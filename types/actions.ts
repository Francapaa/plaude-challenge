export interface RefundInput {
  orderId: string;
  amountUSD: number;
  reason: string;
}

export interface TransferInput {
  recipient: string;
  amountUSD: number;
  memo?: string;
}

/** Second argument received by AI SDK tool `execute` functions. */
export interface ToolContext {
  toolCallId: string;
}

/** Successful simulated payout/transfer receipt returned by tool executors. */
export interface ActionReceipt {
  ok: true;
  receiptId: string;
  executedAt: string;
}

export interface RefundReceipt extends ActionReceipt {
  amountUSD: number;
}

export interface TransferReceipt extends ActionReceipt {
  recipient: string;
  amountUSD: number;
}

/** Denial returned when the human reviewer rejects the action. */
export interface DeniedResult {
  ok: false;
  denied: true;
  message: string;
}

/** Every tool executor resolves to either a receipt or a denial. */
export type ActionResult = ActionReceipt | DeniedResult;
