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

export const getCart = createTool({
  id: "getCart",
  description: "Read the customer's current cart. Always call this instead of reconstructing the cart from memory.",
  inputSchema: z.object({}),
  outputSchema: z.union([
    z.object({
      items: z.array(CartLine),
      total: z.number(),
      currency: z.literal("INR"),
      priceNote: z.string(),
    }),
    z.object({ error: z.literal(true), reason: z.string() }),
  ]),
  execute: async (_input, context) => {
    const { retailerId, customerId } = readShoppingContext(context.requestContext);
    return asValue(() => getServices().cart.getCart(retailerId, customerId));
  },
});
