# Scripts

Start and stop scripts for the Docker container.

- `start.sh` / `stop.sh` - macOS and Linux
- `start.bat` / `stop.bat` - Windows

Each script runs from any directory and wraps `docker compose`. `start` builds and launches the app at <http://localhost:8000>; `stop` removes the container and network.
