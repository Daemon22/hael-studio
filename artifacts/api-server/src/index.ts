import { once } from "node:events";
import app from "./app";
import { logger } from "./lib/logger";
import {
  closeWorkspaceRepository,
  initializeWorkspaceRepository,
} from "./lib/workspaceRepository";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error("PORT environment variable is required but was not provided.");
}

const port = Number(rawPort);

if (!Number.isInteger(port) || port <= 0 || port > 65535) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function start(): Promise<void> {
  if (process.env.DATABASE_URL || process.env.NODE_ENV === "production") {
    await initializeWorkspaceRepository();
  }

  const server = app.listen(port);
  await once(server, "listening");
  logger.info({ port }, "Server listening");

  let shutdown: Promise<void> | undefined;
  const close = (signal: string) => {
    shutdown ??= (async () => {
      logger.info({ signal }, "Server shutting down");
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
      await closeWorkspaceRepository();
    })();
    return shutdown;
  };

  process.once("SIGINT", () => void close("SIGINT"));
  process.once("SIGTERM", () => void close("SIGTERM"));
}

start().catch(async (error: unknown) => {
  const message = error instanceof Error ? error.message : "Unexpected startup error.";
  logger.error({ message }, "API startup failed");
  try {
    await closeWorkspaceRepository();
  } catch {
    // Keep the original startup error as the reported cause.
  }
  process.exitCode = 1;
});
