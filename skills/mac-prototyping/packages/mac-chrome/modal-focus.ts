"use client";

import { type KeyboardEvent as ReactKeyboardEvent, type RefObject, useEffect, useRef } from "react";

const focusableSelector = 'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])';

export function useModalFocusTrap({
  dialogRef,
  fallbackFocusRef,
  focusVersion,
  initialFocusSelector = focusableSelector,
  onCancel,
}: {
  readonly dialogRef: RefObject<HTMLElement | null>;
  readonly fallbackFocusRef?: RefObject<HTMLElement | null>;
  readonly focusVersion?: string;
  readonly initialFocusSelector?: string;
  readonly onCancel: () => void;
}) {
  const openerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    return () => {
      // An explicit fallback is the caller's stable return target (for
      // example, a menu-bar status item). Overlay libraries may restore focus
      // to a still-connected but transient opener while the modal mounts, so
      // connectedness alone must not outrank that explicit policy.
      const fallbackTarget = fallbackFocusRef?.current;
      const target = fallbackTarget?.isConnected ? fallbackTarget : openerRef.current?.isConnected ? openerRef.current : null;
      window.requestAnimationFrame(() => target?.focus());
    };
  }, [fallbackFocusRef]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      dialogRef.current?.querySelector<HTMLElement>(initialFocusSelector)?.focus();
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
      dialogRef.current?.querySelector<HTMLElement>(initialFocusSelector)?.focus();
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
