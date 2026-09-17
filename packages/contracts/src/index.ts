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
  reason: z.enum(["order_accepted", "order_rejected", "out_for_delivery", "delivered", "substitution"]),
});

export type ReplyBlock = z.infer<typeof ReplyBlock>;
export type AgentTurnRequest = z.infer<typeof AgentTurnRequest>;
export type AgentTurnResponse = z.infer<typeof AgentTurnResponse>;
export type NotifyRequest = z.infer<typeof NotifyRequest>;

// ---------------------------------------------------------------------------
// WhatsApp order search/select — POST /api/whatsapp/orders/{search,select}
// Deliberate, temporary bypass of the agent (see root spec.md §14 item 13);
// apps/edge calls apps/api directly and renders the response synchronously.
// ---------------------------------------------------------------------------

export const WhatsappAddress = z.object({
  addressLine: z.string().optional(),
  latitude: z.number(),
  longitude: z.number(),
});

export const WhatsappSearchRequest = z.object({
  messageId: z.string(),
  customerRef: z.string(),
  text: z.string(),
  source: z.enum(["text", "voice"]),
  timestamp: z.string(),
  address: WhatsappAddress,
  paymentMode: z.enum(["COD", "GPAY"]),
});

export const WhatsappRow = z.object({
  id: z.number().int(),
  title: z.string(),
  description: z.string().optional(),
  price: z.string(),
});

export const WhatsappSearchResponse = z.discriminatedUnion("tag", [
  z.object({ customerRef: z.string(), orderId: z.number().int(), tag: z.literal("found"), rows: z.array(WhatsappRow) }),
  z.object({ customerRef: z.string(), orderId: z.number().int(), tag: z.literal("choice"), body: z.string(), rows: z.array(WhatsappRow) }),
  z.object({ customerRef: z.string(), orderId: z.number().int(), tag: z.literal("not_found"), body: z.string() }),
]);

export const WhatsappSelectRequest = z.object({
  customerRef: z.string(),
  orderId: z.number().int(),
  productId: z.number().int(),
});

export const WhatsappCartLine = z.object({
  lineId: z.string(),
  productName: z.string(),
  quantity: z.number(),
  unit: z.string(),
  price: z.number(),
});

export const WhatsappCart = z.object({
  items: z.array(WhatsappCartLine),
  total: z.number(),
  currency: z.literal("INR"),
  priceNote: z.string().optional(),
});

export const WhatsappSubstitute = z.object({
  id: z.number().int(),
  name: z.string(),
  unit: z.string(),
  price: z.number(),
});

export const WhatsappSelectResponse = z.discriminatedUnion("tag", [
  z.object({ customerRef: z.string(), orderId: z.number().int(), tag: z.literal("added"), cart: WhatsappCart }),
  z.object({
    customerRef: z.string(), orderId: z.number().int(), tag: z.literal("unavailable"),
    body: z.string(), substitutes: z.array(WhatsappSubstitute),
  }),
]);

export type WhatsappAddress = z.infer<typeof WhatsappAddress>;
export type WhatsappSearchRequest = z.infer<typeof WhatsappSearchRequest>;
export type WhatsappRow = z.infer<typeof WhatsappRow>;
export type WhatsappSearchResponse = z.infer<typeof WhatsappSearchResponse>;
export type WhatsappSelectRequest = z.infer<typeof WhatsappSelectRequest>;
export type WhatsappCartLine = z.infer<typeof WhatsappCartLine>;
export type WhatsappCart = z.infer<typeof WhatsappCart>;
export type WhatsappSubstitute = z.infer<typeof WhatsappSubstitute>;
export type WhatsappSelectResponse = z.infer<typeof WhatsappSelectResponse>;
