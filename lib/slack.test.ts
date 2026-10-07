import { describe, expect, test } from "vitest";
import { verifySlackSignature } from "./slack";

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
