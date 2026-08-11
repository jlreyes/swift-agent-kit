"use client";

import { useRef, type ReactNode, type RefObject } from "react";

import { useModalFocusTrap } from "./modal-focus";
import { SystemSymbol, type SystemSymbolName } from "./system-symbol";
import { TrafficLights, WindowChrome } from "./window";
import "./styles/tokens.css";
import "./styles/setup-assistant.css";

export type SetupStep = {
  readonly id: string;
  readonly name: string;
  readonly symbol?: SystemSymbolName;
};

// Generic sheet presentation: scrim + top-attached dialog with a modal focus
// trap. Content (including any footer buttons) is the caller's.
export function Sheet({
  open,
  onClose,
  label,
  fallbackFocusRef,
  initialFocusSelector,
  children,
}: {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly label?: string;
  readonly fallbackFocusRef?: RefObject<HTMLElement | null>;
  readonly initialFocusSelector?: string;
  readonly children: ReactNode;
}) {
  if (!open) return null;
  return (
    <SheetDialog onClose={onClose} label={label} fallbackFocusRef={fallbackFocusRef} initialFocusSelector={initialFocusSelector}>
      {children}
    </SheetDialog>
  );
}

function SheetDialog({
  onClose,
  label,
  fallbackFocusRef,
  initialFocusSelector,
  children,
}: {
  readonly onClose: () => void;
  readonly label?: string;
  readonly fallbackFocusRef?: RefObject<HTMLElement | null>;
  readonly initialFocusSelector?: string;
  readonly children: ReactNode;
}) {
  const dialogRef = useRef<HTMLElement>(null);
  const handleKeyDown = useModalFocusTrap({
    dialogRef,
    fallbackFocusRef,
    ...(initialFocusSelector !== undefined ? { initialFocusSelector } : {}),
    onCancel: onClose,
  });
  return (
    <div className="mc-sheet-scrim" role="presentation">
      <section className="mc-sheet" role="dialog" aria-modal="true" aria-label={label} ref={dialogRef} onKeyDown={handleKeyDown}>
        {children}
      </section>
    </div>
  );
}

// Generic step heading (hero symbol + title) for step bodies that want the
// standard look; entirely optional.
export function SetupHeading({ symbol, title }: { readonly symbol?: SystemSymbolName; readonly title: string }) {
  return (
    <header className="mc-setup-heading">
      {symbol !== undefined ? <SystemSymbol className="mc-setup-hero-symbol" name={symbol} /> : null}
      <h1>{title}</h1>
    </header>
  );
}

export function SetupAssistant({
  steps,
  currentStep,
  furthestIndex,
  onSelectStep,
  onBack,
  backLabel = "Back",
  onContinue,
  continueLabel = "Continue",
  continueDisabled = false,
  // While a Sheet is up the underlay goes inert so the trap is airtight.
  modalOpen = false,
  label,
  children,
}: {
  readonly steps: readonly SetupStep[];
  readonly currentStep: string;
  readonly furthestIndex: number;
  readonly onSelectStep: (id: string) => void;
  readonly onBack: () => void;
  readonly backLabel?: string;
  readonly onContinue: () => void;
  readonly continueLabel?: string;
  readonly continueDisabled?: boolean;
  readonly modalOpen?: boolean;
  readonly label?: string;
  readonly children: ReactNode;
}) {
  const currentIndex = steps.findIndex((step) => step.id === currentStep);
  const currentName = currentIndex >= 0 ? steps[currentIndex]?.name : undefined;

  return (
    <WindowChrome className="mc-setup-window" label={label ?? "Setup Assistant"}>
      <div className="mc-setup-titlebar">
        <TrafficLights />
      </div>
      <div className="mc-setup-underlay" inert={modalOpen ? true : undefined} aria-hidden={modalOpen || undefined}>
        <span className="mc-visually-hidden" aria-live="polite">{currentName}</span>
        <nav className="mc-setup-progress" aria-label="Steps">
          {steps.map((step, index) => {
            const isCurrent = step.id === currentStep;
            const isComplete = index < currentIndex || index < furthestIndex;
            return (
              <button
                type="button"
                key={step.id}
                className={isCurrent ? "mc-current" : isComplete ? "mc-complete" : ""}
                aria-current={isCurrent ? "step" : undefined}
                disabled={index > furthestIndex}
                onClick={() => onSelectStep(step.id)}
              >
                {step.symbol !== undefined ? (
                  <span aria-hidden="true">
                    <SystemSymbol name={step.symbol} />
                  </span>
                ) : null}
                {step.name}
              </button>
            );
          })}
        </nav>
        <div className="mc-setup-content">{children}</div>
        <footer className="mc-setup-footer">
          <button className="mc-button mc-text" type="button" onClick={onBack}>
            {backLabel}
          </button>
          <button className="mc-button mc-primary" type="button" disabled={continueDisabled} onClick={onContinue}>
            {continueLabel}
          </button>
        </footer>
      </div>
    </WindowChrome>
  );
}
