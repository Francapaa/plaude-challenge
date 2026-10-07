/** Payload that resolves a suspended approval hook. */
export interface ApprovalPayload {
  approved: boolean;
  comment?: string;
}

/** Result of posting an approval card to Slack (or the mock fallback). */
export interface ApprovalMessage {
  channel: string;
  ts: string;
  mock: boolean;
}

/** Button value embedded in Slack Approve/Deny buttons. */
export interface SlackActionValue {
  toolCallId: string;
}

/** Body accepted by POST /api/approvals/resolve. */
export interface ResolveRequest {
  toolCallId: string;
  approved: boolean;
  comment?: string;
}
