"use client";

import type { ReactNode } from "react";

import { MacButton } from "./controls";
import { SystemSymbol, type SystemSymbolName } from "./system-symbol";
import { TrafficLights, WindowChrome, type WindowFrame } from "./window";
import "./styles/tokens.css";
import "./styles/setup-assistant.css";

/* Default geometry (Setup Assistant sheet-like proportions). */
const setupDefaultSize = { width: 720, height: 560 } as const;
const setupMinSize = { width: 540, height: 420 } as const;

export type SetupStep = {
  readonly id: string;
  readonly name: string;
  readonly symbol?: SystemSymbolName;
};

// Direct imports from this module keep working while the presentation system
// lives in its canonical module.
export { Sheet } from "./presentation";

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
  modalOpen = false,
  label,
  frame,
  onClose,
  onMinimize,
  onZoom,
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
  /** @deprecated MacSheet and Sheet now make their owning window inert automatically. */
  readonly modalOpen?: boolean;
  readonly label?: string;
  /** Placement/size override; defaults to ~720x560, centered. */
  readonly frame?: WindowFrame;
  readonly onClose?: () => void;
  readonly onMinimize?: () => void;
  readonly onZoom?: () => void;
  readonly children: ReactNode;
}) {
  const currentIndex = steps.findIndex((step) => step.id === currentStep);
  const currentName = currentIndex >= 0 ? steps[currentIndex]?.name : undefined;

  return (
    <WindowChrome
      className="mc-setup-window"
      label={label ?? "Setup Assistant"}
      frame={frame}
      defaultSize={setupDefaultSize}
      minSize={setupMinSize}
      onClose={onClose}
      onMinimize={onMinimize}
      onZoom={onZoom}
    >
      <div className="mc-setup-titlebar" data-window-drag-handle="">
        <TrafficLights />
      </div>
      <div className="mc-setup-underlay" inert={modalOpen ? true : undefined} aria-hidden={modalOpen || undefined}>
        <span className="mc-visually-hidden" aria-live="polite">{currentName}</span>
        <nav className="mc-setup-progress" aria-label="Steps" data-window-drag-handle="">
          {steps.map((step, index) => {
            const isCurrent = step.id === currentStep;
            const isComplete = index < currentIndex || index < furthestIndex;
            return (
              <button
                type="button"
                key={step.id}
                data-no-window-drag=""
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
          <MacButton variant="borderless" onPress={onBack}>
            {backLabel}
          </MacButton>
          <MacButton variant="primary" disabled={continueDisabled} onPress={onContinue}>
            {continueLabel}
          </MacButton>
        </footer>
      </div>
    </WindowChrome>
  );
}
