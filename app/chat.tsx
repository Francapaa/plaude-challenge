"use client";

import { useChat } from "@ai-sdk/react";
import { WorkflowChatTransport } from "@ai-sdk/workflow/client";
import { useMemo, useState } from "react";

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
          <div key={m.id} className="text-sm">
            <span className="font-medium">{m.role}:</span>{" "}
            {m.parts
              ?.map((p) => (p.type === "text" ? p.text : ""))
              .join("")}
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
