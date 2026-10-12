import { WorkflowAgent, type ModelCallStreamPart } from "@ai-sdk/workflow";
import { convertToModelMessages, isStepCount, tool, type UIMessage } from "ai";
import { getWritable } from "workflow";
import { AGENT_INSTRUCTIONS, MODEL_ID } from "@/lib/agent";
import { shouldForbidTools } from "@/lib/loop-guard";
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
    prepareStep: ({ steps }) =>
      shouldForbidTools(steps) ? { toolChoice: "none" as const } : {},
    tools: {
      refundPayment: tool({
        description:
          "Request or execute a customer order refund. Calling this tool does NOT charge or refund anything by itself: small, recent, clear refunds execute immediately, anything else automatically pauses for human approval in Slack. To request approval you MUST call this tool — never ask in chat text.",
        inputSchema: refundSchema,
        execute: executeRefundRequest,
      }),
      highValueTransfer: tool({
        description:
          "Request a payment or transfer. Calling this tool does NOT move money by itself: it always pauses for human approval in Slack before executing. To request approval you MUST call this tool — never ask in chat text.",
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
