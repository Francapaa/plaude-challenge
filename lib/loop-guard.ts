import { isDeniedResult } from "./action-guards";

interface StepLike {
  toolResults: readonly { output?: unknown }[];
}
/*
 * Returns true once any executed tool in this run came back denied by a
 * human. Used by the agent's prepareStep to forbid further tool calls
 * (toolChoice: "none") so a denial can't trigger a re-approval loop.
 */
export function shouldForbidTools(steps: readonly StepLike[]): boolean {
  return steps.some((step) =>
    step.toolResults.some((result) => isDeniedResult(result.output)),
  );
}
