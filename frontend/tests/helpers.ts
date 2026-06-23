import { expect, type Page } from "@playwright/test";
import { initialData } from "../src/lib/kanban";

// Log in and reset the board to the known seed so each test starts from a
// deterministic state (the single backend user shares one persisted board).
export async function login(page: Page) {
  await page.goto("/");
  await page.getByTestId("login-form").waitFor();
  await page.getByPlaceholder("Username").fill("user");
  await page.getByPlaceholder("Password").fill("password");
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(
    page.getByRole("heading", { name: "Project Management Studio" })
  ).toBeVisible();

  const res = await page.request.put("/api/board", { data: initialData });
  expect(res.ok()).toBeTruthy();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Project Management Studio" })
  ).toBeVisible();
}
