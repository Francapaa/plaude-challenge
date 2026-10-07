import { NextResponse } from "next/server";
import type { SlackActionValue } from "@/types";
import { approvalHook } from "@/workflow/hooks/approval";
import { verifySlackSignature } from "@/lib/slack";

/**
 * Slack interactivity webhook (Approve/Deny buttons on approval cards).
 * Slack POSTs `application/x-www-form-urlencoded` with a `payload` JSON
 * field of type `block_actions`. We verify the request signature, then
 * resume the suspended workflow hook whose token is the toolCallId carried
 * in the button value.
 */
export async function POST(request: Request) {
  const rawBody = await request.text();
  const params = new URLSearchParams(rawBody);
  const payloadRaw = params.get("payload");

  if (!payloadRaw) {
    return NextResponse.json({ error: "missing payload" }, { status: 400 });
  }

  const signingSecret = process.env.SLACK_SIGNING_SECRET;
  if (signingSecret) {
    const timestamp = request.headers.get("x-slack-request-timestamp") ?? "";
    const signature = request.headers.get("x-slack-signature") ?? "";
    const ageSeconds =
      Math.abs(Date.now() / 1000 - Number(timestamp) || 0);

    if (!timestamp || ageSeconds > 60 * 5) {
      return NextResponse.json({ error: "stale request" }, { status: 401 });
    }

    const valid = verifySlackSignature({
      signingSecret,
      timestamp,
      rawBody,
      signature,
    });
    if (!valid) {
      return NextResponse.json({ error: "invalid signature" }, { status: 401 });
    }
  } else {
    console.warn("[slack] SLACK_SIGNING_SECRET not set — skipping verification");
  }

  let payload: {
    type?: string;
    user?: { username?: string; id?: string };
    actions?: Array<{ action_id?: string; value?: string }>;
  };
  try {
    payload = JSON.parse(payloadRaw);
  } catch {
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
    return NextResponse.json({ error: "invalid action value" }, { status: 400 });
  }

  if (!value.toolCallId) {
    return NextResponse.json({ error: "missing toolCallId" }, { status: 400 });
  }

  const decidedBy =
    payload.user?.username ?? payload.user?.id ?? "slack-user";

  try {
    await approvalHook.resume(value.toolCallId, {
      approved,
      comment: decidedBy,
    });
  } catch (error) {
    // The hook may already be resolved (e.g. approved from the UI first).
    // Ack 200 so Slack doesn't show an error on the button.
    console.log(
      `[slack] hook ${value.toolCallId} already resolved:`,
      error instanceof Error ? error.message : error,
    );
    return NextResponse.json({ ok: true, deduped: true });
  }

  return NextResponse.json({ ok: true });
}
