import { describe, expect, test } from "vitest";
import { shouldForbidTools } from "./loop-guard";

describe("shouldForbidTools", () => {
  test("returns false with no steps", () => {
    expect(shouldForbidTools([])).toBe(false);
  });

  test("returns false when all tools were approved", () => {
    expect(
      shouldForbidTools([
        {
          toolResults: [
            { output: { ok: true, receiptId: "r1", executedAt: "t" } },
          ],
        },
      ]),
    ).toBe(false);
  });

  test("returns true once any tool was denied", () => {
    expect(
      shouldForbidTools([
        {
          toolResults: [
            { output: { ok: true, receiptId: "r1", executedAt: "t" } },
          ],
        },
        {
          toolResults: [
            { output: { ok: false, denied: true, message: "no" } },
          ],
        },
      ]),
    ).toBe(true);
  });
});
