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

/** True if this turn is about to start a session that didn't exist a moment ago. Call before currentSession(). */
export function isNewSession(customerId: string): boolean {
  return !sessions.has(customerId);
}

/** Called once an order is placed, so the next turn starts a fresh thread. */
export function rotateSession(customerId: string): string {
  const sessionId = newSessionId(customerId);
  sessions.set(customerId, sessionId);
  return sessionId;
}

// Payment mode is asked fresh every order, on purpose — unlike the address,
// which is fine to carry over and just confirm. A customer's saved
// default_payment_mode column always has a value once they've ever paid, so
// "is paymentMode null" can't tell us "have they chosen it for THIS order"
// — only a session-scoped flag can. rotateSession() naturally clears this
// for the next order, since it mints a brand-new sessionId this Set has
// never seen.
const paymentChosenSessions = new Set<string>();

export function markPaymentChosen(sessionId: string): void {
  paymentChosenSessions.add(sessionId);
}

export function wasPaymentChosenThisSession(sessionId: string): boolean {
  return paymentChosenSessions.has(sessionId);
}
