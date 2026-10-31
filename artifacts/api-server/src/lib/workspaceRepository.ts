import { and, asc, desc, eq } from "drizzle-orm";
import type {
  ReviewRequest,
  RuntimeEvent,
  WorkspaceMessage,
  WorkspaceSnapshot,
} from "@workspace/api-zod";
import { initialWorkspace } from "./workspaceSeed";

const defaultWorkspaceId = initialWorkspace.id;
const memoryWorkspaces = new Map<string, WorkspaceSnapshot>([[defaultWorkspaceId, structuredClone(initialWorkspace)]]);
const memoryEvents = new Map<string, RuntimeEvent[]>();
const memoryRuntimeStates = new Map<string, WorkspaceRuntimeStateRecord>();
const memoryMemberships = new Map<string, "owner" | "admin" | "editor" | "viewer">();
export type ProjectRepositoryBinding = { projectId: string; provider: "github"; repository: string; branch: string; connectedBy: string; updatedAt: string };
const memoryProjectRepositories = new Map<string, ProjectRepositoryBinding>();
export type ProjectAuditEvent = {
  id: string;
  projectId: string;
  actorSubject: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  requestId: string;
  outcome: "succeeded" | "rejected";
  metadata?: Record<string, unknown>;
};
export type BuildStatus = "queued" | "running" | "succeeded" | "failed" | "cancelled";
export type BuildJob = {
  id: string;
  projectId: string;
  requestedBy: string;
  idempotencyKey: string;
  sourceRepository?: string;
  sourceBranch?: string;
  sourceCommit: string;
  semanticRevision: number;
  artifactManifestHash: string;
  status: BuildStatus;
  runnerJobId?: string;
  previewUrl?: string;
  outputManifest: Array<Record<string, unknown>>;
  diagnostics?: string;
  createdAt: string;
  startedAt?: string;
  finishedAt?: string;
};
export type RuntimeObservation = {
  id: string;
  projectId: string;
  buildId: string;
  actorSubject: string;
  streamId: string;
  sequence: number;
  runtimeId: string;
  eventType: string;
  artifactPath: string;
  artifactHash: string;
  semanticNodeIds: string[];
  detail?: string;
  observedAt: string;
};
const memoryProjectAuditEvents = new Map<string, Array<ProjectAuditEvent & { createdAt: string }>>();
const memoryBuildJobs = new Map<string, BuildJob>();
const memoryRuntimeObservations = new Map<string, RuntimeObservation[]>();
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

export class ProjectNotFoundError extends Error {
  constructor(projectId: string) {
    super(`Project ${projectId} was not found.`);
    this.name = "ProjectNotFoundError";
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
    "SELECT id FROM hael_schema_migrations WHERE id = ANY($1::text[])",
    [["0001_initial_workspace.sql", "0002_projects_and_memberships.sql", "0003_auth_sessions.sql", "0004_project_audit.sql", "0005_builds_and_runtime_provenance.sql", "0006_runtime_observation_streams.sql", "0007_project_repositories.sql", "0008_build_source_bindings.sql"]],
  );
  if (migrations.length < 8) {
    throw new Error("Hael Studio database migrations are incomplete. Run `pnpm --filter @workspace/db migrate` before starting the API.");
  }
  await getOrCreateWorkspace(db, defaultWorkspaceId);
  const bootstrapSubject = process.env.NODE_ENV === "production"
    ? process.env.STUDIO_BOOTSTRAP_SUBJECT
    : process.env.STUDIO_DEV_SUBJECT ?? "local-developer";
  if (bootstrapSubject) {
    await grantProjectMembership(defaultWorkspaceId, bootstrapSubject, "owner", "bootstrap");
  }
}

export async function closeWorkspaceRepository(): Promise<void> {
  if (!databaseModule) return;
  const db = await databaseModule;
  await db.closeDatabase();
}

function workspaceTemplate(projectId: string, name?: string): WorkspaceSnapshot {
  const snapshot = structuredClone(initialWorkspace);
  snapshot.id = projectId;
  snapshot.name = name ?? (projectId === defaultWorkspaceId ? initialWorkspace.name : projectId);
  if (projectId !== defaultWorkspaceId) snapshot.messages = [];
  return snapshot;
}

async function getOrCreateWorkspace(
  db: NonNullable<Awaited<ReturnType<typeof getDatabase>>>,
  projectId: string,
  name?: string,
) {
  const { projects, workspaces } = await import("@workspace/db/schema");
  if (projectId === defaultWorkspaceId) {
    await db.db.insert(projects).values({ id: projectId, name: initialWorkspace.name }).onConflictDoNothing({ target: projects.id });
    await db.db
      .insert(workspaces)
      .values({ id: projectId, snapshot: workspaceTemplate(projectId, name) })
      .onConflictDoNothing({ target: workspaces.id });
  }
  const [row] = await db.db
    .select({ snapshot: workspaces.snapshot })
    .from(workspaces)
    .where(eq(workspaces.id, projectId))
    .limit(1);
  if (!row) throw new ProjectNotFoundError(projectId);
  return row.snapshot;
}

export async function createProject(projectId: string, name: string, ownerSubject: string): Promise<WorkspaceSnapshot> {
  const db = await getDatabase();
  const snapshot = workspaceTemplate(projectId, name);
  if (!db) {
    if (memoryWorkspaces.has(projectId)) throw new Error("A project with this ID already exists.");
    memoryWorkspaces.set(projectId, snapshot);
    await grantProjectMembership(projectId, ownerSubject, "owner");
    return structuredClone(snapshot);
  }

  const { projects, workspaces, projectMemberships } = await import("@workspace/db/schema");
  await db.db.transaction(async (transaction) => {
    await transaction.insert(projects).values({ id: projectId, name, createdBy: ownerSubject });
    await transaction.insert(workspaces).values({ id: projectId, snapshot });
    await transaction.insert(projectMemberships).values({
      projectId, subject: ownerSubject, role: "owner", grantedBy: ownerSubject,
    });
  });
  return snapshot;
}

export async function grantProjectMembership(projectId: string, subject: string, role: "owner" | "admin" | "editor" | "viewer", grantedBy?: string): Promise<void> {
  const db = await getDatabase();
  if (!db) {
    memoryMemberships.set(`${projectId}\u0000${subject}`, role);
    return;
  }
  const { projectMemberships } = await import("@workspace/db/schema");
  await db.db.insert(projectMemberships).values({ projectId, subject, role, grantedBy }).onConflictDoUpdate({
    target: [projectMemberships.projectId, projectMemberships.subject],
    set: { role, grantedBy },
  });
}

export async function manageProjectMembership(
  projectId: string,
  actorSubject: string,
  targetSubject: string,
  requestedRole: "admin" | "editor" | "viewer" | null,
): Promise<"granted" | "revoked" | "actor_forbidden" | "owner_required" | "target_not_found" | "owner_protected"> {
  const db = await getDatabase();
  if (!db) {
    const actorRole = await getProjectRole(projectId, actorSubject);
    if (actorRole !== "owner" && actorRole !== "admin") return "actor_forbidden";
    if (actorRole === "admin" && requestedRole === "admin") return "owner_required";
    const key = `${projectId}\u0000${targetSubject}`;
    const targetRole = memoryMemberships.get(key)
      ?? (projectId === defaultWorkspaceId && targetSubject === (process.env.STUDIO_DEV_SUBJECT ?? "local-developer") ? "owner" : null);
    if (targetRole === "owner") return "owner_protected";
    if (actorRole === "admin" && targetRole === "admin") return "owner_required";
    if (requestedRole === null) {
      if (!targetRole) return "target_not_found";
      memoryMemberships.delete(key);
      return "revoked";
    }
    memoryMemberships.set(key, requestedRole);
    return "granted";
  }

  const { projects, projectMemberships } = await import("@workspace/db/schema");
  return db.db.transaction(async (transaction) => {
    await transaction.select({ id: projects.id }).from(projects)
      .where(eq(projects.id, projectId)).for("update");
    const [actorMembership] = await transaction.select({ role: projectMemberships.role }).from(projectMemberships)
      .where(and(eq(projectMemberships.projectId, projectId), eq(projectMemberships.subject, actorSubject))).limit(1);
    const actorRole = actorMembership?.role;
    if (actorRole !== "owner" && actorRole !== "admin") return "actor_forbidden";
    if (actorRole === "admin" && requestedRole === "admin") return "owner_required";
    const [targetMembership] = await transaction.select({ role: projectMemberships.role }).from(projectMemberships)
      .where(and(eq(projectMemberships.projectId, projectId), eq(projectMemberships.subject, targetSubject))).limit(1);
    if (targetMembership?.role === "owner") return "owner_protected";
    if (actorRole === "admin" && targetMembership?.role === "admin") return "owner_required";
    if (requestedRole === null) {
      if (!targetMembership) return "target_not_found";
      await transaction.delete(projectMemberships).where(and(
        eq(projectMemberships.projectId, projectId), eq(projectMemberships.subject, targetSubject),
      ));
      return "revoked";
    }
    await transaction.insert(projectMemberships).values({
      projectId, subject: targetSubject, role: requestedRole, grantedBy: actorSubject,
    }).onConflictDoUpdate({
      target: [projectMemberships.projectId, projectMemberships.subject],
      set: { role: requestedRole, grantedBy: actorSubject },
    });
    return "granted";
  });
}

export async function getProjectRole(projectId: string, subject: string): Promise<"owner" | "admin" | "editor" | "viewer" | null> {
  const db = await getDatabase();
  if (!db) return memoryMemberships.get(`${projectId}\u0000${subject}`)
    ?? (projectId === defaultWorkspaceId && subject === (process.env.STUDIO_DEV_SUBJECT ?? "local-developer") ? "owner" : null);
  const { projectMemberships } = await import("@workspace/db/schema");
  const [membership] = await db.db.select({ role: projectMemberships.role }).from(projectMemberships)
    .where(and(eq(projectMemberships.projectId, projectId), eq(projectMemberships.subject, subject))).limit(1);
  const role: unknown = membership?.role;
  return role === "owner" || role === "admin" || role === "editor" || role === "viewer" ? role : null;
}

export type ProjectSummary = { id: string; name: string; role: "owner" | "admin" | "editor" | "viewer" };

export async function getProjectRepository(projectId: string): Promise<ProjectRepositoryBinding | null> {
  const db = await getDatabase();
  if (!db) return structuredClone(memoryProjectRepositories.get(projectId) ?? null);
  const { projectRepositories } = await import("@workspace/db/schema");
  const [row] = await db.db.select().from(projectRepositories).where(eq(projectRepositories.projectId, projectId)).limit(1);
  return row ? { ...row, provider: "github", updatedAt: row.updatedAt.toISOString() } : null;
}

export async function setProjectRepository(binding: ProjectRepositoryBinding): Promise<void> {
  const db = await getDatabase();
  if (!db) { memoryProjectRepositories.set(binding.projectId, structuredClone(binding)); return; }
  const { projectRepositories } = await import("@workspace/db/schema");
  await db.db.insert(projectRepositories).values({ ...binding, updatedAt: new Date(binding.updatedAt) }).onConflictDoUpdate({
    target: projectRepositories.projectId,
    set: { provider: binding.provider, repository: binding.repository, branch: binding.branch, connectedBy: binding.connectedBy, updatedAt: new Date(binding.updatedAt) },
  });
}

export async function removeProjectRepository(projectId: string): Promise<void> {
  const db = await getDatabase();
  if (!db) { memoryProjectRepositories.delete(projectId); return; }
  const { projectRepositories } = await import("@workspace/db/schema");
  await db.db.delete(projectRepositories).where(eq(projectRepositories.projectId, projectId));
}

export async function listProjectsForSubject(subject: string): Promise<ProjectSummary[]> {
  const db = await getDatabase();
  if (!db) {
    return [...memoryWorkspaces.entries()].flatMap(([id, snapshot]) => {
      const role = memoryMemberships.get(`${id}\u0000${subject}`)
        ?? (id === defaultWorkspaceId && subject === (process.env.STUDIO_DEV_SUBJECT ?? "local-developer") ? "owner" : null);
      return role ? [{ id, name: snapshot.name, role }] : [];
    });
  }
  const { projects, projectMemberships } = await import("@workspace/db/schema");
  const rows = await db.db.select({
    id: projects.id,
    name: projects.name,
    role: projectMemberships.role,
  }).from(projectMemberships)
    .innerJoin(projects, eq(projectMemberships.projectId, projects.id))
    .where(eq(projectMemberships.subject, subject));
  return rows.flatMap((row) => row.role === "owner" || row.role === "admin" || row.role === "editor" || row.role === "viewer"
    ? [{ id: row.id, name: row.name, role: row.role }]
    : []);
}

export type ProjectMember = { subject: string; role: "owner" | "admin" | "editor" | "viewer"; grantedBy?: string; createdAt?: string };

export async function listProjectMembers(projectId: string): Promise<ProjectMember[]> {
  const db = await getDatabase();
  if (!db) {
    const members = [...memoryMemberships.entries()].flatMap(([key, role]) => {
      const separator = key.indexOf("\u0000");
      const memberProjectId = key.slice(0, separator);
      const subject = key.slice(separator + 1);
      return memberProjectId === projectId && role
        ? [{ subject, role } as ProjectMember]
        : [];
    });
    if (projectId === defaultWorkspaceId) {
      const bootstrapSubject = process.env.STUDIO_DEV_SUBJECT ?? "local-developer";
      if (!members.some((member) => member.subject === bootstrapSubject)) members.push({ subject: bootstrapSubject, role: "owner" });
    }
    return members.sort((left, right) => left.subject.localeCompare(right.subject));
  }
  const { projectMemberships } = await import("@workspace/db/schema");
  const rows = await db.db.select({ subject: projectMemberships.subject, role: projectMemberships.role,
    grantedBy: projectMemberships.grantedBy, createdAt: projectMemberships.createdAt })
    .from(projectMemberships).where(eq(projectMemberships.projectId, projectId)).orderBy(asc(projectMemberships.subject));
  return rows.flatMap((row) => row.role === "owner" || row.role === "admin" || row.role === "editor" || row.role === "viewer"
    ? [{ subject: row.subject, role: row.role, grantedBy: row.grantedBy ?? undefined, createdAt: row.createdAt?.toISOString() }]
    : []);
}

export async function recordProjectAuditEvent(event: ProjectAuditEvent): Promise<void> {
  const db = await getDatabase();
  if (!db) {
    const events = memoryProjectAuditEvents.get(event.projectId) ?? [];
    events.push({ ...structuredClone(event), createdAt: new Date().toISOString() });
    memoryProjectAuditEvents.set(event.projectId, events);
    return;
  }
  const { projectAuditEvents } = await import("@workspace/db/schema");
  await db.db.insert(projectAuditEvents).values({
    ...event,
    resourceId: event.resourceId ?? null,
    metadata: event.metadata ?? {},
  });
}

export async function readProjectAuditEvents(projectId: string, limit = 100): Promise<Array<ProjectAuditEvent & { createdAt: string }>> {
  const safeLimit = Math.max(1, Math.min(250, Math.trunc(limit)));
  const db = await getDatabase();
  if (!db) return structuredClone((memoryProjectAuditEvents.get(projectId) ?? []).slice(-safeLimit).reverse());
  const { projectAuditEvents } = await import("@workspace/db/schema");
  const rows = await db.db.select().from(projectAuditEvents)
    .where(eq(projectAuditEvents.projectId, projectId))
    .orderBy(desc(projectAuditEvents.createdAt)).limit(safeLimit);
  return rows.map((row) => ({
    id: row.id, projectId: row.projectId, actorSubject: row.actorSubject, action: row.action,
    resourceType: row.resourceType, resourceId: row.resourceId ?? undefined, requestId: row.requestId,
    outcome: row.outcome, metadata: row.metadata, createdAt: row.createdAt.toISOString(),
  }));
}

export class BuildIdempotencyConflictError extends Error {
  constructor() { super("The idempotency key was already used with different build inputs."); this.name = "BuildIdempotencyConflictError"; }
}

function sameBuildInput(left: BuildJob, right: BuildJob): boolean {
  return left.projectId === right.projectId && left.requestedBy === right.requestedBy && left.sourceCommit === right.sourceCommit
    && left.sourceRepository === right.sourceRepository && left.sourceBranch === right.sourceBranch
    && left.semanticRevision === right.semanticRevision && left.artifactManifestHash === right.artifactManifestHash;
}

function mapBuildRow(row: {
  id: string; projectId: string; requestedBy: string; idempotencyKey: string; sourceCommit: string;
  sourceRepository: string | null; sourceBranch: string | null;
  semanticRevision: number; artifactManifestHash: string; status: string; runnerJobId: string | null;
  previewUrl: string | null; outputManifest: Array<Record<string, unknown>>; diagnostics: string | null;
  createdAt: Date; startedAt: Date | null; finishedAt: Date | null;
}): BuildJob {
  const status = row.status;
  if (status !== "queued" && status !== "running" && status !== "succeeded" && status !== "failed" && status !== "cancelled") {
    throw new Error("Stored build status is invalid.");
  }
  return {
    id: row.id, projectId: row.projectId, requestedBy: row.requestedBy, idempotencyKey: row.idempotencyKey,
    sourceRepository: row.sourceRepository ?? undefined, sourceBranch: row.sourceBranch ?? undefined,
    sourceCommit: row.sourceCommit, semanticRevision: row.semanticRevision, artifactManifestHash: row.artifactManifestHash,
    status, runnerJobId: row.runnerJobId ?? undefined, previewUrl: row.previewUrl ?? undefined,
    outputManifest: row.outputManifest, diagnostics: row.diagnostics ?? undefined, createdAt: row.createdAt.toISOString(),
    startedAt: row.startedAt?.toISOString(), finishedAt: row.finishedAt?.toISOString(),
  };
}

export async function createBuildJob(job: BuildJob): Promise<{ job: BuildJob; created: boolean }> {
  const db = await getDatabase();
  if (!db) {
    const existing = [...memoryBuildJobs.values()].find((item) => item.projectId === job.projectId && item.idempotencyKey === job.idempotencyKey);
    if (existing) {
      if (!sameBuildInput(existing, job)) throw new BuildIdempotencyConflictError();
      return { job: structuredClone(existing), created: false };
    }
    memoryBuildJobs.set(job.id, structuredClone(job));
    return { job: structuredClone(job), created: true };
  }
  const { buildJobs } = await import("@workspace/db/schema");
  await db.db.insert(buildJobs).values({
    id: job.id, projectId: job.projectId, requestedBy: job.requestedBy, idempotencyKey: job.idempotencyKey,
    sourceRepository: job.sourceRepository ?? null, sourceBranch: job.sourceBranch ?? null,
    sourceCommit: job.sourceCommit, semanticRevision: job.semanticRevision, artifactManifestHash: job.artifactManifestHash,
    status: job.status, outputManifest: [], createdAt: new Date(job.createdAt),
  }).onConflictDoNothing({ target: [buildJobs.projectId, buildJobs.idempotencyKey] });
  const [row] = await db.db.select().from(buildJobs)
    .where(and(eq(buildJobs.projectId, job.projectId), eq(buildJobs.idempotencyKey, job.idempotencyKey))).limit(1);
  if (!row) throw new Error("Build job could not be persisted.");
  const stored = mapBuildRow(row);
  if (!sameBuildInput(stored, job)) throw new BuildIdempotencyConflictError();
  return { job: stored, created: stored.id === job.id };
}

export async function getBuildJob(projectId: string, id: string): Promise<BuildJob | null> {
  const db = await getDatabase();
  if (!db) {
    const job = memoryBuildJobs.get(id);
    return job?.projectId === projectId ? structuredClone(job) : null;
  }
  const { buildJobs } = await import("@workspace/db/schema");
  const [row] = await db.db.select().from(buildJobs).where(and(eq(buildJobs.projectId, projectId), eq(buildJobs.id, id))).limit(1);
  return row ? mapBuildRow(row) : null;
}

export async function listBuildJobs(projectId: string, limit = 50): Promise<BuildJob[]> {
  const safeLimit = Math.max(1, Math.min(100, Math.trunc(limit)));
  const db = await getDatabase();
  if (!db) return [...memoryBuildJobs.values()].filter((job) => job.projectId === projectId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, safeLimit).map((job) => structuredClone(job));
  const { buildJobs } = await import("@workspace/db/schema");
  const rows = await db.db.select().from(buildJobs).where(eq(buildJobs.projectId, projectId))
    .orderBy(desc(buildJobs.createdAt)).limit(safeLimit);
  return rows.map(mapBuildRow);
}

export async function updateBuildJob(projectId: string, id: string, patch: Partial<Pick<BuildJob,
  "status" | "runnerJobId" | "previewUrl" | "outputManifest">> & {
  diagnostics?: string | null; startedAt?: string | null; finishedAt?: string | null;
}): Promise<BuildJob | null> {
  const db = await getDatabase();
  if (!db) {
    const current = memoryBuildJobs.get(id);
    if (!current || current.projectId !== projectId) return null;
    if (!isBuildStatusTransitionAllowed(current, patch)) return structuredClone(current);
    for (const [key, value] of Object.entries(structuredClone(patch))) {
      if (value === null) delete (current as unknown as Record<string, unknown>)[key];
      else (current as unknown as Record<string, unknown>)[key] = value;
    }
    return structuredClone(current);
  }
  const { buildJobs } = await import("@workspace/db/schema");
  const values = {
    ...patch,
    startedAt: patch.startedAt === undefined ? undefined : patch.startedAt === null ? null : new Date(patch.startedAt),
    finishedAt: patch.finishedAt === undefined ? undefined : patch.finishedAt === null ? null : new Date(patch.finishedAt),
  };
  return db.db.transaction(async (transaction) => {
    const [currentRow] = await transaction.select().from(buildJobs)
      .where(and(eq(buildJobs.projectId, projectId), eq(buildJobs.id, id))).for("update").limit(1);
    if (!currentRow) return null;
    const current = mapBuildRow(currentRow);
    if (!isBuildStatusTransitionAllowed(current, patch)) return current;
    await transaction.update(buildJobs).set(values).where(and(eq(buildJobs.projectId, projectId), eq(buildJobs.id, id)));
    const [updatedRow] = await transaction.select().from(buildJobs)
      .where(and(eq(buildJobs.projectId, projectId), eq(buildJobs.id, id))).limit(1);
    return updatedRow ? mapBuildRow(updatedRow) : null;
  });
}

function isBuildStatusTransitionAllowed(current: BuildJob, patch: Partial<Pick<BuildJob, "status" | "runnerJobId">>): boolean {
  const next = patch.status;
  if (!next || next === current.status) return true;
  if (current.runnerJobId && patch.runnerJobId === undefined) return false;
  if (current.status === "queued") return ["running", "succeeded", "failed", "cancelled"].includes(next);
  if (current.status === "running") return ["succeeded", "failed", "cancelled"].includes(next);
  if (current.status === "failed") return next === "queued" && !current.runnerJobId;
  return false;
}

export async function recordRuntimeObservation(observation: RuntimeObservation): Promise<void> {
  const db = await getDatabase();
  if (!db) {
    const events = memoryRuntimeObservations.get(observation.buildId) ?? [];
    if (events.some((event) => event.streamId === observation.streamId && event.sequence === observation.sequence)) throw new Error("Runtime observation sequence already exists.");
    events.push(structuredClone(observation));
    events.sort((a, b) => a.sequence - b.sequence);
    memoryRuntimeObservations.set(observation.buildId, events);
    return;
  }
  const { runtimeObservations } = await import("@workspace/db/schema");
  await db.db.insert(runtimeObservations).values({
    ...observation,
    observedAt: new Date(observation.observedAt),
    detail: observation.detail ?? null,
  });
}

export async function readRuntimeObservations(projectId: string, buildId: string, limit = 500): Promise<RuntimeObservation[]> {
  const safeLimit = Math.max(1, Math.min(1000, Math.trunc(limit)));
  const db = await getDatabase();
  if (!db) return structuredClone((memoryRuntimeObservations.get(buildId) ?? [])
    .filter((item) => item.projectId === projectId)
    .slice()
    .sort((a, b) => a.observedAt.localeCompare(b.observedAt) || a.id.localeCompare(b.id)).slice(-safeLimit));
  const { runtimeObservations } = await import("@workspace/db/schema");
  const rows = await db.db.select().from(runtimeObservations).where(and(
    eq(runtimeObservations.projectId, projectId), eq(runtimeObservations.buildId, buildId),
  )).orderBy(desc(runtimeObservations.observedAt), desc(runtimeObservations.id)).limit(safeLimit);
  return rows.reverse().map((row) => ({
    id: row.id, projectId: row.projectId, buildId: row.buildId, actorSubject: row.actorSubject, streamId: row.streamId, sequence: row.sequence,
    runtimeId: row.runtimeId, eventType: row.eventType, artifactPath: row.artifactPath,
    artifactHash: row.artifactHash, semanticNodeIds: row.semanticNodeIds, detail: row.detail ?? undefined,
    observedAt: row.observedAt.toISOString(),
  }));
}

export async function readWorkspace(projectId = defaultWorkspaceId): Promise<WorkspaceSnapshot> {
  const db = await getDatabase();
  if (!db) {
    const snapshot = memoryWorkspaces.get(projectId);
    if (!snapshot) throw new ProjectNotFoundError(projectId);
    return structuredClone(snapshot);
  }

  const { workspaceMessages } = await import("@workspace/db/schema");
  const snapshot = await getOrCreateWorkspace(db, projectId);
  const persistedMessages = await db.db
    .select({ message: workspaceMessages.message })
    .from(workspaceMessages)
    .where(eq(workspaceMessages.workspaceId, projectId))
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

export async function saveWorkspaceMessage(message: WorkspaceMessage, projectId = defaultWorkspaceId): Promise<void> {
  const db = await getDatabase();
  if (!db) {
    const workspace = memoryWorkspaces.get(projectId);
    if (!workspace) throw new ProjectNotFoundError(projectId);
    workspace.messages.push(message);
    return;
  }

  const { workspaceMessages } = await import("@workspace/db/schema");
  await getOrCreateWorkspace(db, projectId);
  await db.db.insert(workspaceMessages).values({
    id: message.id,
    workspaceId: projectId,
    message,
  });
}

export async function saveReviewRequest(review: ReviewRequest, projectId = defaultWorkspaceId): Promise<void> {
  const db = await getDatabase();
  if (!db) {
    const workspace = memoryWorkspaces.get(projectId);
    if (!workspace) throw new ProjectNotFoundError(projectId);
    workspace.status = "review";
    return;
  }

  const { reviewRequests, workspaces } = await import("@workspace/db/schema");
  const snapshot = await getOrCreateWorkspace(db, projectId);
  await db.db.transaction(async (transaction) => {
    await transaction.insert(reviewRequests).values({ id: review.id, workspaceId: projectId, request: review });
    await transaction
      .update(workspaces)
      .set({ snapshot: { ...snapshot, status: "review" }, updatedAt: new Date() })
      .where(eq(workspaces.id, projectId));
  });
  const workspace = memoryWorkspaces.get(projectId);
  if (workspace) workspace.status = "review";
}

export async function saveRuntimeEvent(event: RuntimeEvent, projectId = defaultWorkspaceId): Promise<void> {
  const db = await getDatabase();
  if (!db) {
    if (!memoryWorkspaces.has(projectId)) throw new ProjectNotFoundError(projectId);
    const events = memoryEvents.get(projectId) ?? [];
    events.push(event);
    memoryEvents.set(projectId, events);
    return;
  }

  const { runtimeEvents } = await import("@workspace/db/schema");
  await getOrCreateWorkspace(db, projectId);
  await db.db.insert(runtimeEvents).values({ id: event.id, workspaceId: projectId, event });
}

export async function readRuntimeEvents(projectId = defaultWorkspaceId): Promise<RuntimeEvent[]> {
  const db = await getDatabase();
  if (!db) return structuredClone(memoryEvents.get(projectId) ?? []);

  const { runtimeEvents } = await import("@workspace/db/schema");
  await getOrCreateWorkspace(db, projectId);
  const rows = await db.db
    .select({ event: runtimeEvents.event })
    .from(runtimeEvents)
    .where(eq(runtimeEvents.workspaceId, projectId))
    .orderBy(asc(runtimeEvents.createdAt))
    .limit(500);
  return rows.map(({ event }) => event);
}

export async function readStudioRuntimeState(projectId = defaultWorkspaceId): Promise<WorkspaceRuntimeStateRecord | null> {
  const db = await getDatabase();
  if (!db) {
    const state = memoryRuntimeStates.get(projectId);
    return state ? structuredClone(state) : null;
  }

  const { studioRuntimeStates } = await import("@workspace/db/schema");
  const [row] = await db.db
    .select()
    .from(studioRuntimeStates)
    .where(eq(studioRuntimeStates.workspaceId, projectId))
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
  projectId = defaultWorkspaceId,
): Promise<WorkspaceRuntimeStateRecord> {
  const db = await getDatabase();
  if (!db) {
    if (!memoryWorkspaces.has(projectId)) throw new ProjectNotFoundError(projectId);
    const currentState = memoryRuntimeStates.get(projectId);
    const actualRevision = currentState?.revision ?? 0;
    if (actualRevision !== expectedRevision) {
      throw new RuntimeStateConflictError(
        currentState ? structuredClone(currentState) : null,
      );
    }
    const nextState = {
      workspaceId: projectId,
      revision: actualRevision + 1,
      updatedAt: new Date().toISOString(),
      state: structuredClone(state),
    };
    memoryRuntimeStates.set(projectId, nextState);
    return structuredClone(nextState);
  }

  await getOrCreateWorkspace(db, projectId);
  const { studioRuntimeStates, workspaces } = await import("@workspace/db/schema");
  return db.db.transaction(async (transaction) => {
    await transaction
      .select({ id: workspaces.id })
      .from(workspaces)
      .where(eq(workspaces.id, projectId))
      .for("update");
    const [current] = await transaction
      .select()
      .from(studioRuntimeStates)
      .where(eq(studioRuntimeStates.workspaceId, projectId))
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
        .where(eq(studioRuntimeStates.workspaceId, projectId));
    } else {
      await transaction.insert(studioRuntimeStates).values({
        workspaceId: projectId,
        revision,
        state,
        updatedAt,
      });
    }
    return { workspaceId: projectId, revision, updatedAt: updatedAt.toISOString(), state };
  });
}
