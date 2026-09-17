// STUB in-memory session boundary. Replace with a real one once the contract
// carries `sessionHint` (docs/contracts.md §A1) or the edge tracks sessions —
// this survives neither a restart nor a second agent instance, and it has no
// 30-min idle expiry, only the order-placed boundary.
const sessions = new Map<string, string>();

function newSessionId(customerId: string): string {
  return `${customerId}:${Date.now().toString(36)}`;
}

export function currentSession(customerId: string): string {
  let sessionId = sessions.get(customerId);
  if (!sessionId) {
    sessionId = newSessionId(customerId);
    sessions.set(customerId, sessionId);
  }
  return sessionId;
}

/** Called once an order is placed, so the next turn starts a fresh thread. */
export function rotateSession(customerId: string): string {
  const sessionId = newSessionId(customerId);
  sessions.set(customerId, sessionId);
  return sessionId;
}
