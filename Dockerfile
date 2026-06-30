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

# Run as a non-root user. /app/data is the SQLite volume mount, owned by appuser.
RUN adduser --system --no-create-home appuser \
    && mkdir -p /app/data \
    && chown -R appuser /app
USER appuser
# uv resolves at runtime and needs a writable HOME/cache (appuser owns /app).
ENV HOME=/app UV_CACHE_DIR=/app/.cache/uv

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD ["python", "-c", "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://localhost:8000/api/health').status==200 else 1)"]

CMD ["uv", "run", "--no-dev", "--frozen", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
