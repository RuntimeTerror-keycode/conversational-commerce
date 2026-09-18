import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { identify, readStoredSession, signOut } from '@/api/session';
import { queryKeys } from '@/api/keys';
import type { Session } from '@/api/types';

/**
 * The session lives in localStorage, not on the server.
 *
 * `/api/identify` is a lookup, not a login — it mints nothing and expires
 * nothing (docs/contracts.md §C2). So the "session query" just reads what the
 * browser already holds; there is no `/auth/me` to call and nothing to refetch.
 */
export function useSession() {
  return useQuery<Session | null>({
    queryKey: queryKeys.session,
    queryFn: () => readStoredSession(),
    staleTime: Infinity,
    retry: false,
  });
}

export function useIdentify() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (username: string) => identify(username),
    onSuccess: (session) => {
      queryClient.setQueryData(queryKeys.session, session);
    },
  });
}

export function useSignOut() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: async () => signOut(),
    onSuccess: () => {
      // Navigate before clearing, so guarded routes are already unmounted and
      // do not fire a round of requests with no shop id attached.
      navigate('/login', { replace: true, state: { signedOut: true } });
      queryClient.clear();
    },
  });
}
