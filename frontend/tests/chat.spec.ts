import { expect, test } from "@playwright/test";
import { login } from "./helpers";
import { initialData } from "../src/lib/kanban";

test.beforeEach(async ({ page }) => {
  await login(page);
});

test("shows a reply and applies an AI board update", async ({ page }) => {
  const updated = structuredClone(initialData);
  updated.cards["card-chat"] = {
    id: "card-chat",
    title: "Chat added card",
    details: "from the assistant",
  };
  updated.columns[0].cardIds.push("card-chat");

  await page.route("**/api/boards/*/chat", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ reply: "Added it.", board_update: updated }),
    })
  );

  await page.getByTestId("chat-toggle").click();
  await page.getByTestId("chat-input").fill("add a card to backlog");
  await page.getByTestId("chat-send").click();

  await expect(page.getByText("Added it.")).toBeVisible();
  // Board auto-refreshes with the AI's update.
  await expect(page.getByText("Chat added card")).toBeVisible();
});

test("replies without changing the board", async ({ page }) => {
  await page.route("**/api/boards/*/chat", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ reply: "No change needed.", board_update: null }),
    })
  );

  await page.getByTestId("chat-toggle").click();
  await page.getByTestId("chat-input").fill("how many columns are there?");
  await page.getByTestId("chat-send").click();

  await expect(page.getByText("No change needed.")).toBeVisible();
});
