"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  rectIntersection,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { KanbanColumn } from "@/components/KanbanColumn";
import { KanbanCardPreview } from "@/components/KanbanCardPreview";
import { ChatSidebar } from "@/components/ChatSidebar";
import {
  columnIdForItem,
  createId,
  moveCard,
  placeCardInColumn,
  type BoardData,
} from "@/lib/kanban";
import { getBoard, saveBoard } from "@/lib/api";

type LoadStatus = "loading" | "ready" | "error";

export const KanbanBoard = ({ onLogout }: { onLogout?: () => void } = {}) => {
  const [board, setBoard] = useState<BoardData | null>(null);
  const [status, setStatus] = useState<LoadStatus>("loading");
  const [saveFailed, setSaveFailed] = useState(false);
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  // Persist only when a change is committed (dirty), not on transient drag-over
  // updates. Snapshot lets us revert a cancelled drag.
  const dirty = useRef(false);
  const dragStartBoard = useRef<BoardData | null>(null);

  useEffect(() => {
    getBoard()
      .then((b) => {
        setBoard(b);
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
  }, []);

  useEffect(() => {
    if (!board || !dirty.current) return;
    dirty.current = false;
    setSaveFailed(false);
    saveBoard(board).catch(() => setSaveFailed(true));
  }, [board]);

  // Apply a user change locally and flag it for persistence.
  const update = (updater: (prev: BoardData) => BoardData) => {
    dirty.current = true;
    setBoard((prev) => (prev ? updater(prev) : prev));
  };

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const cardsById = useMemo(() => board?.cards ?? {}, [board?.cards]);
  const columnIds = useMemo(
    () => new Set(board?.columns.map((c) => c.id) ?? []),
    [board?.columns]
  );

  // Pointer-based collision detection so a card can be dropped into a tall,
  // empty column (distance-based detection favors nearby cards over a large
  // empty area). Prefer the card under the pointer; fall back to the column.
  const collisionDetection = useCallback<CollisionDetection>(
    (args) => {
      const pointer = pointerWithin(args);
      const collisions = pointer.length ? pointer : rectIntersection(args);
      const overCard = collisions.find((c) => !columnIds.has(String(c.id)));
      return overCard ? [overCard] : collisions;
    },
    [columnIds]
  );

  const handleDragStart = (event: DragStartEvent) => {
    dragStartBoard.current = board;
    setActiveCardId(event.active.id as string);
  };

  // Move the card between columns live as it is dragged over another column.
  // Same-column reordering is handled visually by the sortable context and
  // finalized in handleDragEnd. These updates are transient (not persisted).
  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;
    setBoard((prev) => {
      if (!prev) return prev;
      const activeColumn = columnIdForItem(prev.columns, active.id as string);
      const overColumn = columnIdForItem(prev.columns, over.id as string);
      if (!activeColumn || !overColumn || activeColumn === overColumn) {
        return prev;
      }
      const target = prev.columns.find((c) => c.id === overColumn)!;
      const overIsColumn = over.id === overColumn;
      const overIndex = target.cardIds.indexOf(over.id as string);
      const index =
        overIsColumn || overIndex < 0 ? target.cardIds.length : overIndex;
      return {
        ...prev,
        columns: placeCardInColumn(
          prev.columns,
          active.id as string,
          overColumn,
          index
        ),
      };
    });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveCardId(null);
    dragStartBoard.current = null;

    // Finalize ordering and persist. The cross-column move already happened in
    // handleDragOver; here we settle the position within the target column.
    update((prev) => {
      if (!over) return { ...prev };
      const activeColumn = columnIdForItem(prev.columns, active.id as string);
      const overColumn = columnIdForItem(prev.columns, over.id as string);
      if (activeColumn && overColumn && activeColumn === overColumn) {
        return {
          ...prev,
          columns: moveCard(prev.columns, active.id as string, over.id as string),
        };
      }
      return { ...prev };
    });
  };

  const handleDragCancel = () => {
    setActiveCardId(null);
    // Revert any live cross-column movement to the pre-drag state.
    if (dragStartBoard.current) {
      const snapshot = dragStartBoard.current;
      dragStartBoard.current = null;
      setBoard(snapshot);
    }
  };

  const handleRenameColumn = (columnId: string, title: string) => {
    update((prev) => ({
      ...prev,
      columns: prev.columns.map((column) =>
        column.id === columnId ? { ...column, title } : column
      ),
    }));
  };

  const handleAddCard = (columnId: string, title: string, details: string) => {
    const id = createId("card");
    update((prev) => ({
      ...prev,
      cards: {
        ...prev.cards,
        [id]: { id, title, details: details || "No details yet." },
      },
      columns: prev.columns.map((column) =>
        column.id === columnId
          ? { ...column, cardIds: [...column.cardIds, id] }
          : column
      ),
    }));
  };

  const handleEditCard = (cardId: string, title: string, details: string) => {
    update((prev) => ({
      ...prev,
      cards: { ...prev.cards, [cardId]: { ...prev.cards[cardId], title, details } },
    }));
  };

  const handleDeleteCard = (columnId: string, cardId: string) => {
    update((prev) => ({
      ...prev,
      cards: Object.fromEntries(
        Object.entries(prev.cards).filter(([id]) => id !== cardId)
      ),
      columns: prev.columns.map((column) =>
        column.id === columnId
          ? {
              ...column,
              cardIds: column.cardIds.filter((id) => id !== cardId),
            }
          : column
      ),
    }));
  };

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-[var(--gray-text)]">
        Loading board...
      </div>
    );
  }

  if (status === "error" || !board) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-[var(--secondary-purple)]">
        Could not load your board. Please refresh.
      </div>
    );
  }

  const activeCard = activeCardId ? cardsById[activeCardId] : null;
  const totalCards = Object.keys(cardsById).length;

  return (
    <div className="relative overflow-hidden">
      <div className="pointer-events-none absolute left-0 top-0 h-[420px] w-[420px] -translate-x-1/3 -translate-y-1/3 rounded-full bg-[radial-gradient(circle,_rgba(32,157,215,0.25)_0%,_rgba(32,157,215,0.05)_55%,_transparent_70%)]" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-[520px] w-[520px] translate-x-1/4 translate-y-1/4 rounded-full bg-[radial-gradient(circle,_rgba(117,57,145,0.18)_0%,_rgba(117,57,145,0.05)_55%,_transparent_75%)]" />

      <main className="relative mx-auto flex min-h-screen w-full max-w-[1760px] flex-col gap-6 px-4 pb-10 pt-6 sm:px-6 xl:px-10">
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
                Single board kanban
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {saveFailed ? (
              <p
                data-testid="save-failed"
                className="text-xs font-semibold text-[var(--secondary-purple)]"
              >
                Changes could not be saved.
              </p>
            ) : null}
            <div className="hidden items-baseline gap-1.5 rounded-full border border-[var(--stroke)] bg-[var(--surface)] px-4 py-2 sm:flex">
              <span className="text-lg font-semibold leading-none text-[var(--primary-blue)]">
                {totalCards}
              </span>
              <span className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-[var(--gray-text)]">
                cards
              </span>
            </div>
            {onLogout ? (
              <button
                type="button"
                onClick={onLogout}
                data-testid="logout-button"
                className="rounded-full border border-[var(--stroke)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--navy-dark)] transition hover:border-[var(--secondary-purple)] hover:text-[var(--secondary-purple)]"
              >
                Log out
              </button>
            ) : null}
          </div>
        </header>

        <DndContext
          sensors={sensors}
          collisionDetection={collisionDetection}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
          <section className="grid flex-1 gap-4 sm:grid-cols-2 lg:grid-cols-5 lg:gap-5">
            {board.columns.map((column) => (
              <KanbanColumn
                key={column.id}
                column={column}
                cards={column.cardIds.flatMap((cardId) =>
                  board.cards[cardId] ? [board.cards[cardId]] : []
                )}
                onRename={handleRenameColumn}
                onAddCard={handleAddCard}
                onDeleteCard={handleDeleteCard}
                onEditCard={handleEditCard}
              />
            ))}
          </section>
          <DragOverlay>
            {activeCard ? (
              <div className="w-[260px]">
                <KanbanCardPreview card={activeCard} />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </main>

      <ChatSidebar onBoardUpdate={(next) => setBoard(next)} />
    </div>
  );
};
