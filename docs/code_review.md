# Code Review

A full-repo review of Project Management Studio: backend (FastAPI), frontend (Next.js), and cross-cutting concerns (Docker, config, secrets, scripts, docs). Every finding below was verified against source; severities reflect that this is an explicitly local, single-user Docker MVP with a documented fake login, not an internet-facing service.

## Summary

The codebase is clean, well-structured, and the documentation (`ARCHITECTURE.md`, `DATABASE.md`, the `AGENTS.md` set) matches the code with no drift. The build is reproducible (`uv sync --frozen`, `npm ci`, ordered layer caching). The highest-value fixes are error handling around the AI call path and a small set of input-validation and accessibility gaps. Two issues initially flagged as critical were disproven during verification and are recorded as such.

### Verification corrections

- **Secrets are not leaked.** `.env` is gitignored (`.gitignore:130`), is not tracked (`git ls-files .env` is empty), and never appears in history. Only `.env.example` is committed. The keys on disk are not exposed by the repo.
- **AI board edits are not lost.** `main.py:157-158` saves `board_update` server-side, so edits survive reload via `GET /api/board`. The frontend's redundant client save path is a minor robustness item, not data loss.

## Backend

### High

- **AI call path has no error handling around upstream failures.** `main.py:146-159` only catches `ValidationError`. `ai.chat()` can raise `KeyError` (missing `OPENROUTER_API_KEY`, `ai.py:15`), `openai.APIConnectionError`, `RateLimitError`, `AuthenticationError`, or `TypeError` when `completion.choices[0].message.content` is `None` (`ai.py:23`, which is passed to `model_validate_json` and is not a `ValidationError`). Each surfaces as a raw 500.
  - Action: in `ai.py`, set a request `timeout` on the `OpenAI` client and raise a clear error when `content is None`. In `main.py`, wrap the `ai.chat()` call in `try/except Exception` and raise `HTTPException(status_code=502)`. Add a startup check or `os.environ.get` for the API key.

- **No timeout on the OpenRouter call.** `ai.py:22` calls `chat.completions.create` with no timeout. A hung upstream holds the worker thread indefinitely. Given AI responses already take 20-50s, this is a realistic stall.
  - Action: `OpenAI(base_url=BASE_URL, api_key=..., timeout=30)`.

- **Chat history accepts arbitrary roles (prompt injection vector).** `ChatMessage.role` is `str` (`main.py:57`) and history is forwarded verbatim to the model (`main.py:98`). A client can inject `{"role": "system", "content": "..."}` after the app's system prompt.
  - Action: `role: Literal["user", "assistant"]`. Pydantic then rejects anything else with a 422.

### Medium

- **Credentials are hardcoded with no override.** `main.py:30-31` (`user` / `password`). This is the documented MVP design, but unlike `SESSION_SECRET` there is no env override, so the app cannot be locked down without a code change.
  - Action: `os.environ.get("APP_USERNAME", "user")` / `os.environ.get("APP_PASSWORD", "password")`, keeping the dev defaults.

- **Session cookie has no `Secure` flag.** `SessionMiddleware` (`main.py:21-24`) defaults to `https_only=False`. Low risk for localhost, relevant the moment this is served over anything but loopback.
  - Action: set `https_only=True` for non-local deployments (env-gated).

- **OpenAI client rebuilt on every request.** `ai.py:14-15` constructs a fresh `OpenAI` (and HTTP connection pool) per call, defeating keep-alive.
  - Action: promote to a lazily-initialised module-level singleton.

### Low

- **Test gap: AI-call exceptions.** `tests/test_main.py` covers invalid AI JSON but not `ai.chat()` raising. Add a test that monkeypatches `ai.chat` to raise and asserts a 5xx, as a regression guard for the error-handling fix above.

## Frontend

### Medium

- **Drag-and-drop is keyboard-inaccessible.** `KanbanBoard.tsx:63-67` configures only `PointerSensor`; `KanbanCard.tsx:14` does not spread `useSortable`'s `attributes` (which supply `tabIndex`/`role`/ARIA). Keyboard and assistive-tech users cannot reorder or move cards.
  - Action: add `KeyboardSensor` with `sortableKeyboardCoordinates`, and spread `attributes` onto the card element (gated like `listeners` so edit mode is unaffected).

- **Orphaned card id from an AI `board_update` can crash render.** `KanbanBoard.tsx:296` indexes `board.cards[cardId]`; with `noUncheckedIndexedAccess` off, TS treats this as defined. If the model returns a `cardId` not present in `cards`, `KanbanCard` dereferences `undefined`.
  - Action: filter orphans (`column.cardIds.flatMap(id => board.cards[id] ? [board.cards[id]] : [])`) or enable `noUncheckedIndexedAccess` in `tsconfig.json`.

- **`logout()` failure leaves the UI stuck authed.** `AuthGate.tsx:19-22` awaits `logout()` then sets `anon`; a rejection skips the state change with no feedback.
  - Action: move `setStatus("anon")` into a `finally`.

### Low

- **Duplicate `aria-label="Column title"` across all columns.** `KanbanColumn.tsx:48`. Screen readers cannot distinguish inputs.
  - Action: `aria-label={`${column.title} column title`}`.

- **Redundant client save path for AI edits.** `KanbanBoard.tsx:314` calls `setBoard(next)` directly, bypassing the `dirty` ref. Not a bug (the backend already persisted the update), but it diverges from the `update()` convention.
  - Action: route through `update(() => next)` for consistency, or leave as-is and add a comment noting the server already saved.

- **Test gaps.** No unit test asserting `saveBoard` after an AI `board_update`; no test that the send button is disabled while a chat request is in flight (double-submit); no e2e for delete-card, drag-cancel (Escape), or session survival across reload.

## Cross-cutting

### Medium

- **Container runs as root.** `Dockerfile` has no `USER` directive.
  - Action: add a non-root user (`adduser --system --no-create-home appuser` then `USER appuser`) before `EXPOSE`.

- **`SESSION_SECRET` default is a known weak value.** `main.py:23` (`dev-secret-change-me`), marked "Optional" in `.env.example`. Forgeable cookies if deployed unset.
  - Action: change the `.env.example` comment to state the default must not be used for any non-local deployment.

### Low

- **No `restart` policy.** `docker-compose.yml` defaults to `no`; the container stays down after a crash or host reboot.
  - Action: `restart: unless-stopped`.

- **No `HEALTHCHECK`.** `/api/health` exists but Docker cannot use it to detect a hung process.
  - Action: add a `HEALTHCHECK` hitting `/api/health`.

- **No CI.** No `.github/workflows/`. Tests exist but never run automatically.
  - Action: add a workflow running `uv run pytest` and `npm run test:all` (or at least `next build`) on push.

- **No `LICENSE`.** Public repo with no license means default copyright; no one can legally reuse it.
  - Action: add a `LICENSE` (MIT is typical).

- **Shell scripts may lack execute bits on clone.** `scripts/start.sh` / `stop.sh`. Add `chmod +x scripts/*.sh` to `scripts/AGENTS.md`, or set the bit with `git update-index --chmod=+x`.

## Prioritized actions

1. Harden the AI call path: timeout, `content is None` guard, broad `try/except` to 502, and key-presence handling (backend High).
2. Constrain `ChatMessage.role` to `Literal["user", "assistant"]` (backend High).
3. Add `KeyboardSensor` + spread `useSortable` `attributes` for accessible drag-and-drop (frontend Medium).
4. Guard against orphaned card ids from `board_update`, or enable `noUncheckedIndexedAccess` (frontend Medium).
5. Make credentials env-overridable and gate `https_only` for non-local use (backend Medium).
6. Run the container as a non-root user and warn on the `SESSION_SECRET` default (cross-cutting Medium).
7. Add the missing tests, `restart` policy, `HEALTHCHECK`, CI workflow, and `LICENSE` (Low).
