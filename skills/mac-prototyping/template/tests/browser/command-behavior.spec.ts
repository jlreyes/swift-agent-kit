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
