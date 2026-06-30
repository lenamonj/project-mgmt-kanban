import { expect, test } from "@playwright/test";
import { login } from "./helpers";

test("creates, switches, renames, and deletes boards", async ({ page }) => {
  await login(page);

  // The seeded board is present.
  await expect(page.getByTestId("board-bar")).toBeVisible();
  await expect(page.getByRole("button", { name: "My Board" })).toBeVisible();

  // Create a new board and name it.
  await page.getByTestId("new-board").click();
  const renameInput = page.getByTestId("rename-input");
  await renameInput.fill("Launch plan");
  await page.getByTestId("rename-save").click();
  await expect(page.getByRole("button", { name: "Launch plan" })).toBeVisible();

  // The new board starts empty with the default three columns.
  await expect(page.locator('[data-testid^="column-"]')).toHaveCount(3);

  // Switch back to the seeded board (five columns) and back again.
  await page.getByRole("button", { name: "My Board" }).click();
  await expect(page.locator('[data-testid^="column-"]')).toHaveCount(5);
  await page.getByRole("button", { name: "Launch plan" }).click();
  await expect(page.locator('[data-testid^="column-"]')).toHaveCount(3);

  // Delete the active board (with confirmation) and fall back to the other.
  await page.getByTestId("delete-board").click();
  await page.getByTestId("confirm-delete").click();
  await expect(page.getByRole("button", { name: "Launch plan" })).toHaveCount(0);
  await expect(page.locator('[data-testid^="column-"]')).toHaveCount(5);
});

test("registers a new user who gets their own seeded board", async ({ page }) => {
  const username = `e2e-${Date.now()}`;

  await page.goto("/");
  await page.getByTestId("toggle-auth-mode").click();
  await page.getByPlaceholder("Username").fill(username);
  await page.getByPlaceholder("Password").fill("secret-pw");
  await page.getByRole("button", { name: /create account/i }).click();

  await expect(
    page.getByRole("heading", { name: "Project Management Studio" })
  ).toBeVisible();
  await expect(page.getByText(`Signed in as ${username}`)).toBeVisible();
  await expect(page.getByRole("button", { name: "My Board" })).toBeVisible();
  await expect(page.locator('[data-testid^="column-"]')).toHaveCount(5);

  await page.getByTestId("logout-button").click();
  await expect(page.getByTestId("login-form")).toBeVisible();
});
