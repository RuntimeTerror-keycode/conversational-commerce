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

export const updateCart = createTool({
  id: "updateCart",
  description:
    "Add, remove, or set the quantity of a product in the customer's cart. Always returns the complete cart. Rejects products the store cannot supply.",
  inputSchema: z.object({
    action: z.enum(["add", "remove", "set"]),
    productId: z.string(),
    quantity: z.number().positive(),
    unit: z.string(),
  }),
  outputSchema: z.union([
    z.object({
      items: z.array(CartLine),
      total: z.number(),
      currency: z.literal("INR"),
      priceNote: z.string(),
    }),
    z.object({ error: z.literal(true), reason: z.string() }),
  ]),
  execute: async ({ action, productId, quantity, unit }, context) => {
    const { retailerId, customerId, nearbyShopIds } = readShoppingContext(context.requestContext);
    return asValue(() =>
      getServices().cart.mutateCart(retailerId, customerId, { action, productId, quantity, unit }, nearbyShopIds),
    );
  },
});
