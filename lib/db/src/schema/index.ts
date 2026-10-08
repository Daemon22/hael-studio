import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
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
});

export const reviewRequests = pgTable(
  "hael_review_requests",
  {
    id: uuid("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    request: jsonb("request").$type<ReviewRequest>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("hael_review_requests_created_at_idx").on(table.workspaceId, table.createdAt)],
);

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
