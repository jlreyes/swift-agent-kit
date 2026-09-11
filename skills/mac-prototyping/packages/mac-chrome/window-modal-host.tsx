"use client";

import {
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";

import { useOptionalMacWindowManager } from "./app.tsx";
import { useEmbeddedPresentation } from "./embedded-presentation.tsx";
import { useModalFocusTrap } from "./modal-focus.ts";

type MacWindowModalKind = "alert" | "sheet";

type ModalOwner = {
  readonly element: HTMLElement;
  readonly boundary: HTMLElement;
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
  if (stack.owner.scope === "desktop" && stack.owner.element !== stack.owner.boundary) {
    // Keep the ancestor branch containing the portalled modal interactive,
    // while suppressing every sibling alongside that branch. This reaches
    // application chrome beside a nested desktop-canvas without making the
    // application root itself inert.
    let branch: HTMLElement = stack.owner.element;
    while (branch.parentElement !== null && branch.parentElement !== stack.owner.boundary) {
      for (const sibling of branch.parentElement.children) {
        if (sibling instanceof HTMLElement && sibling !== branch) desired.add(sibling);
      }
      branch = branch.parentElement;
    }

    // Portal roots within the presentation boundary also belong to the underlay.
    for (const child of stack.owner.boundary.children) {
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
    const bodyObserver = owner.scope === "desktop" && owner.element !== owner.boundary
      ? new MutationObserver(() => {
          const current = modalOwnerStacks.get(owner.element);
          if (current !== undefined) reconcileModalStack(current);
        })
      : null;
    stack = { layers: [], owner, suppressed: new Set(), ownerObserver, bodyObserver };
    modalOwnerStacks.set(owner.element, stack);
    ownerObserver.observe(owner.element, { childList: true });
    bodyObserver?.observe(owner.boundary, { childList: true, subtree: true });
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

function managedKeyWindow(windowId: string | null, root: Document | HTMLElement): HTMLElement | null {
  if (windowId === null) return null;
  return [...root.querySelectorAll<HTMLElement>(".mac-window[data-window-id]")]
    .find((candidate) => candidate.dataset.windowId === windowId) ?? null;
}

export function isContentEditableTarget(target: Element) {
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
  root,
}: {
  readonly root: Document | HTMLElement;
  readonly allowDesktopFallback: boolean;
  readonly anchor: HTMLElement | null;
  readonly fallbackFocus: HTMLElement | null;
  readonly keyWindowId: string | null;
  readonly presentationScope: "automatic" | "desktop";
}): ModalOwner | null {
  if (presentationScope === "automatic") {
    function windowInRoot(element: HTMLElement | null) {
      const candidate = element?.closest<HTMLElement>(windowSelector) ?? null;
      return candidate !== null && root.contains(candidate) ? candidate : null;
    }
    const nearestWindow = windowInRoot(fallbackFocus)
      ?? windowInRoot(anchor)
      ?? managedKeyWindow(keyWindowId, root)
      ?? root.querySelector<HTMLElement>('.mac-window[data-key-window="true"]');
    if (nearestWindow !== null) return { element: nearestWindow, boundary: nearestWindow, scope: "window" };
  }
  if (!allowDesktopFallback) return null;

  // Alerts from menu-bar apps have no window in their React ancestry. Their
  // deliberate presentation owner is the desktop canvas, not document.body by
  // accident. The body fallback also lets the primitive remain testable and
  // usable outside DesktopShell.
  return {
    element: root.querySelector<HTMLElement>(".desktop-canvas") ?? (root instanceof HTMLElement ? root : document.body),
    boundary: root instanceof HTMLElement ? root : document.body,
    scope: "desktop",
  };
}

type ModalPresentation = {
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
  readonly presentationKey?: string;
  readonly role: "alertdialog" | "dialog";
};

type MotionPhase = "entering" | "open" | "exiting";

function ModalLayer(props: ModalPresentation & {
  readonly open: boolean;
  readonly owner: ModalOwner;
  readonly onExited: () => void;
}) {
  const { owner, kind } = props;
  const requestedKey = props.presentationKey ?? "default";
  const latest = useRef(props);
  const retained = useRef(new Map<string, ModalPresentation>());
  const [activeKey, setActiveKey] = useState(requestedKey);
  const [visibilityVersion, setVisibilityVersion] = useState(0);
  const [phase, setPhase] = useState<MotionPhase>(kind === "sheet" ? "entering" : "open");
  const layerRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const cancelRequested = useRef(false);
  const interruptedTransform = useRef<string | null>(null);
  const focusedControls = useRef(new Map<string, HTMLElement>());
  const resumeFocus = useRef<HTMLElement | null>(null);
  const lastOpenFallback = useRef(props.fallbackFocusRef);
  const returnFocusRef = useRef({ get current() { return lastOpenFallback.current?.current ?? null; } });
  const busy = kind === "sheet" && (phase !== "open" || !props.open || requestedKey !== activeKey);
  const activeProps = props.open && requestedKey === activeKey && phase !== "exiting"
    ? props : retained.current.get(activeKey) ?? props;
  const entries = new Map(retained.current);
  entries.set(activeKey, activeProps);

  useLayoutEffect(() => {
    latest.current = props;
    if (props.open) lastOpenFallback.current = props.fallbackFocusRef;
    retained.current.set(activeKey, activeProps);
  });

  function cancel() {
    if (!latest.current.open || cancelRequested.current) return;
    cancelRequested.current = true;
    latest.current.onCancel?.();
  }

  const handleFocusTrapKeyDown = useModalFocusTrap({
    dialogRef,
    fallbackFocusRef: returnFocusRef.current,
    focusVersion: `${activeKey}:${phase}:${visibilityVersion}`,
    initialFocusRef: busy ? undefined : resumeFocus,
    initialFocusSelector: busy ? ":not(*)" : activeProps.initialFocusSelector,
    ownerElement: owner.element,
    onCancel: cancel,
  });

  useLayoutEffect(() => {
    const layer = layerRef.current;
    if (layer === null) return;
    return registerModalLayer(owner, layer);
  }, [owner]);

  useLayoutEffect(() => {
    const hidden = () => owner.element.closest("[hidden]") !== null || getComputedStyle(owner.element).display === "none";
    let wasHidden = hidden();
    const observer = new MutationObserver(() => {
      const isHidden = hidden();
      if (wasHidden && !isHidden && layerRef.current?.closest('[inert], [aria-hidden="true"]') === null) {
        resumeFocus.current = focusedControls.current.get(activeKey) ?? null;
        setVisibilityVersion((version) => version + 1);
      }
      wasHidden = isHidden;
    });
    observer.observe(owner.element, { attributes: true, attributeFilter: ["hidden", "style"] });
    return () => observer.disconnect();
  }, [activeKey, owner]);

  useLayoutEffect(() => {
    if (kind !== "sheet") {
      if (!props.open) props.onExited();
      return;
    }
    if ((!props.open || requestedKey !== activeKey) && phase !== "exiting") setPhase("exiting");
  }, [activeKey, kind, phase, props.open, props.onExited, requestedKey]);

  useLayoutEffect(() => {
    if (kind !== "sheet" || phase === "open") return;
    const dialog = dialogRef.current;
    if (dialog === null) return;
    let disposed = false;
    const finish = () => {
      if (disposed) return;
      disposed = true;
      if (phase === "entering") {
        cancelRequested.current = false;
        setPhase("open");
      } else if (!latest.current.open) {
        latest.current.onExited();
      } else {
        const nextKey = latest.current.presentationKey ?? "default";
        retained.current.set(nextKey, latest.current);
        resumeFocus.current = focusedControls.current.get(nextKey) ?? null;
        setActiveKey(nextKey);
        cancelRequested.current = false;
        setPhase("entering");
      }
    };
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    const ownerHidden = () => !owner.element.isConnected || owner.element.closest("[hidden]") !== null
      || getComputedStyle(owner.element).display === "none";
    if (reducedMotion?.matches || ownerHidden() || typeof dialog.animate !== "function") {
      finish();
      return;
    }
    const animation = dialog.animate(
      phase === "entering"
        ? [{ transform: "translateY(calc(-100% - 12px))" }, { transform: "translateY(0)" }]
        : [{ transform: interruptedTransform.current ?? getComputedStyle(dialog).transform }, { transform: "translateY(calc(-100% - 12px))" }],
      { duration: phase === "entering" ? 180 : 140, easing: "cubic-bezier(0.2, 0, 0.2, 1)", fill: "both" },
    );
    interruptedTransform.current = null;
    animation.onfinish = finish;
    animation.oncancel = finish;
    const skip = () => { if (reducedMotion?.matches || ownerHidden()) { finish(); animation.cancel(); } };
    reducedMotion?.addEventListener("change", skip);
    const observer = new MutationObserver(skip);
    observer.observe(owner.element, { attributes: true, attributeFilter: ["hidden", "style"] });
    return () => {
      if (!disposed) interruptedTransform.current = getComputedStyle(dialog).transform;
      disposed = true;
      animation.onfinish = null;
      animation.oncancel = null;
      animation.cancel();
      observer.disconnect();
      reducedMotion?.removeEventListener("change", skip);
    };
  }, [activeKey, kind, owner, phase]);

  function handleKeyDown(event: ReactKeyboardEvent<HTMLElement>) {
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest('[aria-modal="true"]') !== dialogRef.current) return;
    event.stopPropagation();
    if (event.defaultPrevented || event.nativeEvent.isComposing) return;
    const consumesReturn = target !== null && (
      target.closest("a[href], button, select, textarea") instanceof HTMLElement
      || isContentEditableTarget(target)
    );
    if (event.key === "Enter" && !event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey && !consumesReturn && activeProps.onDefault !== undefined) {
      event.preventDefault();
      event.stopPropagation();
      activeProps.onDefault();
      return;
    }
    handleFocusTrapKeyDown(event);
  }

  return (
    <div ref={layerRef}
      className={`mc-window-modal-layer mc-window-modal-layer-${kind} mc-window-modal-layer-${owner.scope}`}
      data-modal-kind={kind} data-modal-scope={owner.scope} data-motion-phase={phase}>
      <div className="mc-window-modal-scrim" role="presentation" />
      {[...entries].map(([key, entry]) => {
        const active = key === activeKey;
        return <section key={key} ref={active ? dialogRef : undefined}
          className={entry.className} hidden={!active} inert={!active || undefined}
          data-presentation-key={key} tabIndex={-1} role={entry.role}
          aria-modal={active ? true : undefined} aria-hidden={!active || undefined}
          aria-label={entry.ariaLabel} aria-labelledby={entry.ariaLabelledBy} aria-describedby={entry.ariaDescribedBy}
          onFocusCapture={(event) => {
            if (active && !busy && event.target instanceof HTMLElement && event.target !== dialogRef.current) focusedControls.current.set(key, event.target);
          }}
          onPointerDownCapture={(event) => { if (busy) { event.preventDefault(); event.stopPropagation(); } }}
          onClickCapture={(event) => { if (busy) { event.preventDefault(); event.stopPropagation(); } }}
          onKeyDownCapture={(event) => {
            if (!busy || event.target instanceof Element && event.target.closest('[aria-modal="true"]') !== dialogRef.current) return;
            event.preventDefault(); event.stopPropagation();
            if (event.key === "Escape" && !event.nativeEvent.isComposing && !event.repeat) cancel();
          }}
          onKeyDown={handleKeyDown} onKeyUp={(event) => event.stopPropagation()}>
          <div className="mc-modal-content" inert={active && busy || undefined}>{entry.children}</div>
        </section>;
      })}
    </div>
  );
}

/** Internal presentation substrate shared by MacSheet and MacAlert. */
export function MacWindowModalHost({
  allowDesktopFallback = false,
  open,
  presentationScope = "automatic",
  ...presentation
}: ModalPresentation & {
  readonly allowDesktopFallback?: boolean;
  readonly open: boolean;
  readonly presentationScope?: "automatic" | "desktop";
}) {
  const anchorRef = useRef<HTMLSpanElement>(null);
  const manager = useOptionalMacWindowManager();
  const embeddedPresentation = useEmbeddedPresentation();
  const [owner, setOwner] = useState<ModalOwner | null>(null);

  useLayoutEffect(() => {
    if (!open || owner !== null || embeddedPresentation !== null && embeddedPresentation.portalContainer === null) return;
    setOwner(resolveModalOwner({
      root: embeddedPresentation?.portalContainer ?? document,
      allowDesktopFallback,
      anchor: anchorRef.current,
      fallbackFocus: presentation.fallbackFocusRef?.current ?? null,
      keyWindowId: manager?.keyWindowId ?? null,
      presentationScope,
    }));
  }, [allowDesktopFallback, embeddedPresentation, manager?.keyWindowId, open, owner, presentation.fallbackFocusRef, presentationScope]);

  return <>
    <span ref={anchorRef} className="mc-window-modal-anchor" aria-hidden="true" />
    {owner === null ? null : createPortal(
      <ModalLayer {...presentation} open={open} owner={owner} onExited={() => setOwner(null)} />,
      owner.element,
    )}
  </>;
}
