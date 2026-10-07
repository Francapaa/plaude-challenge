import { WebClient } from "@slack/web-api";

export interface ApprovalMessage {
  channel: string;
  ts: string;
  mock: boolean;
}

function getClient(): WebClient | null {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) return null;
  return new WebClient(token);
}

/**
 * Posts a human-in-the-loop approval request to Slack with Approve/Deny
 * buttons. Falls back to a logged mock when no bot token is configured so
 * the demo works without a workspace.
 */
export async function postApprovalMessage(params: {
  runId: string;
  approvalId: string;
  toolName: string;
  summary: string;
}): Promise<ApprovalMessage> {
  const channel =
    process.env.SLACK_APPROVAL_CHANNEL ?? "#approvals";
  const client = getClient();

  const text =
    `Approval needed for *${params.toolName}* (run ${params.runId}): ${params.summary}`;

  if (!client) {
    console.log(`[slack:mock] ${text}`);
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
              runId: params.runId,
              approvalId: params.approvalId,
            }),
          },
          {
            type: "button",
            text: { type: "plain_text", text: "Deny" },
            style: "danger",
            action_id: "deny_tool",
            value: JSON.stringify({
              runId: params.runId,
              approvalId: params.approvalId,
            }),
          },
        ],
      },
    ],
  });

  return { channel, ts: res.ts ?? "", mock: false };
}
