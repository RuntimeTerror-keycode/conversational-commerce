import { ConfirmedSnapshot } from './domain';

// ---------------------------------------------------------------------------
// customer
// ---------------------------------------------------------------------------

export interface CustomerRow {
  id: number;
  phone: string;
  display_name: string | null;
  language: string | null;
  default_payment_mode: string | null;
}

export interface CustomerWithAddressRow extends CustomerRow {
  address_id: number | null;
  address_line: string | null;
  label: string | null;
  latitude: number | null;
  longitude: number | null;
  city: string | null;
}

// ---------------------------------------------------------------------------
// shop
// ---------------------------------------------------------------------------

export interface ShopWithLocationRow {
  id: number;
  name: string;
  is_active: boolean;
  opening_time: string | null;
  closing_time: string | null;
  delivery_radius_km: number | null;
  latitude: number | null;
  longitude: number | null;
  city: string | null;
}

// ---------------------------------------------------------------------------
// catalog
// ---------------------------------------------------------------------------

export interface CatalogSearchRow {
  catalog_id: number;
  name: string;
  brand: string | null;
  unit: string | null;
  price: number;
  in_stock: boolean;
  score: number;
}

export interface CatalogItemRow {
  id: number;
  name: string;
  brand: string | null;
  unit: string | null;
  category_id: number | null;
  description: string | null;
}

export interface SubstituteRow {
  catalog_id: number;
  name: string;
  unit: string | null;
  price: number;
}

// ---------------------------------------------------------------------------
// cart
// ---------------------------------------------------------------------------

export interface CartRow {
  id: number;
  customer_id: number;
}

export interface CartItemRow {
  id: number;
  cart_id: number;
  catalog_id: number;
  quantity: number;
}

export interface CartItemDetailRow {
  line_id: number;
  catalog_id: number;
  product_name: string;
  quantity: number;
  unit: string;
}

// ---------------------------------------------------------------------------
// master_order
// ---------------------------------------------------------------------------

export interface MasterOrderRow {
  id: number;
  order_code: string;
  customer_id: number;
  address_id: number;
  status: string;
  payment_mode: string;
  delivery_type: string;
  delivery_note: string | null;
  product_amount: string;
  total_amount: string;
  delivery_fee: string;
  confirmation_token: string | null;
  token_expires_at: Date | null;
  confirmed_snapshot: ConfirmedSnapshot | null;
  cart_hash: string | null;
  trace_id: string | null;
  created_at: Date;
}

export interface MasterOrderInsert {
  orderCode: string;
  customerId: number;
  addressId: number;
  paymentMode: string;
  productAmount: number;
  totalAmount: number;
  deliveryFee: number;
  confirmationToken: string;
  tokenExpiresAt: Date;
  confirmedSnapshot: ConfirmedSnapshot;
  cartHash: string;
  deliveryNote?: string;
  traceId?: string;
}

// ---------------------------------------------------------------------------
// shop_product
// ---------------------------------------------------------------------------

export interface ShopProductRow {
  id: number;
  catalog_id: number;
  local_name: string | null;
  regular_price: string;
  selling_price: string;
  stock_quantity: number;
  low_stock_threshold: number;
  is_available: boolean;
  updated_at: Date | null;
}

export interface ShopProductListRow extends ShopProductRow {
  catalog_name: string;
  brand: string | null;
  unit: string | null;
  sku: string | null;
  category_name: string | null;
}

export interface ShopCatalogRow {
  name: string;
  brand: string | null;
  unit: string | null;
  sku: string | null;
  category_name: string | null;
}

export interface SubstituteProductRow {
  id: number;
  selling_price: string;
  local_name: string;
}

export interface InventoryCounts {
  total: number;
  inStock: number;
  low: number;
  out: number;
}

export interface ShopProductListParams {
  shopId: number;
  q?: string;
  category?: string;
  stockState?: string;
  limit: number;
  offset: number;
}

// ---------------------------------------------------------------------------
// fulfillment
// ---------------------------------------------------------------------------

export interface FulfillmentListRow {
  id: number;
  status: string;
  subtotal: string;
  accepted_at: Date | null;
  updated_at: Date | null;
  order_code: string;
  delivery_type: string;
  customer_name: string | null;
  customer_phone: string;
  item_count: number;
}

export interface StatusCountRow {
  status: string;
  count: number;
}

export interface FulfillmentDetailRow {
  id: number;
  master_order_id: number;
  shop_id: number;
  status: string;
  subtotal: string;
  accepted_at: Date | null;
  packed_at: Date | null;
  out_for_delivery_at: Date | null;
  delivered_at: Date | null;
  rejected_at: Date | null;
  rejection_reason: string | null;
  updated_at: Date | null;
  order_code: string;
  delivery_type: string;
  delivery_note: string | null;
  payment_mode: string;
  trace_id: string | null;
  customer_name: string | null;
  customer_phone: string;
  address_line: string | null;
  city: string | null;
  pincode: string | null;
}

export interface FulfillmentStatusRow {
  id: number;
  status: string;
}

export interface FulfillmentListParams {
  shopId: number;
  status?: string;
  since?: string;
  limit: number;
  offset: number;
}

// ---------------------------------------------------------------------------
// order_item
// ---------------------------------------------------------------------------

export interface OrderItemRow {
  lineId: number;
  shopProductId: number;
  productName: string;
  catalogName: string;
  quantity: number;
  unit: string;
  unitPrice: string;
  lineTotal: string;
}

export interface OrderItemPriceRow {
  id: number;
  unit_price: string;
}

export interface OrderItemQuantityRow {
  quantity: number;
}

// ---------------------------------------------------------------------------
// order_event
// ---------------------------------------------------------------------------

export interface OrderEventRow {
  id: number;
  eventType: string;
  actor: string;
  note: string | null;
  createdAt: Date;
}

// ---------------------------------------------------------------------------
// shop_user
// ---------------------------------------------------------------------------

export interface ShopUserRow {
  user_id: number;
  username: string;
  user_name: string;
  role: string;
  shop_id: number;
  shop_name: string;
  shop_is_active: boolean;
  inventory_mode: string;
  /** "HH:MM", or null when the shop has not set hours. */
  opening_time: string | null;
  closing_time: string | null;
}

/** The shop's own settings row — what the dashboard reads and writes. */
export interface ShopSettingsRow {
  id: number;
  name: string;
  owner_name: string | null;
  phone: string;
  opening_time: string | null;
  closing_time: string | null;
  is_active: boolean;
  inventory_mode: string;
  delivery_radius_km: string | null;
}
