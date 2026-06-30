import { expect, type Page } from "@playwright/test";
import { initialData } from "../src/lib/kanban";

// The id of the signed-in user's first board.
export async function firstBoardId(page: Page): Promise<number> {
  const boards = await (await page.request.get("/api/boards")).json();
  return boards[0].id;
}

// Log in and reset the user to a single board seeded with the known data so each
// test starts from a deterministic state (the single backend user is shared, and
// boards persist across runs).
export async function login(page: Page): Promise<number> {
  await page.goto("/");
  await page.getByTestId("login-form").waitFor();
  await page.getByPlaceholder("Username").fill("user");
  await page.getByPlaceholder("Password").fill("password");
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(
    page.getByRole("heading", { name: "Project Management Studio" })
  ).toBeVisible();

  const boards = await (await page.request.get("/api/boards")).json();
  for (const board of boards.slice(1)) {
    await page.request.delete(`/api/boards/${board.id}`);
  }
  const id = boards[0].id;
  const res = await page.request.put(`/api/boards/${id}`, { data: initialData });
  expect(res.ok()).toBeTruthy();

  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Project Management Studio" })
  ).toBeVisible();
  return id;
}
