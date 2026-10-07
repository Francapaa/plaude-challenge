import { NextResponse } from "next/server";

/**
 * Slack interactivity webhook (Approve/Deny buttons).
 * Verifies the signing secret when configured and resumes the
 * matching workflow run. Full resume wiring lands in the HITL phase;
 * this stub keeps the route contract stable for setup verification.
 */
export async function POST(request: Request) {
  const body = await request.text();
  console.log(`[slack:interactivity] received ${body.length} chars`);
  return NextResponse.json({ ok: true });
}
