"use client";

import type { KeyboardEvent, ReactNode } from "react";
import { createContext, useContext, useMemo, useState } from "react";

import "./styles/tokens.css";
import "./styles/embedded-presentation.css";

export type MacEmbeddedPresentationProps = {
  readonly children: ReactNode;
  readonly height?: number;
  readonly menuBar?: boolean;
  readonly windowManagement?: boolean;
};

type EmbeddedPresentation = {
  readonly menuBar: boolean;
  readonly windowManagement: boolean;
  readonly portalContainer: HTMLDivElement | null;
};

const EmbeddedPresentationContext = createContext<EmbeddedPresentation | null>(null);

export function useEmbeddedPresentation() {
  return useContext(EmbeddedPresentationContext);
}

function preventNativeSubmitActivation(event: KeyboardEvent<HTMLDivElement>) {
  const target = event.target;
  // Chromium checks sandbox form permission before submission; React Aria also emits press and native keyboard clicks, so suppress this default to avoid duplicate local dispatch.
  if ((event.key === "Enter" || event.key === " " || event.key === "Spacebar") && !event.nativeEvent.isComposing && target instanceof HTMLButtonElement && target.dataset.embeddedSubmit === "true" && target.form !== null) event.preventDefault();
}

export function MacEmbeddedPresentation({ children, height = 640, menuBar = false, windowManagement = false }: MacEmbeddedPresentationProps) {
  const [portalContainer, setPortalContainer] = useState<HTMLDivElement | null>(null);
  const presentation = useMemo(() => ({ menuBar, portalContainer, windowManagement }), [menuBar, portalContainer, windowManagement]);
  return (
    <EmbeddedPresentationContext.Provider value={presentation}>
      <div
        ref={setPortalContainer}
        className="mc-embedded-presentation"
        data-embedded-menu-bar={menuBar ? "true" : "false"}
        data-embedded-window-management={windowManagement ? "true" : "false"}
        style={{ height }}
        onKeyDownCapture={preventNativeSubmitActivation}
        onKeyUpCapture={preventNativeSubmitActivation}
      >
        {children}
      </div>
    </EmbeddedPresentationContext.Provider>
  );
}
