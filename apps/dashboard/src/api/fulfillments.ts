import { request } from './client';
import type {
  DashboardTransition,
  FulfillmentDetail,
  FulfillmentItemPatch,
  FulfillmentListQuery,
  FulfillmentListResponse,
} from './types';

export function fetchFulfillments(
  query: FulfillmentListQuery,
): Promise<FulfillmentListResponse> {
  return request<FulfillmentListResponse>('/fulfillments', {
    query: {
      status: query.status,
      since: query.since,
      page: query.page,
      limit: query.limit,
    },
  });
}

export function fetchFulfillment(id: number): Promise<FulfillmentDetail> {
  return request<FulfillmentDetail>(`/fulfillments/${id}`);
}

/**
 * Fulfilment transitions only.
 *
 * `accepted` and `rejected` are unrepresentable in the parameter type — the
 * system auto-accepts and nothing in the product rejects. The backend enforces
 * the same rule and 422s anything else.
 */
export function advanceFulfillment(
  id: number,
  status: DashboardTransition,
): Promise<FulfillmentDetail> {
  return request<FulfillmentDetail>(`/fulfillments/${id}`, {
    method: 'PATCH',
    body: { status },
  });
}

/** Allowed while the fulfillment is still `accepted`; 409 afterwards. */
export function updateFulfillmentItem(
  id: number,
  lineId: number,
  patch: FulfillmentItemPatch,
): Promise<FulfillmentDetail> {
  return request<FulfillmentDetail>(`/fulfillments/${id}/items/${lineId}`, {
    method: 'PATCH',
    body: patch,
  });
}
