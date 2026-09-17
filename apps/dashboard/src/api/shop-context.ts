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

/**
 * Survives sign-out on purpose.
 *
 * Coming back is meant to be one tap: the username is not a secret — there is
 * no password behind it — and re-typing it at a counter on a shared tablet is
 * the kind of friction that makes people stay signed in when they shouldn't.
 */
const LAST_USER_KEY = 'kadakaran.lastUsername';

export function rememberUsername(username: string): void {
  try {
    window.localStorage.setItem(LAST_USER_KEY, username);
  } catch {
    // Private mode, or storage disabled. Not worth failing sign-in over.
  }
}

export function readRememberedUsername(): string {
  try {
    return window.localStorage.getItem(LAST_USER_KEY) ?? '';
  } catch {
    return '';
  }
}

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
