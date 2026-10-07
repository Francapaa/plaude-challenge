# Plaude Engineering Challenge

https://plaude.com/api/challenge

AI agent powered by plain-text instructions with a Slack human-in-the-loop workflow.


## Stack

- Next.js (App Router) + TypeScript
- Workflow DevKit (`workflow@5`) + `WorkflowAgent` (`@ai-sdk/workflow`, successor of the deprecated `DurableAgent`)
- Vercel AI Gateway for models
- Slack Web API (Block Kit Approve/Deny)

## Setup

```bash
pnpm install
cp .env.example .env.local  # fill in keys
pnpm run dev
```

## Scripts

- `npm run dev` — dev server
- `npm run build` — production build
- `npm run test` — unit tests (vitest)
- `npm run lint` — eslint

## Structure

- `app/page.tsx` — chat UI (`useChat` + `WorkflowChatTransport`)
- `app/api/chat/route.ts` — starts the durable workflow
- `workflow/agent-chat.ts` — `"use workflow"` agent loop
- `lib/agent.ts` — plain-text approval instructions (refunds, high-value, ambiguous)
- `lib/policy.ts` — testable approval policy mirroring the instructions
- `lib/tools.ts` — durable `"use step"` tool executors + `needsApproval` gates
- `lib/slack.ts` — Slack approval messages (mock fallback without a token)

## Docs

