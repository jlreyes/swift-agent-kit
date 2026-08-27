// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { afterEach, describe, expect, it } from "vitest";

import { MacAlert, MacSheet, MacWindowStatusBar } from "../presentation.tsx";
import { MacWindowModalHost } from "../window-modal-host.tsx";

afterEach(cleanup);

function AlertHarness({ cancel = true }: { readonly cancel?: boolean }) {
  const [open, setOpen] = useState(false);
  const [cancelCount, setCancelCount] = useState(0);
  const [applyCount, setApplyCount] = useState(0);
  const triggerRef = useRef<HTMLButtonElement>(null);
  return (
    <section className="mac-window" aria-label="Example window">
      <div className="window-underlay">
        <button ref={triggerRef} type="button" onClick={() => setOpen(true)}>Show alert</button>
        <output data-cancel-count={cancelCount} data-apply-count={applyCount} />
      </div>
      <MacAlert
        open={open}
        onClose={() => setOpen(false)}
        fallbackFocusRef={triggerRef}
        title="Apply settings?"
        message="The settings will be updated."
        actions={[
          ...(cancel ? [{ id: "cancel", label: "Cancel", role: "cancel" as const, onPress: () => setCancelCount((current) => current + 1) }] : []),
          { id: "apply", label: "Apply", isDefault: true, onPress: () => setApplyCount((current) => current + 1) },
        ]}
      />
    </section>
  );
}

function SheetHarness() {
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState("none");
  const triggerRef = useRef<HTMLButtonElement>(null);
  return (
    <section className="mac-window" aria-label="Project window">
      <div className="window-underlay">
        <button ref={triggerRef} type="button" onClick={() => setOpen(true)}>Create project</button>
        <output>{result}</output>
      </div>
      <MacSheet
        open={open}
        onClose={() => setOpen(false)}
        fallbackFocusRef={triggerRef}
        title="Create Project"
        actions={[
          { id: "create", label: "Create", isDefault: true, onPress: () => setResult("created") },
          { id: "remove", label: "Remove", role: "destructive", onPress: () => setResult("removed") },
          { id: "cancel", label: "Cancel", role: "cancel", onPress: () => setResult("cancelled") },
        ]}
      >
        <label>Project name <input defaultValue="Untitled Project" /></label>
      </MacSheet>
    </section>
  );
}

function DesktopAlertWithExternalPortal({ portalHost }: { readonly portalHost: HTMLElement }) {
  const [open, setOpen] = useState(true);
  return (
    <>
      <div className="desktop-canvas"><div className="desktop-underlay">Desktop</div></div>
      {createPortal(<div className="react-aria-Popover" role="menu">Open status menu</div>, portalHost)}
      <MacAlert
        open={open}
        onClose={() => setOpen(false)}
        presentationScope="desktop"
        title="System decision"
        message="The external menu is modal underlay."
        actions={[{ id: "okay", label: "OK", isDefault: true }]}
      />
    </>
  );
}

function ExplicitFallbackAlertHarness() {
  const [open, setOpen] = useState(false);
  const fallbackRef = useRef<HTMLButtonElement>(null);
  return (
    <section className="mac-window" aria-label="Focus policy window">
      <div className="window-underlay">
        <button ref={fallbackRef} type="button">Stable status item</button>
        <button type="button" onClick={() => setOpen(true)}>Transient menu command</button>
      </div>
      <MacAlert
        open={open}
        onClose={() => setOpen(false)}
        fallbackFocusRef={fallbackRef}
        title="Complete operation?"
        message="Focus should return to the explicit stable target."
        actions={[{ id: "okay", label: "OK", isDefault: true }]}
      />
    </section>
  );
}

function EmptyModalHarness() {
  return (
    <section className="mac-window" aria-label="Empty modal window">
      <div className="window-underlay">Underlay</div>
      <MacWindowModalHost
        ariaLabel="No controls"
        className="empty-modal"
        kind="sheet"
        onCancel={() => {}}
        open
        role="dialog"
      >
        <p>There are no interactive descendants.</p>
      </MacWindowModalHost>
    </section>
  );
}

function StackedModalHarness() {
  const [lowerOpen, setLowerOpen] = useState(true);
  const [upperOpen, setUpperOpen] = useState(true);
  return (
    <section className="mac-window" aria-label="Stacked modal window">
      <div className="stacked-underlay">Underlay</div>
      <MacWindowModalHost
        ariaLabel="Lower dialog"
        className="lower-dialog"
        kind="sheet"
        onCancel={() => setLowerOpen(false)}
        open={lowerOpen}
        role="dialog"
      >
        <button type="button" onClick={() => setLowerOpen(false)}>Close lower</button>
      </MacWindowModalHost>
      <MacWindowModalHost
        ariaLabel="Upper dialog"
        className="upper-dialog"
        kind="sheet"
        onCancel={() => setUpperOpen(false)}
        open={upperOpen}
        role="dialog"
      >
        <button type="button" onClick={() => setLowerOpen(false)}>Remove lower</button>
        <button type="button" onClick={() => setUpperOpen(false)}>Close upper</button>
      </MacWindowModalHost>
    </section>
  );
}

function EnterTargetHarness() {
  const [defaultCount, setDefaultCount] = useState(0);
  return (
    <section className="mac-window" aria-label="Enter target window">
      <output data-testid="default-count">{defaultCount}</output>
      <MacWindowModalHost
        ariaLabel="Enter target dialog"
        className="enter-target-dialog"
        kind="sheet"
        onCancel={() => {}}
        onDefault={() => setDefaultCount((current) => current + 1)}
        open
        role="dialog"
      >
        <svg data-testid="bare-svg" aria-label="Decorative target"><circle /></svg>
        <button type="button">
          Button target
          <svg data-testid="button-svg"><circle /></svg>
        </button>
      </MacWindowModalHost>
    </section>
  );
}

function NestedDesktopAlertHarness() {
  const [open, setOpen] = useState(true);
  return (
    <>
      <div data-testid="application-root">
        <aside data-testid="application-sibling" aria-hidden="false">Application navigation</aside>
        <div className="desktop-canvas"><div>Desktop content</div></div>
      </div>
      <MacAlert
        actions={[{ id: "close", label: "Close", isDefault: true }]}
        message="Everything beside the nested desktop is underlay."
        onClose={() => setOpen(false)}
        open={open}
        presentationScope="desktop"
        title="Nested desktop alert"
      />
    </>
  );
}

function IndependentWindowModalsHarness() {
  const [firstOpen, setFirstOpen] = useState(true);
  const firstFallbackRef = useRef<HTMLButtonElement>(null);
  return (
    <>
      <section className="mac-window" aria-label="First owner">
        <button ref={firstFallbackRef} type="button">First fallback</button>
        <MacWindowModalHost
          ariaLabel="First dialog"
          className="first-dialog"
          fallbackFocusRef={firstFallbackRef}
          kind="sheet"
          onCancel={() => setFirstOpen(false)}
          open={firstOpen}
          role="dialog"
        >
          <button type="button" onClick={() => setFirstOpen(false)}>Close first dialog</button>
        </MacWindowModalHost>
      </section>
      <section className="mac-window" aria-label="Second owner">
        <button type="button">Second fallback</button>
        <MacWindowModalHost
          ariaLabel="Second dialog"
          className="second-dialog"
          kind="sheet"
          onCancel={() => {}}
          open
          role="dialog"
        >
          <button type="button">Second dialog action</button>
        </MacWindowModalHost>
      </section>
    </>
  );
}

describe("native presentation primitives", () => {
  it("runs a default action from a bare SVG target but not an SVG inside an HTML control", async () => {
    render(<EnterTargetHarness />);
    await screen.findByRole("dialog", { name: "Enter target dialog" });

    fireEvent.keyDown(screen.getByTestId("bare-svg"), { key: "Enter" });
    expect(screen.getByTestId("default-count").textContent).toBe("1");

    fireEvent.keyDown(screen.getByTestId("button-svg"), { key: "Enter" });
    expect(screen.getByTestId("default-count").textContent).toBe("1");
  });

  it("suppresses siblings beside a nested desktop canvas and restores their state", async () => {
    render(<NestedDesktopAlertHarness />);
    const sibling = screen.getByTestId("application-sibling");
    await screen.findByRole("alertdialog", { name: "Nested desktop alert" });
    await waitFor(() => {
      expect(sibling.hasAttribute("inert")).toBe(true);
      expect(sibling.getAttribute("aria-hidden")).toBe("true");
    });

    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog", { name: "Nested desktop alert" })).toBeNull());
    expect(sibling.hasAttribute("inert")).toBe(false);
    expect(sibling.getAttribute("aria-hidden")).toBe("false");
  });

  it("restores focus within one modal owner instead of targeting another owner's dialog", async () => {
    render(<IndependentWindowModalsHarness />);
    await screen.findByRole("dialog", { name: "First dialog" });
    await screen.findByRole("dialog", { name: "Second dialog" });

    fireEvent.click(screen.getByRole("button", { name: "Close first dialog" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "First dialog" })).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("button", { name: "First fallback" })));
    expect(screen.getByRole("dialog", { name: "Second dialog" })).toBeTruthy();
  });

  it("focuses the dialog itself when a modal has no focusable descendants", async () => {
    render(<EmptyModalHarness />);
    const dialog = await screen.findByRole("dialog", { name: "No controls" });
    await waitFor(() => expect(document.activeElement).toBe(dialog));
    expect(dialog.getAttribute("tabindex")).toBe("-1");

    fireEvent.keyDown(dialog, { key: "Tab" });
    expect(document.activeElement).toBe(dialog);
  });

  it("coordinates stacked modal suppression until the final layer closes", async () => {
    const { container } = render(<StackedModalHarness />);
    const underlay = container.querySelector<HTMLElement>(".stacked-underlay");
    const upper = await screen.findByRole("dialog", { name: "Upper dialog" });
    const upperLayer = upper.closest<HTMLElement>(".mc-window-modal-layer");
    const lower = container.querySelector<HTMLElement>(".lower-dialog");
    const lowerLayer = lower?.closest<HTMLElement>(".mc-window-modal-layer");

    await waitFor(() => {
      expect(underlay?.hasAttribute("inert")).toBe(true);
      expect(lowerLayer?.hasAttribute("inert")).toBe(true);
      expect(lowerLayer?.getAttribute("aria-hidden")).toBe("true");
      expect(upperLayer?.hasAttribute("inert")).toBe(false);
      expect(upperLayer?.hasAttribute("aria-hidden")).toBe(false);
    });

    fireEvent.click(screen.getByRole("button", { name: "Remove lower" }));
    await waitFor(() => expect(container.querySelector(".lower-dialog")).toBeNull());
    expect(underlay?.hasAttribute("inert")).toBe(true);
    expect(upperLayer?.hasAttribute("inert")).toBe(false);
    await waitFor(() => expect(upper.contains(document.activeElement)).toBe(true));

    fireEvent.click(screen.getByRole("button", { name: "Close upper" }));
    await waitFor(() => expect(container.querySelector(".upper-dialog")).toBeNull());
    expect(underlay?.hasAttribute("inert")).toBe(false);
    expect(underlay?.hasAttribute("aria-hidden")).toBe(false);
  });

  it("promotes the previous modal without exposing its underlay when the top layer closes", async () => {
    const { container } = render(<StackedModalHarness />);
    const underlay = container.querySelector<HTMLElement>(".stacked-underlay");
    await screen.findByRole("dialog", { name: "Upper dialog" });

    fireEvent.click(screen.getByRole("button", { name: "Close upper" }));
    const lower = await screen.findByRole("dialog", { name: "Lower dialog" });
    const lowerLayer = lower.closest<HTMLElement>(".mc-window-modal-layer");
    await waitFor(() => {
      expect(lowerLayer?.hasAttribute("inert")).toBe(false);
      expect(lowerLayer?.hasAttribute("aria-hidden")).toBe(false);
      expect(underlay?.hasAttribute("inert")).toBe(true);
      expect(lower.contains(document.activeElement)).toBe(true);
    });

    fireEvent.click(screen.getByRole("button", { name: "Close lower" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(underlay?.hasAttribute("inert")).toBe(false);
    expect(underlay?.hasAttribute("aria-hidden")).toBe(false);
  });
  it("renders a compact window status bar with optional live feedback", () => {
    render(<MacWindowStatusBar live="polite" trailing="4 items">Ready</MacWindowStatusBar>);
    const status = screen.getByRole("status");
    expect(status.classList.contains("mc-window-status-bar")).toBe(true);
    expect(status.textContent).toContain("Ready");
    expect(status.textContent).toContain("4 items");
  });

  it("attaches a sheet to its owning window and owns labelled title, body, and action regions", async () => {
    const { container } = render(<SheetHarness />);
    fireEvent.click(screen.getByRole("button", { name: "Create project" }));
    const dialog = await screen.findByRole("dialog", { name: "Create Project" });
    const window = container.querySelector(".mac-window");
    expect(window?.querySelector(":scope > .mc-window-modal-layer-sheet")).toBeTruthy();
    expect(dialog.querySelector(".mc-sheet-header h2")?.textContent).toBe("Create Project");
    expect(dialog.querySelector(".mc-sheet-body input")).toBeTruthy();
    const labels = within(dialog).getAllByRole("button").map((button) => button.textContent);
    expect(labels).toEqual(["Remove", "Cancel", "Create"]);
    expect(within(dialog).getByRole("button", { name: "Remove" }).classList.contains("mc-dialog-action-destructive")).toBe(true);
    expect(within(dialog).getByRole("button", { name: "Create" }).classList.contains("mc-dialog-action-default")).toBe(true);
  });

  it("makes the owning window underlay inert and restores it after the modal closes", async () => {
    const { container } = render(<SheetHarness />);
    const underlay = container.querySelector<HTMLElement>(".window-underlay");
    fireEvent.click(screen.getByRole("button", { name: "Create project" }));
    await screen.findByRole("dialog", { name: "Create Project" });
    await waitFor(() => {
      expect(underlay?.hasAttribute("inert")).toBe(true);
      expect(underlay?.getAttribute("aria-hidden")).toBe("true");
    });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(underlay?.hasAttribute("inert")).toBe(false);
    expect(underlay?.hasAttribute("aria-hidden")).toBe(false);
  });

  it("preserves application writes of suppression-matching attributes while a modal is open", async () => {
    const { container } = render(<SheetHarness />);
    const underlay = container.querySelector<HTMLElement>(".window-underlay");
    fireEvent.click(screen.getByRole("button", { name: "Create project" }));
    await screen.findByRole("dialog", { name: "Create Project" });
    await waitFor(() => expect(underlay?.getAttribute("aria-hidden")).toBe("true"));

    underlay?.setAttribute("inert", "");
    underlay?.setAttribute("aria-hidden", "true");
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

    expect(underlay?.getAttribute("inert")).toBe("");
    expect(underlay?.getAttribute("aria-hidden")).toBe("true");
  });

  it("preserves application removal of pre-existing suppression attributes", async () => {
    const { container } = render(<SheetHarness />);
    const underlay = container.querySelector<HTMLElement>(".window-underlay");
    underlay?.setAttribute("inert", "");
    underlay?.setAttribute("aria-hidden", "true");
    const trigger = underlay?.querySelector<HTMLButtonElement>("button");
    expect(trigger).toBeTruthy();
    fireEvent.click(trigger as HTMLButtonElement);
    await screen.findByRole("dialog", { name: "Create Project" });

    underlay?.removeAttribute("inert");
    underlay?.removeAttribute("aria-hidden");
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

    expect(underlay?.hasAttribute("inert")).toBe(false);
    expect(underlay?.hasAttribute("aria-hidden")).toBe(false);
  });

  it("preserves application changes to both suppression attributes", async () => {
    const { container } = render(<SheetHarness />);
    const underlay = container.querySelector<HTMLElement>(".window-underlay");
    fireEvent.click(screen.getByRole("button", { name: "Create project" }));
    await screen.findByRole("dialog", { name: "Create Project" });
    await waitFor(() => expect(underlay?.getAttribute("aria-hidden")).toBe("true"));

    underlay?.setAttribute("inert", "application-owned");
    underlay?.setAttribute("aria-hidden", "false");
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

    expect(underlay?.getAttribute("inert")).toBe("application-owned");
    expect(underlay?.getAttribute("aria-hidden")).toBe("false");
  });

  it("maps Return to the independent default action", async () => {
    render(<SheetHarness />);
    fireEvent.click(screen.getByRole("button", { name: "Create project" }));
    const dialog = await screen.findByRole("dialog", { name: "Create Project" });
    fireEvent.keyDown(dialog, { key: "Enter" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.getByText("created")).toBeTruthy();
  });

  it("maps Escape only to a cancel action and restores trigger focus", async () => {
    render(<AlertHarness />);
    const trigger = screen.getByRole("button", { name: "Show alert" });
    trigger.focus();
    fireEvent.click(trigger);
    const alert = await screen.findByRole("alertdialog", { name: "Apply settings?" });
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("button", { name: "Apply" })));
    fireEvent.keyDown(alert, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(trigger));
    expect(document.querySelector("output")?.dataset.cancelCount).toBe("1");
  });

  it("prefers a connected explicit focus fallback over a connected transient opener", async () => {
    render(<ExplicitFallbackAlertHarness />);
    const stableTarget = screen.getByRole("button", { name: "Stable status item" });
    const transientOpener = screen.getByRole("button", { name: "Transient menu command" });
    transientOpener.focus();
    fireEvent.click(transientOpener);
    await screen.findByRole("alertdialog", { name: "Complete operation?" });
    fireEvent.click(screen.getByRole("button", { name: "OK" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog", { name: "Complete operation?" })).toBeNull());
    expect(transientOpener.isConnected).toBe(true);
    await waitFor(() => expect(document.activeElement).toBe(stableTarget));
  });

  it("keeps an alert open on Escape when it has no cancel action", async () => {
    render(<AlertHarness cancel={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Show alert" }));
    const alert = await screen.findByRole("alertdialog", { name: "Apply settings?" });
    fireEvent.keyDown(alert, { key: "Escape" });
    expect(screen.getByRole("alertdialog", { name: "Apply settings?" })).toBe(alert);
  });

  it("uses an explicit desktop modal scope for a menu-bar app even when another app has a key window", async () => {
    const { container } = render(
      <>
        <div className="desktop-canvas">
          <div className="desktop-underlay">Desktop</div>
          <section className="mac-window" data-key-window="true">Unrelated app window</section>
        </div>
        <MacAlert
          open
          onClose={() => {}}
          presentationScope="desktop"
          title="Menu-bar alert"
          message="This alert belongs to the desktop presentation layer."
          actions={[{ id: "okay", label: "OK", isDefault: true }]}
        />
      </>,
    );
    const alert = await screen.findByRole("alertdialog", { name: "Menu-bar alert" });
    const layer = alert.closest<HTMLElement>(".mc-window-modal-layer");
    expect(layer?.dataset.modalScope).toBe("desktop");
    expect(layer?.parentElement).toBe(container.querySelector(".desktop-canvas"));
    expect(container.querySelector(".desktop-underlay")?.getAttribute("aria-hidden")).toBe("true");
  });

  it("makes body-level portalled overlays inert for a desktop alert and restores them", async () => {
    const portalHost = document.createElement("div");
    portalHost.dataset.reactAriaPortal = "";
    portalHost.setAttribute("aria-hidden", "false");
    document.body.append(portalHost);
    try {
      render(<DesktopAlertWithExternalPortal portalHost={portalHost} />);
      await screen.findByRole("alertdialog", { name: "System decision" });
      await waitFor(() => {
        expect(portalHost.hasAttribute("inert")).toBe(true);
        expect(portalHost.getAttribute("aria-hidden")).toBe("true");
      });
      fireEvent.click(screen.getByRole("button", { name: "OK" }));
      await waitFor(() => expect(screen.queryByRole("alertdialog", { name: "System decision" })).toBeNull());
      expect(portalHost.hasAttribute("inert")).toBe(false);
      expect(portalHost.getAttribute("aria-hidden")).toBe("false");
    } finally {
      portalHost.remove();
    }
  });
});
