# Code Review

A full-repo review of Project Management Studio: backend (FastAPI), frontend (Next.js), and cross-cutting concerns (Docker, config, secrets, scripts, docs). Severities reflect that this is an explicitly local, single-user Docker MVP with a documented fake login, not an internet-facing service.

## Summary

The codebase is clean, well-structured, and the documentation (`ARCHITECTURE.md`, `DATABASE.md`, the `AGENTS.md` set) matches the code with no drift. The build is reproducible (`uv sync --frozen`, `npm ci`, ordered layer caching). The highest-priority issues from the prior review (AI error handling, chat role injection, keyboard accessibility, orphan card crash, non-root container) have all been addressed. The remaining items are low-severity polish and operational hygiene.

## Verification: issues resolved

The following items from the prior review have been verified as fixed:

| Issue | Resolution | Files |
|-------|-----------|-------|
| No timeout on OpenRouter call | `TIMEOUT_SECONDS = 30` on the `OpenAI` client | `ai.py:12,23-25` |
| OpenAI client rebuilt per request | Lazy-initialized module-level singleton `_client_instance` | `ai.py:14-26` |
| `content is None` crash | Raises `RuntimeError("AI returned no content")` | `ai.py:35-36` |
| AI call path no error handling | Broad `except Exception` returns 502 | `chat.py:54-55` |
| Chat history accepts arbitrary roles | `role: Literal["user", "assistant"]` in Pydantic model | `schemas.py:29` |
| Credentials hardcoded with no override | `APP_USERNAME` / `APP_PASSWORD` env vars with defaults | `config.py:13-14` |
| Container runs as root | `adduser --system --no-create-home appuser` + `USER appuser` | `Dockerfile:22-25` |
| Drag-and-drop keyboard-inaccessible | `KeyboardSensor` with `sortableKeyboardCoordinates` added; `attributes` spread on drag handle | `KanbanBoard.tsx:69-71`, `KanbanCard.tsx:108` |
| Orphaned card id crashes render | `flatMap` filters missing cards before passing to column | `KanbanBoard.tsx:301-302` |
| `logout()` failure leaves UI stuck | `try/finally` ensures `setStatus("anon")` runs | `AuthGate.tsx:19-24` |
| Secrets leaked to repo | `.env` gitignored, not tracked, never in history | `.gitignore:130` |
| AI board edits lost on reload | `board_update` persisted server-side before response | `chat.py:56-57` |

## Backend

### Medium

- **Hardcoded credentials are env-overridable but still default to `user`/`password`.** `config.py:13-14`. This is the documented MVP design. The env override means the app can be locked down without code changes, which satisfies the original concern.
  - Action: none required for MVP. If deploying beyond localhost, set `APP_USERNAME` and `APP_PASSWORD`.

- **Session cookie `Secure` flag is env-gated but off by default.** `config.py:7` reads `HTTPS_ONLY` env var. Off for local dev, on when set. Correct behavior.
  - Action: none required. Document that `HTTPS_ONLY=true` must be set for non-loopback deployments.

### Low

- **No rate limiting on login attempts.** `routers/auth.py` accepts unlimited POST to `/api/login`. An attacker can brute-force the single credential set. Acceptable for local-only MVP.
  - Action: if deploying beyond localhost, add rate limiting middleware (e.g., `slowapi`).

- **No CSRF protection on state-changing endpoints.** Session cookie is the only auth mechanism. Same-origin policy mitigates this for browser clients. Acceptable for local-only MVP.
  - Action: none required for local use. For network deployment, add CSRF tokens.

- **DB layer has potential race conditions on concurrent writes.** `db.py` `get_or_create_user` does SELECT-then-INSERT without a transaction. Two concurrent requests with the same new username could hit a UNIQUE constraint violation. `save_board` similarly does read-then-write without a transaction. Acceptable for single-user local use.
  - Action: if concurrency is needed, use `INSERT ... ON CONFLICT DO NOTHING` and explicit transactions with `BEGIN IMMEDIATE`.

- **No board size limits.** `routers/board.py` accepts arbitrarily large `Board` JSON payloads. A buggy client could write excessive data to SQLite. Low risk for local use.
  - Action: add validation in `Board` model (e.g., max card count, max text length per field).

- **Test gap: AI-call exceptions.** `tests/test_main.py` covers invalid AI JSON and upstream failures, but does not test the specific error messages returned. The existing tests at lines 130-142 are sufficient for regression coverage.
  - Action: optional. Add a test asserting the 502 detail message matches expectations.

## Frontend

### Low

- **Duplicate `aria-label="Column title"` across all columns.** `KanbanColumn.tsx` renders the same label for every column's title input. Screen readers cannot distinguish which column is being edited.
  - Action: ``aria-label={`${column.title} column title`}``.

- **No focus management in `NewCardForm`.** When the add-card form opens, focus stays on the button's former position. The title input should receive focus automatically.
  - Action: add `autoFocus` to the title input, or use a `useEffect` + `ref` to focus when `isOpen` becomes true.

- **Missing `aria-live` for error messages.** `LoginForm.tsx` and `ChatSidebar.tsx` display errors without `role="alert"` or `aria-live="polite"`. Screen readers will not announce them.
  - Action: add `role="alert"` to error message elements.

- **No `prefers-reduced-motion` handling.** The app uses `transition` classes extensively. Users who prefer reduced motion get animations anyway.
  - Action: use Tailwind's `motion-safe:` prefix for transitions, or add a CSS media query.

- **Duplicate function `columnIdForItem` and `findColumnId` in `kanban.ts`.** Both do the same thing. `columnIdForItem` is exported and used externally; `findColumnId` is private and used only inside `moveCard`.
  - Action: remove `findColumnId` and use `columnIdForItem` inside `moveCard`.

- **Redundant client save path for AI edits.** `KanbanBoard.tsx:321` calls `setBoard(next)` directly, bypassing the `dirty` ref. Not a bug (the backend already persisted the update), but it diverges from the `update()` convention.
  - Action: leave as-is and add a comment noting the server already saved.

- **Test gaps.** No unit test asserting `saveBoard` after an AI `board_update`; no test that the send button is disabled while a chat request is in flight (double-submit); no e2e for delete-card, drag-cancel (Escape), or session survival across reload.
  - Action: add tests for these flows as coverage improves.

## Cross-cutting

### Medium

- **`SESSION_SECRET` default is a known weak value.** `config.py:4` defaults to `"dev-secret-change-me"`. Forgeable cookies if deployed without setting the env var. The `.env.example` should warn explicitly.
  - Action: update `.env.example` comment to state the default must not be used for any non-local deployment.

### Low

- **No `restart` policy.** `docker-compose.yml` defaults to `no`; the container stays down after a crash or host reboot.
  - Action: add `restart: unless-stopped` to the `app` service.

- **No `HEALTHCHECK`.** `/api/health` exists but Docker cannot use it to detect a hung process.
  - Action: add `HEALTHCHECK CMD curl -f http://localhost:8000/api/health || exit 1` to `Dockerfile`.

- **No CI.** No `.github/workflows/`. Tests exist but never run automatically.
  - Action: add a workflow running `uv run pytest` and `npm run test:all` on push.

- **No `LICENSE`.** Public repo with no license means default copyright; no one can legally reuse it.
  - Action: add a `LICENSE` (MIT is typical).

- **Shell scripts may lack execute bits on clone.** `scripts/start.sh` / `stop.sh`. Add `chmod +x scripts/*.sh` to `scripts/AGENTS.md`, or set the bit with `git update-index --chmod=+x`.

- **Duplicated seed data.** `backend/app/seed.py` `DEFAULT_BOARD` must be kept manually in sync with `frontend/src/lib/kanban.ts` `initialData`. No single source of truth.
  - Action: add a test asserting `Board(**DEFAULT_BOARD).model_dump() == initialData` (or similar) to catch drift.

- **No `suppressHydrationWarning` on `<html>`.** Browser extensions or Next.js middleware could add attributes causing hydration mismatches.
  - Action: add `suppressHydrationWarning` to `<html>` in `layout.tsx`.

## Prioritized actions

1. Add test asserting seed data parity between `backend/app/seed.py` and `frontend/src/lib/kanban.ts` (cross-cutting Medium).
2. Update `.env.example` to warn against using the default `SESSION_SECRET` in non-local deployments (cross-cutting Medium).
3. Add `restart: unless-stopped` and `HEALTHCHECK` to Docker config (cross-cutting Low).
4. Add CI workflow and `LICENSE` file (cross-cutting Low).
5. Fix duplicate `aria-label` on column title inputs (frontend Low).
6. Remove duplicate `findColumnId` function from `kanban.ts` (frontend Low).
7. Add focus management and `aria-live` regions for accessibility (frontend Low).
