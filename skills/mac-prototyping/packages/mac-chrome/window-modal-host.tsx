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

const windowSelector = ".mac-window";

function managedKeyWindow(windowId: string | null): HTMLElement | null {
  if (windowId === null) return null;
  return [...document.querySelectorAll<HTMLElement>(".mac-window[data-window-id]")]
    .find((candidate) => candidate.dataset.windowId === windowId) ?? null;
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
    onCancel: onCancel ?? (() => {}),
  });

  useEffect(() => {
    const layer = layerRef.current;
    if (layer === null) return;
    const previous = new Map<HTMLElement, { readonly ariaHidden: string | null; readonly inert: boolean }>();

    function suppress(element: HTMLElement) {
      if (element === layer || previous.has(element)) return;
      previous.set(element, {
        ariaHidden: element.getAttribute("aria-hidden"),
        inert: element.hasAttribute("inert"),
      });
      element.setAttribute("inert", "");
      element.setAttribute("aria-hidden", "true");
    }

    function suppressCurrentUnderlay() {
      for (const child of owner.element.children) {
        if (child instanceof HTMLElement && child !== layer) suppress(child);
      }
      if (owner.scope !== "desktop" || owner.element === document.body) return;

      // React Aria and similar overlay systems portal menus/popovers into
      // body-level containers outside DesktopShell. A desktop-modal alert owns
      // the whole faux system, so those sibling portal roots are underlay too.
      for (const child of document.body.children) {
        if (!(child instanceof HTMLElement)) continue;
        if (child.contains(owner.element) || child.contains(layer)) continue;
        suppress(child);
      }
    }

    suppressCurrentUnderlay();
    const ownerObserver = new MutationObserver(suppressCurrentUnderlay);
    ownerObserver.observe(owner.element, { childList: true });
    const bodyObserver = owner.scope === "desktop" && owner.element !== document.body
      ? new MutationObserver(suppressCurrentUnderlay)
      : null;
    bodyObserver?.observe(document.body, { childList: true });

    return () => {
      ownerObserver.disconnect();
      bodyObserver?.disconnect();
      for (const [element, state] of previous) {
        if (state.inert) element.setAttribute("inert", "");
        else element.removeAttribute("inert");
        if (state.ariaHidden === null) element.removeAttribute("aria-hidden");
        else element.setAttribute("aria-hidden", state.ariaHidden);
      }
    };
  }, [owner]);

  function handleKeyDown(event: ReactKeyboardEvent<HTMLElement>) {
    const target = event.target instanceof HTMLElement ? event.target : null;
    const consumesReturn = target?.closest("button, select, textarea, [contenteditable='true']") !== null;
    if (event.key === "Enter" && !event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey && !consumesReturn && onDefault !== undefined) {
      event.preventDefault();
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
