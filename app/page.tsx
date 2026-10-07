import { Suspense } from "react";
import { Chat } from "./chat";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-4 p-6">
      <header>
        <h1 className="text-2xl font-semibold">Plaude Agent</h1>
        <p className="text-sm text-zinc-600">
          Durable agent (WorkflowAgent) with Slack human-in-the-loop. Try:{" "}
          <em>refund order #123 for $150</em>
        </p>
      </header>

      <Suspense fallback={<p className="text-sm">Loading chat…</p>}>
        <Chat />
      </Suspense>
    </main>
  );
}
