// Client for the backend API. The frontend is served from the same origin as
// the backend, so cookies are sent automatically.

import type { BoardData, BoardMeta } from "@/lib/kanban";

async function jsonOrThrow<T>(res: Response, action: string): Promise<T> {
  if (!res.ok) throw new Error(`${action} failed (${res.status})`);
  return res.json();
}

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
  return jsonOrThrow(res, "Login");
}

export async function register(
  username: string,
  password: string
): Promise<{ username: string }> {
  const res = await fetch("/api/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (res.status === 409) throw new Error("That username is already taken");
  if (res.status === 422) throw new Error("Username and password are required");
  return jsonOrThrow(res, "Sign up");
}

export async function logout(): Promise<void> {
  await fetch("/api/logout", { method: "POST" });
}

export async function listBoards(): Promise<BoardMeta[]> {
  const res = await fetch("/api/boards");
  return jsonOrThrow(res, "Load boards");
}

export async function createBoard(name: string): Promise<BoardMeta> {
  const res = await fetch("/api/boards", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  return jsonOrThrow(res, "Create board");
}

export type BoardDetail = BoardMeta & { data: BoardData };

export async function getBoard(boardId: number): Promise<BoardDetail> {
  const res = await fetch(`/api/boards/${boardId}`);
  return jsonOrThrow(res, "Load board");
}

export async function saveBoard(boardId: number, board: BoardData): Promise<void> {
  const res = await fetch(`/api/boards/${boardId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(board),
  });
  if (!res.ok) throw new Error(`Failed to save board (${res.status})`);
}

export async function renameBoard(
  boardId: number,
  name: string
): Promise<BoardMeta> {
  const res = await fetch(`/api/boards/${boardId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  return jsonOrThrow(res, "Rename board");
}

export async function deleteBoard(boardId: number): Promise<void> {
  const res = await fetch(`/api/boards/${boardId}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`Failed to delete board (${res.status})`);
}

export type ChatMessage = { role: "user" | "assistant"; content: string };

export type ChatReply = { reply: string; board_update: BoardData | null };

export async function chat(
  boardId: number,
  message: string,
  history: ChatMessage[]
): Promise<ChatReply> {
  const res = await fetch(`/api/boards/${boardId}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, history }),
  });
  if (!res.ok) throw new Error(`Chat failed (${res.status})`);
  return res.json();
}
