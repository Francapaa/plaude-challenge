import { z } from "zod";
import { requiresHumanApproval } from "./policy";

export const refundSchema = z.object({
  orderId: z.string(),
  amountUSD: z.number(),
  reason: z.string(),
});

export const transferSchema = z.object({
  recipient: z.string(),
  amountUSD: z.number(),
  memo: z.string().optional(),
});

export type RefundInput = z.infer<typeof refundSchema>;
export type TransferInput = z.infer<typeof transferSchema>;

export async function executeRefund(input: RefundInput) {
  "use step";
  return {
    ok: true,
    receiptId: `refund_${input.orderId}`,
    amountUSD: input.amountUSD,
    executedAt: new Date().toISOString(),
  };
}

export async function executeTransfer(input: TransferInput) {
  "use step";
  return {
    ok: true,
    receiptId: `transfer_${Date.now()}`,
    recipient: input.recipient,
    amountUSD: input.amountUSD,
    executedAt: new Date().toISOString(),
  };
}

export async function needsRefundApproval(input: RefundInput) {
  return requiresHumanApproval({
    type: "refund",
    amountUSD: input.amountUSD,
    // Order age is unknown at tool-call time in the demo; be conservative
    // only on amount and let the instructions handle the 30-day lookup.
    hasAllDetails: input.orderId.trim().length > 0,
  });
}

export async function needsTransferApproval() {
  return requiresHumanApproval({ type: "transfer", hasAllDetails: true });
}
