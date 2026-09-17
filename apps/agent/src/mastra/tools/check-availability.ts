import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { getServices } from "../../lib/services.js";
import { readShoppingContext } from "../context.js";
import { asValue } from "./errors.js";

const Substitute = z.object({
  id: z.string(),
  name: z.string(),
  unit: z.string(),
  price: z.number(),
});

export const checkAvailability = createTool({
  id: "checkAvailability",
  description:
    "Look up substitutes for products this shop cannot supply. Use it after an add is rejected, not to decide whether an order can go ahead.",
  inputSchema: z.object({ productIds: z.array(z.string()) }),
  outputSchema: z.union([
    z.object({
      results: z.array(
        z.object({ productId: z.string(), inStock: z.boolean(), substitutes: z.array(Substitute) }),
      ),
    }),
    z.object({ error: z.literal(true), reason: z.string() }),
  ]),
  execute: async ({ productIds }, context) => {
    const { retailerId } = readShoppingContext(context.requestContext);
    return asValue(async () => {
      const results = await getServices().catalog.checkAvailability(retailerId, productIds);
      return { results };
    });
  },
});
