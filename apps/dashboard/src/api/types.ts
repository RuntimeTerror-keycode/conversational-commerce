/**
 * Dashboard API contract — apps/dashboard <-> apps/api
 *
 * Handover draft for the backend dev. Full rationale in docs/frontend-contract.md.
 *
 * Status of each block is marked below:
 *   EXISTING  — already in packages/contracts/src/index.ts, restated here for
 *               a self-contained handover. Do not redefine, import it.
 *   AGREED    — specified in docs/contracts.md §C2/§C3.
 *   PROPOSED  — needs backend agreement before either side builds against it.
 *
 * Money: every amount is a whole-rupee number (320 === Rs 320), matching the
 * existing agent/cart stubs. If the backend prefers integer paise, say so — it
 * is one formatting function on our side. (Q-X1)
 *
 * Timestamps: ISO 8601 UTC strings.
 */

/* ------------------------------------------------------------------ *
 * Primitives
 * ------------------------------------------------------------------ */

/** Whole rupees. 320 === Rs 320. See Q-X1. */
export type Money = number;

/** ISO 8601 UTC, e.g. "2026-09-16T09:28:11Z". */
export type Timestamp = string;

/* ------------------------------------------------------------------ *
 * Order status — EXISTING (packages/contracts/src/index.ts)
 * ------------------------------------------------------------------ */

export type OrderStatus =
  | 'draft'
  | 'placed'
  | 'accepted'
  | 'rejected'
  | 'packed'
  | 'out_for_delivery'
  | 'delivered';

/**
 * Statuses the dashboard ever displays.
 *
 * `draft` is a cart still being built over WhatsApp. `placed` exists only in
 * the instant before auto-accept fires. Neither is ever shown, so
 * GET /api/orders must exclude both by default.
 *
 * `rejected` is listed because it is in the shared enum, but nothing in the
 * product can currently produce it — there is no reject anywhere. (Q-O12)
 */
export type VisibleOrderStatus = Extract<
  OrderStatus,
  'accepted' | 'packed' | 'out_for_delivery' | 'delivered' | 'rejected'
>;

/**
 * Transitions the dashboard is allowed to request.
 *
 * The system owns `placed -> accepted` (auto-accept, no human involved).
 * The shopkeeper owns everything after it. A PATCH carrying `accepted` or
 * `rejected` should be rejected with 422.
 */
export type ShopkeeperTransition = Extract<
  OrderStatus,
  'packed' | 'out_for_delivery' | 'delivered'
>;

/* ------------------------------------------------------------------ *
 * Response envelopes — PROPOSED
 * ------------------------------------------------------------------ */

/**
 * List endpoints only. Single-resource endpoints return the bare object.
 *
 * NOTE: this replaces docs/contracts.md §C2's bare `Order[]`. A bare array
 * cannot carry pagination or the cross-page status counts the sidebar badge
 * needs. (Q-X2)
 */
export interface Paginated<T> {
  data: T[];
  page: PageInfo;
}

export interface PageInfo {
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
}

export interface ApiError {
  status: 'error';
  /** Stable and machine-readable. Never string-match `message`. */
  code:
    | 'bad_request'
    | 'unauthorized'
    | 'forbidden'
    | 'not_found'
    | 'conflict'
    | 'read_only_inventory'
    | 'validation_failed'
    | 'rate_limited'
    | 'internal_error';
  /** Human-readable. May change freely. */
  message: string;
  details?: Record<string, unknown>;
}

/* ------------------------------------------------------------------ *
 * Session — PROPOSED (nothing in the repo defines user auth today)
 * ------------------------------------------------------------------ */

export type InventoryMode = 'managed' | 'external';

export interface User {
  id: string;
  name: string;
  role: 'owner' | 'staff';
  retailerId: string;
}

export interface Retailer {
  id: string;
  name: string;
  area: string;
  whatsappNumber: string | null;
  currency: 'INR';
  timezone: string;

  /**
   * Drives the entire inventory screen.
   *
   *   managed  — we are their inventory system. They add/edit products and
   *              stock counts here, and packages/domain decrements
   *              `stockQuantity` after each order.
   *   external — they run their own POS. We hold a synced copy, decrement
   *              nothing, and expose it read-only.
   *
   * The frontend only READS this to decide what is editable. It never sends a
   * "decrement or not" flag — that decision lives in packages/domain.
   */
  inventoryMode: InventoryMode;

  /** Shop open/closed. Named to avoid confusion with per-order accept. (Q-S2) */
  shopOpen: boolean;
  autoAcceptSeconds: number;
  lowStockThresholdDefault: number;

  /** external mode only; null in managed mode. */
  sync: SyncState | null;
}

export interface SyncState {
  provider: string;
  lastSyncedAt: Timestamp | null;
  status: 'ok' | 'stale' | 'failed' | 'running';
  nextSyncAt: Timestamp | null;
  error?: string;
}

export interface Session {
  user: User;
  retailer: Retailer;
}

export interface LoginRequest {
  identifier: string;
  password: string;
}

/* ------------------------------------------------------------------ *
 * Orders — PROPOSED (no Order type exists anywhere in the repo yet)
 * ------------------------------------------------------------------ */

export interface OrderCustomer {
  /** wa_id. Opaque key, and currently also the phone number. (Q-C1) */
  ref: string;
  displayName: string | null;
  /** Full number for delivery. Detail responses only. (Q-C1) */
  phone?: string;
}

export interface OrderLine {
  lineId: string;
  productId: string;
  productName: string;

  /**
   * What the customer actually typed — "2 kg ari".
   *
   * REQUIRED by docs/contracts.md §C3 rule 3 and displayed on every line. It
   * is the single best on-screen proof the AI did something.
   */
  sourceText?: string;

  quantity: number;
  unit: string;
  unitPrice: Money;
  lineTotal: Money;
  availability: 'in_stock' | 'out_of_stock';
  /** Set when this line replaced another product. */
  substitutedFor: { productId: string; productName: string } | null;
}

export interface OrderEvent {
  at: Timestamp;
  type:
    | 'placed'
    | 'accepted'
    | 'rejected'
    | 'packed'
    | 'out_for_delivery'
    | 'delivered'
    | 'line_changed'
    | 'substitution';
  /** `system` covers auto-accept — it must be legible as not-a-human. */
  actor: 'customer' | 'retailer' | 'system' | 'agent';
  note?: string;
}

export interface OrderDelivery {
  mode: 'delivery' | 'pickup';
  address: string | null;
  note: string | null;
  etaMinutes: number | null;
}

/** Payment is mentioned in no document. Assuming COD until told otherwise. (Q-O5) */
export interface OrderPayment {
  method: 'cod';
  status: 'pending' | 'paid';
}

export interface OrderTimeline {
  placedAt: Timestamp;
  acceptedAt: Timestamp | null;
  packedAt: Timestamp | null;
  outForDeliveryAt: Timestamp | null;
  deliveredAt: Timestamp | null;
  rejectedAt: Timestamp | null;
}

/** Row shape for GET /api/orders. Deliberately smaller than Order. */
export interface OrderSummary {
  id: string;
  /** Short and human — "#1042". Something the shop can say out loud. */
  orderCode: string;
  status: VisibleOrderStatus;
  customer: OrderCustomer;
  itemCount: number;
  /** First line's sourceText, so §C3 rule 3 holds without opening the order. */
  firstLineSourceText: string | null;
  total: Money;
  currency: 'INR';
  placedAt: Timestamp;
  acceptedAt: Timestamp | null;
  updatedAt: Timestamp;
}

export interface Order extends Omit<OrderSummary, 'itemCount' | 'firstLineSourceText'> {
  items: OrderLine[];
  subtotal: Money;
  deliveryFee: Money;
  delivery: OrderDelivery;
  payment: OrderPayment;
  timeline: OrderTimeline;
  rejectionReason: string | null;
  events: OrderEvent[];
  /** Threaded from the edge. Surfaced in the UI for debugging. */
  traceId: string | null;
}

/** Counts across ALL matching orders, ignoring pagination — the badge must not lie. */
export type OrderStatusCounts = Record<VisibleOrderStatus, number>;

export interface OrderListResponse extends Paginated<OrderSummary> {
  counts: OrderStatusCounts;
  /** Echo back as `since` on the next poll. */
  serverTime: Timestamp;
}

export interface OrderListQuery {
  status?: VisibleOrderStatus[] | 'new' | 'in_progress';
  since?: Timestamp;
  q?: string;
  dateFrom?: Timestamp;
  dateTo?: Timestamp;
  page?: number;
  limit?: number;
  sort?: 'placedAt:desc' | 'placedAt:asc' | 'total:desc';
}

/** PATCH /api/orders/:id — fulfilment transitions only. */
export interface OrderStatusPatch {
  status: ShopkeeperTransition;
}

/** PATCH /api/orders/:id/items/:lineId — exactly one field. Returns the full Order. */
export type OrderLinePatch =
  | { quantity: number }
  | { substituteProductId: string }
  | { remove: true };

/* ------------------------------------------------------------------ *
 * Inventory — partly AGREED (§C2), stockQuantity PROPOSED
 * ------------------------------------------------------------------ */

export interface Product {
  id: string;
  sku: string | null;
  name: string;
  brand: string | null;
  category: string | null;
  unit: string;
  price: Money;
  currency: 'INR';

  /** Present in BOTH modes. This is the signal the agent grounds on. */
  inStock: boolean;

  /**
   * Managed mode only; null in external mode.
   *
   * docs/contracts.md §C2 specifies a boolean `inStock` alone, which is enough
   * for external shops but cannot serve managed ones — we decrement this after
   * every order. Written through the ordinary PATCH below, not a separate
   * stock endpoint. (Q-I1)
   */
  stockQuantity: number | null;
  lowStockThreshold: number | null;
  /** Derived server-side so the frontend never computes it. */
  isLow: boolean;

  /** Colloquial search terms — "ari", "chaya podi". (Q-I4) */
  aliases: string[];
  updatedAt: Timestamp;
  /** external mode only. */
  syncedAt: Timestamp | null;
}

export interface ProductListResponse extends Paginated<Product> {
  counts: { total: number; inStock: number; low: number; out: number };
  /** Saves a second call for the filter dropdown. */
  categories: string[];
}

export interface ProductListQuery {
  q?: string;
  category?: string;
  stockState?: 'all' | 'in_stock' | 'low' | 'out';
  page?: number;
  limit?: number;
  sort?: 'name:asc' | 'price:asc' | 'stockQuantity:asc' | 'updatedAt:desc';
}

/** Any subset. 409 `read_only_inventory` in external mode. */
export type ProductPatch = Partial<
  Pick<
    Product,
    | 'name'
    | 'sku'
    | 'brand'
    | 'category'
    | 'unit'
    | 'price'
    | 'inStock'
    | 'stockQuantity'
    | 'lowStockThreshold'
    | 'aliases'
  >
>;

/** POST /api/inventory — managed mode only. */
export interface ProductCreate {
  name: string;
  unit: string;
  price: Money;
  inStock: boolean;
  stockQuantity: number;
  sku?: string;
  brand?: string;
  category?: string;
  lowStockThreshold?: number;
  aliases?: string[];
}

/* ------------------------------------------------------------------ *
 * Dashboard KPIs — PROPOSED
 *
 * Everything except `revenue` can be derived from the `counts` blocks on the
 * orders and inventory lists. If this endpoint is awkward to build, say so and
 * we will drop it. (Q-D2)
 * ------------------------------------------------------------------ */

export interface StatsSummary {
  range: 'today' | '7d' | '30d';
  /** status === 'accepted' — arrived, untouched. This is the sidebar badge. */
  newOrders: number;
  /** packed + out_for_delivery. */
  activeOrders: number;
  completedToday: number;
  revenue: Money;
  currency: 'INR';
  lowStockCount: number;
  outOfStockCount: number;
}

/* ------------------------------------------------------------------ *
 * Endpoint map
 * ------------------------------------------------------------------ *
 *
 *  POST   /api/auth/login              LoginRequest      -> Session
 *  POST   /api/auth/logout             -                 -> 204
 *  GET    /api/auth/me                 -                 -> Session
 *
 *  GET    /api/orders                  OrderListQuery    -> OrderListResponse
 *  GET    /api/orders/:id              -                 -> Order
 *  PATCH  /api/orders/:id              OrderStatusPatch  -> Order
 *  PATCH  /api/orders/:id/items/:lineId OrderLinePatch   -> Order
 *
 *  GET    /api/inventory               ProductListQuery  -> ProductListResponse
 *  GET    /api/inventory/:id           -                 -> Product
 *  POST   /api/inventory               ProductCreate     -> Product    (managed)
 *  PATCH  /api/inventory/:id           ProductPatch      -> Product
 *  DELETE /api/inventory/:id           -                 -> 204        (managed)
 *  POST   /api/inventory/sync          -                 -> SyncState  (external)
 *  GET    /api/inventory/sync          -                 -> SyncState  (external)
 *
 *  GET    /api/stats/summary           ?range=           -> StatsSummary
 *  PATCH  /api/retailer                Partial<Retailer> -> Retailer
 *
 * retailerId is NEVER sent by the frontend. It is derived from the session
 * server-side — scoping enforced inside, not by the caller (CLAUDE.md rule 4).
 */
