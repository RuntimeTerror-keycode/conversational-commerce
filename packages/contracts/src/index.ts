import { z } from "zod";

export const OrderStatus = z.enum([
  "draft", "placed", "accepted", "rejected",
  "packed", "out_for_delivery", "delivered",
]);

export const CartLine = z.object({
  lineId: z.string(),
  productName: z.string(),
  sourceText: z.string().optional(),
  quantity: z.number(),
  unit: z.string(),
  price: z.number(),
});

export const ReplyBlock = z.discriminatedUnion("type", [
  z.object({ type: z.literal("text"), body: z.string().max(1024) }),
  z.object({
    type: z.literal("buttons"),
    body: z.string().max(1024),
    buttons: z.array(z.object({ id: z.string(), label: z.string().max(20) })).max(3),
  }),
  z.object({
    type: z.literal("list"),
    body: z.string().max(1024),
    header: z.string().optional(),
    rows: z.array(z.object({
      id: z.string(),
      title: z.string().max(24),
      description: z.string().optional(),
    })).max(10),
  }),
  z.object({
    type: z.literal("cart_summary"),
    items: z.array(CartLine),
    total: z.number(),
    currency: z.literal("INR"),
  }),
]);

export const AgentTurnRequest = z.object({
  traceId: z.string(),
  messageId: z.string(),
  customerRef: z.string(),
  text: z.string(),
  source: z.enum(["text", "voice"]),
  locale: z.string().nullable().optional(),
});

export const AgentTurnResponse = z.object({
  traceId: z.string(),
  blocks: z.array(ReplyBlock).max(2),
  sessionState: z.enum(["active", "order_placed"]),
});

export const NotifyRequest = z.object({
  traceId: z.string(),
  customerRef: z.string(),
  blocks: z.array(ReplyBlock).max(2),
  reason: z.enum(["order_accepted", "order_rejected", "out_for_delivery", "substitution"]),
});

export type ReplyBlock = z.infer<typeof ReplyBlock>;
export type AgentTurnRequest = z.infer<typeof AgentTurnRequest>;
export type AgentTurnResponse = z.infer<typeof AgentTurnResponse>;
export type NotifyRequest = z.infer<typeof NotifyRequest>;
