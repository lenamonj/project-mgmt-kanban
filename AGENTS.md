# Project Management Studio

A project management web app: a single-board Kanban with a fake login and an AI assistant that can edit the board through chat. It runs locally in a Docker container.

## Features

- Sign in with a single set of credentials
- A Kanban board per signed-in user, with columns that can be renamed
- Cards that can be created, edited, deleted, and moved between columns with drag and drop
- An AI chat sidebar that can create, edit, and move one or more cards

## Scope

- A single hardcoded login (`user` / `password`); the database schema supports multiple users
- One board per user
- Runs locally in a Docker container

## Technology

- Next.js frontend, statically exported
- Python FastAPI backend, which also serves the static frontend at `/`
- Packaged into a single Docker container; `uv` manages the Python environment
- OpenRouter for AI calls, using the `openai/gpt-oss-120b` model (`OPENROUTER_API_KEY` in `.env`)
- SQLite for storage, created on first run if absent
- Start and stop scripts for macOS, Linux, and Windows in `scripts/`

## Color scheme

- Accent yellow `#ecad0a` - accent lines, highlights
- Primary blue `#209dd7` - links, key sections
- Secondary purple `#753991` - submit buttons, primary actions
- Dark navy `#032147` - headings
- Gray text `#888888` - supporting text, labels

## Conventions

- Latest library versions and idiomatic approaches
- Simplicity first: no over-engineering, no unnecessary defensive code, no extra features
- Concise documentation, no emojis
- Documentation lives in `docs/`
