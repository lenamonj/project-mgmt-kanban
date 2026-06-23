#!/usr/bin/env sh
# Stop the app (Mac / Linux)
set -e
cd "$(dirname "$0")/.."
docker compose down
