import {
  columnIdForItem,
  moveCard,
  placeCardInColumn,
  type Column,
} from "@/lib/kanban";

describe("moveCard", () => {
  const baseColumns: Column[] = [
    { id: "col-a", title: "A", cardIds: ["card-1", "card-2"] },
    { id: "col-b", title: "B", cardIds: ["card-3"] },
  ];

  it("reorders cards in the same column", () => {
    const result = moveCard(baseColumns, "card-2", "card-1");
    expect(result[0].cardIds).toEqual(["card-2", "card-1"]);
  });

  it("moves cards to another column", () => {
    const result = moveCard(baseColumns, "card-2", "card-3");
    expect(result[0].cardIds).toEqual(["card-1"]);
    expect(result[1].cardIds).toEqual(["card-2", "card-3"]);
  });

  it("drops cards to the end of a column", () => {
    const result = moveCard(baseColumns, "card-1", "col-b");
    expect(result[0].cardIds).toEqual(["card-2"]);
    expect(result[1].cardIds).toEqual(["card-3", "card-1"]);
  });
});

describe("columnIdForItem", () => {
  const columns: Column[] = [
    { id: "col-a", title: "A", cardIds: ["card-1", "card-2"] },
    { id: "col-b", title: "B", cardIds: ["card-3"] },
  ];

  it("returns the column id when given a card id", () => {
    expect(columnIdForItem(columns, "card-3")).toBe("col-b");
  });

  it("returns the id itself when given a column id", () => {
    expect(columnIdForItem(columns, "col-a")).toBe("col-a");
  });

  it("returns undefined for an unknown id", () => {
    expect(columnIdForItem(columns, "nope")).toBeUndefined();
  });
});

describe("placeCardInColumn", () => {
  const columns: Column[] = [
    { id: "col-a", title: "A", cardIds: ["card-1", "card-2"] },
    { id: "col-b", title: "B", cardIds: ["card-3"] },
  ];

  it("moves a card into another column at the given index", () => {
    const result = placeCardInColumn(columns, "card-1", "col-b", 0);
    expect(result[0].cardIds).toEqual(["card-2"]);
    expect(result[1].cardIds).toEqual(["card-1", "card-3"]);
  });

  it("is a no-op when the card is already in the target column", () => {
    const result = placeCardInColumn(columns, "card-3", "col-b", 0);
    expect(result[1].cardIds).toEqual(["card-3"]);
  });
});
