import { describe, expect, test } from "vitest";
import { FatalError } from "workflow";
import {
  buildAckText,
  buildVerdictBlocks,
  resolveApprovalChannel,
  verifySlackSignature,
} from "./slack";

const SIGNING_SECRET = "test_secret";
const TIMESTAMP = "1531420618";
const RAW_BODY = "payload=test";
// Precomputed with: HMAC_SHA256("v0:1531420618:payload=test", "test_secret")
const VALID_SIGNATURE =
  "v0=788584c47c66775eba047536f3bd56abb11e783290a9a45597621c05e2824eb0";

describe("verifySlackSignature", () => {
  test("accepts a genuine Slack signature", () => {
    expect(
      verifySlackSignature({
        signingSecret: SIGNING_SECRET,
        timestamp: TIMESTAMP,
        rawBody: RAW_BODY,
        signature: VALID_SIGNATURE,
      }),
    ).toBe(true);
  });

  test("rejects a tampered body", () => {
    expect(
      verifySlackSignature({
        signingSecret: SIGNING_SECRET,
        timestamp: TIMESTAMP,
        rawBody: "payload=evil",
        signature: VALID_SIGNATURE,
      }),
    ).toBe(false);
  });

  test("rejects a wrong secret", () => {
    expect(
      verifySlackSignature({
        signingSecret: "wrong_secret",
        timestamp: TIMESTAMP,
        rawBody: RAW_BODY,
        signature: VALID_SIGNATURE,
      }),
    ).toBe(false);
  });
});

describe("buildVerdictBlocks", () => {
  test("renders approval with no action buttons", () => {
    const blocks = buildVerdictBlocks({
      toolName: "refundPayment",
      summary: "Refund $150 for order #123",
      approved: true,
      decidedBy: "alice",
      decidedAt: "2026-10-08T00:00:00.000Z",
    });
    expect(blocks).toHaveLength(2);
    expect(blocks[0].type).toBe("section");
    expect(JSON.stringify(blocks)).toContain("Approved");
    expect(JSON.stringify(blocks)).toContain("alice");
    expect(JSON.stringify(blocks)).toContain("Refund $150");
    expect(JSON.stringify(blocks)).not.toContain('"type":"actions"');
  });

  test("renders denial verdict", () => {
    const blocks = buildVerdictBlocks({
      toolName: "highValueTransfer",
      summary: "Transfer $2000",
      approved: false,
      decidedBy: "bob",
      decidedAt: "2026-10-08T00:00:00.000Z",
    });
    expect(JSON.stringify(blocks)).toContain("Denied");
    expect(JSON.stringify(blocks)).toContain("bob");
  });
});

describe("buildAckText", () => {
  test("mentions the decision and tool", () => {
    expect(buildAckText({ toolName: "refundPayment", approved: true })).toContain(
      "Approve",
    );
    expect(
      buildAckText({ toolName: "refundPayment", approved: false }),
    ).toContain("Deny");
  });
});

describe("resolveApprovalChannel", () => {
  const KEY = "SLACK_APPROVAL_CHANNEL";
  const prev = process.env[KEY];

  const set = (value: string | undefined) => {
    if (value === undefined) delete process.env[KEY];
    else process.env[KEY] = value;
  };

  test("restores env after tests", () => {
    set(prev);
    expect(process.env[KEY]).toBe(prev);
  });

  test("accepts a channel ID", () => {
    set("C0C8A9ARREU");
    expect(resolveApprovalChannel()).toBe("C0C8A9ARREU");
    set(prev);
  });

  test("falls back when unset", () => {
    set(undefined);
    expect(resolveApprovalChannel()).toBe("#approvals");
    set(prev);
  });

  test("rejects channel names, quotes and padding", () => {
    for (const bad of ["#approvals", '"C0C8A9ARREU"', "C0C8A9ARREU ", " C0C8A9ARREU"]) {
      set(bad);
      expect(() => resolveApprovalChannel()).toThrow(FatalError);
    }
    set(prev);
  });
});
