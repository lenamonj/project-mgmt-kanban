import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ChatSidebar } from "@/components/ChatSidebar";
import * as api from "@/lib/api";

vi.mock("@/lib/api", () => ({
  chat: vi.fn(),
}));

const board = {
  columns: [{ id: "col-a", title: "A", cardIds: ["x"] }],
  cards: { x: { id: "x", title: "X", details: "d" } },
};

describe("ChatSidebar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sends a message and shows the assistant reply", async () => {
    vi.mocked(api.chat).mockResolvedValue({ reply: "Hi there", board_update: null });
    const onBoardUpdate = vi.fn();
    render(<ChatSidebar boardId={1} onBoardUpdate={onBoardUpdate} />);

    await userEvent.click(screen.getByTestId("chat-toggle"));
    await userEvent.type(screen.getByTestId("chat-input"), "hello");
    await userEvent.click(screen.getByTestId("chat-send"));

    expect(await screen.findByText("Hi there")).toBeInTheDocument();
    expect(screen.getByText("hello")).toBeInTheDocument();
    expect(onBoardUpdate).not.toHaveBeenCalled();
  });

  it("applies a board update from the assistant", async () => {
    vi.mocked(api.chat).mockResolvedValue({ reply: "Done", board_update: board });
    const onBoardUpdate = vi.fn();
    render(<ChatSidebar boardId={1} onBoardUpdate={onBoardUpdate} />);

    await userEvent.click(screen.getByTestId("chat-toggle"));
    await userEvent.type(screen.getByTestId("chat-input"), "add a card");
    await userEvent.click(screen.getByTestId("chat-send"));

    expect(await screen.findByText("Done")).toBeInTheDocument();
    expect(onBoardUpdate).toHaveBeenCalledWith(board);
  });

  it("shows an error when the request fails", async () => {
    vi.mocked(api.chat).mockRejectedValue(new Error("boom"));
    render(<ChatSidebar boardId={1} onBoardUpdate={vi.fn()} />);

    await userEvent.click(screen.getByTestId("chat-toggle"));
    await userEvent.type(screen.getByTestId("chat-input"), "hello");
    await userEvent.click(screen.getByTestId("chat-send"));

    expect(await screen.findByTestId("chat-error")).toBeInTheDocument();
  });
});
