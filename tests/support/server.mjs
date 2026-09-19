import { once } from "node:events";
import { spawn } from "node:child_process";
import { createServer } from "node:net";

const workspaceRoot = new URL("../../", import.meta.url);

export async function getFreePort() {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const { port } = server.address();
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
  return port;
}

export async function waitForHttp(url, { timeoutMs = 20_000 } = {}) {
  const deadline = Date.now() + timeoutMs;
  let lastError;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.status < 500) return response;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  throw new Error(`Timed out waiting for ${url}: ${lastError ?? "no response"}`);
}

export function startWorkspaceApi(port) {
  return startProcess(
    "pnpm",
    ["--filter", "@workspace/api-server", "run", "dev"],
    { PORT: String(port), NODE_ENV: "test", LOG_LEVEL: "silent" },
  );
}

export function startStudio(port) {
  return startProcess(
    "pnpm",
    ["--filter", "@workspace/hael-studio", "run", "dev"],
    { PORT: String(port), BASE_PATH: "/", NODE_ENV: "test" },
  );
}

function startProcess(command, args, extraEnv) {
  const child = spawn(command, args, {
    cwd: workspaceRoot,
    env: { ...process.env, ...extraEnv },
    stdio: ["ignore", "pipe", "pipe"],
    detached: true,
  });
  let output = "";
  child.stdout.on("data", (chunk) => {
    output += chunk;
  });
  child.stderr.on("data", (chunk) => {
    output += chunk;
  });

  const exit = once(child, "exit").then(([code, signal]) => ({
    code,
    signal,
    output: output.toString(),
  }));

  return {
    child,
    getOutput: () => output.toString(),
    exit,
    async stop() {
      if (child.exitCode !== null) return;
      try {
        process.kill(-child.pid, "SIGTERM");
      } catch {
        child.kill("SIGTERM");
      }
      await Promise.race([
        exit,
        new Promise((resolve) => setTimeout(resolve, 2_000)),
      ]);
      if (child.exitCode === null) {
        try {
          process.kill(-child.pid, "SIGKILL");
        } catch {
          child.kill("SIGKILL");
        }
      }
    },
  };
}