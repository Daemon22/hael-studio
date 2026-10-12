import type { IncomingMessage, ServerResponse } from "node:http";
import app from "./artifacts/api-server/src/app";
import { initializeWorkspaceRepository } from "./artifacts/api-server/src/lib/workspaceRepository";

type VercelResponse = ServerResponse & {
  status(code: number): VercelResponse;
  json(body: unknown): VercelResponse;
};

let databaseReady: Promise<void> | undefined;

export default async function handler(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const response = res as VercelResponse;

  try {
    databaseReady ??= initializeWorkspaceRepository().catch((error: unknown) => {
      databaseReady = undefined;
      throw error;
    });

    await databaseReady;

    const url = req.url ?? "/";

    if (url !== "/api" && !url.startsWith("/api/")) {
      req.url = `/api${url.startsWith("/") ? url : `/${url}`}`;
    }

    (app as unknown as (
      req: IncomingMessage,
      res: ServerResponse,
    ) => void)(req, response);
  } catch (error) {
    console.error(
      "HAEL Studio backend initialization failed.",
      error instanceof Error ? error.message : "Unknown error",
    );

    response.status(503).json({
      error: "HAEL Studio backend is temporarily unavailable.",
    });
  }
}
