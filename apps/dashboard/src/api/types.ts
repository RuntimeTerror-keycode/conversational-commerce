/**
 * Dashboard API contract — apps/dashboard <-> apps/api
 *
 * MIRRORS THE IMPLEMENTED BACKEND. Every type here matches
 * `apps/api/src/types/*.ts` field for field. When the backend changes, change
 * this file to match — do not add fields the API does not actually return.
 *
 * See docs/contracts.md §C2 and its changelog for how this diverged from the
 * FE proposal in docs/frontend-contract.md. The headlines:
 *
 *   - Orders are **fulfillments** — a shop's slice of a customer's master
 *     order. Each shop only ever sees its own.
 *   - Auth is a username lookup returning a `shopId`, sent back as an
 *     `X-Shop-Id` header. No password, no cookie, no session to expire.
 *   - Ids are **numbers**, not strings.
 *   - Money is **decimal rupees** (`320.5` = ₹320.50), DECIMAL(10,2) in the DB.
 */

/** Decimal rupees. 320.5 === ₹320.50. */
export type Money = number;

/** ISO 8601 timestamp string. */
export type Timestamp = string;

/* ------------------------------------------------------------------ *
 * Envelopes
 * ------------------------------------------------------------------ */

export interface PageInfo {
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  page: PageInfo;
  serverTime: Timestamp;
}

export type ErrorCode =
  | 'bad_request'
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'conflict'
  | 'validation_failed'
  | 'rate_limited'
  | 'internal_error';

export interface ApiError {
  status: 'error';
  code: ErrorCode;
  message: string;
  details?: Record<string, unknown>;
}

/* ------------------------------------------------------------------ *
 * Session — POST /api/identify
 * ------------------------------------------------------------------ */

export interface IdentifyRequest {
  username: string;
}

export interface SessionUser {
  id: number;
  username: string;
  name: string;
  role: string;
}

/**
 * Derived server-side so the dashboard and the agent can never disagree.
 *
 *   offline      — the shopkeeper switched the shop off
 *   closed       — outside opening hours right now
 *   open         — taking orders
 *   always_open  — active, but no hours configured
 */
export type ShopOpenState = 'open' | 'closed' | 'offline' | 'always_open';

export interface SessionShop {
  id: number;
  name: string;
  isActive: boolean;
  /** 'managed' | 'external' in practice; the API types it as a plain string. */
  inventoryMode: string;
  /** "HH:MM", or null when the shop has not set hours. */
  openingTime: string | null;
  closingTime: string | null;
  openState: ShopOpenState;
}

/** GET /api/shops/me */
export interface ShopSettings {
  id: number;
  name: string;
  ownerName: string | null;
  phone: string;
  openingTime: string | null;
  closingTime: string | null;
  isActive: boolean;
  inventoryMode: string;
  deliveryRadiusKm: number | null;
  openState: ShopOpenState;
}

/** PATCH /api/shops/me */
export interface ShopSettingsUpdate {
  name?: string;
  ownerName?: string | null;
  isActive?: boolean;
  openingTime?: string | null;
  closingTime?: string | null;
}

export interface Session {
  user: SessionUser;
  shop: SessionShop;
}

/* ------------------------------------------------------------------ *
 * Fulfillments — what the shopkeeper calls "orders"
 * ------------------------------------------------------------------ */

export type FulfillmentStatus =
  | 'accepted'
  | 'packed'
  | 'out_for_delivery'
  | 'delivered'
  | 'rejected';

/**
 * Transitions the dashboard may request (docs/contracts.md §C2).
 *
 * `accepted` is never sent — the system auto-accepts and a fulfillment is born
 * in that state. `rejected` is in the enum defensively but nothing produces
 * it. The backend rejects anything outside this set with 422.
 */
export type DashboardTransition = Extract<
  FulfillmentStatus,
  'packed' | 'out_for_delivery' | 'delivered'
>;

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
  subtotal: Money;
  deliveryType: string;
  acceptedAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export type FulfillmentCounts = Record<FulfillmentStatus, number>;

/** Money totals across every matching row, not just the returned page. */
export interface FulfillmentTotals {
  deliveredRevenue: Money;
  deliveredRevenueToday: Money;
}

export interface FulfillmentListResponse extends PaginatedResponse<FulfillmentSummary> {
  counts: FulfillmentCounts;
  totals: FulfillmentTotals;
}

export interface FulfillmentLineItem {
  lineId: number;
  shopProductId: number;
  /** The shop's own name for the product. */
  productName: string;
  /** The shared catalogue name. */
  catalogName: string;
  quantity: number;
  unit: string;
  unitPrice: Money;
  lineTotal: Money;
  /** What the customer actually typed — "2 kg ari". docs/contracts.md §C3 rule 3. */
  sourceText: string | null;
}

export interface FulfillmentTimeline {
  acceptedAt: Timestamp | null;
  packedAt: Timestamp | null;
  outForDeliveryAt: Timestamp | null;
  deliveredAt: Timestamp | null;
  rejectedAt: Timestamp | null;
}

export interface FulfillmentEvent {
  id: number;
  /** Free-form from the API, e.g. "status_packed", "placed". */
  eventType: string;
  /** 'customer' | 'retailer' | 'system' | 'agent' in practice. */
  actor: string;
  note: string | null;
  createdAt: Timestamp;
}

export interface FulfillmentDetail {
  id: number;
  orderCode: string;
  status: FulfillmentStatus;
  customer: FulfillmentCustomer;
  items: FulfillmentLineItem[];
  subtotal: Money;
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
  updatedAt: Timestamp | null;
}

/**
 * GET /api/fulfillments
 *
 * NOTE: `status` is a SINGLE value. The API validates it against the enum and
 * returns 422 for a comma-separated list, so multi-status tabs are not
 * expressible in one request. There is also no `q` search parameter.
 */
export interface FulfillmentListQuery {
  status?: FulfillmentStatus;
  since?: Timestamp;
  page?: number;
  limit?: number;
}

/** PATCH /api/fulfillments/:id */
export interface FulfillmentStatusPatch {
  status: DashboardTransition;
}

/** PATCH /api/fulfillments/:id/items/:lineId — `accepted` fulfillments only. */
export type FulfillmentItemPatch =
  | { quantity: number }
  | { substituteProductId: number }
  | { remove: true };

/* ------------------------------------------------------------------ *
 * Inventory
 * ------------------------------------------------------------------ */

export interface Product {
  id: number;
  /** Catalogue name. */
  name: string;
  /** The shop's own/colloquial name — the closest thing to a search alias. */
  localName: string | null;
  brand: string | null;
  category: string | null;
  unit: string | null;
  sku: string | null;
  regularPrice: Money;
  sellingPrice: Money;
  inStock: boolean;
  stockQuantity: number;
  lowStockThreshold: number;
  isLow: boolean;
  updatedAt: Timestamp | null;
}

export interface InventoryCounts {
  total: number;
  inStock: number;
  low: number;
  out: number;
}

export interface InventoryListResponse extends PaginatedResponse<Product> {
  counts: InventoryCounts;
  /** Categories this shop stocks — populates the filter dropdown. */
  categories: string[];
}

/** A shared-catalogue item the shop could stock. */
export interface CatalogItem {
  catalogId: number;
  name: string;
  brand: string | null;
  category: string | null;
  unit: string | null;
  sku: string | null;
  alreadyStocked: boolean;
}

/** POST /api/inventory */
export interface InventoryCreateInput {
  catalogId: number;
  sellingPrice: Money;
  regularPrice?: Money;
  stockQuantity?: number;
  lowStockThreshold?: number;
  localName?: string | null;
}

export type StockStateFilter = 'in_stock' | 'low' | 'out';

export interface InventoryListQuery {
  q?: string;
  category?: string;
  stockState?: StockStateFilter;
  page?: number;
  limit?: number;
}

/** PATCH /api/inventory/:id */
export interface InventoryUpdateInput {
  sellingPrice?: Money;
  inStock?: boolean;
  stockQuantity?: number;
  lowStockThreshold?: number;
}

/* ------------------------------------------------------------------ *
 * Endpoint map (as implemented)
 * ------------------------------------------------------------------ *
 *
 *  POST   /api/identify                       IdentifyRequest -> Session
 *
 *  All routes below require the `X-Shop-Id` header.
 *
 *  GET    /api/fulfillments                   FulfillmentListQuery -> FulfillmentListResponse
 *  GET    /api/fulfillments/:id               -> FulfillmentDetail
 *  PATCH  /api/fulfillments/:id               FulfillmentStatusPatch -> FulfillmentDetail
 *  PATCH  /api/fulfillments/:id/items/:lineId FulfillmentItemPatch -> FulfillmentDetail
 *
 *  GET    /api/inventory                      InventoryListQuery -> InventoryListResponse
 *  GET    /api/inventory/catalog              ?q&limit -> { data: CatalogItem[] }
 *  POST   /api/inventory                      InventoryCreateInput -> Product
 *  PATCH  /api/inventory/:id                  InventoryUpdateInput -> Product
 *  DELETE /api/inventory/:id                  -> 204 — implemented server-side,
 *                                                deliberately not exposed in the UI
 *
 *  GET    /api/shops/me                       -> ShopSettings
 *  PATCH  /api/shops/me                       ShopSettingsUpdate -> ShopSettings
 *
 *  GET    /api/health
 *
 * Still not implemented:
 *  - no search on fulfillments (no `q` parameter)
 *  - `sourceText` is hardcoded null server-side and has no column
 */
