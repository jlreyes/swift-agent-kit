// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it } from "vitest";

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
