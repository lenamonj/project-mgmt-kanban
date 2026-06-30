"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { KanbanBoard } from "@/components/KanbanBoard";
import {
  createBoard,
  deleteBoard,
  listBoards,
  renameBoard,
} from "@/lib/api";
import type { BoardMeta } from "@/lib/kanban";

type Status = "loading" | "ready" | "error";

type WorkspaceProps = { username?: string | null; onLogout: () => void };

export const Workspace = ({ username, onLogout }: WorkspaceProps) => {
  const [boards, setBoards] = useState<BoardMeta[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const renameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    listBoards()
      .then((list) => {
        setBoards(list);
        setActiveId(list[0]?.id ?? null);
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
  }, []);

  useEffect(() => {
    if (renaming) renameInputRef.current?.focus();
  }, [renaming]);

  const activeBoard = boards.find((b) => b.id === activeId) ?? null;

  const switchTo = (id: number) => {
    setActiveId(id);
    setRenaming(false);
    setConfirmingDelete(false);
  };

  const handleNewBoard = async () => {
    const created = await createBoard("Untitled board");
    setBoards((prev) => [...prev, created]);
    setActiveId(created.id);
    setConfirmingDelete(false);
    setRenameValue(created.name);
    setRenaming(true);
  };

  const submitRename = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = renameValue.trim();
    if (!activeBoard || !name) {
      setRenaming(false);
      return;
    }
    const updated = await renameBoard(activeBoard.id, name);
    setBoards((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
    setRenaming(false);
  };

  const handleDelete = async () => {
    if (!activeBoard) return;
    await deleteBoard(activeBoard.id);
    const remaining = boards.filter((b) => b.id !== activeBoard.id);
    setBoards(remaining);
    setActiveId(remaining[0]?.id ?? null);
    setConfirmingDelete(false);
  };

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute left-0 top-0 h-[420px] w-[420px] -translate-x-1/3 -translate-y-1/3 rounded-full bg-[radial-gradient(circle,_rgba(32,157,215,0.25)_0%,_rgba(32,157,215,0.05)_55%,_transparent_70%)]" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-[520px] w-[520px] translate-x-1/4 translate-y-1/4 rounded-full bg-[radial-gradient(circle,_rgba(117,57,145,0.18)_0%,_rgba(117,57,145,0.05)_55%,_transparent_75%)]" />

      <main className="relative mx-auto flex min-h-screen w-full max-w-[1760px] flex-col gap-5 px-4 pb-10 pt-6 sm:px-6 xl:px-10">
        <header className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[var(--stroke)] bg-white/80 px-5 py-4 shadow-[var(--shadow)] backdrop-blur">
          <div className="flex items-center gap-4">
            <span
              aria-hidden="true"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--navy-dark)] font-display text-sm font-bold tracking-wide text-white"
            >
              PM
            </span>
            <div>
              <h1 className="font-display text-xl font-semibold leading-tight text-[var(--navy-dark)] sm:text-2xl">
                Project Management Studio
              </h1>
              <p className="text-[0.7rem] font-semibold uppercase tracking-[0.28em] text-[var(--gray-text)]">
                {username ? `Signed in as ${username}` : "Workspace"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onLogout}
            data-testid="logout-button"
            className="rounded-full border border-[var(--stroke)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--navy-dark)] transition hover:border-[var(--secondary-purple)] hover:text-[var(--secondary-purple)]"
          >
            Log out
          </button>
        </header>

        {status === "loading" ? (
          <div className="flex flex-1 items-center justify-center py-20 text-sm text-[var(--gray-text)]">
            Loading workspace...
          </div>
        ) : status === "error" ? (
          <div className="flex flex-1 items-center justify-center py-20 text-sm text-[var(--secondary-purple)]">
            Could not load your boards. Please refresh.
          </div>
        ) : (
          <>
            <nav
              data-testid="board-bar"
              className="flex flex-wrap items-center gap-2 rounded-2xl border border-[var(--stroke)] bg-white/70 px-4 py-3 shadow-[var(--shadow)] backdrop-blur"
            >
              {boards.map((board) => (
                <button
                  key={board.id}
                  type="button"
                  onClick={() => switchTo(board.id)}
                  data-testid={`board-tab-${board.id}`}
                  aria-current={board.id === activeId}
                  className={clsx(
                    "rounded-full px-4 py-2 text-sm font-semibold transition",
                    board.id === activeId
                      ? "bg-[var(--secondary-purple)] text-white"
                      : "border border-[var(--stroke)] text-[var(--navy-dark)] hover:border-[var(--secondary-purple)] hover:text-[var(--secondary-purple)]"
                  )}
                >
                  {board.name}
                </button>
              ))}
              <button
                type="button"
                onClick={handleNewBoard}
                data-testid="new-board"
                className="rounded-full border border-dashed border-[var(--primary-blue)] px-4 py-2 text-sm font-semibold text-[var(--primary-blue)] transition hover:bg-[var(--primary-blue)] hover:text-white"
              >
                + New board
              </button>

              <span className="mx-1 hidden h-6 w-px bg-[var(--stroke)] sm:block" />

              {activeBoard ? (
                renaming ? (
                  <form onSubmit={submitRename} className="flex items-center gap-2">
                    <input
                      ref={renameInputRef}
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onBlur={submitRename}
                      aria-label="Board name"
                      data-testid="rename-input"
                      className="rounded-full border border-[var(--primary-blue)] bg-white px-4 py-2 text-sm outline-none"
                    />
                    <button
                      type="submit"
                      data-testid="rename-save"
                      className="rounded-full bg-[var(--primary-blue)] px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white"
                    >
                      Save
                    </button>
                  </form>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setRenameValue(activeBoard.name);
                      setRenaming(true);
                    }}
                    data-testid="rename-board"
                    className="rounded-full border border-[var(--stroke)] px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--navy-dark)] transition hover:border-[var(--primary-blue)] hover:text-[var(--primary-blue)]"
                  >
                    Rename
                  </button>
                )
              ) : null}

              {activeBoard && boards.length > 1 ? (
                confirmingDelete ? (
                  <span className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleDelete}
                      data-testid="confirm-delete"
                      className="rounded-full bg-[var(--secondary-purple)] px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white"
                    >
                      Delete board
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmingDelete(false)}
                      data-testid="cancel-delete"
                      className="rounded-full border border-[var(--stroke)] px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--navy-dark)]"
                    >
                      Cancel
                    </button>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmingDelete(true)}
                    data-testid="delete-board"
                    className="rounded-full border border-[var(--stroke)] px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--navy-dark)] transition hover:border-[var(--secondary-purple)] hover:text-[var(--secondary-purple)]"
                  >
                    Delete
                  </button>
                )
              ) : null}
            </nav>

            {activeId !== null ? (
              <KanbanBoard key={activeId} boardId={activeId} />
            ) : (
              <div className="flex flex-1 items-center justify-center py-20 text-sm text-[var(--gray-text)]">
                Create a board to get started.
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
};
