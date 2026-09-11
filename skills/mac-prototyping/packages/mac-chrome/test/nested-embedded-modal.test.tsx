import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";

import { DesktopSpaceFrame, macBookAirM1DisplaySize } from "../desktop-space.tsx";
import { MacEmbeddedPresentation } from "../embedded-presentation.tsx";
import { MacWindowModalHost } from "../window-modal-host.tsx";

afterEach(cleanup);

function NestedPresentation({ open, scope }: { readonly open: boolean; readonly scope: "automatic" | "desktop" }) {
  return <>
    <button data-testid="outside">Outside desktop</button>
    <DesktopSpaceFrame displaySize={macBookAirM1DisplaySize}>
      <div className="mac-window" data-key-window="true">
        <button data-testid="outer">Outer window control</button>
        <MacEmbeddedPresentation>
          <button data-testid="inner">Embedded background</button>
          <MacWindowModalHost open={open} allowDesktopFallback presentationScope={scope}
            kind="alert" role="alertdialog" ariaLabel="Embedded decision" className="fixture-alert">
            <button>Close</button>
          </MacWindowModalHost>
        </MacEmbeddedPresentation>
      </div>
    </DesktopSpaceFrame>
  </>;
}

it.each<"automatic" | "desktop">(["automatic", "desktop"])("keeps an inherited outer canvas outside a nested embed's %s modal boundary", (scope) => {
  const view = render(<NestedPresentation open scope={scope} />);
  const embedded = view.container.querySelector(".mc-embedded-presentation");
  const dialog = screen.getByRole("alertdialog", { name: "Embedded decision" });
  expect(dialog.closest(".mc-embedded-presentation")).toBe(embedded);
  expect(dialog.closest("[data-modal-scope]")?.getAttribute("data-modal-scope")).toBe("desktop");
  expect(screen.getByTestId("inner").hasAttribute("inert")).toBe(true);
  expect(screen.getByTestId("outer").closest('[inert], [aria-hidden="true"]')).toBeNull();
  expect(screen.getByTestId("outside").closest('[inert], [aria-hidden="true"]')).toBeNull();
  expect(document.head.hasAttribute("inert")).toBe(false);

  view.rerender(<NestedPresentation open={false} scope={scope} />);
  expect(screen.queryByRole("alertdialog")).toBeNull();
  expect(screen.getByTestId("inner").hasAttribute("inert")).toBe(false);
});
