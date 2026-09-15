// STUB — replace with domain.searchProducts(retailerId, query, opts) per
// docs/contracts.md §C1 once packages/domain exists. Fake catalog only,
// no real hybrid search / alias table (docs/spec.md §4).
import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { FAKE_CATALOG } from "./fake-catalog.js";

const Product = z.object({
  id: z.string(),
  name: z.string(),
  brand: z.string().optional(),
  unit: z.string(),
  price: z.number(),
  inStock: z.boolean(),
});

export const searchProducts = createTool({
  id: "searchProducts",
  description:
    "Search the store's catalogue for products matching a customer's query. Only ever mention products returned by this tool.",
  inputSchema: z.object({
    query: z.string(),
    attributes: z.record(z.string()).optional(),
    limit: z.number().optional(),
  }),
  outputSchema: z.object({ products: z.array(Product) }),
  execute: async ({ query, limit }) => {
    const q = query.toLowerCase();
    const matches = FAKE_CATALOG.filter((p) => p.keywords.some((kw) => q.includes(kw)));
    const products = matches
      .slice(0, limit ?? 3)
      .map(({ id, name, brand, unit, price, inStock }) => ({ id, name, brand, unit, price, inStock }));
    return { products };
  },
});
