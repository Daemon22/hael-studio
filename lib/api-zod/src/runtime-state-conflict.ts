import { z } from "zod";
import { GetWorkspaceRuntimeStateResponse } from "./generated/api";

export const RuntimeStateConflictResponseSchema = z.object({
  error: z.string(),
  current: GetWorkspaceRuntimeStateResponse.nullable(),
});
