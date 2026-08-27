"use client";

import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";

import { useOptionalMacWindowManager } from "./app.tsx";
import { useModalFocusTrap } from "./modal-focus.ts";

type MacWindowModalKind = "alert" | "sheet";

type ModalOwner = {
  readonly element: HTMLElement;
  readonly scope: "desktop" | "window";
};

type SuppressionState = {
  count: number;
  readonly baselineAriaHidden: string | null;
  readonly baselineInert: string | null;
  readonly changedAttributes: Set<"aria-hidden" | "inert">;
  readonly observer: MutationObserver;
};

type ModalOwnerStack = {
  readonly layers: HTMLDivElement[];
  readonly owner: ModalOwner;
  readonly suppressed: Set<HTMLElement>;
  readonly ownerObserver: MutationObserver;
  readonly bodyObserver: MutationObserver | null;
};

const suppressionStates = new WeakMap<HTMLElement, SuppressionState>();
const modalOwnerStacks = new WeakMap<HTMLElement, ModalOwnerStack>();

function recordSuppressionMutations(state: SuppressionState, records: readonly MutationRecord[]) {
  for (const record of records) {
    if (record.attributeName === "aria-hidden" || record.attributeName === "inert") {
      state.changedAttributes.add(record.attributeName);
    }
  }
}

function restoreAttribute(element: HTMLElement, name: "aria-hidden" | "inert", value: string | null) {
  if (value === null) element.removeAttribute(name);
  else element.setAttribute(name, value);
}

function suppress(element: HTMLElement) {
  const existingState = suppressionStates.get(element);
  if (existingState !== undefined) {
    existingState.count += 1;
    return;
  }
  const baselineAriaHidden = element.getAttribute("aria-hidden");
  const baselineInert = element.getAttribute("inert");
  element.setAttribute("inert", "");
  element.setAttribute("aria-hidden", "true");

  const changedAttributes = new Set<"aria-hidden" | "inert">();
  const state: SuppressionState = {
    count: 1,
    baselineAriaHidden,
    baselineInert,
    changedAttributes,
    observer: new MutationObserver((records) => recordSuppressionMutations(state, records)),
  };
  suppressionStates.set(element, state);
  // Start after the suppression writes so only application-owned mutations
  // invalidate our right to roll an attribute back.
  state.observer.observe(element, {
    attributeFilter: ["aria-hidden", "inert"],
    attributes: true,
  });
}

function restore(element: HTMLElement) {
  const state = suppressionStates.get(element);
  if (state === undefined) return;
  state.count -= 1;
  if (state.count > 0) return;
  suppressionStates.delete(element);
  recordSuppressionMutations(state, state.observer.takeRecords());
  state.observer.disconnect();

  // Roll back only values that still belong to this suppression claim. If
  // application code touched an attribute while the modal was open—even if it
  // deliberately wrote the same value—its latest state remains authoritative.
  if (!state.changedAttributes.has("inert") && element.getAttribute("inert") === "") {
    restoreAttribute(element, "inert", state.baselineInert);
  }
  if (!state.changedAttributes.has("aria-hidden") && element.getAttribute("aria-hidden") === "true") {
    restoreAttribute(element, "aria-hidden", state.baselineAriaHidden);
  }
}

function reconcileModalStack(stack: ModalOwnerStack) {
  const topLayer = stack.layers.at(-1);
  const desired = new Set<HTMLElement>();
  for (const child of stack.owner.element.children) {
    if (child instanceof HTMLElement && child !== topLayer) desired.add(child);
  }
  if (stack.owner.scope === "desktop" && stack.owner.element !== document.body) {
    // Keep the ancestor branch containing the portalled modal interactive,
    // while suppressing every sibling alongside that branch. This reaches
    // application chrome beside a nested desktop-canvas without making the
    // application root itself inert.
    let branch: HTMLElement = stack.owner.element;
    while (branch.parentElement !== null && branch.parentElement !== document.body) {
      for (const sibling of branch.parentElement.children) {
        if (sibling instanceof HTMLElement && sibling !== branch) desired.add(sibling);
      }
      branch = branch.parentElement;
    }

    // Body-level portal roots are also part of a desktop modal's underlay.
    for (const child of document.body.children) {
      if (!(child instanceof HTMLElement) || child === branch || child.contains(stack.owner.element)) continue;
      desired.add(child);
    }
  }

  for (const element of stack.suppressed) {
    if (!desired.has(element)) {
      restore(element);
      stack.suppressed.delete(element);
    }
  }
  for (const element of desired) {
    if (!stack.suppressed.has(element)) {
      suppress(element);
      stack.suppressed.add(element);
    }
  }
}

function registerModalLayer(owner: ModalOwner, layer: HTMLDivElement) {
  let stack = modalOwnerStacks.get(owner.element);
  if (stack === undefined) {
    const ownerObserver = new MutationObserver(() => {
      const current = modalOwnerStacks.get(owner.element);
      if (current !== undefined) reconcileModalStack(current);
    });
    const bodyObserver = owner.scope === "desktop" && owner.element !== document.body
      ? new MutationObserver(() => {
          const current = modalOwnerStacks.get(owner.element);
          if (current !== undefined) reconcileModalStack(current);
        })
      : null;
    stack = { layers: [], owner, suppressed: new Set(), ownerObserver, bodyObserver };
    modalOwnerStacks.set(owner.element, stack);
    ownerObserver.observe(owner.element, { childList: true });
    bodyObserver?.observe(document.body, { childList: true, subtree: true });
  }
  stack.layers.push(layer);
  reconcileModalStack(stack);

  return () => {
    const current = modalOwnerStacks.get(owner.element);
    if (current === undefined) return;
    const index = current.layers.lastIndexOf(layer);
    if (index !== -1) current.layers.splice(index, 1);
    if (current.layers.length > 0) {
      reconcileModalStack(current);
      return;
    }
    current.ownerObserver.disconnect();
    current.bodyObserver?.disconnect();
    for (const element of current.suppressed) restore(element);
    current.suppressed.clear();
    modalOwnerStacks.delete(owner.element);
  };
}

const windowSelector = ".mac-window";

function managedKeyWindow(windowId: string | null): HTMLElement | null {
  if (windowId === null) return null;
  return [...document.querySelectorAll<HTMLElement>(".mac-window[data-window-id]")]
    .find((candidate) => candidate.dataset.windowId === windowId) ?? null;
}

function isContentEditableTarget(target: Element) {
  const editingBoundary = target.closest<HTMLElement>("[contenteditable]");
  if (editingBoundary === null) {
    return target instanceof HTMLElement && target.isContentEditable;
  }
  const value = editingBoundary.getAttribute("contenteditable")?.toLowerCase();
  if (value === "false") return false;
  if (value === "" || value === "true" || value === "plaintext-only") return true;
  // Invalid/inherited serialized values are resolved by the platform.
  return editingBoundary.isContentEditable;
}

function resolveModalOwner({
  allowDesktopFallback,
  anchor,
  fallbackFocus,
  keyWindowId,
  presentationScope,
}: {
  readonly allowDesktopFallback: boolean;
  readonly anchor: HTMLElement | null;
  readonly fallbackFocus: HTMLElement | null;
  readonly keyWindowId: string | null;
  readonly presentationScope: "automatic" | "desktop";
}): ModalOwner | null {
  if (presentationScope === "automatic") {
    const nearestWindow = fallbackFocus?.closest<HTMLElement>(windowSelector)
      ?? anchor?.closest<HTMLElement>(windowSelector)
      ?? managedKeyWindow(keyWindowId)
      ?? document.querySelector<HTMLElement>('.mac-window[data-key-window="true"]');
    if (nearestWindow !== null) return { element: nearestWindow, scope: "window" };
  }
  if (!allowDesktopFallback) return null;

  // Alerts from menu-bar apps have no window in their React ancestry. Their
  // deliberate presentation owner is the desktop canvas, not document.body by
  // accident. The body fallback also lets the primitive remain testable and
  // usable outside DesktopShell.
  return {
    element: document.querySelector<HTMLElement>(".desktop-canvas") ?? document.body,
    scope: "desktop",
  };
}

function ModalLayer({
  ariaDescribedBy,
  ariaLabel,
  ariaLabelledBy,
  children,
  className,
  dialogRef,
  fallbackFocusRef,
  initialFocusSelector,
  kind,
  onCancel,
  onDefault,
  owner,
  role,
}: {
  readonly ariaDescribedBy?: string;
  readonly ariaLabel?: string;
  readonly ariaLabelledBy?: string;
  readonly children: ReactNode;
  readonly className: string;
  readonly dialogRef: RefObject<HTMLElement | null>;
  readonly fallbackFocusRef?: RefObject<HTMLElement | null>;
  readonly initialFocusSelector?: string;
  readonly kind: MacWindowModalKind;
  readonly onCancel?: () => void;
  readonly onDefault?: () => void;
  readonly owner: ModalOwner;
  readonly role: "alertdialog" | "dialog";
}) {
  const layerRef = useRef<HTMLDivElement>(null);
  const handleFocusTrapKeyDown = useModalFocusTrap({
    dialogRef,
    fallbackFocusRef,
    ...(initialFocusSelector === undefined ? {} : { initialFocusSelector }),
    ownerElement: owner.element,
    onCancel: onCancel ?? (() => {}),
  });

  useEffect(() => {
    const layer = layerRef.current;
    if (layer === null) return;
    return registerModalLayer(owner, layer);
  }, [owner]);

  function handleKeyDown(event: ReactKeyboardEvent<HTMLElement>) {
    const target = event.target instanceof Element ? event.target : null;
    const consumesReturn = target !== null && (
      target.closest("a[href], button, select, textarea") instanceof HTMLElement
      || isContentEditableTarget(target)
    );
    if (event.key === "Enter" && !event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey && !consumesReturn && onDefault !== undefined) {
      event.preventDefault();
      event.stopPropagation();
      onDefault();
      return;
    }
    handleFocusTrapKeyDown(event);
  }

  return (
    <div
      ref={layerRef}
      className={`mc-window-modal-layer mc-window-modal-layer-${kind} mc-window-modal-layer-${owner.scope}`}
      data-modal-kind={kind}
      data-modal-scope={owner.scope}
    >
      <div className="mc-window-modal-scrim" role="presentation" />
      <section
        ref={dialogRef}
        className={className}
        tabIndex={-1}
        role={role}
        aria-modal="true"
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        aria-describedby={ariaDescribedBy}
        onKeyDown={handleKeyDown}
      >
        {children}
      </section>
    </div>
  );
}

/** Internal presentation substrate shared by MacSheet and MacAlert. */
export function MacWindowModalHost({
  allowDesktopFallback = false,
  ariaDescribedBy,
  ariaLabel,
  ariaLabelledBy,
  children,
  className,
  fallbackFocusRef,
  initialFocusSelector,
  kind,
  onCancel,
  onDefault,
  open,
  presentationScope = "automatic",
  role,
}: {
  readonly allowDesktopFallback?: boolean;
  readonly ariaDescribedBy?: string;
  readonly ariaLabel?: string;
  readonly ariaLabelledBy?: string;
  readonly children: ReactNode;
  readonly className: string;
  readonly fallbackFocusRef?: RefObject<HTMLElement | null>;
  readonly initialFocusSelector?: string;
  readonly kind: MacWindowModalKind;
  readonly onCancel?: () => void;
  readonly onDefault?: () => void;
  readonly open: boolean;
  readonly presentationScope?: "automatic" | "desktop";
  readonly role: "alertdialog" | "dialog";
}) {
  const anchorRef = useRef<HTMLSpanElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const manager = useOptionalMacWindowManager();
  const [owner, setOwner] = useState<ModalOwner | null>(null);

  useEffect(() => {
    if (!open) {
      setOwner(null);
      return;
    }
    setOwner(resolveModalOwner({
      allowDesktopFallback,
      anchor: anchorRef.current,
      fallbackFocus: fallbackFocusRef?.current ?? null,
      keyWindowId: manager?.keyWindowId ?? null,
      presentationScope,
    }));
  }, [allowDesktopFallback, fallbackFocusRef, manager?.keyWindowId, open, presentationScope]);

  return (
    <>
      <span ref={anchorRef} className="mc-window-modal-anchor" aria-hidden="true" />
      {!open || owner === null ? null : createPortal(
        <ModalLayer
          ariaDescribedBy={ariaDescribedBy}
          ariaLabel={ariaLabel}
          ariaLabelledBy={ariaLabelledBy}
          className={className}
          dialogRef={dialogRef}
          fallbackFocusRef={fallbackFocusRef}
          initialFocusSelector={initialFocusSelector}
          kind={kind}
          onCancel={onCancel}
          onDefault={onDefault}
          owner={owner}
          role={role}
        >
          {children}
        </ModalLayer>,
        owner.element,
      )}
    </>
  );
}
