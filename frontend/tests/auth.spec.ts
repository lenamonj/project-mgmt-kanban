import { expect, test } from "@playwright/test";
import { login } from "./helpers";

test("shows the login form when unauthenticated", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("login-form")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Project Management Studio" })
  ).toHaveCount(0);
});

test("rejects invalid credentials", async ({ page }) => {
  await page.goto("/");
  await page.getByPlaceholder("Username").fill("user");
  await page.getByPlaceholder("Password").fill("wrong");
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page.getByTestId("login-error")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Project Management Studio" })
  ).toHaveCount(0);
});

test("logs in and logs out", async ({ page }) => {
  await login(page);
  await page.getByTestId("logout-button").click();
  await expect(page.getByTestId("login-form")).toBeVisible();
});
