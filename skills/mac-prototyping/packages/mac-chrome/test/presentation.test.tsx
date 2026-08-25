// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useRef, useState } from "react";
import { afterEach, describe, expect, it } from "vitest";

import { MacAlert, MacWindowStatusBar } from "../presentation.tsx";

afterEach(cleanup);

function AlertHarness() {
  const [open, setOpen] = useState(false);
  const [cancelCount, setCancelCount] = useState(0);
  const [applyCount, setApplyCount] = useState(0);
  const triggerRef = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button ref={triggerRef} type="button" onClick={() => setOpen(true)}>Show alert</button>
      <MacAlert
        open={open}
        onClose={() => setOpen(false)}
        fallbackFocusRef={triggerRef}
        title="Apply settings?"
        message="The settings will be updated."
        actions={[
          { id: "cancel", label: "Cancel", role: "cancel", onPress: () => setCancelCount((current) => current + 1) },
          { id: "apply", label: "Apply", role: "default", onPress: () => setApplyCount((current) => current + 1) },
        ]}
      />
      <output data-cancel-count={cancelCount} data-apply-count={applyCount} />
    </>
  );
}

describe("native presentation primitives", () => {
  it("renders a compact window status bar with optional live feedback", () => {
    render(<MacWindowStatusBar live="polite" trailing="4 items">Ready</MacWindowStatusBar>);
    const status = screen.getByRole("status");
    expect(status.classList.contains("mc-window-status-bar")).toBe(true);
    expect(status.textContent).toContain("Ready");
    expect(status.textContent).toContain("4 items");
  });

  it("runs alert actions, maps Escape to cancel, and restores trigger focus", async () => {
    render(<AlertHarness />);
    const trigger = screen.getByRole("button", { name: "Show alert" });
    trigger.focus();
    fireEvent.click(trigger);
    const alert = screen.getByRole("alertdialog", { name: "Apply settings?" });
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("button", { name: "Apply" })));
    fireEvent.keyDown(alert, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(trigger));
    expect(document.querySelector("output")?.dataset.cancelCount).toBe("1");

    fireEvent.click(trigger);
    fireEvent.click(await screen.findByRole("button", { name: "Apply" }));
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(document.querySelector("output")?.dataset.applyCount).toBe("1");
  });
});
