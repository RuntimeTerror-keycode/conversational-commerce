# Agent ↔ Domain API Reference

Base URL: `http://<api-host>:4000/api`

Reads use **GET** (query params / path params).
Mutations use **POST** or **PATCH** with `Content-Type: application/json`.
Errors return `{ status: "error", code: string, message: string }`.

---

## 1. Retailers

### GET `/api/retailers/nearby`

Resolve the nearest shops for a customer. Returns the closest shop as `primary` and all shops within delivery radius sorted by distance.

**Query params**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `customerRef` | string | ✅ | Customer phone number |

**Example**

```
GET /api/retailers/nearby?customerRef=919847012345
```

**Response 200**

```json
{
  "primary": {
    "retailerId": "1",
    "name": "Krishna Supermart",
    "area": "Kochi"
  },
  "nearby": [
    { "retailerId": "1", "name": "Krishna Supermart", "distanceKm": 2.1 },
    { "retailerId": "2", "name": "Maveli Stores",     "distanceKm": 3.7 }
  ]
}
```

**Errors**

| Code | When |
|------|------|
| 400 `bad_request` | `customerRef` missing |
| 404 `not_found` | Customer not in database |

---

## 2. Catalog

### GET `/api/catalog/search`

Search the global catalog for products available at shops near the customer. Matches against product name, brand, and tag aliases. Returns products with the cheapest price across nearby shops.

**Query params**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `customerId` | string | ✅ | Customer phone number |
| `query` | string | ✅ | Search text |
| `limit` | number | | Max results (default 3, max 10) |

**Example**

```
GET /api/catalog/search?customerId=919847012345&query=coconut+oil&limit=2
```

**Response 200** — array of products (may be empty)

```json
[
  {
    "id": "24",
    "name": "India Gate Basmati Rice Classic 1kg",
    "brand": "India Gate",
    "unit": "kg",
    "price": 170,
    "inStock": true
  }
]
```

### POST `/api/catalog/availability`

Check stock availability for specific products at a single shop. Returns substitutes from the same catalog category when an item is out of stock.

**Request body**

```json
{
  "retailerId": "1",
  "productIds": ["24", "33"]
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `retailerId` | string | ✅ | Shop ID |
| `productIds` | string[] | ✅ | Catalog IDs (non-empty) |

**Response 200** — array, one entry per requested product

```json
[
  {
    "productId": "24",
    "inStock": true,
    "substitutes": []
  },
  {
    "productId": "33",
    "inStock": false,
    "substitutes": [
      { "id": "34", "name": "Milma Curd 200g Cup", "unit": "pack", "price": 18 }
    ]
  }
]
```

---

## 3. Cart

Cart is scoped per customer, stores catalog-level references (not shop-specific). Prices shown are the cheapest available across nearby shops at read time.

### GET `/api/cart/:customerId`

Return the current cart contents and computed total.

**Path params**

| Param | Type | Description |
|-------|------|-------------|
| `customerId` | string | Customer phone number |

**Example**

```
GET /api/cart/919847012345
```

**Response 200**

```json
{
  "items": [
    {
      "lineId": "6",
      "productName": "India Gate Basmati Rice Classic 1kg",
      "quantity": 5,
      "unit": "kg",
      "price": 170
    }
  ],
  "total": 850,
  "currency": "INR"
}
```

Empty cart returns `{ "items": [], "total": 0, "currency": "INR" }`.

### PATCH `/api/cart/:customerId`

Add, set, or remove a single item. Returns the full updated cart (same shape as GET).

**Path params**

| Param | Type | Description |
|-------|------|-------------|
| `customerId` | string | Customer phone number |

**Request body**

```json
{
  "op": {
    "action": "add",
    "productId": "24",
    "quantity": 2,
    "unit": "kg"
  }
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `op.action` | `"add"` \| `"set"` \| `"remove"` | ✅ | Operation type |
| `op.productId` | string | ✅ | Catalog ID |
| `op.quantity` | number | for add/set | Positive integer (defaults to 1) |
| `op.unit` | string | | Unit label (defaults to `"unit"`) |

**Action semantics**

| Action | Behaviour |
|--------|-----------|
| `add` | Adds the item to cart. If already present, increments quantity. Validates the product exists in catalog and is available at a nearby shop. |
| `set` | Overwrites quantity for an item already in cart. Fails if item not in cart. |
| `remove` | Removes the item from cart entirely. Fails if item not in cart. |

**Errors**

| Code | When |
|------|------|
| 400 `bad_request` | Missing `op` fields |
| 404 `not_found` | Customer not found, or product not in cart (for `set`/`remove`) |
| 422 `validation_failed` | Unknown product ID, product unavailable at any shop, non-positive qty |

---

## 4. Orders

Two-step flow: **confirm** then **place**. The confirmation step snapshots the cart, runs the multi-shop splitting algorithm, and returns a time-limited token. The place step validates the token and creates the order.

### POST `/api/orders/confirm`

Snapshot the cart, compute shop assignments, and return a confirmation token.

**Request body**

```json
{
  "customerId": "919847012345",
  "nearbyShopIds": ["1", "2"]
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `customerId` | string | ✅ | Customer phone |
| `nearbyShopIds` | string[] | ✅ | Shop IDs from `/retailers/nearby` |

**Response 200**

```json
{
  "summary": [
    {
      "lineId": "19",
      "productName": "India Gate Basmati Rice Classic 1kg",
      "quantity": 5,
      "unit": "kg",
      "price": 170
    }
  ],
  "total": 1537,
  "confirmationToken": "a1c85492fd529ad2...",
  "expiresAt": "2026-09-16T17:15:24.483Z",
  "shopBreakdown": [
    {
      "shopId": "1",
      "shopName": "Krishna Supermart",
      "items": [ ... ],
      "subtotal": 1397
    },
    {
      "shopId": "2",
      "shopName": "Maveli Stores",
      "items": [ ... ],
      "subtotal": 140
    }
  ]
}
```

**Shop splitting algorithm**
- Uses a greedy set-cover approach: assigns items to the shop that can cover the most items.
- Minimum fulfillment amount per shop: ₹400. Small assignments are absorbed into the largest fulfillment to avoid uneconomical sub-orders.
- Token TTL: 5 minutes.

### POST `/api/orders`

Validate the confirmation token and place the order. Creates one `master_order` with `fulfillment` entries per shop. Clears the cart on success.

**Request body**

```json
{
  "confirmationToken": "a1c85492fd529ad2...",
  "opts": {
    "deliveryNote": "Ring the bell twice"
  }
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `confirmationToken` | string | ✅ | Token from `/orders/confirm` |
| `opts.deliveryNote` | string | | Optional delivery instructions |

**Response 201** — success

```json
{
  "orderId": "3",
  "status": "placed",
  "etaMinutes": 30
}
```

**Response 4xx** — failure

```json
{
  "error": true,
  "reason": "expired"
}
```

| reason | HTTP | When |
|--------|------|------|
| `not_found` | 404 | Token doesn't match any draft order (already used or never existed) |
| `expired` | 410 | Token has expired (past the 5-minute window) |
| `cart_changed` | 409 | Cart was modified after confirmation was issued |

---

## Route Summary

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/retailers/nearby` | Resolve primary + nearby shops |
| GET | `/api/catalog/search` | Search products across nearby shops |
| POST | `/api/catalog/availability` | Check stock at a specific shop |
| GET | `/api/cart/:customerId` | Read cart |
| PATCH | `/api/cart/:customerId` | Add / set / remove cart item |
| POST | `/api/orders/confirm` | Snapshot cart → confirmation token |
| POST | `/api/orders` | Place order with token |

---

## Type Reference

```typescript
// --- Retailers ---
interface ResolveRetailerResponse {
  primary: { retailerId: string; name: string; area: string };
  nearby:  { retailerId: string; name: string; distanceKm: number }[];
}

// --- Catalog ---
interface DomainProduct {
  id: string;
  name: string;
  brand: string | null;
  unit: string;
  price: number;
  inStock: boolean;
}

interface AvailabilityResult {
  productId: string;
  inStock: boolean;
  substitutes: { id: string; name: string; unit: string; price: number }[];
}

// --- Cart ---
interface DomainCartLine {
  lineId: string;
  productName: string;
  quantity: number;
  unit: string;
  price: number;
}

interface DomainCart {
  items: DomainCartLine[];
  total: number;
  currency: "INR";
}

interface CartOpInput {
  action: "add" | "remove" | "set";
  productId: string;         // catalog ID
  quantity: number;
  unit: string;
}

// --- Orders ---
interface OrderConfirmationResponse {
  summary: DomainCartLine[];
  total: number;
  confirmationToken: string;
  expiresAt: string;         // ISO 8601
  shopBreakdown: {
    shopId: string;
    shopName: string;
    items: DomainCartLine[];
    subtotal: number;
  }[];
}

type CreateOrderResponse =
  | { orderId: string; status: "placed"; etaMinutes: number }
  | { error: true; reason: "not_found" | "expired" | "cart_changed" };
```

---

## Typical Agent Flow

```
1. GET  /api/retailers/nearby?customerRef=919847012345
   → get primary.retailerId + nearby[].retailerId

2. GET  /api/catalog/search?customerId=919847012345&query=rice
   → show results to user

3. POST /api/catalog/availability  { retailerId, productIds }
   → confirm stock at a specific shop, get substitutes

4. PATCH /api/cart/919847012345  { op: { action: "add", productId, quantity } }
   → returns full updated cart each time

5. POST /api/orders/confirm  { customerId, nearbyShopIds }
   → show summary + shop breakdown to user for confirmation

6. POST /api/orders  { confirmationToken }
   → order placed, cart cleared
```

---

## Constants

| Name | Value | Notes |
|------|-------|-------|
| Default search limit | 3 | |
| Max search limit | 10 | |
| Confirmation token TTL | 5 min | |
| Default ETA | 30 min | |
| Min fulfillment amount | ₹400 | Sub-orders below this are merged |
