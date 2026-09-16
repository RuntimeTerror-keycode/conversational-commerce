import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { advanceOrder, fetchOrder, fetchOrders } from '@/api/orders';
import { queryKeys } from '@/api/keys';
import type { OrderListQuery, ShopkeeperTransition } from '@/api/types';

/**
 * Poll every 3 seconds — docs/contracts.md §C3 rule 1, which forbids
 * websockets outright because conference wifi kills socket connections and you
 * do not notice until you are on stage.
 *
 * The full page is refetched rather than a `since`-based delta. At demo scale
 * the payload is trivial and delta-merge bugs on stage are not.
 */
export const ORDERS_POLL_MS = 3_000;

export function useOrders(query: OrderListQuery) {
  return useQuery({
    queryKey: queryKeys.orders(query),
    queryFn: () => fetchOrders(query),
    refetchInterval: ORDERS_POLL_MS,
    refetchIntervalInBackground: false,
    placeholderData: (previous) => previous,
  });
}

export function useOrder(orderId: string | null) {
  return useQuery({
    queryKey: queryKeys.order(orderId ?? ''),
    queryFn: () => fetchOrder(orderId!),
    enabled: Boolean(orderId),
    refetchInterval: ORDERS_POLL_MS,
  });
}

export function useAdvanceOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ orderId, status }: { orderId: string; status: ShopkeeperTransition }) =>
      advanceOrder(orderId, status),
    onSuccess: (order) => {
      queryClient.setQueryData(queryKeys.order(order.id), order);
    },
    // Refetch on failure too: a 409 means someone else moved it, and the
    // honest response is to show what it actually is now.
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['orders'] });
      void queryClient.invalidateQueries({ queryKey: queryKeys.stats });
    },
  });
}
