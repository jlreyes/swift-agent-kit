"use client";

import { useEffect, useId, useRef, useState, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";

import { MacButton } from "./controls.tsx";
import { useModalFocusTrap } from "./modal-focus.ts";
import "./styles/presentation.css";

export type MacAlertActionRole = "default" | "cancel" | "destructive";

export type MacAlertAction = {
  readonly id: string;
  readonly label: string;
  readonly role?: MacAlertActionRole;
  readonly disabled?: boolean;
  readonly onPress?: () => void;
};

/**
 * A compact status area attached to the bottom of a window. This is a window
 * status bar, not AppKit's NSStatusBar (which owns menu-bar status items).
 */
export function MacWindowStatusBar({ children, className = "", live, trailing }: {
  readonly children: ReactNode;
  readonly className?: string;
  readonly live?: "polite" | "assertive";
  readonly trailing?: ReactNode;
}) {
  return (
    <footer className={`mc-window-status-bar ${className}`} role={live === undefined ? undefined : "status"} aria-live={live}>
      <span className="mc-window-status-primary">{children}</span>
      {trailing === undefined ? null : <span className="mc-window-status-trailing">{trailing}</span>}
    </footer>
  );
}

/** A window-modal macOS-style alert with default/cancel/destructive actions. */
export function MacAlert({ actions, fallbackFocusRef, icon, message, onClose, open, title }: {
  readonly actions: readonly MacAlertAction[];
  readonly fallbackFocusRef?: RefObject<HTMLElement | null>;
  readonly icon?: ReactNode;
  readonly message: ReactNode;
  readonly onClose: () => void;
  readonly open: boolean;
  readonly title: string;
}) {
  const anchorRef = useRef<HTMLSpanElement>(null);
  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => {
    if (!open) {
      setHost(null);
      return;
    }
    setHost(fallbackFocusRef?.current?.closest<HTMLElement>(".mac-window") ?? anchorRef.current?.closest<HTMLElement>(".mac-window") ?? document.body);
  }, [fallbackFocusRef, open]);
  if (!open) return null;
  return (
    <>
      <span ref={anchorRef} className="mc-alert-anchor" aria-hidden="true" />
      {host === null ? null : createPortal(
        <MacAlertDialog
          actions={actions}
          fallbackFocusRef={fallbackFocusRef}
          icon={icon}
          message={message}
          onClose={onClose}
          title={title}
        />,
        host,
      )}
    </>
  );
}

function MacAlertDialog({ actions, fallbackFocusRef, icon, message, onClose, title }: {
  readonly actions: readonly MacAlertAction[];
  readonly fallbackFocusRef?: RefObject<HTMLElement | null>;
  readonly icon?: ReactNode;
  readonly message: ReactNode;
  readonly onClose: () => void;
  readonly title: string;
}) {
  const dialogRef = useRef<HTMLElement>(null);
  const titleId = useId();
  const messageId = useId();
  const cancelAction = actions.find((action) => action.role === "cancel" && action.disabled !== true);
  const defaultAction = actions.find((action) => (action.role ?? "default") === "default" && action.disabled !== true);

  function perform(action: MacAlertAction) {
    if (action.disabled) return;
    action.onPress?.();
    onClose();
  }

  const handleKeyDown = useModalFocusTrap({
    dialogRef,
    fallbackFocusRef,
    initialFocusSelector: defaultAction === undefined ? ".mc-alert-action-cancel:not([disabled]), button:not([disabled])" : ".mc-alert-action-default:not([disabled])",
    onCancel: () => {
      cancelAction?.onPress?.();
      onClose();
    },
  });

  return (
    <div className="mc-alert-scrim" role="presentation">
      <section className="mc-alert" role="alertdialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={messageId} ref={dialogRef} onKeyDown={handleKeyDown}>
        {icon === undefined ? null : <div className="mc-alert-icon" aria-hidden="true">{icon}</div>}
        <div className="mc-alert-copy">
          <h2 id={titleId}>{title}</h2>
          <div id={messageId}>{message}</div>
        </div>
        <div className="mc-alert-actions">
          {actions.map((action) => {
            const role = action.role ?? "default";
            return (
              <MacButton
                key={action.id}
                className={`mc-alert-action-${role}`}
                variant={role === "default" ? "primary" : role === "destructive" ? "destructive" : "regular"}
                disabled={action.disabled}
                onPress={() => perform(action)}
              >
                {action.label}
              </MacButton>
            );
          })}
        </div>
      </section>
    </div>
  );
}
