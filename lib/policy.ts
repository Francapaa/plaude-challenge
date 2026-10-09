/**
 * Pure approval policy mirroring lib/agent.ts plain-text rules.
 * Kept side-effect free so it is unit-testable and reusable from
 * `needsApproval` callbacks and Slack message builders.
 */

import type { ActionInput } from "@/types";

export const REFUND_AUTO_APPROVE_MAX_USD = 20;
export const REFUND_WINDOW_DAYS = 30;
export const HIGH_VALUE_THRESHOLD_USD = 1000;

export function requiresHumanApproval(action: ActionInput): boolean {
  // Ambiguous requests always escalate: never guess.
  if (action.hasAllDetails === false) return true;

  if (action.type === "transfer") {
    // High-value operations: always require approval (no auto-approve path).
    return true;
  }

  if (action.type === "refund") {
    const amount = action.amountUSD ?? 0;
    if (amount > REFUND_AUTO_APPROVE_MAX_USD) return true;
    if ((action.daysSincePurchase ?? 0) > REFUND_WINDOW_DAYS) return true;
    return false;
  }

  // Generic actions default to approval (safe default for the demo).
  return true;
}

/**
 * Heuristic mirror of the SCOPE rule in lib/agent.ts: whether a raw user
 * message is about something the agent handles (money operations,
 * permission changes, deletions) or a brief greeting. Anything else is
 * out of scope and must be refused with a redirect instead of answered.
 * Pure and unit-testable. Note: conversational follow-ups with no keywords
 * ("yes, do it") are resolved by the model from history, not by this check.
 */
const IN_SCOPE_KEYWORDS = [
  // Refunds
  "refund",
  "refunds",
  "reembolso",
  "reembolsos",
  "devolucion",
  "devoluciones",
  // Payments & transfers
  "transfer",
  "transfers",
  "transferencia",
  "transferencias",
  "payment",
  "payments",
  "pago",
  "pagos",
  "pagar",
  "pague",
  "paga",
  "pay",
  "money",
  "dinero",
  "amount",
  "monto",
  "order",
  "orders",
  "pedido",
  "pedidos",
  "orden",
  "ordenes",
  "recipient",
  "recipients",
  "destinatario",
  "destinatarios",
  "invoice",
  "invoices",
  "factura",
  "facturas",
  "receipt",
  "receipts",
  "recibo",
  "recibos",
  "charge",
  "charges",
  "cargo",
  "cargos",
  "balance",
  "balances",
  "saldo",
  "saldos",
  "account",
  "accounts",
  "cuenta",
  "cuentas",
  // Approval flow itself (follow-ups like "approve it")
  "approve",
  "approval",
  "approvals",
  "aprobar",
  "aprueba",
  "apruebo",
  "aprobacion",
  "aprobaciones",
  // Permission changes & deletions (high-value ops per agent instructions)
  "permission",
  "permissions",
  "permiso",
  "permisos",
  "role",
  "roles",
  "rol",
  "access",
  "acceso",
  "accesos",
  "delete",
  "deletion",
  "eliminar",
  "borrar",
  // Brief greetings / small talk (allowed, with redirect)
  "hello",
  "hey",
  "hola",
  "hi",
  "thanks",
  "thank you",
  "gracias",
  "bye",
  "adios",
  "good morning",
  "good afternoon",
  "buenos dias",
  "buenas tardes",
  "buenas noches",
];

const IN_SCOPE_PATTERNS = IN_SCOPE_KEYWORDS.map(
  (keyword) => new RegExp(`\\b${keyword}\\b`),
);

export function isInScopeTopic(text: string): boolean {
  const normalized = text
    .toLowerCase()
    .normalize("NFD")
    // Strip combining diacritical marks so "devolución" matches "devolucion".
    .replace(/[\u0300-\u036f]/g, "");
  return IN_SCOPE_PATTERNS.some((pattern) => pattern.test(normalized));
}
