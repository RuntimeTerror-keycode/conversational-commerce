// STUB — replace with domain.mutateCart(customerId, retailerId, op) per
// docs/contracts.md §C1 once packages/domain exists. Always returns the
// complete cart, never a diff — the model must not drift on partial state.
import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { readCart, writeCart, type CartLine } from "./cart-store.js";
import { findProduct } from "./fake-catalog.js";
import { readShoppingContext } from "../context.js";

const CartLineSchema = z.object({
  lineId: z.string(),
  productName: z.string(),
  sourceText: z.string().optional(),
  quantity: z.number(),
  unit: z.string(),
  price: z.number(),
});

export const updateCart = createTool({
  id: "updateCart",
  description:
    "Add, remove, or set the quantity of a product in the customer's cart. Always returns the complete cart.",
  inputSchema: z.object({
    action: z.enum(["add", "remove", "set"]),
    productId: z.string(),
    quantity: z.number(),
    unit: z.string(),
  }),
  outputSchema: z.object({ items: z.array(CartLineSchema), total: z.number(), currency: z.literal("INR") }),
  execute: async ({ action, productId, quantity, unit }, context) => {
    const { retailerId, customerId } = readShoppingContext(context.requestContext);
    const cart = readCart(retailerId, customerId);
    const existing = cart.items.find((line) => line.lineId === productId);
    let items: CartLine[];

    if (action === "remove") {
      items = cart.items.filter((line) => line.lineId !== productId);
    } else {
      const product = findProduct(productId);
      const newQuantity = action === "add" ? (existing?.quantity ?? 0) + quantity : quantity;
      const line: CartLine = {
        lineId: productId,
        productName: product?.name ?? productId,
        quantity: newQuantity,
        unit,
        price: product?.price ?? existing?.price ?? 0,
      };
      items = existing
        ? cart.items.map((l) => (l.lineId === productId ? line : l))
        : [...cart.items, line];
    }

    return writeCart(retailerId, customerId, items);
  },
});
