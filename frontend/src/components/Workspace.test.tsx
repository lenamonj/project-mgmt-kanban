import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Workspace } from "@/components/Workspace";
import { emptyBoard, initialData, type BoardMeta } from "@/lib/kanban";
import * as api from "@/lib/api";

vi.mock("@/lib/api", () => ({
  listBoards: vi.fn(),
  createBoard: vi.fn(),
  renameBoard: vi.fn(),
  deleteBoard: vi.fn(),
  getBoard: vi.fn(),
  saveBoard: vi.fn(async () => {}),
  chat: vi.fn(),
}));

const meta = (id: number, name: string): BoardMeta => ({
  id,
  name,
  created_at: "",
  updated_at: "",
});

const detail = (id: number, name: string, data = initialData) => ({
  ...meta(id, name),
  data,
});

describe("Workspace", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.getBoard).mockImplementation(async (id: number) =>
      detail(id, "Board")
    );
  });

  it("lists boards and opens the first one", async () => {
    vi.mocked(api.listBoards).mockResolvedValue([
      meta(1, "My Board"),
      meta(2, "Launch"),
    ]);
    render(<Workspace onLogout={vi.fn()} />);

    expect(await screen.findByTestId("board-tab-1")).toHaveTextContent("My Board");
    expect(screen.getByTestId("board-tab-2")).toHaveTextContent("Launch");
    // First board's data loaded into the board view.
    expect(await screen.findAllByTestId(/column-/i)).toHaveLength(5);
  });

  it("creates a new board and enters rename mode", async () => {
    vi.mocked(api.listBoards).mockResolvedValue([meta(1, "My Board")]);
    vi.mocked(api.createBoard).mockResolvedValue(meta(2, "Untitled board"));
    vi.mocked(api.getBoard).mockImplementation(async (id: number) =>
      detail(id, "x", id === 2 ? emptyBoard() : initialData)
    );
    render(<Workspace onLogout={vi.fn()} />);

    await userEvent.click(await screen.findByTestId("new-board"));

    expect(api.createBoard).toHaveBeenCalledWith("Untitled board");
    expect(await screen.findByTestId("rename-input")).toBeInTheDocument();
  });

  it("renames the active board", async () => {
    vi.mocked(api.listBoards).mockResolvedValue([meta(1, "My Board")]);
    vi.mocked(api.renameBoard).mockResolvedValue(meta(1, "Roadmap"));
    render(<Workspace onLogout={vi.fn()} />);

    await userEvent.click(await screen.findByTestId("rename-board"));
    const input = screen.getByTestId("rename-input");
    await userEvent.clear(input);
    await userEvent.type(input, "Roadmap");
    await userEvent.click(screen.getByTestId("rename-save"));

    expect(api.renameBoard).toHaveBeenCalledWith(1, "Roadmap");
    expect(await screen.findByTestId("board-tab-1")).toHaveTextContent("Roadmap");
  });

  it("deletes a board after confirmation", async () => {
    vi.mocked(api.listBoards).mockResolvedValue([
      meta(1, "My Board"),
      meta(2, "Launch"),
    ]);
    vi.mocked(api.deleteBoard).mockResolvedValue(undefined);
    render(<Workspace onLogout={vi.fn()} />);

    await userEvent.click(await screen.findByTestId("delete-board"));
    await userEvent.click(screen.getByTestId("confirm-delete"));

    expect(api.deleteBoard).toHaveBeenCalledWith(1);
    expect(screen.queryByTestId("board-tab-1")).not.toBeInTheDocument();
    expect(screen.getByTestId("board-tab-2")).toBeInTheDocument();
  });

  it("hides delete when only one board remains", async () => {
    vi.mocked(api.listBoards).mockResolvedValue([meta(1, "Only")]);
    render(<Workspace onLogout={vi.fn()} />);

    await screen.findByTestId("board-tab-1");
    expect(screen.queryByTestId("delete-board")).not.toBeInTheDocument();
  });
});
