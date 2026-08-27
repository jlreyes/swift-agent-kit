"use client";

import { type KeyboardEvent as ReactKeyboardEvent, type RefObject, useEffect, useRef } from "react";

const focusableSelector = 'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])';
const modalOwnerSelector = ".mac-window, .desktop-canvas";

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
    (topDialog.querySelector<HTMLElement>(focusableSelector) ?? topDialog).focus();
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
      (dialog.querySelector<HTMLElement>(initialFocusSelector) ?? dialog).focus();
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
    const controls = [...(dialogRef.current?.querySelectorAll<HTMLElement>(focusableSelector) ?? [])];
    const first = controls[0];
    const last = controls.at(-1);
    if (!first || !last) {
      event.preventDefault();
      const dialog = dialogRef.current;
      if (dialog !== null) (dialog.querySelector<HTMLElement>(initialFocusSelector) ?? dialog).focus();
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
