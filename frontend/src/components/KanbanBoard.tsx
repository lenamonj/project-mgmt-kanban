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

export const KanbanBoard = ({ boardId }: { boardId: number }) => {
  const [board, setBoard] = useState<BoardData | null>(null);
  const [status, setStatus] = useState<LoadStatus>("loading");
  const [saveFailed, setSaveFailed] = useState(false);
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  // Persist only when a change is committed (dirty), not on transient drag-over
  // updates. Snapshot lets us revert a cancelled drag.
  const dirty = useRef(false);
  const dragStartBoard = useRef<BoardData | null>(null);

  // KanbanBoard is mounted with key={boardId}, so each board gets a fresh
  // instance starting from the loading state; no in-effect reset is needed.
  useEffect(() => {
    let active = true;
    getBoard(boardId)
      .then((detail) => {
        if (!active) return;
        setBoard(detail.data);
        setStatus("ready");
      })
      .catch(() => active && setStatus("error"));
    return () => {
      active = false;
    };
  }, [boardId]);

  useEffect(() => {
    if (!board || !dirty.current) return;
    dirty.current = false;
    saveBoard(boardId, board)
      .then(() => setSaveFailed(false))
      .catch(() => setSaveFailed(true));
  }, [board, boardId]);

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
      <div className="flex flex-1 items-center justify-center py-20 text-sm text-[var(--gray-text)]">
        Loading board...
      </div>
    );
  }

  if (status === "error" || !board) {
    return (
      <div
        data-testid="board-error"
        className="flex flex-1 items-center justify-center py-20 text-sm text-[var(--secondary-purple)]"
      >
        Could not load this board. Please refresh.
      </div>
    );
  }

  const activeCard = activeCardId ? cardsById[activeCardId] : null;

  return (
    <div className="flex flex-1 flex-col gap-4">
      {saveFailed ? (
        <p
          data-testid="save-failed"
          className="rounded-xl border border-[var(--secondary-purple)] bg-white/70 px-4 py-2 text-xs font-semibold text-[var(--secondary-purple)]"
        >
          Changes could not be saved.
        </p>
      ) : null}

      <DndContext
        sensors={sensors}
        collisionDetection={collisionDetection}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <section className="flex flex-1 items-stretch gap-4 overflow-x-auto pb-2">
          {board.columns.map((column) => (
            <div key={column.id} className="w-[300px] shrink-0">
              <KanbanColumn
                column={column}
                cards={column.cardIds.flatMap((cardId) =>
                  board.cards[cardId] ? [board.cards[cardId]] : []
                )}
                onRename={handleRenameColumn}
                onAddCard={handleAddCard}
                onDeleteCard={handleDeleteCard}
                onEditCard={handleEditCard}
              />
            </div>
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

      <ChatSidebar boardId={boardId} onBoardUpdate={(next) => setBoard(next)} />
    </div>
  );
};
