// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";

import { SetupAssistant } from "../setup-assistant.tsx";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

it("uses the shared button variants for Setup Assistant navigation", async () => {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  let backCount = 0;
  let continueCount = 0;
  await act(async () => {
    root.render(
      <SetupAssistant
        steps={[{ id: "welcome", name: "Welcome" }]}
        currentStep="welcome"
        furthestIndex={0}
        onSelectStep={() => {}}
        onBack={() => { backCount += 1; }}
        onContinue={() => { continueCount += 1; }}
      >
        <p>Welcome</p>
      </SetupAssistant>,
    );
  });

  const back = container.querySelector<HTMLButtonElement>(".mc-setup-footer .mc-button-borderless");
  const continueButton = container.querySelector<HTMLButtonElement>(".mc-setup-footer .mc-button-primary");
  expect(back?.textContent).toBe("Back");
  expect(continueButton?.textContent).toBe("Continue");
  await act(async () => back?.click());
  await act(async () => continueButton?.click());
  expect(backCount).toBe(1);
  expect(continueCount).toBe(1);

  await act(async () => root.unmount());
  container.remove();
});

it("uses shared window chrome and keeps the progress rail draggable around its controls", async () => {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const onClose = vi.fn();
  const onZoom = vi.fn();

  await act(async () => {
    root.render(
      <SetupAssistant
        steps={[
          { id: "welcome", name: "Welcome" },
          { id: "account", name: "Account" },
        ]}
        currentStep="welcome"
        furthestIndex={1}
        onSelectStep={() => {}}
        onBack={() => {}}
        onContinue={() => {}}
        onClose={onClose}
        onZoom={onZoom}
      >
        <p>Welcome</p>
      </SetupAssistant>,
    );
  });

  const window = container.querySelector<HTMLElement>(".mac-window.mc-setup-window");
  expect(window).toBeTruthy();
  expect(window?.querySelector(".mc-setup-titlebar[data-window-drag-handle]")).toBeTruthy();
  const progress = window?.querySelector<HTMLElement>(".mc-setup-progress[data-window-drag-handle]");
  expect(progress).toBeTruthy();
  expect(progress?.querySelectorAll("button[data-no-window-drag]")).toHaveLength(2);
  expect(window?.querySelectorAll(".traffic-lights button")).toHaveLength(3);
  expect(window?.querySelectorAll("[data-window-resize-handle]")).toHaveLength(8);

  await act(async () => {
    window?.querySelector<HTMLButtonElement>("button[aria-label='Zoom window']")?.click();
  });
  expect(onZoom).toHaveBeenCalledTimes(1);

  await act(async () => {
    window?.querySelector<HTMLButtonElement>("button[aria-label='Close window']")?.click();
  });
  expect(onClose).toHaveBeenCalledTimes(1);
  expect(container.querySelector(".mc-setup-window")).toBeNull();

  await act(async () => root.unmount());
  container.remove();
});
