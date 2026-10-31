import {
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
  check,
  unique,
  foreignKey,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import type {
  ReviewRequest,
  RuntimeEvent,
  WorkspaceSnapshot,
} from "@workspace/api-zod";

export const workspaces = pgTable("hael_workspaces", {
  id: text("id").primaryKey(),
  snapshot: jsonb("snapshot").$type<WorkspaceSnapshot>().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const projects = pgTable("hael_projects", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const projectMemberships = pgTable("hael_project_memberships", {
  projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  subject: text("subject").notNull(),
  role: text("role", { enum: ["owner", "admin", "editor", "viewer"] }).notNull(),
  grantedBy: text("granted_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  primaryKey({ columns: [table.projectId, table.subject], name: "hael_project_memberships_pk" }),
  index("hael_project_memberships_subject_idx").on(table.subject, table.projectId),
]);

export const projectRepositories = pgTable("hael_project_repositories", {
  projectId: text("project_id").primaryKey().references(() => projects.id, { onDelete: "cascade" }),
  provider: text("provider", { enum: ["github"] }).notNull().default("github"),
  repository: text("repository").notNull(),
  branch: text("branch").notNull(),
  connectedBy: text("connected_by").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const authSessions = pgTable("hael_auth_sessions", {
  id: uuid("id").primaryKey(),
  subject: text("subject").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  absoluteExpiresAt: timestamp("absolute_expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("hael_auth_sessions_expires_at_idx").on(table.expiresAt),
  index("hael_auth_sessions_subject_idx").on(table.subject, table.expiresAt),
]);

export const projectAuditEvents = pgTable("hael_project_audit_events", {
  id: uuid("id").primaryKey(),
  projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  actorSubject: text("actor_subject").notNull(),
  action: text("action").notNull(),
  resourceType: text("resource_type").notNull(),
  resourceId: text("resource_id"),
  requestId: text("request_id").notNull(),
  outcome: text("outcome", { enum: ["succeeded", "rejected"] }).notNull(),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("hael_project_audit_events_project_created_idx").on(table.projectId, table.createdAt),
  index("hael_project_audit_events_actor_created_idx").on(table.actorSubject, table.createdAt),
]);

export const buildJobs = pgTable("hael_build_jobs", {
  id: uuid("id").primaryKey(),
  projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  requestedBy: text("requested_by").notNull(),
  idempotencyKey: text("idempotency_key").notNull(),
  sourceRepository: text("source_repository"),
  sourceBranch: text("source_branch"),
  sourceCommit: text("source_commit").notNull(),
  semanticRevision: integer("semantic_revision").notNull(),
  artifactManifestHash: text("artifact_manifest_hash").notNull(),
  status: text("status", { enum: ["queued", "running", "succeeded", "failed", "cancelled"] }).notNull(),
  runnerJobId: text("runner_job_id").unique(),
  previewUrl: text("preview_url"),
  outputManifest: jsonb("output_manifest").$type<Array<Record<string, unknown>>>().notNull().default([]),
  diagnostics: text("diagnostics"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  startedAt: timestamp("started_at", { withTimezone: true }),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
}, (table) => [
  unique("hael_build_jobs_project_id_unique").on(table.projectId, table.id),
  unique("hael_build_jobs_idempotency_unique").on(table.projectId, table.idempotencyKey),
  index("hael_build_jobs_project_created_idx").on(table.projectId, table.createdAt),
  index("hael_build_jobs_status_created_idx").on(table.status, table.createdAt),
  check("hael_build_jobs_semantic_revision_nonnegative", sql`${table.semanticRevision} >= 0`),
]);

export const runtimeObservations = pgTable("hael_runtime_observations", {
  id: uuid("id").primaryKey(),
  projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  buildId: uuid("build_id").notNull().references(() => buildJobs.id, { onDelete: "cascade" }),
  actorSubject: text("actor_subject").notNull(),
  streamId: text("stream_id").notNull().default("legacy"),
  sequence: integer("sequence").notNull(),
  runtimeId: text("runtime_id").notNull(),
  eventType: text("event_type").notNull(),
  artifactPath: text("artifact_path").notNull(),
  artifactHash: text("artifact_hash").notNull(),
  semanticNodeIds: jsonb("semantic_node_ids").$type<string[]>().notNull().default([]),
  detail: text("detail"),
  observedAt: timestamp("observed_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("hael_runtime_observations_project_time_idx").on(table.projectId, table.observedAt),
  index("hael_runtime_observations_build_sequence_idx").on(table.buildId, table.sequence),
  foreignKey({
    columns: [table.projectId, table.buildId],
    foreignColumns: [buildJobs.projectId, buildJobs.id],
    name: "hael_runtime_observations_project_build_fk",
  }).onDelete("cascade"),
  unique("hael_runtime_observations_build_stream_sequence_unique").on(table.buildId, table.streamId, table.sequence),
  check("hael_runtime_observations_sequence_nonnegative", sql`${table.sequence} >= 0`),
]);

export const workspaceMessages = pgTable(
  "hael_workspace_messages",
  {
    id: uuid("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    message: jsonb("message")
      .$type<WorkspaceSnapshot["messages"][number]>()
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("hael_workspace_messages_created_at_idx").on(table.workspaceId, table.createdAt)],
);

export const studioRuntimeStates = pgTable("hael_studio_runtime_states", {
  workspaceId: text("workspace_id")
    .primaryKey()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  revision: integer("revision").notNull().default(0),
  state: jsonb("state").$type<Record<string, unknown>>().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
}, (table) => [check("hael_studio_runtime_states_revision_nonnegative", sql`${table.revision} >= 0`)]);

export const reviewRequests = pgTable("hael_review_requests", {
  id: uuid("id").primaryKey(),
  workspaceId: text("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  request: jsonb("request").$type<ReviewRequest>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const runtimeEvents = pgTable(
  "hael_runtime_events",
  {
    id: uuid("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    event: jsonb("event").$type<RuntimeEvent>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("hael_runtime_events_created_at_idx").on(table.workspaceId, table.createdAt),
  ],
);
