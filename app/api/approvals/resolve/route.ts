import { NextResponse } from "next/server";
import type { ResolveRequest } from "@/types";
import { approvalHook } from "@/workflow/hooks/approval";

/**
 * UI fallback approval endpoint. Resolves the same workflow hook token
 * (toolCallId) as the Slack buttons — whichever decision arrives first
 * wins, the other becomes a no-op.
 */
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

  try {
    await approvalHook.resume(body.toolCallId, {
      approved: body.approved,
      comment: body.comment ?? "web-ui",
    });
  } catch (error) {
    console.log(
      `[approvals] hook ${body.toolCallId} already resolved:`,
      error instanceof Error ? error.message : error,
    );
    return NextResponse.json({ ok: true, deduped: true });
  }

  return NextResponse.json({ ok: true });
}
