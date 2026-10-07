import { WorkflowAgent, type ModelCallStreamPart } from "@ai-sdk/workflow";
import { convertToModelMessages, isStepCount, tool, type UIMessage } from "ai";
import { getWritable } from "workflow";
import { AGENT_INSTRUCTIONS, MODEL_ID } from "@/lib/agent";
import {
  executeRefund,
  executeTransfer,
  needsRefundApproval,
  needsTransferApproval,
  refundSchema,
  transferSchema,
} from "@/lib/tools";

export async function chat(messages: UIMessage[]) {
  "use workflow"; //durable

  const modelMessages = await convertToModelMessages(messages);

  const agent = new WorkflowAgent({
    model: MODEL_ID,
    instructions: AGENT_INSTRUCTIONS,
    tools: {
      refundPayment: tool({
        description:
          "Refund a customer order. Requires human approval over $20.",
        inputSchema: refundSchema,
        needsApproval: needsRefundApproval,
        execute: executeRefund,
      }),
      highValueTransfer: tool({
        description:
          "Send a payment or transfer. Always requires human approval.",
        inputSchema: transferSchema,
        needsApproval: needsTransferApproval,
        execute: executeTransfer,
      }),
    },
  });

  const result = await agent.stream({
    messages: modelMessages,
    writable: getWritable<ModelCallStreamPart>(),
    stopWhen: isStepCount(10), // 10 calls
  });

  return { messages: result.messages };
}
