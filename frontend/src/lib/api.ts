// Client for the backend API. The frontend is served from the same origin as
// the backend, so cookies are sent automatically.

import type { BoardData } from "@/lib/kanban";

export async function getMe(): Promise<{ username: string } | null> {
  const res = await fetch("/api/me");
  if (res.status === 401) return null;
  if (!res.ok) throw new Error(`Unexpected /api/me status ${res.status}`);
  return res.json();
}

export async function login(
  username: string,
  password: string
): Promise<{ username: string }> {
  const res = await fetch("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (res.status === 401) throw new Error("Invalid username or password");
  if (!res.ok) throw new Error(`Login failed (${res.status})`);
  return res.json();
}

export async function logout(): Promise<void> {
  await fetch("/api/logout", { method: "POST" });
}

export async function getBoard(): Promise<BoardData> {
  const res = await fetch("/api/board");
  if (!res.ok) throw new Error(`Failed to load board (${res.status})`);
  return res.json();
}

export async function saveBoard(board: BoardData): Promise<void> {
  const res = await fetch("/api/board", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(board),
  });
  if (!res.ok) throw new Error(`Failed to save board (${res.status})`);
}

export type ChatMessage = { role: "user" | "assistant"; content: string };

export type ChatReply = { reply: string; board_update: BoardData | null };

export async function chat(
  message: string,
  history: ChatMessage[]
): Promise<ChatReply> {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, history }),
  });
  if (!res.ok) throw new Error(`Chat failed (${res.status})`);
  return res.json();
}
