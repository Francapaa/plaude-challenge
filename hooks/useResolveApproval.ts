"use client";

import { useState } from "react";
import type { ResolveRequest } from "@/types";

/**
 * Resolves a suspended approval-hook from the web UI (fallback channel —
 * Slack buttons resolve the same hook token). Returns the submit handler
 * plus UI states for the approval card.
 */
export function useResolveApproval(toolCallId: string) {
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState<boolean | null>(null);

  const resolve = async (approved: boolean) => {
    setSubmitting(true);
    try {
      const body: ResolveRequest = { toolCallId, approved };
      await fetch("/api/approvals/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      setSent(approved);
    } finally {
      setSubmitting(false);
    }
  };

  return { resolve, submitting, sent };
}
