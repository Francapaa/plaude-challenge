import { describe, expect, test } from "vitest";
import { isInScopeTopic, requiresHumanApproval } from "./policy";

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

describe("isInScopeTopic", () => {
  test("accepts money operations in English and Spanish", () => {
    expect(isInScopeTopic("refund order #123 for $150")).toBe(true);
    expect(isInScopeTopic("quiero un reembolso de mi pedido")).toBe(true);
    expect(isInScopeTopic("transfer $500 to Ana")).toBe(true);
    expect(isInScopeTopic("haz una transferencia a Juan")).toBe(true);
    expect(isInScopeTopic("pay my invoice")).toBe(true);
  });

  test("accepts permission changes and deletions", () => {
    expect(isInScopeTopic("give Ana admin permissions")).toBe(true);
    expect(isInScopeTopic("dale acceso a Martín")).toBe(true);
    expect(isInScopeTopic("delete my account")).toBe(true);
    expect(isInScopeTopic("quiero eliminar mi cuenta")).toBe(true);
  });

  test("accepts brief greetings", () => {
    expect(isInScopeTopic("hola")).toBe(true);
    expect(isInScopeTopic("hey, thanks")).toBe(true);
  });

  test("is accent-insensitive", () => {
    expect(isInScopeTopic("pido la devolución")).toBe(true);
  });

  test("rejects unrelated topics", () => {
    expect(isInScopeTopic("give me a pasta recipe")).toBe(false);
    expect(isInScopeTopic("help me with my homework")).toBe(false);
    expect(isInScopeTopic("write a python function")).toBe(false);
    expect(isInScopeTopic("what is the weather like")).toBe(false);
    expect(isInScopeTopic("cuéntame un chiste")).toBe(false);
  });

  test("does not match substrings inside other words", () => {
    expect(isInScopeTopic("this ship is big")).toBe(false);
    expect(isInScopeTopic("the border is closed")).toBe(false);
  });
});
