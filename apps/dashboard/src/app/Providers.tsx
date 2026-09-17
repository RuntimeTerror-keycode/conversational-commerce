import { useState, type ReactNode } from 'react';
import { QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ApiRequestError } from '@/api/client';
import { queryKeys } from '@/api/keys';
import { ToastProvider } from '@/components/ui/Toast';

/**
 * Polling, not websockets — docs/contracts.md §C3 rule 1. Conference wifi kills
 * socket connections and you do not notice until you are on stage.
 *
 * The 3s interval lives on the orders query itself; most queries do not want it.
 */
function createQueryClient() {
  const queryClient: QueryClient = new QueryClient({
    queryCache: new QueryCache({
      onError: (error, query) => {
        if (!(error instanceof ApiRequestError) || !error.isUnauthorized) return;

        // The session query 401ing is the normal "not logged in" case.
        // Re-invalidating it here would spin forever.
        if (query.queryKey[0] === queryKeys.session[0]) return;

        // Any other query hitting 401 means the session died underneath us.
        // Refetch it and let RequireAuth navigate — a soft router redirect,
        // not a full page reload, so nothing else in the app is torn down.
        void queryClient.invalidateQueries({ queryKey: queryKeys.session });
      },
    }),
    defaultOptions: {
      queries: {
        staleTime: 2_000,
        retry: (count, error) =>
          error instanceof ApiRequestError && error.isUnauthorized ? false : count < 1,
        refetchOnWindowFocus: true,
      },
    },
  });

  return queryClient;
}

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(createQueryClient);

  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>{children}</ToastProvider>
    </QueryClientProvider>
  );
}
