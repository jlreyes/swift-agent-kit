// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";

import { DesktopShell } from "../desktop-shell.tsx";
import { MacEmbeddedPresentation } from "../embedded-presentation.tsx";
import { MacAlert } from "../presentation.tsx";

afterEach(cleanup);

function Fixture({ open }: { readonly open: boolean }) {
  return <>
    <button type="button">Host action</button>
    <MacEmbeddedPresentation menuBar>
      <DesktopShell appName="Embedded"><button type="button">Canvas action</button></DesktopShell>
      <button type="button">Embedded sibling</button>
      <MacAlert open={open} onClose={() => undefined} title="Embedded decision" message="Local canvas" presentationScope="desktop" actions={[{ id: "close", label: "Close" }]} />
    </MacEmbeddedPresentation>
  </>;
}

it("contains desktop modal suppression and observation within the embedded presentation", async () => {
  const bodySibling = document.createElement("button");
  bodySibling.textContent = "Separate host root";
  document.body.append(bodySibling);
  try {
    const { container, rerender } = render(<Fixture open />);
    const host = screen.getByRole("button", { name: "Host action" });
    const dialog = await screen.findByRole("alertdialog", { name: "Embedded decision" });
    const root = container.querySelector(".mc-embedded-presentation");
    expect(root?.contains(dialog)).toBe(true);
    const sibling = screen.getByText("Embedded sibling");
    await waitFor(() => expect(sibling.hasAttribute("inert")).toBe(true));
    expect(host.closest('[inert], [aria-hidden="true"]')).toBeNull();
    expect(bodySibling.hasAttribute("inert")).toBe(false);
    expect(bodySibling.hasAttribute("aria-hidden")).toBe(false);

    const dynamic = document.createElement("button");
    dynamic.textContent = "New embedded underlay";
    root?.append(dynamic);
    await waitFor(() => expect(dynamic.hasAttribute("inert")).toBe(true));
    expect(host.closest('[inert], [aria-hidden="true"]')).toBeNull();
    expect(bodySibling.hasAttribute("inert")).toBe(false);

    rerender(<Fixture open={false} />);
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(sibling.hasAttribute("inert")).toBe(false);
    expect(dynamic.hasAttribute("inert")).toBe(false);
    expect(dynamic.hasAttribute("aria-hidden")).toBe(false);
  } finally {
    bodySibling.remove();
  }
});
