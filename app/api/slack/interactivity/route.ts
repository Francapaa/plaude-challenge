import { NextResponse } from "next/server";
import { getHookByToken, resumeHook } from "workflow/api";
import { HookNotFoundError } from "workflow/errors";
import type { ApprovalPayload, SlackActionValue } from "@/types";
import { approvalPayloadSchema } from "@/workflow/hooks/approval";
import {
  acknowledgeViaResponseUrl,
  buildAckText,
  verifySlackSignature,
} from "@/lib/slack";

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
    response_url?: string;
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

  const toolName = value.toolName ?? "action";
  const decidedBy = payload.user?.username ?? payload.user?.id ?? "slack-user";
  console.log(
    `${TAG} action=${action?.action_id} tool=${toolName} toolCallId=${value.toolCallId} user=${decidedBy}`,
  );

  // Instant ephemeral feedback to the clicker. Never touches the shared
  // card, so duplicates can't corrupt the final verdict. Best-effort: a
  // failed ack must not block the resume.
  if (payload.response_url) {
    try {
      await acknowledgeViaResponseUrl(
        payload.response_url,
        buildAckText({ toolName, approved }),
      );
    } catch (error) {
      console.warn(
        `${TAG} ack failed toolCallId=${value.toolCallId}:`,
        error instanceof Error ? error.message : error,
      );
    }
  }

  const resumeStarted = Date.now();
  // Diagnostic lookup (single read, no metadata hydration): records whether
  // the token exists at all before attempting the resume.
  const existing = await getHookByToken(value.toolCallId).catch(() => null);
  console.log(
    `${TAG} hook-lookup toolCallId=${value.toolCallId} exists=${existing !== null} runId=${existing?.runId ?? "unknown"}`,
  );

  try {
    // Token-based resume (no defineHook instance identity involved): the live
    // backend resolves whichever hook holds the token. Schema validation that
    // defineHook.resume() did automatically is done explicitly here.
    const payload: ApprovalPayload = approvalPayloadSchema.parse({
      approved,
      comment: decidedBy,
    });
    const resumedHook = await resumeHook(value.toolCallId, payload);
    console.log(
      `${TAG} hook-resumed toolCallId=${value.toolCallId} runId=${resumedHook.runId}`,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const notFound =
      HookNotFoundError.is(error) ||
      /not found|no hook|unknown token/i.test(message);
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
