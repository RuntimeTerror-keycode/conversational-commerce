import { PaginatedResponse } from './index';

export type FulfillmentStatus =
  | 'accepted'
  | 'packed'
  | 'out_for_delivery'
  | 'delivered'
  | 'rejected';

export interface FulfillmentCustomer {
  displayName: string | null;
  phone: string;
}

export interface FulfillmentSummary {
  id: number;
  orderCode: string;
  status: FulfillmentStatus;
  customer: FulfillmentCustomer;
  itemCount: number;
  subtotal: number;
  deliveryType: string;
  acceptedAt: string | null;
  updatedAt: string | null;
}

export interface FulfillmentCounts {
  accepted: number;
  packed: number;
  out_for_delivery: number;
  delivered: number;
  rejected: number;
}

/** Money totals across every matching row, not just the returned page. */
export interface FulfillmentTotals {
  /** Sum of delivered fulfillments, all time. */
  deliveredRevenue: number;
  /** Sum of fulfillments delivered since midnight, shop-local. */
  deliveredRevenueToday: number;
}

export interface FulfillmentListResponse extends PaginatedResponse<FulfillmentSummary> {
  counts: FulfillmentCounts;
  totals: FulfillmentTotals;
}

export interface FulfillmentLineItem {
  lineId: number;
  shopProductId: number;
  productName: string;
  catalogName: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  lineTotal: number;
  sourceText: string | null;
}

export interface FulfillmentTimeline {
  acceptedAt: string | null;
  packedAt: string | null;
  outForDeliveryAt: string | null;
  deliveredAt: string | null;
  rejectedAt: string | null;
}

export interface FulfillmentEvent {
  id: number;
  eventType: string;
  actor: string;
  note: string | null;
  createdAt: string;
}

export interface FulfillmentDetail {
  id: number;
  masterOrderId: number;
  orderCode: string;
  status: FulfillmentStatus;
  customer: FulfillmentCustomer & { phone: string };
  items: FulfillmentLineItem[];
  subtotal: number;
  delivery: {
    type: string;
    address: string | null;
    city: string | null;
    note: string | null;
  };
  payment: {
    method: string;
    status: string;
  };
  timeline: FulfillmentTimeline;
  rejectionReason: string | null;
  events: FulfillmentEvent[];
  traceId: string | null;
  updatedAt: string | null;
}
