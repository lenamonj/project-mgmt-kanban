import { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import clsx from "clsx";
import type { Card } from "@/lib/kanban";

type KanbanCardProps = {
  card: Card;
  onDelete: (cardId: string) => void;
  onEdit: (cardId: string, title: string, details: string) => void;
};

export const KanbanCard = ({ card, onDelete, onEdit }: KanbanCardProps) => {
  const {
    listeners,
    attributes,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: card.id });
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(card.title);
  const [details, setDetails] = useState(card.details);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const startEditing = () => {
    setTitle(card.title);
    setDetails(card.details);
    setEditing(true);
  };

  const save = () => {
    const nextTitle = title.trim();
    if (!nextTitle) return;
    onEdit(card.id, nextTitle, details.trim() || "No details yet.");
    setEditing(false);
  };

  const cancel = () => {
    setEditing(false);
  };

  // Pointer drag works from anywhere on the card via listeners, disabled while
  // editing so the inputs receive pointer events. dnd-kit's role="button"
  // attributes go on the dedicated drag handle below rather than the article
  // (which would nest the Edit/Delete buttons inside a button); the handle is
  // the focusable activator that lets the KeyboardSensor start a keyboard drag.
  const dragProps = editing ? {} : listeners;

  return (
    <article
      ref={setNodeRef}
      style={style}
      className={clsx(
        "rounded-2xl border border-transparent bg-white px-4 py-4 shadow-[0_12px_24px_rgba(3,33,71,0.08)]",
        // Only animate shadow/opacity; dnd-kit drives transform via inline style.
        "transition-[box-shadow,opacity] duration-150",
        isDragging && "opacity-60 shadow-[0_18px_32px_rgba(3,33,71,0.16)]"
      )}
      {...dragProps}
      data-testid={`card-${card.id}`}
    >
      {editing ? (
        <div className="flex flex-col gap-3">
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            aria-label="Card title"
            placeholder="Card title"
            className="rounded-lg border border-[var(--stroke)] bg-[var(--surface)] px-3 py-2 font-display text-base font-semibold text-[var(--navy-dark)] outline-none focus:border-[var(--primary-blue)]"
          />
          <textarea
            value={details}
            onChange={(event) => setDetails(event.target.value)}
            aria-label="Card details"
            placeholder="Details"
            rows={3}
            className="rounded-lg border border-[var(--stroke)] bg-[var(--surface)] px-3 py-2 text-sm leading-6 text-[var(--navy-dark)] outline-none focus:border-[var(--primary-blue)]"
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={save}
              className="rounded-lg bg-[var(--secondary-purple)] px-3 py-1.5 text-xs font-semibold text-white transition hover:opacity-90"
            >
              Save
            </button>
            <button
              type="button"
              onClick={cancel}
              className="rounded-lg border border-[var(--stroke)] px-3 py-1.5 text-xs font-semibold text-[var(--gray-text)] transition hover:text-[var(--navy-dark)]"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-2">
          <button
            type="button"
            ref={setActivatorNodeRef}
            {...attributes}
            aria-label={`Drag ${card.title}`}
            className="mt-0.5 shrink-0 cursor-grab touch-none rounded-md p-1 text-[var(--gray-text)] transition hover:text-[var(--navy-dark)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--primary-blue)]"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="currentColor"
              aria-hidden="true"
            >
              <circle cx="5" cy="3" r="1.2" />
              <circle cx="9" cy="3" r="1.2" />
              <circle cx="5" cy="7" r="1.2" />
              <circle cx="9" cy="7" r="1.2" />
              <circle cx="5" cy="11" r="1.2" />
              <circle cx="9" cy="11" r="1.2" />
            </svg>
          </button>
          <div className="flex-1">
            <h4 className="font-display text-base font-semibold text-[var(--navy-dark)]">
              {card.title}
            </h4>
            <p className="mt-2 text-sm leading-6 text-[var(--gray-text)]">
              {card.details}
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <button
              type="button"
              onClick={startEditing}
              className="rounded-full border border-transparent px-2 py-1 text-xs font-semibold text-[var(--gray-text)] transition hover:border-[var(--stroke)] hover:text-[var(--navy-dark)]"
              aria-label={`Edit ${card.title}`}
            >
              Edit
            </button>
            <button
              type="button"
              onClick={() => onDelete(card.id)}
              className="rounded-full border border-transparent px-2 py-1 text-xs font-semibold text-[var(--gray-text)] transition hover:border-[var(--stroke)] hover:text-[var(--navy-dark)]"
              aria-label={`Delete ${card.title}`}
            >
              Remove
            </button>
          </div>
        </div>
      )}
    </article>
  );
};
