import { NextResponse } from "next/server";
import { getHookByToken, resumeHook } from "workflow/api";
import { HookNotFoundError } from "workflow/errors";
import type { ApprovalPayload, ResolveRequest } from "@/types";
import { approvalPayloadSchema } from "@/workflow/hooks/approval";

/**
 * UI fallback approval endpoint. Resolves the same workflow hook token
 * (toolCallId) as the Slack buttons — whichever decision arrives first
 * wins, the other becomes a no-op.
 */
const TAG = "[approvals:hitl]";

export async function POST(request: Request) {
  let body: Partial<ResolveRequest>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  if (!body.toolCallId || typeof body.approved !== "boolean") {
    return NextResponse.json(
      { error: "toolCallId and approved are required" },
      { status: 400 },
    );
  }

  console.log(
    `${TAG} resolve toolCallId=${body.toolCallId} approved=${body.approved}`,
  );

  // Diagnostic lookup (single read): records whether the token exists at
  // all before attempting the resume.
  const existing = await getHookByToken(body.toolCallId).catch(() => null);
  console.log(
    `${TAG} hook-lookup toolCallId=${body.toolCallId} exists=${existing !== null} runId=${existing?.runId ?? "unknown"}`,
  );

  try {
    // Token-based resume (no defineHook instance identity involved).
    const payload: ApprovalPayload = approvalPayloadSchema.parse({
      approved: body.approved,
      comment: body.comment ?? "web-ui",
    });
    const resumedHook = await resumeHook(body.toolCallId, payload);
    console.log(
      `${TAG} hook-resumed toolCallId=${body.toolCallId} runId=${resumedHook.runId}`,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const notFound =
      HookNotFoundError.is(error) ||
      /not found|no hook|unknown token/i.test(message);
    console.warn(
      `${TAG} resume toolCallId=${body.toolCallId} ` +
        `outcome=${notFound ? "hook-not-found" : "already-resolved"} error=${message}`,
    );
    return NextResponse.json({
      ok: true,
      resumed: false,
      reason: notFound ? "hook-not-found" : "already-resolved",
    });
  }

  console.log(`${TAG} resumed toolCallId=${body.toolCallId}`);
  return NextResponse.json({ ok: true, resumed: true });
}
