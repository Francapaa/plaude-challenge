export type ActionType = "refund" | "transfer" | "generic";

export interface ActionInput {
  type: ActionType;
  amountUSD?: number;
  daysSincePurchase?: number;
  hasAllDetails?: boolean;
}
