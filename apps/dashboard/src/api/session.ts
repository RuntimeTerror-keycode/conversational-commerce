import { request } from './client';
import { clearStoredSession, readStoredSession, storeSession } from './shop-context';
import type { Session } from './types';

/**
 * `POST /api/identify` is the entire auth flow.
 *
 * No password, no cookie, no `/auth/me` to bootstrap from — the contract
 * dropped all three (docs/contracts.md §C2 changelog). On reload we read the
 * stored session back rather than re-identifying, because nothing server-side
 * would validate it anyway.
 */
export async function identify(username: string): Promise<Session> {
  const session = await request<Session>('/identify', {
    method: 'POST',
    body: { username },
    skipShopHeader: true,
  });

  storeSession(session);
  return session;
}

/** Local only — there is no server session to end. */
export function signOut(): void {
  clearStoredSession();
}

export { readStoredSession };
