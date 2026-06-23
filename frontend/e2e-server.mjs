// Playwright webServer for e2e: build the static frontend, then serve it through
// the FastAPI backend (uvicorn) so auth and API routes are real. The backend
// STATIC_DIR env points at the fresh build, avoiding a copy step.
import { spawn, spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const frontendDir = dirname(fileURLToPath(import.meta.url));
const backendDir = join(frontendDir, "..", "backend");
const outDir = join(frontendDir, "out");

const build = spawnSync("npm", ["run", "build"], {
  cwd: frontendDir,
  stdio: "inherit",
  shell: true,
});
if (build.status !== 0) process.exit(build.status ?? 1);

const server = spawn(
  "uv",
  ["run", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "8000"],
  {
    cwd: backendDir,
    env: { ...process.env, STATIC_DIR: outDir, SESSION_SECRET: "e2e-secret" },
    stdio: "inherit",
    shell: true,
  }
);

const stop = () => server.kill();
process.on("SIGTERM", stop);
process.on("SIGINT", stop);
process.on("exit", stop);
