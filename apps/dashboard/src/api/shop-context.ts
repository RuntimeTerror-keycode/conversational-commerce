import type { Session } from './types';

/**
 * The shop id is the whole of our auth.
 *
 * `POST /api/identify` returns it and every subsequent request carries it as
 * `X-Shop-Id` (docs/contracts.md §C2). There is no cookie and no token, so the
 * browser has to hold it — losing it on reload would drop the shopkeeper back
 * to the login screen every refresh.
 *
 * localStorage, not sessionStorage: a counter display gets reloaded and reopened
 * all day and should not need signing in again each time.
 */
const STORAGE_KEY = 'kadakaran.session';

let cached: Session | null = null;

export function readStoredSession(): Session | null {
  if (cached) return cached;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Session;
    // Guard against a half-written or stale-shaped value rather than letting a
    // malformed object flow into the app as if it were a session.
    if (typeof parsed?.shop?.id !== 'number' || !parsed?.user?.username) return null;

    cached = parsed;
    return parsed;
  } catch {
    return null;
  }
}

export function storeSession(session: Session): void {
  cached = session;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    // Private browsing or blocked storage — the in-memory copy still works
    // for this tab.
  }
}

export function clearStoredSession(): void {
  cached = null;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to do; the in-memory copy is already gone.
  }
}

/** The `X-Shop-Id` value for outgoing requests, or null when signed out. */
export function currentShopId(): number | null {
  return readStoredSession()?.shop.id ?? null;
}
