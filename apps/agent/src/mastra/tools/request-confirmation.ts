// STUB — replace with a real requestOrderConfirmation domain call once
// packages/domain exists (docs/contracts.md §C1). Token TTL 5 min per
// docs/spec.md §3.
import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { readCart } from "./cart-store.js";
import { createConfirmationToken } from "./confirmation-store.js";
import { readShoppingContext } from "../context.js";

const CartLine = z.object({
  lineId: z.string(),
  productName: z.string(),
  sourceText: z.string().optional(),
  quantity: z.number(),
  unit: z.string(),
  price: z.number(),
});

export const requestOrderConfirmation = createTool({
  id: "requestOrderConfirmation",
  description:
    "Get a cart summary and a short-lived confirmation token before placing an order. Call this before placeOrder, never skip it.",
  inputSchema: z.object({}),
  outputSchema: z.object({
    summary: z.array(CartLine),
    total: z.number(),
    confirmationToken: z.string(),
    expiresAt: z.string(),
  }),
  execute: async (_input, context) => {
    const { retailerId, customerId } = readShoppingContext(context.requestContext);
    const cart = readCart(retailerId, customerId);
    const { token, expiresAt } = createConfirmationToken(cart);
    return { summary: cart.items, total: cart.total, confirmationToken: token, expiresAt };
  },
});
