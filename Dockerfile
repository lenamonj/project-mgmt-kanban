# Stage 1: build the static frontend
FROM node:22-slim AS frontend
WORKDIR /frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend ./
RUN npm run build

# Stage 2: backend image serving the API and the built frontend
FROM ghcr.io/astral-sh/uv:python3.13-bookworm-slim
WORKDIR /app

# Install dependencies first for better layer caching
COPY backend/pyproject.toml backend/uv.lock ./
RUN uv sync --no-dev --frozen

# Copy the application, then overlay the built frontend into the static dir
COPY backend/app ./app
COPY --from=frontend /frontend/out ./app/static

EXPOSE 8000

CMD ["uv", "run", "--no-dev", "--frozen", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
