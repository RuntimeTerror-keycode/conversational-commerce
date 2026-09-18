// Batch wrapper over domain.mutateCart. Sequential, not parallel — the domain
// mutations share one cart row, and the last call's return is the cart the
// model must see. Per-item failures are reported, not thrown, so one bad line
// doesn't lose the rest of the list.
import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { getServices } from "../../lib/services.js";
import { readShoppingContext } from "../context.js";
import { toToolFailure } from "./errors.js";
import type { DomainCart } from "@cc/domain";

const CartLine = z.object({
  lineId: z.string(),
  productName: z.string(),
  quantity: z.number(),
  unit: z.string(),
  price: z.number(),
});

export const addItems = createTool({
  id: "addItems",
  description:
    "Add several products to the cart in one go, after the customer has confirmed a list. Returns the final cart plus anything that could not be added.",
  inputSchema: z.object({
    items: z
      .array(
        z.object({
          productId: z.string(),
          quantity: z.number().positive(),
          unit: z.string(),
        }),
      )
      .min(1)
      .max(8),
  }),
  outputSchema: z.object({
    items: z.array(CartLine),
    total: z.number(),
    currency: z.literal("INR"),
    priceNote: z.string(),
    rejected: z.array(z.object({ productId: z.string(), reason: z.string() })),
  }),
  execute: async ({ items }, context) => {
    const { retailerId, customerId, nearbyShopIds } = readShoppingContext(context.requestContext);
    const cartService = getServices().cart;
    const rejected: { productId: string; reason: string }[] = [];
    let cart: DomainCart | undefined;

    for (const item of items) {
      try {
        cart = await cartService.mutateCart(retailerId, customerId, { action: "add", ...item }, nearbyShopIds);
      } catch (error) {
        rejected.push({ productId: item.productId, reason: toToolFailure(error).reason });
      }
    }

    cart ??= await cartService.getCart(retailerId, customerId, nearbyShopIds);
    return { ...cart, rejected };
  },
});
