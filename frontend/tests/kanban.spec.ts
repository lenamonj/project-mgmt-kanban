import { expect, test } from "@playwright/test";
import { login } from "./helpers";

test.beforeEach(async ({ page }) => {
  await login(page);
});

async function dragCardToColumn(page, cardTestId: string, columnTestId: string) {
  const cardBox = await page.getByTestId(cardTestId).boundingBox();
  const columnBox = await page.getByTestId(columnTestId).boundingBox();
  if (!cardBox || !columnBox) throw new Error("Unable to resolve drag coordinates.");
  await page.mouse.move(cardBox.x + cardBox.width / 2, cardBox.y + 20);
  await page.mouse.down();
  await page.mouse.move(columnBox.x + columnBox.width / 2, columnBox.y + 80, {
    steps: 15,
  });
  await page.mouse.up();
}

test("loads the kanban board", async ({ page }) => {
  await expect(page.getByRole("heading", { name: "Project Management Studio" })).toBeVisible();
  await expect(page.locator('[data-testid^="column-"]')).toHaveCount(5);
});

test("adds a card to a column", async ({ page }) => {
  const firstColumn = page.locator('[data-testid^="column-"]').first();
  await firstColumn.getByRole("button", { name: /add a card/i }).click();
  await firstColumn.getByPlaceholder("Card title").fill("Playwright card");
  await firstColumn.getByPlaceholder("Details").fill("Added via e2e.");
  await firstColumn.getByRole("button", { name: /add card/i }).click();
  await expect(firstColumn.getByText("Playwright card")).toBeVisible();
});

test("edits a card and persists across reload", async ({ page }) => {
  const firstColumn = page.locator('[data-testid^="column-"]').first();
  await firstColumn.getByRole("button", { name: /edit align roadmap themes/i }).click();
  const titleInput = firstColumn.getByLabel("Card title");
  await titleInput.fill("Edited via e2e");

  const saved = page.waitForResponse(
    (r) => r.url().includes("/api/board") && r.request().method() === "PUT"
  );
  await firstColumn.getByRole("button", { name: /^save$/i }).click();
  await expect(firstColumn.getByText("Edited via e2e")).toBeVisible();
  await saved;

  await page.reload();
  await expect(
    page.locator('[data-testid^="column-"]').first().getByText("Edited via e2e")
  ).toBeVisible();
});

test("persists an added card across a reload", async ({ page }) => {
  const firstColumn = page.locator('[data-testid^="column-"]').first();
  await firstColumn.getByRole("button", { name: /add a card/i }).click();
  await firstColumn.getByPlaceholder("Card title").fill("Persisted card");

  const saved = page.waitForResponse(
    (r) => r.url().includes("/api/board") && r.request().method() === "PUT"
  );
  await firstColumn.getByRole("button", { name: /add card/i }).click();
  await expect(firstColumn.getByText("Persisted card")).toBeVisible();
  await saved;

  await page.reload();
  await expect(
    page.locator('[data-testid^="column-"]').first().getByText("Persisted card")
  ).toBeVisible();
});

test("moves a card into an emptied column", async ({ page }) => {
  // Pile every card into Backlog so the other columns are empty and very tall.
  const board = await (await page.request.get("/api/board")).json();
  const allIds = Object.keys(board.cards);
  board.columns = board.columns.map((c: { id: string }) =>
    c.id === "col-backlog" ? { ...c, cardIds: allIds } : { ...c, cardIds: [] }
  );
  await page.request.put("/api/board", { data: board });
  await page.reload();
  await expect(page.getByRole("heading", { name: "Project Management Studio" })).toBeVisible();

  await dragCardToColumn(page, "card-card-1", "column-col-discovery");
  await expect(
    page.getByTestId("column-col-discovery").getByTestId("card-card-1")
  ).toBeVisible();
});

test("moves a card between columns", async ({ page }) => {
  const card = page.getByTestId("card-card-1");
  const targetColumn = page.getByTestId("column-col-review");
  const cardBox = await card.boundingBox();
  const columnBox = await targetColumn.boundingBox();
  if (!cardBox || !columnBox) {
    throw new Error("Unable to resolve drag coordinates.");
  }

  await page.mouse.move(
    cardBox.x + cardBox.width / 2,
    cardBox.y + cardBox.height / 2
  );
  await page.mouse.down();
  // Several steps so onDragOver fires and the card moves columns live.
  await page.mouse.move(
    columnBox.x + columnBox.width / 2,
    columnBox.y + 120,
    { steps: 12 }
  );
  const saved = page.waitForResponse(
    (r) => r.url().includes("/api/board") && r.request().method() === "PUT"
  );
  await page.mouse.up();
  await expect(targetColumn.getByTestId("card-card-1")).toBeVisible();
  await saved;

  // The cross-column move must survive a reload (persisted, not just local).
  await page.reload();
  await expect(
    page.getByTestId("column-col-review").getByTestId("card-card-1")
  ).toBeVisible();
  await expect(
    page.getByTestId("column-col-backlog").getByTestId("card-card-1")
  ).toHaveCount(0);
});
