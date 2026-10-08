import { createHmac, timingSafeEqual } from "node:crypto";
import { WebClient } from "@slack/web-api";
import type { ApprovalMessage, SlackCardBlocks, VerdictInput } from "@/types";

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
            value: JSON.stringify({
              toolCallId: params.toolCallId,
              toolName: params.toolName,
            }),
          },
          {
            type: "button",
            text: { type: "plain_text", text: "Deny" },
            style: "danger",
            action_id: "deny_tool",
            value: JSON.stringify({
              toolCallId: params.toolCallId,
              toolName: params.toolName,
            }),
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
/** Final card: verdict + who/when + original summary, no action buttons. */
export function buildVerdictBlocks(input: VerdictInput): SlackCardBlocks {
  const icon = input.approved ? "✅" : "❌";
  const verdict = input.approved ? "Approved" : "Denied";
  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `${icon} *${verdict} — ${input.toolName}*\n${input.summary}`,
      },
    },
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `Decided by ${input.decidedBy} · ${input.decidedAt}`,
        },
      ],
    },
  ];
}

/** Ephemeral ack shown only to the clicker while the decision processes. */
export function buildAckText(input: {
  toolName: string;
  approved: boolean;
}): string {
  return `Got it — your "${input.approved ? "Approve" : "Deny"}" for ${input.toolName} is being processed…`;
}

export async function updateApprovalMessage(params: {
  channel: string;
  ts: string;
  mock: boolean;
  toolName: string;
  summary: string;
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
    blocks: buildVerdictBlocks({
      toolName: params.toolName,
      summary: params.summary,
      approved: params.approved,
      decidedBy: params.decidedBy ?? "unknown",
      decidedAt: new Date().toISOString(),
    }) as never,
  });
  return { updated: true };
}

/**
 * Sends an ephemeral acknowledgement visible only to the person who
 * clicked. Never touches the shared card, so a late/duplicate click can
 * never corrupt the final verdict.
 */
export async function acknowledgeViaResponseUrl(
  responseUrl: string,
  text: string,
): Promise<void> {
  await fetch(responseUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ response_type: "ephemeral", text }),
  });
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
