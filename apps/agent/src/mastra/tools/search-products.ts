import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { getServices } from "../../lib/services.js";
import { readShoppingContext } from "../context.js";
import { asValue } from "./errors.js";

const Product = z.object({
  id: z.string(),
  name: z.string(),
  brand: z.string().nullable(),
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
  outputSchema: z.union([
    z.object({ products: z.array(Product) }),
    z.object({ error: z.literal(true), reason: z.string() }),
  ]),
  execute: async ({ query, attributes, limit }, context) => {
    const { retailerId } = readShoppingContext(context.requestContext);
    return asValue(async () => {
      const products = await getServices().catalog.searchProducts(retailerId, query, { attributes, limit });
      return { products };
    });
  },
});
