"use client";

import { useId, type ReactNode, type RefObject } from "react";

import { MacButton, type MacButtonVariant } from "./controls.tsx";
import { MacWindowModalHost } from "./window-modal-host.tsx";
import "./styles/presentation.css";

export type MacDialogActionRole = "cancel" | "destructive";
export type MacAlertPresentationScope = "automatic" | "desktop";

/** Shared action model for attached sheets and alerts. */
export type MacDialogAction = {
  readonly id: string;
  readonly label: string;
  readonly role?: MacDialogActionRole;
  /** Default-key prominence and behavior are independent of semantic role. */
  readonly isDefault?: boolean;
  readonly disabled?: boolean;
  readonly onPress?: () => void;
};

/** @deprecated Use MacDialogActionRole. The `default` role remains accepted for compatibility. */
export type MacAlertActionRole = MacDialogActionRole | "default";

/** @deprecated Use MacDialogAction and express prominence with `isDefault`. */
export type MacAlertAction = Omit<MacDialogAction, "role"> & {
  readonly role?: MacAlertActionRole;
};

type CompatibleDialogAction = MacDialogAction | MacAlertAction;

function actionIsDefault(action: CompatibleDialogAction): boolean {
  return action.isDefault === true || action.role === "default";
}

function orderedActions(actions: readonly CompatibleDialogAction[]): readonly CompatibleDialogAction[] {
  return actions
    .map((action, index) => ({ action, index }))
    .sort((left, right) => {
      const priority = (action: CompatibleDialogAction) => actionIsDefault(action) ? 2 : action.role === "cancel" ? 1 : 0;
      return priority(left.action) - priority(right.action) || left.index - right.index;
    })
    .map(({ action }) => action);
}

function DialogActions({ actions, onClose }: {
  readonly actions: readonly CompatibleDialogAction[];
  readonly onClose: () => void;
}) {
  function perform(action: CompatibleDialogAction) {
    if (action.disabled === true) return;
    action.onPress?.();
    onClose();
  }

  return (
    <div className="mc-dialog-actions">
      {orderedActions(actions).map((action) => {
        const isDefault = actionIsDefault(action);
        const isDestructive = action.role === "destructive";
        const variant: MacButtonVariant = isDefault ? "primary" : isDestructive ? "destructive" : "regular";
        return (
          <MacButton
            key={action.id}
            className={`mc-dialog-action${isDefault ? " mc-dialog-action-default" : ""}${isDestructive ? " mc-dialog-action-destructive" : ""}${action.role === "cancel" ? " mc-dialog-action-cancel" : ""}`}
            variant={variant}
            disabled={action.disabled}
            onPress={() => perform(action)}
          >
            {action.label}
          </MacButton>
        );
      })}
    </div>
  );
}

function enabledAction(actions: readonly CompatibleDialogAction[], predicate: (action: CompatibleDialogAction) => boolean) {
  return actions.find((action) => action.disabled !== true && predicate(action));
}

function performAndClose(action: CompatibleDialogAction | undefined, onClose: () => void) {
  if (action === undefined) return;
  action.onPress?.();
  onClose();
}

/**
 * A compact window-attached sheet with owned title, body, and action regions.
 * Sheets intentionally require a window owner; alerts additionally support a
 * desktop presentation for menu-bar apps.
 */
export function MacSheet({
  actions,
  children,
  fallbackFocusRef,
  initialFocusSelector,
  onClose,
  open,
  title,
}: {
  readonly actions: readonly MacDialogAction[];
  readonly children: ReactNode;
  readonly fallbackFocusRef?: RefObject<HTMLElement | null>;
  readonly initialFocusSelector?: string;
  readonly onClose: () => void;
  readonly open: boolean;
  readonly title: string;
}) {
  const titleId = useId();
  const bodyId = useId();
  const cancelAction = enabledAction(actions, (action) => action.role === "cancel");
  const defaultAction = enabledAction(actions, actionIsDefault);
  const resolvedInitialFocus = initialFocusSelector
    ?? (defaultAction === undefined ? ".mc-dialog-action-cancel:not([disabled]), .mc-dialog-action:not([disabled])" : ".mc-dialog-action-default:not([disabled])");

  return (
    <MacWindowModalHost
      ariaDescribedBy={bodyId}
      ariaLabelledBy={titleId}
      className="mc-sheet"
      fallbackFocusRef={fallbackFocusRef}
      initialFocusSelector={resolvedInitialFocus}
      kind="sheet"
      onCancel={cancelAction === undefined ? undefined : () => performAndClose(cancelAction, onClose)}
      onDefault={defaultAction === undefined ? undefined : () => performAndClose(defaultAction, onClose)}
      open={open}
      role="dialog"
    >
      <header className="mc-sheet-header"><h2 id={titleId}>{title}</h2></header>
      <div className="mc-sheet-body" id={bodyId}>{children}</div>
      <footer className="mc-sheet-footer"><DialogActions actions={actions} onClose={onClose} /></footer>
    </MacWindowModalHost>
  );
}

/**
 * Backwards-compatible freeform sheet. Prefer MacSheet so title, body, actions,
 * default-key behavior, and native spacing are provided by the system.
 */
export function Sheet({
  children,
  fallbackFocusRef,
  initialFocusSelector,
  label,
  onClose,
  open,
}: {
  readonly children: ReactNode;
  readonly fallbackFocusRef?: RefObject<HTMLElement | null>;
  readonly initialFocusSelector?: string;
  readonly label?: string;
  readonly onClose: () => void;
  readonly open: boolean;
}) {
  return (
    <MacWindowModalHost
      ariaLabel={label}
      className="mc-sheet mc-sheet-legacy"
      fallbackFocusRef={fallbackFocusRef}
      initialFocusSelector={initialFocusSelector}
      kind="sheet"
      onCancel={onClose}
      open={open}
      role="dialog"
    >
      {children}
    </MacWindowModalHost>
  );
}

/** A compact status area attached to the bottom of a window. */
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

/** A native-style alert owned by the active window or, for menu-bar apps, the desktop. */
export function MacAlert({
  actions,
  applicationName,
  fallbackFocusRef,
  icon,
  message,
  onClose,
  open,
  presentationScope = "automatic",
  title,
}: {
  readonly actions: readonly CompatibleDialogAction[];
  readonly applicationName?: string;
  readonly fallbackFocusRef?: RefObject<HTMLElement | null>;
  readonly icon?: ReactNode;
  readonly message: ReactNode;
  readonly onClose: () => void;
  readonly open: boolean;
  /** Use `desktop` for a menu-bar app so an unrelated key window is never selected. */
  readonly presentationScope?: MacAlertPresentationScope;
  readonly title: string;
}) {
  const titleId = useId();
  const messageId = useId();
  const cancelAction = enabledAction(actions, (action) => action.role === "cancel");
  const defaultAction = enabledAction(actions, actionIsDefault);
  return (
    <MacWindowModalHost
      allowDesktopFallback
      ariaDescribedBy={messageId}
      ariaLabelledBy={titleId}
      className={`mc-alert${icon === undefined ? " mc-alert-no-icon" : ""}`}
      fallbackFocusRef={fallbackFocusRef}
      initialFocusSelector={defaultAction === undefined ? ".mc-dialog-action-cancel:not([disabled]), .mc-dialog-action:not([disabled])" : ".mc-dialog-action-default:not([disabled])"}
      kind="alert"
      onCancel={cancelAction === undefined ? undefined : () => performAndClose(cancelAction, onClose)}
      onDefault={defaultAction === undefined ? undefined : () => performAndClose(defaultAction, onClose)}
      open={open}
      presentationScope={presentationScope}
      role="alertdialog"
    >
      {icon === undefined ? null : <div className="mc-alert-icon" aria-hidden="true">{icon}</div>}
      <div className="mc-alert-copy">
        {applicationName === undefined ? null : <div className="mc-alert-application">{applicationName}</div>}
        <h2 id={titleId}>{title}</h2>
        <div className="mc-alert-message" id={messageId}>{message}</div>
      </div>
      <footer className="mc-alert-footer"><DialogActions actions={actions} onClose={onClose} /></footer>
    </MacWindowModalHost>
  );
}
