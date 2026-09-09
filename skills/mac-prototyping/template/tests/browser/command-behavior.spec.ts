import { expect, test } from "@playwright/test";

test.describe("menu support and modal keyboard containment", () => {
  test.skip(({ isMobile }) => isMobile, "Desktop keyboard command regression.");

  test("a partial dispatcher only enables declared commands", async ({ page }) => {
    await page.goto("/showcase/command-behavior");
    await page.getByRole("button", { name: "Commands", exact: true }).click();
    await expect(page.getByRole("menuitem", { name: "About Commands" })).toBeDisabled();
    await expect(page.getByRole("menuitem", { name: /Settings/ })).toBeDisabled();
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Help", exact: true }).click();
    await expect(page.getByRole("menuitem", { name: /App Help/ })).toBeDisabled();
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "File", exact: true }).click();
    await expect(page.getByRole("menuitem", { name: /Open…/ })).toBeDisabled();
    await page.getByRole("menuitem", { name: /New Window/ }).click();
    await expect(page.getByRole("status", { name: "New commands" })).toHaveText("1");
    await page.getByRole("checkbox", { name: "Declare supported commands" }).uncheck();
    await page.getByRole("button", { name: "File", exact: true }).click();
    await expect(page.getByRole("menuitem", { name: /New Window/ })).toBeDisabled();
  });

  test("a sheet contains Cmd+N while preserving editing, child handling, default action and focus", async ({ page }) => {
    await page.goto("/showcase/command-behavior");
    await page.getByRole("button", { name: "Open sheet" }).focus();
    await page.keyboard.press("Meta+n");
    await expect(page.getByRole("status", { name: "New commands" })).toHaveText("1");
    await page.getByRole("button", { name: "Open sheet" }).click();
    const dialog = page.getByRole("dialog", { name: "Edit command" });
    const name = dialog.getByRole("textbox", { name: "Name", exact: true });
    await expect(name).toBeFocused();
    await page.keyboard.press("Meta+n");
    await name.press("ControlOrMeta+a");
    await page.keyboard.type("Edited");
    await expect(name).toHaveValue("Edited");
    const notes = dialog.getByRole("textbox", { name: "Notes" });
    await notes.focus();
    await notes.press("ControlOrMeta+a");
    await page.keyboard.type("First");
    await notes.press("Enter");
    await page.keyboard.type("Second");
    await expect(notes).toHaveValue("First\nSecond");
    await dialog.getByRole("textbox", { name: "Child-owned Return" }).press("Enter");
    await expect(dialog).toBeVisible();
    await name.press("Enter");
    await expect(dialog).toBeHidden();
    await expect(page.getByRole("status", { name: "Applied actions" })).toHaveText("1");
    await expect(page.getByRole("status", { name: "New commands" })).toHaveText("1");
    await expect(page.getByRole("button", { name: "Open sheet" })).toBeFocused();
    await page.keyboard.press("Meta+n");
    await expect(page.getByRole("status", { name: "New commands" })).toHaveText("2");
  });

  test("an alert contains Cmd+N, supports Escape and activates its focused default button", async ({ page }) => {
    await page.goto("/showcase/command-behavior");
    const opener = page.getByRole("button", { name: "Open alert" });
    await opener.click();
    const alert = page.getByRole("alertdialog", { name: "Apply command?" });
    await expect(alert.getByRole("button", { name: "Apply" })).toBeFocused();
    await page.keyboard.press("Meta+n");
    await page.keyboard.press("Escape");
    await expect(alert).toBeHidden();
    await expect(opener).toBeFocused();
    await expect(page.getByRole("status", { name: "New commands" })).toHaveText("0");
    await expect(page.getByRole("status", { name: "Applied actions" })).toHaveText("0");
    await opener.click();
    await expect(alert.getByRole("button", { name: "Apply" })).toBeFocused();
    await page.keyboard.press("Meta+n");
    await page.keyboard.press("Enter");
    await expect(alert).toBeHidden();
    await expect(page.getByRole("status", { name: "New commands" })).toHaveText("0");
    await expect(page.getByRole("status", { name: "Applied actions" })).toHaveText("1");
    await expect(opener).toBeFocused();
  });
});

for (const reducedMotion of ["no-preference", "reduce"] as const) {
  test.describe(`sheet focus after menu dismissal (${reducedMotion})`, () => {
    test.use({ contextOptions: { reducedMotion } });
    test.skip(({ isMobile }) => isMobile, "Desktop keyboard command regression.");

    for (const dismissal of ["Escape", "switched menu Escape", "focus entry Escape", "focused title pointer Escape", "closed title movement Escape", "Tab", "Shift+Tab", "outside pointer dismissal"] as const) {
      test(`restores the sheet control after ${dismissal}`, async ({ page }) => {
        await page.goto("/showcase/command-behavior");
        expect(await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches)).toBe(reducedMotion === "reduce");
        const file = page.getByRole("button", { name: "File", exact: true });
        await file.click();
        await expect(page.getByRole("menu", { name: "File menu" })).toBeVisible();
        await page.keyboard.press("Escape");
        await expect(file).toBeFocused();

        const opener = page.getByRole("button", { name: "Open sheet" });
        await opener.click();
        const dialog = page.getByRole("dialog", { name: "Edit command" });
        const name = dialog.getByRole("textbox", { name: "Name", exact: true });
        await expect(name).toBeFocused();
        await name.fill("Keep this draft");
        if (dismissal === "focus entry Escape") {
          await file.focus();
          await page.keyboard.press("ArrowDown");
        } else {
          if (dismissal === "focused title pointer Escape" || dismissal === "closed title movement Escape") {
            await file.focus();
            if (dismissal === "closed title movement Escape") {
              await page.getByRole("button", { name: "Edit", exact: true }).focus();
              await file.focus();
            }
            await expect(page.getByRole("menu")).toBeHidden();
          }
          await file.click();
        }
        await expect(page.getByRole("menu", { name: "File menu" })).toBeVisible();
        if (dismissal === "switched menu Escape") {
          await page.keyboard.press("ArrowRight");
          await expect(page.getByRole("menu", { name: "Edit menu" })).toBeVisible();
        }
        if (dismissal === "outside pointer dismissal") await page.getByRole("img", { name: "Wi-Fi" }).click();
        else await page.keyboard.press(dismissal === "Tab" || dismissal === "Shift+Tab" ? dismissal : "Escape");

        await expect(page.getByRole("menu")).toBeHidden();
        await expect(dialog).toBeVisible();
        await expect(name).toBeFocused();
        await expect(name).toHaveValue("Keep this draft");
        await page.keyboard.press("Tab");
        await expect(dialog.getByRole("textbox", { name: "Notes" })).toBeFocused();
        await page.keyboard.press("Escape");
        await expect(dialog).toBeHidden();
        await expect(opener).toBeFocused();
        await expect(page.getByRole("status", { name: "Applied actions" })).toHaveText("0");
      });
    }
    test("preserves focus deliberately moved into another window", async ({ page }) => {
      await page.goto("/showcase/command-behavior");
      await page.getByRole("button", { name: "Open sheet" }).click();
      const dialog = page.getByRole("dialog", { name: "Edit command" });
      await expect(dialog.getByRole("textbox", { name: "Name", exact: true })).toBeFocused();
      await page.getByRole("button", { name: "File", exact: true }).click();
      await expect(page.getByRole("menu", { name: "File menu" })).toBeVisible();
      const other = page.getByRole("textbox", { name: "Other window field" });
      await other.click();
      await expect(page.getByRole("menu")).toBeHidden();
      await expect(other).toBeFocused();
      await page.keyboard.type("Other work");
      await expect(other).toHaveValue("Other work");
      await expect(dialog).toBeVisible();
    });
    test("discards an abandoned closed-menu visit from the sheet", async ({ page }) => {
      await page.goto("/showcase/command-behavior");
      await page.getByRole("button", { name: "Open sheet" }).click();
      const dialog = page.getByRole("dialog", { name: "Edit command" });
      await expect(dialog.getByRole("textbox", { name: "Name", exact: true })).toBeFocused();
      const file = page.getByRole("button", { name: "File", exact: true });
      await file.focus();
      await expect(file).toBeFocused();
      await expect(page.getByRole("menu")).toBeHidden();
      const other = page.getByRole("textbox", { name: "Other window field" });
      await other.click();
      await expect(other).toBeFocused();
      await file.click();
      await expect(page.getByRole("menu", { name: "File menu" })).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(page.getByRole("menu")).toBeHidden();
      await expect(file).toBeFocused();
      await expect(dialog).toBeVisible();
    });
  });
}
