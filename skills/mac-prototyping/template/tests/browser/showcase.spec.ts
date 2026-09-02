import { expect, test, type Page } from "@playwright/test";

type BrowserProblem = {
  readonly kind: "console" | "page" | "request" | "response";
  readonly message: string;
};

type Rect = {
  readonly bottom: number;
  readonly height: number;
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly width: number;
};

function collectBrowserProblems(page: Page): readonly BrowserProblem[] {
  const problems: BrowserProblem[] = [];
  page.on("console", (message) => {
    if (message.type() === "error" && !message.text().startsWith("Failed to load resource:")) {
      problems.push({ kind: "console", message: message.text() });
    }
  });
  page.on("pageerror", (error) => problems.push({ kind: "page", message: error.message }));
  page.on("requestfailed", (request) => {
    if (!isOptionalHydratedAsset(request.url())) {
      problems.push({ kind: "request", message: `${request.failure()?.errorText ?? "request failed"}: ${request.url()}` });
    }
  });
  page.on("response", (response) => {
    if (response.status() >= 400 && !isOptionalHydratedAsset(response.url())) {
      problems.push({ kind: "response", message: `${response.status()} ${response.url()}` });
    }
  });
  return problems;
}

function isOptionalHydratedAsset(url: string): boolean {
  return new URL(url).pathname === "/mac-assets/wallpapers/tahoe.jpg";
}

async function rect(page: Page, selector: string): Promise<Rect> {
  return page.locator(selector).evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    return {
      bottom: bounds.bottom,
      height: bounds.height,
      left: bounds.left,
      right: bounds.right,
      top: bounds.top,
      width: bounds.width,
    };
  });
}

function overlaps(first: Rect, second: Rect): boolean {
  return first.left < second.right
    && first.right > second.left
    && first.top < second.bottom
    && first.bottom > second.top;
}

test.describe("desktop chrome acceptance", () => {
  test.skip(({ isMobile }) => isMobile, "Desktop geometry is covered by the desktop browser project.");

  test("keeps symbols stable, status items separated, and windows reachable through resize", async ({ page }) => {
    const problems = collectBrowserProblems(page);
    await page.goto("/showcase", { waitUntil: "domcontentloaded" });

    const symbol = page.locator(".p0-app-icon-glyph--system-symbol .mc-system-symbol").first();
    await expect(symbol).toBeVisible();
    const firstGeometry = await symbol.evaluate((element) => {
      const bounds = element.getBoundingClientRect();
      return { height: bounds.height, left: bounds.left, top: bounds.top, width: bounds.width };
    });
    await page.evaluate(async () => document.fonts.ready);
    await page.waitForTimeout(300);
    await expect.poll(async () => symbol.evaluate((element) => {
      const bounds = element.getBoundingClientRect();
      return { height: bounds.height, left: bounds.left, top: bounds.top, width: bounds.width };
    })).toEqual(firstGeometry);

    for (let reload = 0; reload < 2; reload += 1) {
      await page.reload({ waitUntil: "domcontentloaded" });
      await expect(page.locator(".p0-app-icon-glyph--system-symbol .mc-system-symbol").first()).toBeVisible();
      await page.evaluate(async () => document.fonts.ready);
      const reloadedGeometry = await page.locator(".p0-app-icon-glyph--system-symbol .mc-system-symbol").first().evaluate((element) => {
        const bounds = element.getBoundingClientRect();
        return { height: bounds.height, left: bounds.left, top: bounds.top, width: bounds.width };
      });
      expect(reloadedGeometry).toEqual(firstGeometry);
    }

    const extras = await rect(page, ".mc-menubar-extras");
    const statusItems = page.locator(".menu-right > :not(.mc-menubar-extras)");
    for (let index = 0; index < await statusItems.count(); index += 1) {
      const statusBounds = await statusItems.nth(index).evaluate((element) => {
        const bounds = element.getBoundingClientRect();
        return {
          bottom: bounds.bottom,
          height: bounds.height,
          left: bounds.left,
          right: bounds.right,
          top: bounds.top,
          width: bounds.width,
        };
      });
      expect(overlaps(extras, statusBounds)).toBe(false);
    }

    const activeWindow = page.locator('.mac-window[data-key-window="true"]');
    await expect(activeWindow).toBeVisible();
    const activeWindowId = await activeWindow.getAttribute("data-window-id");
    const activeBounds = await activeWindow.boundingBox();
    expect(activeWindowId).not.toBeNull();
    expect(activeBounds).not.toBeNull();
    if (activeBounds === null || activeWindowId === null) throw new Error("Active window geometry was unavailable");
    const hitWindowId = await page.evaluate(({ x, y }) => {
      return document.elementFromPoint(x, y)?.closest<HTMLElement>(".mac-window")?.dataset.windowId ?? null;
    }, { x: activeBounds.x + activeBounds.width / 2, y: activeBounds.y + activeBounds.height / 2 });
    expect(hitWindowId).toBe(activeWindowId);

    const resizeSidebar = page.getByRole("separator", { name: "Resize Component catalog" });
    await expect(resizeSidebar).toBeVisible();
    const separatorBounds = await resizeSidebar.boundingBox();
    if (separatorBounds === null) throw new Error("Sidebar separator geometry was unavailable");
    await page.mouse.move(separatorBounds.x + separatorBounds.width / 2, separatorBounds.y + separatorBounds.height / 2);
    await page.mouse.down();
    await page.mouse.move(separatorBounds.x + 72, separatorBounds.y + separatorBounds.height / 2, { steps: 4 });
    await page.mouse.up();

    await page.setViewportSize({ width: 900, height: 650 });
    await expect.poll(async () => {
      const canvas = await rect(page, ".desktop-canvas");
      const windowBounds = await rect(page, '.mac-window[data-key-window="true"]');
      return {
        bottom: windowBounds.bottom <= canvas.bottom + 1,
        left: windowBounds.left >= canvas.left - 1,
        right: windowBounds.right <= canvas.right + 1,
        top: windowBounds.top >= canvas.top - 1,
      };
    }).toEqual({ bottom: true, left: true, right: true, top: true });
    await page.setViewportSize({ width: 1280, height: 800 });

    await expect(page.locator("vite-error-overlay, nextjs-portal, #webpack-dev-server-client-overlay")).toHaveCount(0);
    expect(problems).toEqual([]);
  });
});

test.describe("fixed-desktop phone review", () => {
  test.skip(({ isMobile }) => !isMobile, "Phone review is covered by the mobile WebKit project.");

  test("preserves the Mac canvas and leaves touch navigation to the browser", async ({ page }) => {
    const problems = collectBrowserProblems(page);
    await page.goto("/showcase", { waitUntil: "domcontentloaded" });

    const viewport = page.locator('.showcase-viewport[data-mobile-review-mode="fixed-desktop"]');
    await expect(viewport).toBeVisible();
    await expect.poll(async () => {
      const bounds = await rect(page, ".showcase-viewport");
      return { height: Math.round(bounds.height), width: Math.round(bounds.width) };
    }).toEqual({ height: 750, width: 1200 });
    await expect.poll(async () => {
      const bounds = await rect(page, ".desktop-canvas");
      return { height: Math.round(bounds.height), width: Math.round(bounds.width) };
    }).toEqual({ height: 750, width: 1200 });
    await expect(page.locator(".mc-window-resize-handle").first()).toBeHidden();

    const activeWindow = page.locator('.mac-window[data-key-window="true"]');
    await expect(activeWindow).toHaveAttribute("data-mobile-presentation", "authored");
    const beforeTouch = await rect(page, '.mac-window[data-key-window="true"]');
    const dragHandle = activeWindow.locator("[data-window-drag-handle]").first();
    const handleBounds = await dragHandle.boundingBox();
    if (handleBounds === null) throw new Error("Window drag handle geometry was unavailable");
    await dragHandle.dispatchEvent("pointerdown", {
      button: 0,
      clientX: handleBounds.x + 20,
      clientY: handleBounds.y + 10,
      isPrimary: true,
      pointerId: 41,
      pointerType: "touch",
    });
    await dragHandle.dispatchEvent("pointermove", {
      clientX: handleBounds.x + 100,
      clientY: handleBounds.y + 70,
      isPrimary: true,
      pointerId: 41,
      pointerType: "touch",
    });
    await dragHandle.dispatchEvent("pointerup", {
      clientX: handleBounds.x + 100,
      clientY: handleBounds.y + 70,
      isPrimary: true,
      pointerId: 41,
      pointerType: "touch",
    });
    expect(await rect(page, '.mac-window[data-key-window="true"]')).toEqual(beforeTouch);

    const dock = page.getByRole("navigation", { name: "Showcase Dock" });
    await dock.getByRole("button", { name: "Finder", exact: true }).evaluate((button: HTMLButtonElement) => button.click());
    await page.evaluate(() => window.scrollTo({ left: 360, top: 80 }));
    const beforeFocus = await page.evaluate(() => ({ x: window.scrollX, y: window.scrollY }));
    await dock.getByRole("button", { name: "Mac Chrome", exact: true }).evaluate((button: HTMLButtonElement) => button.click());
    await expect.poll(async () => page.evaluate(() => ({ x: window.scrollX, y: window.scrollY }))).toEqual(beforeFocus);

    await expect(page.locator("vite-error-overlay, nextjs-portal, #webpack-dev-server-client-overlay")).toHaveCount(0);
    expect(problems).toEqual([]);
  });
});
