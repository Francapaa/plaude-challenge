import { describe, expect, test } from "vitest";
import {
  isActionReceipt,
  isActionResult,
  isDeniedResult,
  isRefundInput,
  isTransferInput,
} from "./action-guards";

describe("isRefundInput", () => {
  test("accepts a well-formed refund input", () => {
    expect(
      isRefundInput({ orderId: "#123", amountUSD: 150, reason: "damaged" }),
    ).toBe(true);
  });

  test("rejects transfer-shaped input", () => {
    expect(isRefundInput({ recipient: "acme", amountUSD: 150 })).toBe(false);
  });

  test("rejects non-objects", () => {
    expect(isRefundInput(null)).toBe(false);
    expect(isRefundInput("refund")).toBe(false);
  });
});

describe("isTransferInput", () => {
  test("accepts a transfer with and without memo", () => {
    expect(isTransferInput({ recipient: "acme", amountUSD: 500 })).toBe(true);
    expect(
      isTransferInput({ recipient: "acme", amountUSD: 500, memo: "hi" }),
    ).toBe(true);
  });

  test("rejects a non-string memo", () => {
    expect(
      isTransferInput({ recipient: "acme", amountUSD: 500, memo: 42 }),
    ).toBe(false);
  });
});

describe("isDeniedResult / isActionReceipt / isActionResult", () => {
  test("classifies a denial", () => {
    const denial = { ok: false, denied: true, message: "nope" };
    expect(isDeniedResult(denial)).toBe(true);
    expect(isActionReceipt(denial)).toBe(false);
    expect(isActionResult(denial)).toBe(true);
  });

  test("classifies a receipt", () => {
    const receipt = {
      ok: true,
      receiptId: "refund_#123",
      executedAt: new Date().toISOString(),
    };
    expect(isActionReceipt(receipt)).toBe(true);
    expect(isDeniedResult(receipt)).toBe(false);
    expect(isActionResult(receipt)).toBe(true);
  });

  test("rejects unknown outputs", () => {
    expect(isActionResult({ ok: true })).toBe(false);
    expect(isActionResult("done")).toBe(false);
  });
});
