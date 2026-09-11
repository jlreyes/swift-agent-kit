import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, expect, it } from "vitest";

import { DesktopSpaceFrame, macBookAirM1DisplaySize } from "../desktop-space.tsx";
import { MacEmbeddedPresentation } from "../embedded-presentation.tsx";
import { MacPopover } from "../menu.tsx";
import { MacWindowModalHost } from "../window-modal-host.tsx";

afterEach(cleanup);

function PopoverHarness() {
  const [open, setOpen] = useState(false);
  return <MacEmbeddedPresentation windowManagement>
    <DesktopSpaceFrame displaySize={macBookAirM1DisplaySize}>
      <MacPopover label="Status" trigger="Status" isOpen={open} onOpenChange={setOpen}>
        <button>Open preferences</button>
      </MacPopover>
    </DesktopSpaceFrame>
  </MacEmbeddedPresentation>;
}

it("portals inside the logical canvas and retains initial focus, Escape, and trigger focus return", async () => {
  const { container } = render(<PopoverHarness />);
  const trigger = screen.getByRole("button", { name: "Status" });
  act(() => trigger.focus());
  fireEvent.click(trigger);
  const dialog = await screen.findByRole("dialog", { name: "Status" });
  const canvas = container.querySelector(".desktop-canvas");
  expect(canvas?.contains(dialog)).toBe(true);
  await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));
  fireEvent.keyDown(document.activeElement ?? dialog, { key: "Escape" });
  await waitFor(() => expect(screen.queryByRole("dialog", { name: "Status" })).toBeNull());
  await waitFor(() => expect(document.activeElement).toBe(trigger));
});

it("attaches a desktop alert to its contextual desktop rather than the first desktop in the document", () => {
  const { container } = render(<>
    <DesktopSpaceFrame displaySize={macBookAirM1DisplaySize}><button>Other desktop</button></DesktopSpaceFrame>
    <DesktopSpaceFrame displaySize={macBookAirM1DisplaySize}>
      <button>Owning desktop</button>
      <MacWindowModalHost open allowDesktopFallback presentationScope="desktop" kind="alert" role="alertdialog" ariaLabel="Decision" className="fixture-alert">
        <button>Close</button>
      </MacWindowModalHost>
    </DesktopSpaceFrame>
  </>);
  const canvases = container.querySelectorAll(".desktop-canvas");
  const dialog = screen.getByRole("alertdialog", { name: "Decision" });
  expect(canvases[1]?.contains(dialog)).toBe(true);
  expect(screen.getByRole("button", { name: "Other desktop" }).closest("[inert]")).toBeNull();
  expect(container.querySelectorAll('[inert]')).not.toHaveLength(0);
});


it("resolves an automatic alert within its desktop when one embed contains two desktops", () => {
  const { container } = render(<MacEmbeddedPresentation windowManagement>
    <DesktopSpaceFrame displaySize={macBookAirM1DisplaySize}>
      <div className="mac-window" data-key-window="true" data-testid="first-window"><button>First window</button></div>
    </DesktopSpaceFrame>
    <DesktopSpaceFrame displaySize={macBookAirM1DisplaySize}>
      <div className="mac-window" data-key-window="true" data-testid="second-window"><button>Second window</button></div>
      <MacWindowModalHost open allowDesktopFallback kind="alert" role="alertdialog" ariaLabel="Window decision" className="fixture-alert">
        <button>Close</button>
      </MacWindowModalHost>
    </DesktopSpaceFrame>
  </MacEmbeddedPresentation>);
  const dialog = screen.getByRole("alertdialog", { name: "Window decision" });
  expect(dialog.closest(".mac-window")).toBe(screen.getByTestId("second-window"));
  expect(screen.getByRole("button", { name: "First window" }).closest("[inert]")).toBeNull();
  expect(container.querySelector('[data-modal-scope="window"]')).not.toBeNull();
});


it("preserves the outer presentation portal for a static embedded desktop", async () => {
  const { container } = render(<MacEmbeddedPresentation>
    <DesktopSpaceFrame displaySize={null}>
      <MacPopover label="Static status" trigger="Static status"><button>Preferences</button></MacPopover>
    </DesktopSpaceFrame>
  </MacEmbeddedPresentation>);
  fireEvent.click(screen.getByRole("button", { name: "Static status" }));
  const dialog = await screen.findByRole("dialog", { name: "Static status" });
  expect(container.querySelector(".mc-embedded-presentation")?.contains(dialog)).toBe(true);
  expect(container.querySelector(".desktop-canvas")?.contains(dialog)).toBe(false);
});
