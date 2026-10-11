"use client";

import { useChat } from "@ai-sdk/react";
import { WorkflowChatTransport } from "@ai-sdk/workflow/client";
import { getToolName, isToolUIPart } from "ai";
import { useMemo, useState } from "react";
import { ApprovalCard } from "./approval-card";

const APPROVAL_TOOLS = new Set(["refundPayment", "highValueTransfer"]);

export function Chat() {
  const transport = useMemo(
    () => new WorkflowChatTransport({ api: "/api/chat" }),
    [],
  );
  const { messages, sendMessage } = useChat({ transport });
  const [input, setInput] = useState("");

  return (
    <>
      <div className="flex flex-1 flex-col gap-2 rounded border p-4">
        {messages.length === 0 && (
          <p className="text-sm text-zinc-500">
            No messages yet. Send one to start the workflow.
          </p>
        )}
        {messages.map((m) => (
          <div key={m.id} className="flex flex-col gap-2 text-sm">
            {m.role !== "user" ? null : (
              <p>
                <span className="font-medium">user:</span>{" "}
                {m.parts
                  ?.map((p) => (p.type === "text" ? p.text : ""))
                  .join("")}
              </p>
            )}
            {m.parts?.map((part, i) => {
              if (part.type === "text" && m.role !== "user") {
                return <p key={i}>{part.text}</p>;
              }
              if (isToolUIPart(part) && APPROVAL_TOOLS.has(getToolName(part))) {
                return (
                  <ApprovalCard
                    key={part.toolCallId}
                    toolName={getToolName(part)}
                    input={part.input}
                    output={part.output}
                  />
                );
              }
              return null;
            })}
          </div>
        ))}
      </div>

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (input.trim()) {
            sendMessage({ text: input });
            setInput("");
          }
        }}
      >
        <input
          className="flex-1 rounded border px-3 py-2"
          value={input}
          placeholder="Ask for a refund, transfer, or anything ambiguous…"
          onChange={(e) => setInput(e.target.value)}
        />
        <button
          type="submit"
          className="rounded bg-black px-4 py-2 text-white"
        >
          Send
        </button>
      </form>
    </>
  );
}
