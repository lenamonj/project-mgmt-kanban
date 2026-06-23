#!/usr/bin/env sh
# Start the app (Mac / Linux)
set -e
cd "$(dirname "$0")/.."
docker compose up -d --build
echo "App running at http://localhost:8000"
