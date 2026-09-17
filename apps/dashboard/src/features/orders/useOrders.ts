import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  advanceFulfillment,
  fetchFulfillment,
  fetchFulfillments,
} from '@/api/fulfillments';
import { queryKeys } from '@/api/keys';
import type { DashboardTransition, FulfillmentListQuery } from '@/api/types';

/**
 * Poll every 3 seconds — docs/contracts.md §C3 rule 1, which forbids
 * websockets outright because conference wifi kills socket connections and you
 * do not notice until you are on stage.
 *
 * The full page is refetched rather than a `since`-based delta, which the
 * backend agreed to (Q-O7): delta-merge bugs on stage are not worth the saving.
 */
export const ORDERS_POLL_MS = 3_000;

export function useFulfillments(query: FulfillmentListQuery) {
  return useQuery({
    queryKey: queryKeys.fulfillments(query),
    queryFn: () => fetchFulfillments(query),
    refetchInterval: ORDERS_POLL_MS,
    refetchIntervalInBackground: false,
    placeholderData: (previous) => previous,
  });
}

export function useFulfillment(id: number | null) {
  return useQuery({
    queryKey: queryKeys.fulfillment(id ?? 0),
    queryFn: () => fetchFulfillment(id!),
    enabled: id !== null,
    refetchInterval: ORDERS_POLL_MS,
  });
}

export function useAdvanceFulfillment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, status }: { id: number; status: DashboardTransition }) =>
      advanceFulfillment(id, status),
    onSuccess: (fulfillment) => {
      queryClient.setQueryData(queryKeys.fulfillment(fulfillment.id), fulfillment);
    },
    // Refetch on failure too: a 409 means someone else moved it, and the
    // honest response is to show what it actually is now.
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['fulfillments'] });
    },
  });
}
