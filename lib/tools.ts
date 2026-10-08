import { z } from "zod";
import type {
  ActionReceipt,
  ActionResult,
  RefundInput,
  RefundReceipt,
  ToolContext,
  TransferInput,
  TransferReceipt,
} from "@/types";
import { approvalHook } from "@/workflow/hooks/approval";
import { requiresHumanApproval } from "./policy";
import { postApprovalMessage, updateApprovalMessage } from "./slack";

export const refundSchema = z.object({
  orderId: z.string(),
  amountUSD: z.number(),
  reason: z.string(),
}) satisfies z.ZodType<RefundInput>;

export const transferSchema = z.object({
  recipient: z.string(),
  amountUSD: z.number(),
  memo: z.string().optional(),
}) satisfies z.ZodType<TransferInput>;

/** Durable step: simulated refund payout (no real money moves in the demo). */
export async function finalizeRefundStep(
  input: RefundInput,
): Promise<RefundReceipt> {
  "use step";
  return {
    ok: true,
    receiptId: `refund_${input.orderId}`,
    amountUSD: input.amountUSD,
    executedAt: new Date().toISOString(),
  };
}

/** Durable step: simulated transfer (no real money moves in the demo). */
export async function finalizeTransferStep(
  input: TransferInput,
): Promise<TransferReceipt> {
  "use step";
  return {
    ok: true,
    receiptId: `transfer_${Date.now()}`,
    recipient: input.recipient,
    amountUSD: input.amountUSD,
    executedAt: new Date().toISOString(),
  };
}

function refundSummary(input: RefundInput): string {
  return `Refund $${input.amountUSD} for order ${input.orderId} — reason: ${input.reason}`;
}

function transferSummary(input: TransferInput): string {
  return `Transfer $${input.amountUSD} to ${input.recipient}${input.memo ? ` — memo: ${input.memo}` : ""}`;
}

/**
 * Shared escalation flow: post the Slack card, suspend on the hook,
 * then finalize or deny. Runs at workflow level (no "use step" here —
 * hooks are workflow-level primitives). Slack posts and payouts are
 * isolated in "use step" functions so replays never double-post or
 * double-execute.
 */
async function escalateForApproval(params: {
  toolCallId: string;
  toolName: string;
  summary: string;
  finalize: () => Promise<ActionReceipt>;
}): Promise<ActionResult> {
  const posted = await postApprovalMessageStep({
    toolCallId: params.toolCallId,
    toolName: params.toolName,
    summary: params.summary,
  });

  // Workflow pauses here — no compute consumed — until a human resolves
  // the same token from Slack or from the UI fallback.
  console.log(
    `[hitl] awaiting approval tool=${params.toolName} toolCallId=${params.toolCallId}`,
  );
  const hook = approvalHook.create({ token: params.toolCallId });
  const decision = await hook;
  console.log(
    `[hitl] decision tool=${params.toolName} toolCallId=${params.toolCallId} approved=${decision.approved} by=${decision.comment ?? "?"}`,
  );

  // Marking the Slack card is cosmetic: it must never kill the run,
  // no matter what Slack returns (wrong channel id, revoked token…).
  console.log(
    `[hitl] updating card tool=${params.toolName} toolCallId=${params.toolCallId} channel=${posted.channel} ts=${posted.ts} mock=${posted.mock}`,
  );
  try {
  await updateApprovalMessageStep({
    channel: posted.channel,
    ts: posted.ts,
    mock: posted.mock,
    toolName: params.toolName,
    summary: params.summary,
    approved: decision.approved,
    decidedBy: decision.comment,
  });
  } catch (error) {
    console.warn(
      `[hitl] card update failed tool=${params.toolName} toolCallId=${params.toolCallId}:`,
      error instanceof Error ? error.message : error,
    );
  }

  if (!decision.approved) {
    return {
      ok: false,
      denied: true,
      message:
        `FINAL DECISION — the human reviewer denied this ${params.toolName} action` +
        `${decision.comment ? ` (${decision.comment})` : ""}. ` +
        `Do NOT call ${params.toolName} (or any equivalent tool) again for this request in this conversation — the human already decided. ` +
        `Reply to the user with a safe alternative instead.`,
    };
  }

  return params.finalize();
}

/** Durable step: post the approval card (cached on replay → no duplicates). */
async function postApprovalMessageStep(input: {
  toolCallId: string;
  toolName: string;
  summary: string;
}) {
  "use step";
  return postApprovalMessage(input);
}

/** Durable step: mark the Slack card as approved/denied. */
async function updateApprovalMessageStep(input: {
  channel: string;
  ts: string;
  mock: boolean;
  toolName: string;
  summary: string;
  approved: boolean;
  decidedBy?: string;
}) {
  "use step";
  console.log("Update approval message is being executed")
  return updateApprovalMessage(input);
}

/**
 * Refund tool executor. Small, recent, clear refunds auto-execute per
 * policy; everything else escalates to a human in Slack.
 */
export async function executeRefundRequest(
  input: RefundInput,
  { toolCallId }: ToolContext,
): Promise<ActionResult> {
  const needsApproval = requiresHumanApproval({
    type: "refund",
    amountUSD: input.amountUSD,
    hasAllDetails: input.orderId.trim().length > 0,
  });

  if (!needsApproval) {
    return finalizeRefundStep(input);
  }

  return escalateForApproval({
    toolCallId,
    toolName: "refundPayment",
    summary: refundSummary(input),
    finalize: () => finalizeRefundStep(input),
  });
}

/** Transfer tool executor. High-value operations always escalate. */
export async function executeTransferRequest(
  input: TransferInput,
  { toolCallId }: ToolContext,
): Promise<ActionResult> {
  return escalateForApproval({
    toolCallId,
    toolName: "highValueTransfer",
    summary: transferSummary(input),
    finalize: () => finalizeTransferStep(input),
  });
}
