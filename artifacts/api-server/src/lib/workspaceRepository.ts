import { asc, eq } from "drizzle-orm";
import type {
  ReviewRequest,
  RuntimeEvent,
  WorkspaceMessage,
  WorkspaceSnapshot,
} from "@workspace/api-zod";
import { initialWorkspace } from "./workspaceSeed";

const workspaceId = initialWorkspace.id;
let memoryWorkspace = structuredClone(initialWorkspace);
let memoryEvents: RuntimeEvent[] = [];
let memoryRuntimeState: WorkspaceRuntimeStateRecord | null = null;
let databaseModule: Promise<typeof import("@workspace/db")> | undefined;

export type WorkspaceRuntimeStateRecord = {
  workspaceId: string;
  revision: number;
  updatedAt: string;
  state: Record<string, unknown>;
};

export class RuntimeStateConflictError extends Error {
  constructor(public readonly current: WorkspaceRuntimeStateRecord | null) {
    super("Runtime state has changed since it was read.");
    this.name = "RuntimeStateConflictError";
  }
}

async function getDatabase() {
  if (!process.env.DATABASE_URL) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("DATABASE_URL is required in production; durable workspace storage is unavailable.");
    }
    return null;
  }
  databaseModule ??= import("@workspace/db");
  return databaseModule;
}

export async function initializeWorkspaceRepository(): Promise<void> {
  const db = await getDatabase();
  if (!db) return;
  try {
    await db.pool.query("SELECT 1");
  } catch (error) {
    const code = typeof error === "object" && error !== null && "code" in error
      ? ` (Postgres code ${error.code})`
      : "";
    throw new Error(`Could not connect to PostgreSQL using DATABASE_URL${code}. Check host, credentials, network, and TLS settings.`);
  }
  const { rows } = await db.pool.query(
    "SELECT to_regclass('hael_schema_migrations') AS migrations_table",
  );
  if (!rows[0]?.migrations_table) {
    throw new Error("Hael Studio database migrations are missing. Run `pnpm --filter @workspace/db migrate` before starting the API.");
  }
  const { rows: migrations } = await db.pool.query(
    "SELECT id FROM hael_schema_migrations WHERE id = $1",
    ["0001_initial_workspace.sql"],
  );
  if (migrations.length === 0) {
    throw new Error("Hael Studio database migrations are incomplete. Run `pnpm --filter @workspace/db migrate` before starting the API.");
  }
}

export async function closeWorkspaceRepository(): Promise<void> {
  if (!databaseModule) return;
  const db = await databaseModule;
  await db.closeDatabase();
}

async function getOrCreateWorkspace(db: NonNullable<Awaited<ReturnType<typeof getDatabase>>>) {
  const { workspaces } = await import("@workspace/db/schema");
  await db.db
    .insert(workspaces)
    .values({ id: workspaceId, snapshot: initialWorkspace })
    .onConflictDoNothing({ target: workspaces.id });
  const [row] = await db.db
    .select({ snapshot: workspaces.snapshot })
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .limit(1);
  if (!row) throw new Error(`Workspace ${workspaceId} could not be initialized.`);
  return row.snapshot;
}

export async function readWorkspace(): Promise<WorkspaceSnapshot> {
  const db = await getDatabase();
  if (!db) return structuredClone(memoryWorkspace);

  const { workspaceMessages } = await import("@workspace/db/schema");
  const snapshot = await getOrCreateWorkspace(db);
  const persistedMessages = await db.db
    .select({ message: workspaceMessages.message })
    .from(workspaceMessages)
    .where(eq(workspaceMessages.workspaceId, workspaceId))
    .orderBy(asc(workspaceMessages.createdAt))
    .limit(500);
  return {
    ...snapshot,
    messages: [...snapshot.messages, ...persistedMessages.map(({ message }) => message)],
    capabilities: snapshot.capabilities.map((capability) =>
      capability.id === "persistence" ? { ...capability, state: "live" } : capability,
    ),
  };
}

export async function saveWorkspaceMessage(message: WorkspaceMessage): Promise<void> {
  const db = await getDatabase();
  if (!db) {
    memoryWorkspace.messages.push(message);
    return;
  }

  const { workspaceMessages } = await import("@workspace/db/schema");
  await getOrCreateWorkspace(db);
  await db.db.insert(workspaceMessages).values({
    id: message.id,
    workspaceId,
    message,
  });
}

export async function saveReviewRequest(review: ReviewRequest): Promise<void> {
  const db = await getDatabase();
  if (!db) {
    memoryWorkspace.status = "review";
    return;
  }

  const { reviewRequests, workspaces } = await import("@workspace/db/schema");
  const snapshot = await getOrCreateWorkspace(db);
  await db.db.transaction(async (transaction) => {
    await transaction.insert(reviewRequests).values({ id: review.id, workspaceId, request: review });
    await transaction
      .update(workspaces)
      .set({ snapshot: { ...snapshot, status: "review" }, updatedAt: new Date() })
      .where(eq(workspaces.id, workspaceId));
  });
  memoryWorkspace.status = "review";
}

export async function saveRuntimeEvent(event: RuntimeEvent): Promise<void> {
  const db = await getDatabase();
  if (!db) {
    memoryEvents.push(event);
    return;
  }

  const { runtimeEvents } = await import("@workspace/db/schema");
  await getOrCreateWorkspace(db);
  await db.db.insert(runtimeEvents).values({ id: event.id, workspaceId, event });
}

export async function readRuntimeEvents(): Promise<RuntimeEvent[]> {
  const db = await getDatabase();
  if (!db) return structuredClone(memoryEvents);

  const { runtimeEvents } = await import("@workspace/db/schema");
  await getOrCreateWorkspace(db);
  const rows = await db.db
    .select({ event: runtimeEvents.event })
    .from(runtimeEvents)
    .where(eq(runtimeEvents.workspaceId, workspaceId))
    .orderBy(asc(runtimeEvents.createdAt))
    .limit(500);
  return rows.map(({ event }) => event);
}

export async function readStudioRuntimeState(): Promise<WorkspaceRuntimeStateRecord | null> {
  const db = await getDatabase();
  if (!db) return memoryRuntimeState ? structuredClone(memoryRuntimeState) : null;

  const { studioRuntimeStates } = await import("@workspace/db/schema");
  const [row] = await db.db
    .select()
    .from(studioRuntimeStates)
    .where(eq(studioRuntimeStates.workspaceId, workspaceId))
    .limit(1);
  return row
    ? {
        workspaceId: row.workspaceId,
        revision: row.revision,
        updatedAt: row.updatedAt.toISOString(),
        state: row.state,
      }
    : null;
}

export async function saveStudioRuntimeState(
  expectedRevision: number,
  state: Record<string, unknown>,
): Promise<WorkspaceRuntimeStateRecord> {
  const db = await getDatabase();
  if (!db) {
    const actualRevision = memoryRuntimeState?.revision ?? 0;
    if (actualRevision !== expectedRevision) {
      throw new RuntimeStateConflictError(
        memoryRuntimeState ? structuredClone(memoryRuntimeState) : null,
      );
    }
    memoryRuntimeState = {
      workspaceId,
      revision: actualRevision + 1,
      updatedAt: new Date().toISOString(),
      state: structuredClone(state),
    };
    return structuredClone(memoryRuntimeState);
  }

  await getOrCreateWorkspace(db);
  const { studioRuntimeStates, workspaces } = await import("@workspace/db/schema");
  return db.db.transaction(async (transaction) => {
    await transaction
      .select({ id: workspaces.id })
      .from(workspaces)
      .where(eq(workspaces.id, workspaceId))
      .for("update");
    const [current] = await transaction
      .select()
      .from(studioRuntimeStates)
      .where(eq(studioRuntimeStates.workspaceId, workspaceId))
      .limit(1);
    const actualRevision = current?.revision ?? 0;
    if (actualRevision !== expectedRevision) {
      throw new RuntimeStateConflictError(current ? {
        workspaceId: current.workspaceId,
        revision: current.revision,
        updatedAt: current.updatedAt.toISOString(),
        state: current.state,
      } : null);
    }

    const updatedAt = new Date();
    const revision = actualRevision + 1;
    if (current) {
      await transaction
        .update(studioRuntimeStates)
        .set({ revision, state, updatedAt })
        .where(eq(studioRuntimeStates.workspaceId, workspaceId));
    } else {
      await transaction.insert(studioRuntimeStates).values({
        workspaceId,
        revision,
        state,
        updatedAt,
      });
    }
    return { workspaceId, revision, updatedAt: updatedAt.toISOString(), state };
  });
}
