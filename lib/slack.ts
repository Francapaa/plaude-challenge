import { createHmac, timingSafeEqual } from "node:crypto";
import { WebClient } from "@slack/web-api";
import { FatalError } from "workflow";
import type { ApprovalMessage, SlackCardBlocks, VerdictInput } from "@/types";

const CHANNEL_ID_PATTERN = /^C[A-Z0-9]{8,}$/;

/**
 * Resolves the Slack approval channel from the environment, logging the
 * exact raw value so invisible typos (quotes, spaces, trailing S) show up
 * in logs immediately. Channel names like "#approvals" are rejected on
 * purpose: chat.postMessage tolerates them but chat.update answers
 * channel_not_found, which used to cost hours of debugging.
 */
export function resolveApprovalChannel(): string {
  const raw = process.env.SLACK_APPROVAL_CHANNEL;
  console.log(
    `[slack] SLACK_APPROVAL_CHANNEL raw=${JSON.stringify(raw ?? null)}`,
  );
  if (raw === undefined || raw === "") {
    console.warn(
      '[slack] SLACK_APPROVAL_CHANNEL not set — falling back to "#approvals" (demo mode; card updates will fail)',
    );
    return "#approvals";
  }
  if (!CHANNEL_ID_PATTERN.test(raw)) {
    throw new FatalError(
      `SLACK_APPROVAL_CHANNEL must be a channel ID like "C012AB3CD", got ${JSON.stringify(raw)}. ` +
        `Fix the variable in Vercel (exact name SLACK_APPROVAL_CHANNEL, no quotes/spaces) and redeploy.`,
    );
  }
  return raw;
}

function getClient(): WebClient | null {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) return null;
  return new WebClient(token);
}

function approvalText(toolName: string, summary: string): string {
  return `Approval needed for *${toolName}*: ${summary}`;
}

export async function postApprovalMessage(params: {
  toolCallId: string;
  toolName: string;
  summary: string;
}): Promise<ApprovalMessage> {
  const channel = resolveApprovalChannel();
  const client = getClient();

  const text = approvalText(params.toolName, params.summary);

  if (!client) {
    console.log(`[slack:mock] ${text} (toolCallId=${params.toolCallId})`);
    return { channel, ts: `mock_${Date.now()}`, mock: true };
  }
  // buttons in slack chat
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

//processing decision
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
