import { once } from "node:events";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { fileURLToPath } from "node:url";

const pnpmCommand = process.platform === "win32" ? "pnpm.cmd" : "pnpm";

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

export function startWorkspaceApi(port, { databaseUrl, nodeEnv = "test" } = {}) {
  return startBuiltWorkspaceApi(port, { databaseUrl, nodeEnv });
}

export function startBuiltWorkspaceApi(port, { databaseUrl, nodeEnv = "test", logLevel = "silent" } = {}) {
  const entry = new URL("../../artifacts/api-server/dist/index.mjs", import.meta.url);
  return startProcess(
    process.execPath,
    ["--enable-source-maps", fileURLToPath(entry)],
    { PORT: String(port), NODE_ENV: nodeEnv, LOG_LEVEL: logLevel, DATABASE_URL: databaseUrl },
  );
}

export function startStudio(port) {
  return startProcess(
    pnpmCommand,
    ["--filter", "@workspace/hael-studio", "run", "dev"],
    { PORT: String(port), BASE_PATH: "/", NODE_ENV: "test" },
  );
}

function startProcess(command, args, extraEnv) {
  const env = { ...process.env, ...extraEnv };
  for (const [key, value] of Object.entries(extraEnv)) {
    if (value === undefined) delete env[key];
  }
  const child = spawn(command, args, {
    cwd: workspaceRoot,
    env,
    stdio: ["ignore", "pipe", "pipe"],
    detached: process.platform !== "win32",
    shell: command.toLowerCase().endsWith(".cmd"),
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
      if (process.platform === "win32") {
        const terminator = spawn("taskkill.exe", ["/PID", String(child.pid), "/T", "/F"], {
          stdio: "ignore",
          windowsHide: true,
        });
        await once(terminator, "exit");
      } else {
        try {
          process.kill(-child.pid, "SIGTERM");
        } catch {
          child.kill("SIGTERM");
        }
      }
      await Promise.race([
        exit,
        new Promise((resolve) => setTimeout(resolve, 2_000)),
      ]);
      if (child.exitCode === null) {
        try {
          if (process.platform === "win32") {
            child.kill("SIGKILL");
          } else {
            process.kill(-child.pid, "SIGKILL");
          }
        } catch {
          child.kill("SIGKILL");
        }
      }
    },
  };
}
