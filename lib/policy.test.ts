import { describe, expect, test } from "vitest";
import { requiresHumanApproval } from "./policy";

describe("requiresHumanApproval", () => {
  test("auto-approves small recent refunds with clear details", () => {
    expect(
      requiresHumanApproval({
        type: "refund",
        amountUSD: 15,
        daysSincePurchase: 5,
        hasAllDetails: true,
      }),
    ).toBe(false);
  });

  test("escalates refunds over $20", () => {
    expect(
      requiresHumanApproval({
        type: "refund",
        amountUSD: 150,
        daysSincePurchase: 5,
        hasAllDetails: true,
      }),
    ).toBe(true);
  });

  test("escalates refunds outside the 30-day window", () => {
    expect(
      requiresHumanApproval({
        type: "refund",
        amountUSD: 10,
        daysSincePurchase: 45,
        hasAllDetails: true,
      }),
    ).toBe(true);
  });

  test("always escalates transfers (high-value operations)", () => {
    expect(
      requiresHumanApproval({
        type: "transfer",
        amountUSD: 5,
        hasAllDetails: true,
      }),
    ).toBe(true);
  });

  test("escalates ambiguous requests with missing details", () => {
    expect(
      requiresHumanApproval({ type: "refund", hasAllDetails: false }),
    ).toBe(true);
  });
});
