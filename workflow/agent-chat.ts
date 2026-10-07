import { WorkflowAgent, type ModelCallStreamPart } from "@ai-sdk/workflow";
import { convertToModelMessages, isStepCount, tool, type UIMessage } from "ai";
import { getWritable } from "workflow";
import { AGENT_INSTRUCTIONS, MODEL_ID } from "@/lib/agent";
import {
  executeRefundRequest,
  executeTransferRequest,
  refundSchema,
  transferSchema,
} from "@/lib/tools";

export async function chat(messages: UIMessage[]) {
  "use workflow";

  const modelMessages = await convertToModelMessages(messages);

  const agent = new WorkflowAgent({
    model: MODEL_ID,
    instructions: AGENT_INSTRUCTIONS,
    tools: {
      // Note: no `needsApproval` here. Each executor escalates to a human
      // itself: it posts the Slack card and suspends on the approval hook
      // (workflow-level primitive), so Slack and the UI fallback resolve
      // the same token.
      refundPayment: tool({
        description:
          "Refund a customer order. Small, recent, clear refunds execute immediately; anything else pauses for human approval in Slack.",
        inputSchema: refundSchema,
        execute: executeRefundRequest,
      }),
      highValueTransfer: tool({
        description:
          "Send a payment or transfer. Always pauses for human approval in Slack before executing.",
        inputSchema: transferSchema,
        execute: executeTransferRequest,
      }),
    },
  });

  const result = await agent.stream({
    messages: modelMessages,
    writable: getWritable<ModelCallStreamPart>(),
    stopWhen: isStepCount(10),
  });

  return { messages: result.messages };
}
