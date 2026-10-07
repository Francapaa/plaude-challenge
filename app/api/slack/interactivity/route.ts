import { NextResponse } from "next/server";
import type { SlackActionValue } from "@/types";
import { approvalHook } from "@/workflow/hooks/approval";
import { verifySlackSignature } from "@/lib/slack";

const TAG = "[slack:hitl]";

/**
 * Slack interactivity webhook (Approve/Deny buttons on approval cards).
 * Slack POSTs `application/x-www-form-urlencoded` with a `payload` JSON
 * field of type `block_actions`. We verify the request signature, then
 * resume the suspended workflow hook whose token is the toolCallId carried
 * in the button value.
 */
export async function POST(request: Request) {
  const receivedAt = Date.now();
  const rawBody = await request.text();
  const params = new URLSearchParams(rawBody);
  const payloadRaw = params.get("payload");

  if (!payloadRaw) {
    console.warn(`${TAG} rejected: missing payload`);
    return NextResponse.json({ error: "missing payload" }, { status: 400 });
  }

  const signingSecret = process.env.SLACK_SIGNING_SECRET;
  if (signingSecret) {
    const timestamp = request.headers.get("x-slack-request-timestamp") ?? "";
    const signature = request.headers.get("x-slack-signature") ?? "";
    const ageSeconds = Math.abs(Date.now() / 1000 - Number(timestamp) || 0);

    if (!timestamp || ageSeconds > 60 * 5) {
      console.warn(`${TAG} rejected: stale request (age=${ageSeconds}s)`);
      return NextResponse.json({ error: "stale request" }, { status: 401 });
    }

    const valid = verifySlackSignature({
      signingSecret,
      timestamp,
      rawBody,
      signature,
    });
    if (!valid) {
      console.warn(`${TAG} rejected: invalid signature`);
      return NextResponse.json({ error: "invalid signature" }, { status: 401 });
    }
  } else {
    console.warn(`${TAG} SLACK_SIGNING_SECRET not set — skipping verification`);
  }

  let payload: {
    type?: string;
    user?: { username?: string; id?: string };
    actions?: Array<{ action_id?: string; value?: string }>;
  };
  try {
    payload = JSON.parse(payloadRaw);
  } catch {
    console.warn(`${TAG} rejected: invalid payload JSON`);
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  }

  if (payload.type !== "block_actions") {
    return NextResponse.json({ ok: true, ignored: payload.type ?? null });
  }

  const action = payload.actions?.[0];
  const approved = action?.action_id === "approve_tool";

  let value: Partial<SlackActionValue>;
  try {
    value = JSON.parse(action?.value ?? "{}");
  } catch {
    console.warn(`${TAG} rejected: invalid action value`);
    return NextResponse.json({ error: "invalid action value" }, { status: 400 });
  }

  if (!value.toolCallId) {
    console.warn(`${TAG} rejected: missing toolCallId`);
    return NextResponse.json({ error: "missing toolCallId" }, { status: 400 });
  }

  const decidedBy = payload.user?.username ?? payload.user?.id ?? "slack-user";
  console.log(
    `${TAG} action=${action?.action_id} toolCallId=${value.toolCallId} user=${decidedBy}`,
  );

  const resumeStarted = Date.now();
  try {
    await approvalHook.resume(value.toolCallId, {
      approved,
      comment: decidedBy,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const notFound = /not found|no hook|unknown token/i.test(message);
    // Always ack 200 so Slack doesn't show an error on the button or retry,
    // but make the outcome explicit in logs and response for debugging.
    console.warn(
      `${TAG} resume toolCallId=${value.toolCallId} ` +
        `outcome=${notFound ? "hook-not-found" : "already-resolved"} error=${message}`,
    );
    return NextResponse.json({
      ok: true,
      resumed: false,
      reason: notFound ? "hook-not-found" : "already-resolved",
    });
  }
  const latencyMs = Date.now() - resumeStarted;
  const totalMs = Date.now() - receivedAt;
  console.log(
    `${TAG} resumed toolCallId=${value.toolCallId} approved=${approved} ` +
      `resumeMs=${latencyMs} totalMs=${totalMs}`,
  );
  if (totalMs > 2800) {
    console.warn(`${TAG} slow ack totalMs=${totalMs} (Slack limit ~3000ms)`);
  }

  return NextResponse.json({ ok: true, resumed: true });
}
