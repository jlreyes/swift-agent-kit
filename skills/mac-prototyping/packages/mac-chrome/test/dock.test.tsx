// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it } from "vitest";

import { MacDock, MacDockAppIcon } from "../dock.tsx";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

it("normalizes asset and generated app icons onto the same canvas", async () => {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);

  await act(async () => {
    root.render(
      <>
        <MacDockAppIcon icon={{ kind: "asset", src: "/finder.png" }} label="Finder" />
        <MacDockAppIcon
          icon={{
            kind: "symbol",
            symbol: <svg data-testid="glyph" viewBox="0 0 24 24" />,
            background: "#123456",
            foreground: "#fedcba",
          }}
        />
      </>,
    );
  });

  const [asset, tile] = container.querySelectorAll<HTMLElement>(".p0-app-icon");
  expect(asset?.classList.contains("p0-app-icon--asset")).toBe(true);
  expect(tile?.classList.contains("p0-app-icon--tile")).toBe(true);
  expect(asset?.getAttribute("role")).toBe("img");
  expect(asset?.getAttribute("aria-label")).toBe("Finder");
  expect(tile?.getAttribute("aria-hidden")).toBe("true");

  expect(asset?.style.width).toBe("50px");
  expect(asset?.style.height).toBe("50px");
  expect(tile?.style.width).toBe("50px");
  expect(tile?.style.height).toBe("50px");
  expect(tile!.querySelector<HTMLElement>(".p0-app-icon-artwork")?.style.width).toBe("42px");
  expect(tile!.querySelector<HTMLElement>(".p0-app-icon-artwork")?.style.height).toBe("42px");
  expect(tile!.querySelector<HTMLElement>(".p0-app-icon-glyph")?.style.width).toBe("26px");
  expect(tile!.querySelector<HTMLElement>(".p0-app-icon-glyph")?.style.height).toBe("26px");
  expect(tile!.querySelector<HTMLElement>(".p0-app-icon-artwork")?.style.backgroundColor).toBe("rgb(18, 52, 86)");
  expect(tile!.querySelector<HTMLElement>(".p0-app-icon-artwork")?.style.color).toBe("rgb(254, 220, 186)");

  await act(async () => root.unmount());
  container.remove();
});

it("routes every Dock item through MacDockAppIcon without changing its canvas size", async () => {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);

  await act(async () => {
    root.render(
      <MacDock
        items={[
          { id: "asset", label: "Asset", icon: "/asset.png" },
          {
            id: "generated",
            label: "Generated",
            icon: {
              kind: "symbol",
              symbol: <svg viewBox="0 0 24 24" />,
              background: "#654321",
            },
          },
          { id: "legacy", label: "Legacy React node", icon: <svg viewBox="0 0 24 24" /> },
        ]}
      />,
    );
  });

  const dockButtons = container.querySelectorAll<HTMLElement>(".p0-dock-item");
  const iconCanvases = container.querySelectorAll<HTMLElement>(".p0-dock-item > .p0-app-icon");
  expect(dockButtons).toHaveLength(3);
  expect(iconCanvases).toHaveLength(3);
  expect(Array.from(dockButtons, (button) => button.dataset.hoverEffect)).toEqual(["lift", "lift", "lift"]);
  expect(Array.from(iconCanvases, (icon) => icon.style.width)).toEqual(["50px", "50px", "50px"]);
  expect(iconCanvases[0]?.classList.contains("p0-app-icon--asset")).toBe(true);
  expect(iconCanvases[1]?.classList.contains("p0-app-icon--tile")).toBe(true);
  expect(iconCanvases[2]?.classList.contains("p0-app-icon--tile")).toBe(true);

  await act(async () => root.unmount());
  container.remove();
});

it("renders minimized windows as a separate normalized thumbnail group", async () => {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);

  await act(async () => {
    root.render(
      <MacDock
        items={[
          { id: "app", label: "App", icon: "/app.png", group: "apps", running: true },
          {
            id: "window",
            label: "Project window",
            icon: "/app.png",
            group: "windows",
            viewTransitionName: "mc-window-project",
            windowThumbnail: { src: "data:image/png;base64,d2luZG93", width: 900, height: 600 },
          },
          { id: "trash", label: "Trash", icon: "/trash.png", group: "places" },
        ]}
      />,
    );
  });

  const thumbnailButton = container.querySelector<HTMLElement>(".p0-dock-item.is-window-thumbnail");
  const thumbnail = thumbnailButton?.querySelector<HTMLElement>(".p0-window-thumbnail");
  expect(container.querySelectorAll(".p0-dock-divider")).toHaveLength(2);
  expect(thumbnailButton?.querySelector(".p0-app-icon")).toBeNull();
  expect(thumbnail?.style.aspectRatio).toBe("900 / 600");
  expect(thumbnail?.style.viewTransitionName).toBe("mc-window-project");
  expect(thumbnail?.querySelector("img")?.getAttribute("src")).toContain("data:image/png");

  await act(async () => root.unmount());
  container.remove();
});
