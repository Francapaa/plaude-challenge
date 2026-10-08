import { describe, expect, test } from "vitest";
import { AGENT_INSTRUCTIONS, MODEL_ID } from "./agent";

describe("AGENT_INSTRUCTIONS", () => {
  test("mandates calling the tool instead of asking in chat text", () => {
    expect(AGENT_INSTRUCTIONS).toMatch(/MUST CALL the tool/i);
    expect(AGENT_INSTRUCTIONS).toMatch(/NEVER ask for approval in chat text/i);
  });

  test("forbids re-asking after a denial", () => {
    expect(AGENT_INSTRUCTIONS).toMatch(/already contains a denial/i);
    expect(AGENT_INSTRUCTIONS).toMatch(/NEVER call that tool again/i);
  });

  test("covers the three approval scenarios", () => {
    expect(AGENT_INSTRUCTIONS).toMatch(/refund/i);
    expect(AGENT_INSTRUCTIONS).toMatch(/high-value/i);
    expect(AGENT_INSTRUCTIONS).toMatch(/ambiguous/i);
  });

  test("uses a cheap model by default", () => {
    expect(MODEL_ID).toBe("openai/gpt-4o-mini");
  });
});
