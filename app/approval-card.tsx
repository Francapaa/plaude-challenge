"use client";

import { useResolveApproval } from "@/hooks/useResolveApproval";
import {
  isActionReceipt,
  isDeniedResult,
  isRefundInput,
  isTransferInput,
} from "@/lib/action-guards";

interface ApprovalCardProps {
  toolCallId: string;
  toolName: string;
  input: unknown;
  output: unknown;
}

function renderInput(input: unknown): string {
  if (isRefundInput(input)) {
    return `order ${input.orderId} $${input.amountUSD} — ${input.reason}`;
  }
  if (isTransferInput(input)) {
    return `to ${input.recipient} $${input.amountUSD}${input.memo ? ` — ${input.memo}` : ""}`;
  }
  return "";
}

function renderOutput(output: unknown): string {
  if (isDeniedResult(output)) return output.message;
  if (isActionReceipt(output)) return `Done — receipt ${output.receiptId}`;
  return typeof output === "string" ? output : "Done.";
}

export function ApprovalCard({ toolCallId, toolName, input, output }: ApprovalCardProps) {
  const { resolve, submitting, sent } = useResolveApproval(toolCallId);

  if (output) {
    const tone = isDeniedResult(output)
      ? "border-red-200 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-100"
      : isActionReceipt(output)
        ? "border-green-200 bg-green-50 text-green-900 dark:border-green-800 dark:bg-green-950 dark:text-green-100"
        : "border-zinc-200 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100";
    return (
      <div className={`rounded border p-3 text-sm ${tone}`}>
        <span className="font-medium">{toolName}:</span> {renderOutput(output)}
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100">
      <p>
        ⏳ <span className="font-medium">Waiting for human approval in Slack</span>
        <br />
        <span className="text-zinc-700 dark:text-amber-200/70">
          {toolName} {renderInput(input)}
        </span>
      </p>
      {sent === null ? (
        <div className="flex gap-2">
          <button
            type="button"
            disabled={submitting}
            onClick={() => void resolve(true)}
            className="rounded bg-green-600 px-3 py-1 text-white disabled:opacity-50"
          >
            {submitting ? "…" : "Approve here"}
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={() => void resolve(false)}
            className="rounded bg-red-600 px-3 py-1 text-white disabled:opacity-50"
          >
            {submitting ? "…" : "Deny here"}
          </button>
        </div>
      ) : (
        <p className="text-zinc-600 dark:text-amber-200/70">
          Decision sent from here ({sent ? "approved" : "denied"}) — the agent will continue shortly.
        </p>
      )}
    </div>
  );
}
