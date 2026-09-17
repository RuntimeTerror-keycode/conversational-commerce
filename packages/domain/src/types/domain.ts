// ---------------------------------------------------------------------------
// resolveRetailer
// ---------------------------------------------------------------------------

export interface NearbyShop {
  retailerId: string;
  name: string;
  distanceKm: number;
}

export interface ResolveRetailerResponse {
  primary: { retailerId: string; name: string; area: string };
  nearby: NearbyShop[];
}

// ---------------------------------------------------------------------------
// searchProducts
// ---------------------------------------------------------------------------

export interface DomainProduct {
  id: string;
  name: string;
  brand: string | null;
  unit: string;
  price: number;
  inStock: boolean;
}

// ---------------------------------------------------------------------------
// checkAvailability
// ---------------------------------------------------------------------------

export interface AvailabilitySubstitute {
  id: string;
  name: string;
  unit: string;
  price: number;
}

export interface AvailabilityResult {
  productId: string;
  inStock: boolean;
  substitutes: AvailabilitySubstitute[];
}

// ---------------------------------------------------------------------------
// Cart
// ---------------------------------------------------------------------------

export interface DomainCartLine {
  lineId: string;
  productName: string;
  quantity: number;
  unit: string;
  price: number;
}

export interface DomainCart {
  items: DomainCartLine[];
  total: number;
  currency: 'INR';
  priceNote: string;
}

export interface CartOpInput {
  action: 'add' | 'remove' | 'set';
  productId: string;
  quantity: number;
  unit: string;
}

// ---------------------------------------------------------------------------
// Order confirmation
// ---------------------------------------------------------------------------

export interface ShopBreakdownEntry {
  shopId: string;
  shopName: string;
  items: DomainCartLine[];
  subtotal: number;
}

export interface OrderConfirmationResponse {
  summary: DomainCartLine[];
  total: number;
  confirmationToken: string;
  expiresAt: string;
  shopBreakdown: ShopBreakdownEntry[];
}

// ---------------------------------------------------------------------------
// createOrder
// ---------------------------------------------------------------------------

export type CreateOrderSuccess = {
  orderId: string;
  status: 'placed';
  etaMinutes: number;
};

export type CreateOrderFailure = {
  error: true;
  reason: 'not_found' | 'expired' | 'cart_changed';
};

export type CreateOrderResponse = CreateOrderSuccess | CreateOrderFailure;

// ---------------------------------------------------------------------------
// Confirmed snapshot (persisted at confirmation time)
// ---------------------------------------------------------------------------

export interface SnapshotItem {
  catalogId: number;
  productName: string;
  quantity: number;
  unit: string;
  shopProductId: number;
  unitPrice: number;
}

export interface SnapshotAssignment {
  shopId: number;
  shopName: string;
  items: SnapshotItem[];
  subtotal: number;
}

export interface ConfirmedSnapshot {
  assignments: SnapshotAssignment[];
  nearbyShopIds: number[];
}
