"use client";

import { useLayoutEffect, useRef, type FocusEvent, type PointerEvent } from "react";

type ModalOrigin = {
  readonly control: HTMLElement;
  readonly dialog: HTMLElement;
  readonly owner: HTMLElement;
};

const ownerSelector = ".mac-window, .desktop-canvas";
const menuSelector = ".menu-left, .mc-menubar-menu-popover";
const controlSelector = "button, input, select, textarea, a[href], [contenteditable], [tabindex]";

function available(element: HTMLElement): boolean {
  if (!element.isConnected || element.matches(":disabled")) return false;
  for (let ancestor: HTMLElement | null = element; ancestor !== null; ancestor = ancestor.parentElement) {
    if (ancestor.hidden || ancestor.hasAttribute("inert") || ancestor.getAttribute("aria-hidden") === "true" || ancestor.getAttribute("aria-disabled") === "true") return false;
    const style = window.getComputedStyle(ancestor);
    if (style.display === "none" || style.visibility === "hidden" || style.visibility === "collapse" || style.contentVisibility === "hidden") return false;
  }
  return true;
}

function modalOrigin(control: EventTarget | null): ModalOrigin | null {
  if (!(control instanceof HTMLElement) || !available(control)) return null;
  const dialog = control.closest<HTMLElement>('[aria-modal="true"]');
  const owner = dialog?.closest<HTMLElement>(ownerSelector);
  return dialog === null || dialog === undefined || owner === null || owner === undefined ? null : { control, dialog, owner };
}

function returnTarget(origin: ModalOrigin | null): HTMLElement | null {
  if (origin === null || !origin.dialog.isConnected || !available(origin.owner)) return null;
  const topDialog = [...origin.owner.querySelectorAll<HTMLElement>('[aria-modal="true"]')]
    .filter((dialog) => dialog.closest(ownerSelector) === origin.owner && available(dialog)).at(-1);
  if (topDialog === undefined) return null;
  const active = document.activeElement;
  if (active instanceof HTMLElement && topDialog.contains(active) && available(active)) return active;
  if (topDialog.contains(origin.control) && available(origin.control)) return origin.control;
  return [...topDialog.querySelectorAll<HTMLElement>(controlSelector)]
    .find((control) => control.tabIndex >= 0 && available(control)) ?? topDialog;
}

export function useMenuModalFocusReturn(open: boolean) {
  const originRef = useRef<ModalOrigin | null>(null);
  const wasOpenRef = useRef(false);
  const pointerDismissRef = useRef(false);

  useLayoutEffect(() => {
    const wasOpen = wasOpenRef.current;
    wasOpenRef.current = open;
    if (open || !wasOpen) return;
    const origin = originRef.current;
    originRef.current = null;
    const pointerDismiss = pointerDismissRef.current;
    pointerDismissRef.current = false;
    function restore() {
      const target = returnTarget(origin);
      const active = document.activeElement;
      if (target === null) return;
      if (active instanceof HTMLElement && active !== document.body && available(active)
        && active.closest(menuSelector) === null && active.closest('[aria-modal="true"]') !== target.closest('[aria-modal="true"]')) return;
      target.focus({ preventScroll: true });
    }
    if (!pointerDismiss) {
      restore();
      return;
    }
    const frame = window.requestAnimationFrame(restore);
    return () => window.cancelAnimationFrame(frame);
  }, [open]);

  function capture(control: EventTarget | null, menuBar: HTMLElement) {
    if (!open && !(control instanceof Node && menuBar.contains(control))) originRef.current = modalOrigin(control);
  }

  return {
    onPointerDownCapture: (event: PointerEvent<HTMLElement>) => capture(document.activeElement, event.currentTarget),
    onFocusCapture: (event: FocusEvent<HTMLElement>) => capture(event.relatedTarget, event.currentTarget),
    hasModalReturnTarget: () => returnTarget(originRef.current) !== null,
    dismissFromPointer: (target: Element) => {
      pointerDismissRef.current = true;
      const origin = originRef.current;
      if (origin === null) return;
      const window = target.closest(".mac-window");
      const control = target.closest<HTMLElement>(controlSelector);
      if ((window !== null && window !== origin.owner) || (control !== null && !origin.owner.contains(control) && available(control))) {
        originRef.current = null;
      }
    },
  };
}
