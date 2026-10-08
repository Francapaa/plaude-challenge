import { createHmac, timingSafeEqual } from "node:crypto";
import { WebClient } from "@slack/web-api";
import type { ApprovalMessage } from "@/types";

function getClient(): WebClient | null {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) return null;
  return new WebClient(token);
}

function approvalText(toolName: string, summary: string): string {
  return `Approval needed for *${toolName}*: ${summary}`;
}

/**
 * Posts a human-in-the-loop approval request to Slack with Approve/Deny
 * buttons. The button value carries the toolCallId, which is also the
 * workflow hook token — so the interactivity webhook can resume the exact
 * suspended tool call. Falls back to a logged mock when no bot token is
 * configured so the demo works without a workspace.
 */
export async function postApprovalMessage(params: {
  toolCallId: string;
  toolName: string;
  summary: string;
}): Promise<ApprovalMessage> {
  const channel = process.env.SLACK_APPROVAL_CHANNEL ?? "#approvals";
  const client = getClient();

  const text = approvalText(params.toolName, params.summary);

  if (!client) {
    console.log(`[slack:mock] ${text} (toolCallId=${params.toolCallId})`);
    return { channel, ts: `mock_${Date.now()}`, mock: true };
  }

  const res = await client.chat.postMessage({
    channel,
    text,
    blocks: [
      {
        type: "section",
        text: { type: "mrkdwn", text },
      },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: { type: "plain_text", text: "Approve" },
            style: "primary",
            action_id: "approve_tool",
            value: JSON.stringify({ toolCallId: params.toolCallId }),
          },
          {
            type: "button",
            text: { type: "plain_text", text: "Deny" },
            style: "danger",
            action_id: "deny_tool",
            value: JSON.stringify({ toolCallId: params.toolCallId }),
          },
        ],
      },
    ],
  });

  const posted = { channel, ts: res.ts ?? "", mock: false };
  console.log(
    `[slack] posted tool=${params.toolName} channel=${posted.channel} ts=${posted.ts}`,
  );
  return posted;
}

/** Edits the approval card in place once a human has decided. */
export async function updateApprovalMessage(params: {
  channel: string;
  ts: string;
  mock: boolean;
  toolName: string;
  approved: boolean;
  decidedBy?: string;
}): Promise<{ updated: boolean }> {
  const verdict = params.approved ? "Approved" : "Denied";
  const text =
    `${verdict} — *${params.toolName}*` +
    (params.decidedBy ? ` (${params.decidedBy})` : "");

  if (params.mock || !getClient()) {
    console.log(`[slack:mock] ${text}`);
    return { updated: false };
  }

  await getClient()!.chat.update({
    channel: params.channel,
    ts: params.ts,
    text,
    blocks: [
      {
        type: "section",
        text: { type: "mrkdwn", text },
      },
    ],
  });
  return { updated: true };
}

/**
 * Verifies that an incoming request genuinely comes from Slack.
 * https://docs.slack.dev/authentication/verifying-requests-from-slack
 */
export function verifySlackSignature(params: {
  signingSecret: string;
  timestamp: string;
  rawBody: string;
  signature: string;
}): boolean {
  const base = `v0:${params.timestamp}:${params.rawBody}`;
  const expected =
    "v0=" +
    createHmac("sha256", params.signingSecret).update(base).digest("hex");

  const a = Buffer.from(expected);
  const b = Buffer.from(params.signature);
  return a.length === b.length && timingSafeEqual(a, b);
}
