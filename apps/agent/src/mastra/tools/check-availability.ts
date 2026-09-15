// STUB — replace with domain.checkAvailability(retailerId, productIds) per
// docs/contracts.md §C1 once packages/domain exists.
import { createTool } from "@mastra/core/tools";
import { z } from "zod";

const Substitute = z.object({
  id: z.string(),
  name: z.string(),
  unit: z.string(),
  price: z.number(),
});

// Hardcoded: p_601 (Chicken 1kg) is out of stock with one substitute.
const OUT_OF_STOCK: Record<string, z.infer<typeof Substitute>[]> = {
  p_601: [{ id: "p_602", name: "Chicken (frozen) 1kg", unit: "1kg", price: 195 }],
};

export const checkAvailability = createTool({
  id: "checkAvailability",
  description: "Check current stock for a list of product ids, with substitutes for anything out of stock.",
  inputSchema: z.object({ productIds: z.array(z.string()) }),
  outputSchema: z.object({
    results: z.array(
      z.object({
        productId: z.string(),
        inStock: z.boolean(),
        substitutes: z.array(Substitute),
      }),
    ),
  }),
  execute: async ({ productIds }) => {
    const results = productIds.map((productId) => {
      const substitutes = OUT_OF_STOCK[productId];
      return { productId, inStock: !substitutes, substitutes: substitutes ?? [] };
    });
    return { results };
  },
});
