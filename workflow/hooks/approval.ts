import { defineHook } from "workflow";
import { z } from "zod";
import type { ApprovalPayload } from "@/types";

export const approvalPayloadSchema = z.object({
  approved: z.boolean(),
  comment: z.string().optional(),
}) satisfies z.ZodType<ApprovalPayload>;

/**
 * Typed human-in-the-loop hook. Tools create an instance per tool call
 * using the toolCallId as the token, so both Slack buttons and the UI
 * fallback resolve the same suspension via `approvalHook.resume(token, …)`.
 */
export const approvalHook = defineHook<ApprovalPayload>({
  schema: approvalPayloadSchema,
});
