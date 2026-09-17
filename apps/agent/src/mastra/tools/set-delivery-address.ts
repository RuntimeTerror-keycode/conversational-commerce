import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { getServices } from "../../lib/services.js";
import { readShoppingContext } from "../context.js";
import { asValue } from "./errors.js";

export const setDeliveryAddress = createTool({
  id: "setDeliveryAddress",
  description:
    "Save the customer's delivery address exactly as they typed it in this conversation. Call this the moment they give one, before calling requestOrderConfirmation again. Only pass text the customer actually typed — never a location you inferred, geocoded, or guessed from coordinates, a map link, or a landmark name.",
  inputSchema: z.object({ addressLine: z.string().min(3) }),
  outputSchema: z.union([
    z.object({ deliveryAddress: z.string() }),
    z.object({ error: z.literal(true), reason: z.string() }),
  ]),
  execute: async ({ addressLine }, context) => {
    const { customerId } = readShoppingContext(context.requestContext);
    return asValue(() => getServices().orders.setDeliveryAddress(customerId, addressLine));
  },
});
