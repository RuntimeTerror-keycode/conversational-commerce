// The token gate is real, not a stub: rejecting without a valid
// confirmationToken is non-negotiable (CLAUDE.md rule 3). The domain layer
// enforces it and returns failures as values, so no mapping is needed here.
import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { getServices } from "../../lib/services.js";
import { asValue } from "./errors.js";

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
    z.object({ error: z.literal(true), reason: z.string() }),
  ]),
  execute: async ({ confirmationToken, deliveryNote }) =>
    asValue(() => getServices().orders.createOrder(confirmationToken, { deliveryNote })),
});
