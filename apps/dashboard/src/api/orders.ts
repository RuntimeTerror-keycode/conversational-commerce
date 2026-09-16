import { request } from './client';
import type {
  Order,
  OrderListQuery,
  OrderListResponse,
  ShopkeeperTransition,
} from './types';

export function fetchOrders(query: OrderListQuery): Promise<OrderListResponse> {
  return request<OrderListResponse>('/orders', {
    query: {
      status: Array.isArray(query.status) ? query.status.join(',') : query.status,
      q: query.q,
      page: query.page,
      limit: query.limit,
      sort: query.sort,
    },
  });
}

export function fetchOrder(orderId: string): Promise<Order> {
  return request<Order>(`/orders/${orderId}`);
}

/**
 * Fulfilment transitions only.
 *
 * `accepted` and `rejected` are never sent from here — the system auto-accepts
 * and there is no reject in the product. The type makes that unrepresentable.
 */
export function advanceOrder(
  orderId: string,
  status: ShopkeeperTransition,
): Promise<Order> {
  return request<Order>(`/orders/${orderId}`, { method: 'PATCH', body: { status } });
}
