import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { getServices } from "../../lib/services.js";
import { readShoppingContext } from "../context.js";
import { asValue } from "./errors.js";

export const setPaymentMode = createTool({
  id: "setPaymentMode",
  description:
    "Save how the customer wants to pay — cash on delivery or GPay/UPI. Call this the moment they choose, before calling requestOrderConfirmation again.",
  inputSchema: z.object({ mode: z.enum(["cod", "gpay"]) }),
  outputSchema: z.union([
    z.object({ paymentMode: z.string() }),
    z.object({ error: z.literal(true), reason: z.string() }),
  ]),
  execute: async ({ mode }, context) => {
    const { customerId } = readShoppingContext(context.requestContext);
    return asValue(() => getServices().orders.setPaymentMode(customerId, mode));
  },
});
