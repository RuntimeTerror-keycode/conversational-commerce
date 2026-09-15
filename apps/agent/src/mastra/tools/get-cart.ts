// STUB — replace with domain.getCart(customerId, retailerId) per
// docs/contracts.md §C1 once packages/domain exists.
import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { readCart } from "./cart-store.js";
import { readShoppingContext } from "../context.js";

const CartLine = z.object({
  lineId: z.string(),
  productName: z.string(),
  sourceText: z.string().optional(),
  quantity: z.number(),
  unit: z.string(),
  price: z.number(),
});

export const getCart = createTool({
  id: "getCart",
  description: "Read the customer's current cart. Always call this instead of reconstructing the cart from memory.",
  inputSchema: z.object({}),
  outputSchema: z.object({ items: z.array(CartLine), total: z.number(), currency: z.literal("INR") }),
  execute: async (_input, context) => {
    const { retailerId, customerId } = readShoppingContext(context.requestContext);
    return readCart(retailerId, customerId);
  },
});
