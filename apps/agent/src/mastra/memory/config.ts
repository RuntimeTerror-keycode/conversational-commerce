import { Memory } from "@mastra/memory";
import { LibSQLStore } from "@mastra/libsql";
import { z } from "zod";

// Shared by the Mastra instance's top-level storage and by Memory, so both
// point at the same local file instead of opening two separate DB handles.
export const storage = new LibSQLStore({
  id: "agent-storage",
  url: process.env.MASTRA_DB_URL ?? "file:./mastra.db",
});

/**
 * Deliberately narrow. Working memory is resource-scoped and permanent, so
 * anything storable here is replayed into every future turn's context and the
 * model cannot tell it apart from a fresh tool result. Catalogue facts — price,
 * stock, pack size, SKU ids, totals — must therefore be unstorable, or they
 * silently defeat the grounding rule in CLAUDE.md #5.
 */
const workingMemorySchema = z.object({
  language: z
    .string()
    .optional()
    .describe("How this customer writes: malayalam, english, manglish, or a mix. Used to match their language."),
  deliveryArea: z.string().optional().describe("Area or landmark for delivery, if the customer has given one."),
  usualBrands: z
    .array(z.string())
    .optional()
    .describe("Brand names the customer has chosen before. Names only — never include a price or pack size."),
  standingPreferences: z
    .string()
    .optional()
    .describe(
      "Durable preferences only, e.g. 'prefers evening delivery'. Never prices, stock status, SKU ids, order contents or totals — those must come from a tool call on every turn.",
    ),
});

export const shoppingMemory = new Memory({
  storage,
  options: {
    lastMessages: 20,
    workingMemory: { enabled: true, scope: "resource", schema: workingMemorySchema },
  },
});

/**
 * docs/spec.md §3 memory scoping: resourceId persists preferences across
 * orders forever, threadId is per-session.
 */
export function scopeFor(customerId: string, sessionId: string) {
  return { resource: `customer:${customerId}`, thread: `session:${sessionId}` };
}
