# Frontend

Kanban board gated behind a fake login, backed by the API: the board is loaded from `GET /api/board` and every change is saved via `PUT /api/board`. Cards are drag-and-drop, editable inline, addable, deletable. An AI chat sidebar can modify the board. Auth is a real backend session.

## Stack

- Next.js 16 (App Router)
- React 19
- TypeScript (strict)
- Tailwind CSS 4 (`@tailwindcss/postcss`)
- `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` for drag and drop
- `clsx` for className composition

## Structure

- `src/app/` - `layout.tsx` (fonts, metadata), `page.tsx` (renders `<AuthGate />`), `globals.css`
- `src/components/` - `AuthGate.tsx` (checks `/api/me`, renders login or board), `LoginForm.tsx`, `KanbanBoard.tsx` (takes optional `onLogout`), `KanbanColumn.tsx`, `KanbanCard.tsx` (display + inline edit mode), `KanbanCardPreview.tsx`, `NewCardForm.tsx`, `ChatSidebar.tsx` (AI chat)
- `src/lib/kanban.ts` - types `Card` / `Column` / `BoardData`, plus `moveCard`, `columnIdForItem`, `placeCardInColumn`, `createId`, and the `initialData` seed
- `src/lib/api.ts` - backend client: `getMe`, `login`, `logout`, `getBoard`, `saveBoard`, `chat`; same-origin fetch
- `src/test/` - Vitest setup
- `tests/` - Playwright e2e specs + `helpers.ts` (`login`)

## State

`KanbanBoard.tsx` (`"use client"`) loads the board from `GET /api/board` on mount and renders loading / load-error states. User changes go through an `update()` helper that sets a `dirty` ref; an effect then persists the board with `PUT /api/board` (save failures show a small indicator). `moveCard` (in `src/lib/kanban.ts`) handles reorder-within-column and move-between-columns. `initialData` defines the seed board shape and is used as the reset baseline in tests.

## Tests

- Unit (Vitest, jsdom): `src/lib/kanban.test.ts`, `src/components/KanbanBoard.test.tsx`, `src/components/ChatSidebar.test.tsx`
- E2E (Playwright): `tests/auth.spec.ts`, `tests/kanban.spec.ts`, `tests/chat.spec.ts` (routes `/api/chat` to a mock so no live AI call). Runs against the integrated app on `http://127.0.0.1:8000` - `e2e-server.mjs` (the configured `webServer`) builds the frontend and serves it through uvicorn with `STATIC_DIR` pointed at `out/`, so auth and API are real. Requires `uv` available. Runs with `workers: 1` because all tests share the single backend board; the `login` helper resets the board to the seed for determinism
- Scripts: `npm run test:unit`, `npm run test:e2e`, `npm run test:all`

## Design tokens

Color palette as CSS variables in `src/app/globals.css`, matching the project scheme: accent yellow `#ecad0a`, primary blue `#209dd7`, secondary purple `#753991`, dark navy `#032147`, gray text `#888888`.

## Build and serving

`next.config.ts` sets `output: "export"`, so `npm run build` produces a static site in `frontend/out`. The Docker multi-stage build (repo-root `Dockerfile`) builds this and copies `out/` into the backend's `app/static`, where FastAPI serves it at `/`.

## AI chat

`ChatSidebar` calls `POST /api/chat` with the message and prior history. On a `board_update` it calls `onBoardUpdate`, and `KanbanBoard` applies it to state (the backend has already persisted it). Responses typically take 20-50 seconds; the model returns the entire board on each call.
