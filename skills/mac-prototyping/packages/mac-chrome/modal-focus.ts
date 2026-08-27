"use client";

import { type KeyboardEvent as ReactKeyboardEvent, type RefObject, useEffect, useRef } from "react";

const focusableSelector = "button, input, select, textarea, a[href], summary, [contenteditable='true'], [tabindex]";
const modalOwnerSelector = ".mac-window, .desktop-canvas";

function hasHiddenOrInertAncestor(element: HTMLElement, boundary: HTMLElement): boolean {
  let current: HTMLElement | null = element;
  while (current !== null) {
    if (current.hidden || current.hasAttribute("inert") || current.getAttribute("aria-hidden") === "true") return true;
    const style = window.getComputedStyle(current);
    if (style.display === "none" || style.visibility === "hidden" || style.visibility === "collapse" || style.contentVisibility === "hidden") return true;
    if (current === boundary) return false;
    current = current.parentElement;
  }
  return true;
}

function isTabbable(element: HTMLElement, boundary: HTMLElement): boolean {
  if (!element.isConnected || !boundary.contains(element)) return false;
  if (element.matches(":disabled") || element.getAttribute("aria-disabled") === "true") return false;
  if (element instanceof HTMLInputElement && element.type === "hidden") return false;
  if (element.tabIndex < 0) return false;
  return !hasHiddenOrInertAncestor(element, boundary);
}

function tabbableElements(boundary: HTMLElement, selector = focusableSelector): readonly HTMLElement[] {
  return [...boundary.querySelectorAll<HTMLElement>(selector)].filter((element) => isTabbable(element, boundary));
}

function focusInitialElement(boundary: HTMLElement, initialFocusSelector: string) {
  const requested = tabbableElements(boundary, initialFocusSelector)[0];
  (requested ?? tabbableElements(boundary)[0] ?? boundary).focus();
}

function containingModalOwner(dialog: HTMLElement): HTMLElement | null {
  return dialog.closest<HTMLElement>(modalOwnerSelector)
    ?? dialog.closest<HTMLElement>(".mc-window-modal-layer")?.parentElement
    ?? dialog.parentElement;
}

function activeModalDialogs(ownerElement: HTMLElement | null) {
  if (ownerElement === null) return [];
  return [...ownerElement.querySelectorAll<HTMLElement>('[aria-modal="true"]')]
    .filter((dialog) => (
      containingModalOwner(dialog) === ownerElement
      && dialog.closest('[inert], [aria-hidden="true"]') === null
    ));
}

function focusTargetOrActiveModal(target: HTMLElement | null, ownerElement: HTMLElement | null) {
  const activeDialogs = activeModalDialogs(ownerElement);
  if (target !== null && activeDialogs.some((dialog) => dialog === target || dialog.contains(target))) {
    target.focus();
    return;
  }
  const topDialog = activeDialogs.at(-1);
  if (topDialog !== undefined) {
    (tabbableElements(topDialog)[0] ?? topDialog).focus();
    return;
  }
  target?.focus();
}

export function useModalFocusTrap({
  dialogRef,
  fallbackFocusRef,
  focusVersion,
  initialFocusSelector = focusableSelector,
  ownerElement,
  onCancel,
}: {
  readonly dialogRef: RefObject<HTMLElement | null>;
  readonly fallbackFocusRef?: RefObject<HTMLElement | null>;
  readonly focusVersion?: string;
  readonly initialFocusSelector?: string;
  /** Limits stacked-modal focus ownership to one window or desktop canvas. */
  readonly ownerElement?: HTMLElement;
  readonly onCancel: () => void;
}) {
  const openerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const resolvedOwner = ownerElement ?? (dialogRef.current === null ? null : containingModalOwner(dialogRef.current));
    openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    return () => {
      // An explicit fallback is the caller's stable return target (for
      // example, a menu-bar status item). Overlay libraries may restore focus
      // to a still-connected but transient opener while the modal mounts, so
      // connectedness alone must not outrank that explicit policy.
      const fallbackTarget = fallbackFocusRef?.current;
      const target = fallbackTarget?.isConnected ? fallbackTarget : openerRef.current?.isConnected ? openerRef.current : null;
      // Closing a lower layer must not return focus into its underlay while a
      // newer modal remains active. In that case the active modal owns focus.
      window.requestAnimationFrame(() => focusTargetOrActiveModal(target, resolvedOwner));
    };
  }, [fallbackFocusRef, ownerElement]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const dialog = dialogRef.current;
      if (dialog === null) return;
      focusInitialElement(dialog, initialFocusSelector);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [dialogRef, focusVersion, initialFocusSelector]);

  return function handleModalKeyDown(event: ReactKeyboardEvent<HTMLElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      onCancel();
      return;
    }
    if (event.key !== "Tab") return;
    const dialog = dialogRef.current;
    const controls = dialog === null ? [] : tabbableElements(dialog);
    const first = controls[0];
    const last = controls.at(-1);
    if (!first || !last) {
      event.preventDefault();
      if (dialog !== null) focusInitialElement(dialog, initialFocusSelector);
      return;
    }
    if (!(document.activeElement instanceof HTMLElement) || !controls.includes(document.activeElement)) {
      event.preventDefault();
      (event.shiftKey ? last : first).focus();
      return;
    }
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };
}
