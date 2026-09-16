// ---------------------------------------------------------------------------
// resolveRetailer
// ---------------------------------------------------------------------------

export interface NearbyShop {
  retailerId: string;
  name: string;
  distanceKm: number;
}

export interface ResolveRetailerRequest {
  customerRef: string;
}

export interface ResolveRetailerResponse {
  primary: { retailerId: string; name: string; area: string };
  nearby: NearbyShop[];
}

// ---------------------------------------------------------------------------
// searchProducts
// ---------------------------------------------------------------------------

export interface SearchProductsRequest {
  customerId: string;
  query: string;
  opts?: { attributes?: Record<string, string>; limit?: number };
}

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

export interface CheckAvailabilityRequest {
  retailerId: string;
  productIds: string[];
}

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
}

export interface CartOpInput {
  action: 'add' | 'remove' | 'set';
  productId: string;
  quantity: number;
  unit: string;
}

export interface GetCartRequest {
  customerId: string;
}

export interface MutateCartRequest {
  customerId: string;
  op: CartOpInput;
}

// ---------------------------------------------------------------------------
// Order confirmation
// ---------------------------------------------------------------------------

export interface RequestConfirmationRequest {
  customerId: string;
  nearbyShopIds: string[];
}

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

export interface CreateOrderRequest {
  confirmationToken: string;
  opts?: { deliveryNote?: string };
}

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
