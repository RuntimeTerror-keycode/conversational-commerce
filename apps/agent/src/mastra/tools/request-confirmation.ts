import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { getServices } from "../../lib/services.js";
import { readShoppingContext } from "../context.js";
import { asValue } from "./errors.js";

const CartLine = z.object({
  lineId: z.string(),
  productName: z.string(),
  quantity: z.number(),
  unit: z.string(),
  price: z.number(),
});

export const requestOrderConfirmation = createTool({
  id: "requestOrderConfirmation",
  description:
    "Get the final priced summary and a short-lived confirmation token before placing an order. Call this before placeOrder, never skip it. If shopBreakdown has more than one entry, tell the customer which shops will pack the order. Always state deliveryAddress and paymentMode in the summary so the customer can catch a mistake before confirming — if either is null, ask the customer instead of assuming one.",
  inputSchema: z.object({}),
  outputSchema: z.union([
    z.object({
      summary: z.array(CartLine),
      total: z.number(),
      confirmationToken: z.string(),
      expiresAt: z.string(),
      shopBreakdown: z.array(
        z.object({
          shopId: z.string(),
          shopName: z.string(),
          items: z.array(CartLine),
          subtotal: z.number(),
        }),
      ),
      deliveryAddress: z.string().nullable(),
      paymentMode: z.string().nullable(),
    }),
    z.object({ error: z.literal(true), reason: z.string() }),
  ]),
  execute: async (_input, context) => {
    const { customerId, nearbyShopIds } = readShoppingContext(context.requestContext);
    return asValue(() => getServices().orders.requestConfirmation(customerId, nearbyShopIds));
  },
});
