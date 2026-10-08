import { NextResponse } from "next/server";
import type { ResolveRequest } from "@/types";
import { approvalHook } from "@/workflow/hooks/approval";

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

  try {
    await approvalHook.resume(body.toolCallId, {
      approved: body.approved,
      comment: body.comment ?? "web-ui",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const notFound = /not found|no hook|unknown token/i.test(message);
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
