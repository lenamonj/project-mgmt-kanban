# Roadmap: comprehensive PM application

Tracking the build-out from a single-board, single-user MVP to a multi-user,
multi-board project management app. Each phase must leave the app working with
all tests green.

## Phase 1: user management + multiple boards (foundation)

Status: done

Backend
- [x] Users have hashed passwords (stdlib pbkdf2), stored in DB
- [x] Registration endpoint `POST /api/register`
- [x] Login verifies the password hash; session carries the user id
- [x] `boards` table is one-to-many per user, with a `name` and timestamps
- [x] Schema migration from the old one-board-per-user shape
- [x] Board CRUD: list, create, read, update, rename, delete (ownership enforced)
- [x] Chat scoped to a board: `POST /api/boards/{id}/chat`
- [x] Tests: hashing, registration, login, board CRUD, cross-user isolation, chat

Frontend
- [x] API client for auth + board CRUD + scoped chat
- [x] Register/sign-in form
- [x] Boards dashboard: list, create, rename, delete, open
- [x] Kanban board parametrized by board id; chat scoped to the board
- [x] Unit tests for new API and components
- [x] E2E updated for the multi-board flow

Docs
- [x] AGENTS.md / CLAUDE.md / DATABASE.md / README reflect the new model

Test counts after Phase 1: backend 34, frontend unit 20, e2e 13.

## Phase 2: richer cards (later)
- Card metadata: description, due date, priority, labels, assignee
- Filtering and search

## Phase 3: collaboration (later)
- Board sharing between users, roles

## Phase 4: polish (later)
- Activity log, board templates, keyboard shortcuts
