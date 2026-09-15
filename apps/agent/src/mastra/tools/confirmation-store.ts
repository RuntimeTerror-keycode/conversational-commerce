// STUB shared by request-confirmation.ts and place-order.ts. Replace with a
// real short-lived token store (e.g. Postgres row with TTL) once
// packages/domain exists — token TTL is 5 min per docs/spec.md §3.
import type { Cart } from "./cart-store.js";

type ConfirmationRecord = {
  cart: Cart;
  expiresAt: number;
};

const TOKEN_TTL_MS = 5 * 60 * 1000;

const tokens = new Map<string, ConfirmationRecord>();

export function createConfirmationToken(cart: Cart): { token: string; expiresAt: string } {
  const token = crypto.randomUUID();
  const expiresAt = Date.now() + TOKEN_TTL_MS;
  tokens.set(token, { cart, expiresAt });
  return { token, expiresAt: new Date(expiresAt).toISOString() };
}

export type ConfirmationResult =
  | { ok: true; cart: Cart }
  | { ok: false; reason: "not_found" | "expired" };

/** Consumes the token — a valid token can only be used once. */
export function consumeConfirmationToken(token: string): ConfirmationResult {
  const record = tokens.get(token);
  if (!record) return { ok: false, reason: "not_found" };
  tokens.delete(token);
  if (Date.now() > record.expiresAt) return { ok: false, reason: "expired" };
  return { ok: true, cart: record.cart };
}
