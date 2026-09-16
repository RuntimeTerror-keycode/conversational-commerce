import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ApiRequestError } from '@/api/client';
import { fetchSession, login, logout } from '@/api/auth';
import { queryKeys } from '@/api/keys';
import type { LoginRequest } from '@/api/types';

/**
 * One query bootstraps the whole app.
 *
 * A 401 here is not an error state — it just means "not logged in", so it must
 * not retry and must not surface as a failure screen.
 */
export function useSession() {
  return useQuery({
    queryKey: queryKeys.session,
    queryFn: fetchSession,
    retry: (_count, error) =>
      !(error instanceof ApiRequestError && error.isUnauthorized),
    staleTime: 5 * 60_000,
  });
}

export function useLogin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (credentials: LoginRequest) => login(credentials),
    onSuccess: (session) => {
      queryClient.setQueryData(queryKeys.session, session);
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: logout,
    onSuccess: () => {
      // Navigate first, then clear. The other way round leaves the guarded
      // routes mounted with an empty cache, refetching against a session that
      // is already gone.
      navigate('/login', { replace: true });
      queryClient.clear();
    },
  });
}
