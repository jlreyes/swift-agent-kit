import { expect, test, type Locator, type Page } from "@playwright/test";

// Real: React, shared navigation primitives, browser layout and input. Mocked: none.
async function sidebarGeometry(page: Page) {
  return page.getByRole("complementary", { name: "Library", exact: true }).evaluate((sidebar) => {
    const pane = sidebar.getBoundingClientRect();
    const content = sidebar.querySelector('[data-testid="compound-sidebar"], [role="treegrid"]');
    const panel = sidebar.closest("[data-panel]");
    if (content === null || panel === null) throw new Error("Sidebar content or allocated panel is missing");
    const allocated = panel.getBoundingClientRect();
    const bounds = content.getBoundingClientRect();
    return { allocatedWidth: allocated.width, paneWidth: pane.width, contentWidth: bounds.width, allocationGap: Math.max(Math.abs(pane.left - allocated.left), Math.abs(pane.right - allocated.right), Math.abs(pane.top - allocated.top), Math.abs(pane.bottom - allocated.bottom)), leftGap: bounds.left - pane.left, rightGap: pane.right - bounds.right, topGap: bounds.top - pane.top, bottomGap: pane.bottom - bounds.bottom };
  });
}

async function expectSidebarFilled(page: Page) {
  await expect.poll(async () => {
    const { allocationGap, leftGap, rightGap, topGap, bottomGap } = await sidebarGeometry(page);
    return Math.max(allocationGap, Math.abs(leftGap), Math.abs(rightGap), Math.abs(topGap), Math.abs(bottomGap));
  }).toBeLessThan(1);
  const sidebar = page.getByRole("complementary", { name: "Library", exact: true });
  await expect.poll(() => sidebar.evaluate((element) => element.scrollWidth - element.clientWidth)).toBeLessThan(1);
}

async function width(locator: Locator) {
  return locator.evaluate((element) => element.getBoundingClientRect().width);
}

async function resizeSidebar(page: Page) {
  const sidebar = page.getByRole("complementary", { name: "Library", exact: true });
  const separator = page.getByRole("separator", { name: "Resize Library", exact: true });
  await separator.press("Home");
  await expect.poll(() => width(sidebar)).toBeLessThan(200);
  await expectSidebarFilled(page);
  const before = await width(sidebar);
  const bounds = await separator.boundingBox();
  if (bounds === null) throw new Error("Sidebar separator is not visible");
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await page.mouse.down();
  await page.mouse.move(bounds.x + 50, bounds.y + bounds.height / 2, { steps: 5 });
  await page.mouse.up();
  await expect.poll(() => width(sidebar)).toBeGreaterThan(before + 20);
  await expectSidebarFilled(page);
  const expanded = await width(sidebar);
  await separator.press("ArrowLeft");
  await expect.poll(() => width(sidebar)).toBeLessThan(expanded - 1);
  await expectSidebarFilled(page);
}

test.describe("navigation content geometry", () => {
  test.skip(({ isMobile }) => isMobile, "Desktop pane sizing uses the desktop project.");

  test("fills compound sidebars through resizing, three columns, and an inspector", async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1300, height: 800 });
    await page.goto("/showcase/navigation-layout");
    await expect(page.getByRole("treegrid", { name: "Documents" })).toBeVisible();
    await testInfo.attach("initial-geometry", { body: JSON.stringify(await sidebarGeometry(page), null, 2), contentType: "application/json" });
    await testInfo.attach("initial-render", { body: await page.screenshot(), contentType: "image/png" });
    await expectSidebarFilled(page);

    const compound = page.getByTestId("compound-sidebar");
    for (const child of [page.getByTestId("sidebar-header"), page.getByRole("treegrid", { name: "Documents" }), page.getByTestId("sidebar-footer")]) {
      expect(await width(child)).toBeCloseTo(await width(compound), 0);
    }
    expect(await width(page.getByRole("searchbox", { name: "Search documents" }))).toBeCloseTo(await width(compound) - 16, 0);
    await resizeSidebar(page);

    await page.getByRole("checkbox", { name: "Three columns" }).check();
    await page.getByRole("checkbox", { name: "Inspector", exact: true }).check();
    await expect(page.getByRole("region", { name: "Content", exact: true })).toBeVisible();
    const inspector = page.getByRole("complementary", { name: "Document inspector", exact: true });
    await expect(inspector).toBeVisible();
    await expectSidebarFilled(page);
    await resizeSidebar(page);
    const inspectorWidth = await width(inspector);
    await page.getByRole("separator", { name: "Resize Document inspector" }).press("ArrowLeft");
    await expect.poll(() => width(inspector)).toBeGreaterThan(inspectorWidth);
    await expectSidebarFilled(page);

    await page.getByRole("checkbox", { name: "Long labels" }).check();
    await expectSidebarFilled(page);
    await page.setViewportSize({ width: 1080, height: 720 });
    await expectSidebarFilled(page);
    const detail = page.getByRole("region", { name: "Detail", exact: true });
    await expect.poll(() => width(detail)).toBeGreaterThanOrEqual(279);
    await testInfo.attach("resized-render", { body: await page.screenshot(), contentType: "image/png" });
    for (const viewportWidth of [800, 650]) {
      await page.setViewportSize({ width: viewportWidth, height: 720 });
      await expectSidebarFilled(page);
      await expect.poll(() => width(page.getByRole("complementary", { name: "Library", exact: true }))).toBeGreaterThanOrEqual(179);
      await expect.poll(() => width(page.getByRole("region", { name: "Content", exact: true }))).toBeGreaterThanOrEqual(179);
      await expect.poll(() => width(detail)).toBeGreaterThanOrEqual(279);
      const stage = page.getByTestId("navigation-stage");
      await stage.evaluate((element) => element.scrollTo({ left: element.scrollWidth }));
      const stageBounds = await stage.boundingBox();
      const inspectorBounds = await inspector.boundingBox();
      if (stageBounds === null || inspectorBounds === null) throw new Error("Stage or inspector geometry is unavailable");
      expect(inspectorBounds.x + inspectorBounds.width).toBeLessThanOrEqual(stageBounds.x + stageBounds.width + 1);
      await stage.evaluate((element) => element.scrollTo({ left: 0 }));
    }
  });

  test("keeps the list scrollable with fixed search, header, and footer", async ({ page }) => {
    await page.goto("/showcase/navigation-layout");
    await expectSidebarFilled(page);
    const list = page.getByRole("treegrid", { name: "Documents" });
    await list.getByRole("row", { name: "Item 2", exact: true }).click();
    await expect(page.getByRole("status", { name: "Selected document" })).toHaveText("item-1");
    const header = await page.getByTestId("sidebar-header").boundingBox();
    const footer = await page.getByTestId("sidebar-footer").boundingBox();
    await list.hover();
    await page.mouse.wheel(0, 2000);
    await expect.poll(() => list.evaluate((element) => element.scrollTop)).toBeGreaterThan(100);
    expect(await page.getByTestId("sidebar-header").boundingBox()).toEqual(header);
    expect(await page.getByTestId("sidebar-footer").boundingBox()).toEqual(footer);
    expect(await page.locator(".navigation-layout-detail-scroll").evaluate((element) => element.scrollTop)).toBe(0);
    await expect(page.getByRole("searchbox", { name: "Search documents" })).toBeVisible();
    await expectSidebarFilled(page);
    await page.getByRole("searchbox", { name: "Search documents" }).fill("Item 60");
    await expect(list.getByRole("row")).toHaveCount(2);
    await expectSidebarFilled(page);
  });

  test("preserves the standard source-list sidebar", async ({ page }) => {
    await page.goto("/showcase/navigation-layout");
    await page.getByRole("checkbox", { name: "Compound sidebar" }).uncheck();
    await expectSidebarFilled(page);
    await resizeSidebar(page);
    const list = page.getByRole("treegrid", { name: "Documents" });
    await list.getByRole("row", { name: "Item 3", exact: true }).click();
    await expect(list.getByRole("row", { name: "Item 3", exact: true })).toHaveAttribute("aria-selected", "true");
    await list.hover();
    await page.mouse.wheel(0, 2000);
    await expect.poll(() => list.evaluate((element) => element.scrollTop)).toBeGreaterThan(100);
    await expectSidebarFilled(page);
  });

  test("preserves row and section heights when the list overflows", async ({ page }) => {
    await page.goto("/showcase/navigation-layout");
    const list = page.getByRole("treegrid", { name: "Documents" });
    for (const compound of [true, false]) {
      await page.getByRole("checkbox", { name: "Compound sidebar" }).check();
      await page.getByRole("searchbox", { name: "Search documents" }).fill("");
      await page.getByRole("checkbox", { name: "Compound sidebar" }).setChecked(compound);
      for (const [name, height] of [["Item 1", 28], ["Documents", 22]] as const) {
        await expect.poll(() => list.getByRole("row", { name, exact: true }).evaluate((element) => element.getBoundingClientRect().height)).toBe(height);
      }
      await page.getByRole("checkbox", { name: "Compound sidebar" }).check();
      await page.getByRole("searchbox", { name: "Search documents" }).fill("Item 1");
      await page.getByRole("checkbox", { name: "Compound sidebar" }).setChecked(compound);
      expect(await list.getByRole("row", { name: "Item 1", exact: true }).evaluate((element) => element.getBoundingClientRect().height)).toBe(28);
    }
  });
});
