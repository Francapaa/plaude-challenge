/**
 * Pure approval policy mirroring lib/agent.ts plain-text rules.
 * Kept side-effect free so it is unit-testable and reusable from
 * `needsApproval` callbacks and Slack message builders.
 */

export const REFUND_AUTO_APPROVE_MAX_USD = 20;
export const REFUND_WINDOW_DAYS = 30;
export const HIGH_VALUE_THRESHOLD_USD = 1000;

export type ActionType = "refund" | "transfer" | "generic";

export interface ActionInput {
  type: ActionType;
  amountUSD?: number;
  daysSincePurchase?: number;
  hasAllDetails?: boolean;
}

export function requiresHumanApproval(action: ActionInput): boolean {
  // Ambiguous requests always escalate: never guess.
  if (action.hasAllDetails === false) return true;

  if (action.type === "transfer") {
    // High-value operations: always require approval (no auto-approve path).
    return true;
  }

  if (action.type === "refund") {
    const amount = action.amountUSD ?? 0;
    if (amount > REFUND_AUTO_APPROVE_MAX_USD) return true;
    if ((action.daysSincePurchase ?? 0) > REFUND_WINDOW_DAYS) return true;
    return false;
  }

  // Generic actions default to approval (safe default for the demo).
  return true;
}
