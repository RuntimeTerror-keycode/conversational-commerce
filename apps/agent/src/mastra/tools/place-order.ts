// The token gate is real, not a stub: rejecting without a valid
// confirmationToken is non-negotiable (CLAUDE.md rule 3), enforced inside
// apps/api's own call to the domain layer.
//
// Placement goes through apps/api's POST /api/orders rather than calling
// packages/domain directly, on purpose: apps/api owns order mutation (it's
// also where accept/reject/status changes live) and, as of this change, the
// "order confirmed" WhatsApp notification too — see
// apps/api/src/services/order-notify.service.ts. Keeping both in one place
// resolves the "who owns /notify" question CLAUDE.md flagged as open.
//
// Payment mode is also gated here, in code, not left to the model: the
// domain layer's requestOrderConfirmation always returns the customer's
// last-used payment mode once they've ever paid before (never null), so a
// model relying on "is paymentMode set" alone will happily place an order
// on a stale default the customer was never actually asked about this time
// — confirmed live: "1 Sprite, place the order" placed instantly on a
// returning customer's old saved mode, no fresh choice in sight. Session-
// scoped "was it chosen THIS order" genuinely can't live in the stateless,
// per-request domain layer, so it's enforced here instead.
import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { asValue } from "./errors.js";
import { readShoppingContext } from "../context.js";
import { currentSession, wasPaymentChosenThisSession } from "../memory/session-store.js";

const REQUEST_TIMEOUT_MS = 8000;

export const placeOrder = createTool({
  id: "placeOrder",
  description:
    "Place the order using a confirmationToken from requestOrderConfirmation. Rejects without a valid token — never call this without one. Also rejects if the customer hasn't explicitly chosen a payment method for this specific order yet, even if requestOrderConfirmation showed a paymentMode value (that's just their last-used default, not a decision for this order) — call setPaymentMode with their actual choice for this order first.",
  inputSchema: z.object({
    confirmationToken: z.string(),
    deliveryNote: z.string().optional(),
  }),
  outputSchema: z.union([
    z.object({ orderId: z.string(), status: z.literal("placed"), etaMinutes: z.number() }),
    z.object({ error: z.literal(true), reason: z.string() }),
  ]),
  execute: async ({ confirmationToken, deliveryNote }, context) => {
    const { customerId } = readShoppingContext(context.requestContext);
    if (!wasPaymentChosenThisSession(currentSession(customerId))) {
      return { error: true, reason: "payment_mode_not_chosen_this_order" } as const;
    }

    return asValue(async () => {
      const apiBaseUrl = process.env.API_BASE_URL ?? "http://localhost:4000";
      const serviceSharedSecret = process.env.SERVICE_SHARED_SECRET ?? "change-me";

      const res = await fetch(`${apiBaseUrl}/api/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Service-Token": serviceSharedSecret },
        body: JSON.stringify({ confirmationToken, opts: deliveryNote ? { deliveryNote } : undefined }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });

      const body = (await res.json()) as unknown;

      if (res.ok) {
        return body as { orderId: string; status: "placed"; etaMinutes: number };
      }

      if (body && typeof body === "object" && (body as { error?: unknown }).error === true) {
        return body as { error: true; reason: string };
      }

      throw new Error(`placeOrder request to apps/api failed with status ${res.status}`);
    });
  },
});
