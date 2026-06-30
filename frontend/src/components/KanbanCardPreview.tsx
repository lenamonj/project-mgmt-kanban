import type { Card } from "@/lib/kanban";

type KanbanCardPreviewProps = {
  card: Card;
};

export const KanbanCardPreview = ({ card }: KanbanCardPreviewProps) => (
  <article className="rounded-2xl border border-[var(--stroke)] bg-white px-3 py-3 shadow-[0_18px_32px_rgba(3,33,71,0.16)]">
    <h4 className="font-display text-[0.95rem] font-semibold leading-5 text-[var(--navy-dark)]">
      {card.title}
    </h4>
    <p className="mt-1.5 text-sm leading-6 text-[var(--gray-text)]">
      {card.details}
    </p>
  </article>
);
