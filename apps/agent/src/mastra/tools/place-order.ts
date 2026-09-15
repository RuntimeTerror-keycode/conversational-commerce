// STUB — replace with domain.createOrder per docs/contracts.md §C1 once
// packages/domain exists. The token gate below is real, not a stub: rejecting
// without a valid confirmationToken is a non-negotiable rule, enforced here
// regardless of what the model intends (CLAUDE.md rule 3).
import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { consumeConfirmationToken } from "./confirmation-store.js";

export const placeOrder = createTool({
  id: "placeOrder",
  description:
    "Place the order using a confirmationToken from requestOrderConfirmation. Rejects without a valid token — never call this without one.",
  inputSchema: z.object({
    confirmationToken: z.string(),
    deliveryNote: z.string().optional(),
  }),
  outputSchema: z.union([
    z.object({ orderId: z.string(), status: z.literal("placed"), etaMinutes: z.number() }),
    z.object({ error: z.literal(true), reason: z.enum(["not_found", "expired"]) }),
  ]),
  execute: async ({ confirmationToken }) => {
    const result = consumeConfirmationToken(confirmationToken);
    if (!result.ok) {
      return { error: true as const, reason: result.reason };
    }
    return { orderId: `ord_${crypto.randomUUID()}`, status: "placed" as const, etaMinutes: 45 };
  },
});
