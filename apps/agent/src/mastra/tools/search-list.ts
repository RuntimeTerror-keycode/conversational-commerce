// Batch wrapper over domain.searchProducts. Routing only, no business logic:
// the point is to collapse one model step per item into a single step, which
// is what keeps a multi-item list inside the edge's 20s budget.
import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { getServices } from "../../lib/services.js";
import { readShoppingContext } from "../context.js";
import { toToolFailure } from "./errors.js";

const Product = z.object({
  id: z.string(),
  name: z.string(),
  brand: z.string().nullable(),
  unit: z.string(),
  price: z.number(),
  inStock: z.boolean(),
});

export const searchList = createTool({
  id: "searchList",
  description:
    "Search for several products at once. Use this when the customer has given you a list, instead of calling searchProducts repeatedly.",
  inputSchema: z.object({
    queries: z.array(z.string()).min(1).max(8),
    limitPerQuery: z.number().optional(),
  }),
  outputSchema: z.object({
    results: z.array(
      z.object({
        query: z.string(),
        products: z.array(Product),
      }),
    ),
  }),
  execute: async ({ queries, limitPerQuery }, context) => {
    const { retailerId, nearbyShopIds } = readShoppingContext(context.requestContext);
    const catalog = getServices().catalog;

    const results = await Promise.all(
      queries.map(async (query) => {
        try {
          const products = await catalog.searchProducts(
            retailerId,
            query,
            { limit: limitPerQuery ?? 2 },
            nearbyShopIds,
          );
          return { query, products };
        } catch {
          return { query, products: [] };
        }
      }),
    );

    return { results };
  },
});
