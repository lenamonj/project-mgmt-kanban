"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { chat, type ChatMessage } from "@/lib/api";
import type { BoardData } from "@/lib/kanban";

export const ChatSidebar = ({
  boardId,
  onBoardUpdate,
}: {
  boardId: number;
  onBoardUpdate: (board: BoardData) => void;
}) => {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView?.({ behavior: "smooth" });
  }, [messages, sending]);

  const send = async (event: React.FormEvent) => {
    event.preventDefault();
    const text = input.trim();
    if (!text || sending) return;
    const history = messages;
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setInput("");
    setSending(true);
    setError(null);
    try {
      const result = await chat(boardId, text, history);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: result.reply },
      ]);
      if (result.board_update) onBoardUpdate(result.board_update);
    } catch {
      setError("Message failed. Please try again.");
    } finally {
      setSending(false);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        data-testid="chat-toggle"
        className="fixed bottom-6 right-6 z-40 rounded-full bg-[var(--secondary-purple)] px-6 py-4 text-sm font-semibold text-white shadow-[var(--shadow)] transition hover:opacity-90"
      >
        Ask the assistant
      </button>
    );
  }

  return (
    <aside
      data-testid="chat-panel"
      className="fixed right-0 top-0 z-40 flex h-screen w-full max-w-md flex-col border-l border-[var(--stroke)] bg-[var(--surface-strong)] shadow-[var(--shadow)]"
    >
      <header className="flex items-center justify-between border-b border-[var(--stroke)] px-6 py-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[var(--gray-text)]">
            Assistant
          </p>
          <h2 className="mt-1 font-display text-xl font-semibold text-[var(--navy-dark)]">
            Board chat
          </h2>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          data-testid="chat-close"
          className="rounded-full border border-[var(--stroke)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--navy-dark)] transition hover:border-[var(--secondary-purple)] hover:text-[var(--secondary-purple)]"
        >
          Close
        </button>
      </header>

      <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-6 py-6">
        {messages.length === 0 ? (
          <p className="text-sm leading-6 text-[var(--gray-text)]">
            Ask me to add, move, rename, or edit cards. For example: &quot;Add a
            card to Review for the launch checklist.&quot;
          </p>
        ) : null}
        {messages.map((message, index) => (
          <div
            key={index}
            data-testid={`chat-message-${message.role}`}
            className={clsx(
              "max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-6",
              message.role === "user"
                ? "self-end bg-[var(--secondary-purple)] text-white"
                : "self-start bg-[var(--surface)] text-[var(--navy-dark)]"
            )}
          >
            {message.content}
          </div>
        ))}
        {sending ? (
          <div className="self-start rounded-2xl bg-[var(--surface)] px-4 py-3 text-sm text-[var(--gray-text)]">
            Thinking...
          </div>
        ) : null}
        {error ? (
          <p
            role="alert"
            data-testid="chat-error"
            className="text-sm font-medium text-[var(--secondary-purple)]"
          >
            {error}
          </p>
        ) : null}
        <div ref={endRef} />
      </div>

      <form
        onSubmit={send}
        className="flex items-center gap-3 border-t border-[var(--stroke)] px-6 py-5"
      >
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Message the assistant"
          data-testid="chat-input"
          className="flex-1 rounded-xl border border-[var(--stroke)] bg-[var(--surface)] px-4 py-3 text-sm outline-none focus:border-[var(--primary-blue)]"
        />
        <button
          type="submit"
          disabled={sending}
          data-testid="chat-send"
          className="rounded-xl bg-[var(--secondary-purple)] px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
        >
          Send
        </button>
      </form>
    </aside>
  );
};
