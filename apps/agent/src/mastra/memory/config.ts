import { Memory } from "@mastra/memory";
import { LibSQLStore } from "@mastra/libsql";

// Shared by the Mastra instance's top-level storage and by Memory, so both
// point at the same local file instead of opening two separate DB handles.
export const storage = new LibSQLStore({
  id: "agent-storage",
  url: process.env.MASTRA_DB_URL ?? "file:./mastra.db",
});

export const shoppingMemory = new Memory({
  storage,
  options: {
    lastMessages: 20,
    workingMemory: { enabled: true, scope: "resource" },
  },
});

/**
 * docs/spec.md §3 memory scoping: resourceId persists preferences across
 * orders forever, threadId is per-session.
 */
export function scopeFor(customerId: string, sessionId: string) {
  return { resource: `customer:${customerId}`, thread: `session:${sessionId}` };
}
