import type {
  ActionReceipt,
  ActionResult,
  DeniedResult,
  RefundInput,
  TransferInput,
} from "@/types";

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** Narrows an unknown tool-call input to a refund request. */
export function isRefundInput(value: unknown): value is RefundInput {
  return (
    isObject(value) &&
    typeof value.orderId === "string" &&
    typeof value.amountUSD === "number" &&
    typeof value.reason === "string"
  );
}

/** Narrows an unknown tool-call input to a transfer request. */
export function isTransferInput(value: unknown): value is TransferInput {
  return (
    isObject(value) &&
    typeof value.recipient === "string" &&
    typeof value.amountUSD === "number" &&
    (value.memo === undefined || typeof value.memo === "string")
  );
}

/** Narrows an unknown tool output to a human denial. */
export function isDeniedResult(value: unknown): value is DeniedResult {
  return (
    isObject(value) &&
    value.ok === false &&
    value.denied === true &&
    typeof value.message === "string"
  );
}

/** Narrows an unknown tool output to a successful receipt. */
export function isActionReceipt(value: unknown): value is ActionReceipt {
  return (
    isObject(value) &&
    value.ok === true &&
    typeof value.receiptId === "string" &&
    typeof value.executedAt === "string"
  );
}

/** Narrows an unknown tool output to a known executor result. */
export function isActionResult(value: unknown): value is ActionResult {
  return isDeniedResult(value) || isActionReceipt(value);
}
