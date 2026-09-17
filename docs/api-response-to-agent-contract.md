# API response to agent domain contract

Response from the API/backend team to `docs/agent-domain-contract.md`.
Most proposals accepted. A few changed due to multi-vendor architecture decisions made on the backend.

Read this alongside the original contract — this document only covers **what changed and why**.

---

## Decisions that change the contract

### 1. Multi-shop order splitting

Orders are not confined to a single shop. If a customer's cart has items that no single shop carries entirely, the order is split across multiple nearby shops at placement time.

**Implication:** the agent no longer resolves to one retailer and stays there. It works with a *primary* shop for context (system prompt, price display) but the backend handles multi-shop resolution and splitting behind the scenes.

**Splitting rules:**
- Greedy set cover — assign items to the shop that covers the most, prioritizing proximity
- Minimum ₹400 per shop fulfillment — below this, items are reassigned to another shop that also carries them
- If reassignment is not possible (only one shop carries the item), the small fulfillment is kept

### 2. `resolveRetailer` → returns multiple shops

Was: one shop.
Now: a primary shop (for the agent's system prompt and price display) plus a list of all nearby shops within delivery radius.

```ts
// BEFORE
resolveRetailer(customerRef: string): Promise<{
  retailerId: string; name: string; area: string;
}>

// AFTER
resolveRetailer(customerRef: string): Promise<{
  primary: { retailerId: string; name: string; area: string };
  nearby:  { retailerId: string; name: string; distanceKm: number }[];
}>
```

`nearby` is sorted by distance, and `primary` is always `nearby[0]`. The agent should store the full `nearby` list in its turn context — the backend will need it at order time (passed through `requestOrderConfirmation`).

**How nearby is determined:** haversine distance from customer's address to each shop's address, filtered by `shop.delivery_radius_km`. Shops without a geocoded address or with `is_active = false` are excluded.

### 3. Cart is catalog-level and customer-scoped

Was: cart scoped to `(customerId, retailerId)`, items reference `shop_product.id`.
Now: cart scoped to `customerId` only, items reference `catalog.id`.

**Why:** the customer adds "rice" to the cart without knowing or caring which shop it comes from. Shop assignment happens at order time via the splitting algorithm.

**Price in cart:** when the agent reads the cart, the backend returns the primary shop's price for each item if that shop carries it, otherwise the cheapest nearby shop's price. These are **indicative** — final prices are locked at order confirmation when items are assigned to specific shops.

The agent should say something like *"Your cart total is approximately ₹X"* rather than *"Your total is ₹X"* — or just show the price without a caveat (the difference is usually zero for hackathon since most items will come from the primary shop).

### 4. `Product.id` is `catalog.id`, not `shop_product.id`

Search returns catalog-level products. When the agent passes `productId` to `mutateCart`, it is a `catalog.id`.

```ts
type Product = {
  id: string;       // catalog.id — NOT shop_product.id
  name: string;
  brand?: string;
  unit: string;
  price: number;    // primary shop's price, or cheapest nearby
  inStock: boolean; // true if ANY nearby shop carries it
}
```

### 5. `sourceText` removed

`sourceText` has been removed from `CartLine` and `CartOp`. Not part of the domain contract for now. If needed later, it will be added back as a separate concern.

### 6. Order confirmation shows per-shop breakdown

Since the order may span multiple shops, the confirmation response now includes a `shopBreakdown` so the agent can tell the customer how the order will be split.

---

## Revised function signatures

### `resolveRetailer` — changed

```ts
resolveRetailer(customerRef: string): Promise<{
  primary: { retailerId: string; name: string; area: string };
  nearby:  { retailerId: string; name: string; distanceKm: number }[];
}>
```

No other changes. Still called once per turn, still not model-facing.

### `searchProducts` — signature gains `customerId`

```ts
searchProducts(
  customerId: string,
  query: string,
  opts?: { attributes?: Record<string, string>; limit?: number }
): Promise<Product[]>
```

`retailerId` dropped as first argument. The backend resolves nearby shops from `customerId`'s address and searches across all of them. Results are catalog-level.

All the original rules still apply:
- Query is raw customer phrasing, passed through unedited
- Must handle Malayalam/Manglish via alias table (`tag` table in DB)
- Limit defaults to 3
- Empty array is a normal result, not an error

### `checkAvailability` — keeps `retailerId`, `productIds` are now `catalog.id`

```ts
checkAvailability(
  retailerId: string,
  productIds: string[]       // catalog.id values
): Promise<AvailabilityResult[]>

type AvailabilityResult = {
  productId: string;         // catalog.id
  inStock: boolean;          // at THIS shop specifically
  substitutes: { id: string; name: string; unit: string; price: number }[];
}
```

Signature unchanged from original contract — `retailerId` stays. This is a shop-specific check ("does Fresh Mart have chicken?"), not a broad discovery. Substitutes come from that shop's inventory.

Note: even if the primary shop is out of stock, the splitting algorithm at order time can still source the item from another nearby shop that carries it. The agent does not need to manage that — it just adds to the catalog-level cart and the backend handles shop assignment.

### `getCart` — `retailerId` dropped

```ts
getCart(customerId: string): Promise<Cart>

type Cart = {
  items: CartLine[];
  total: number;          // indicative — based on nearest available prices
  currency: "INR";
}

type CartLine = {
  lineId: string;
  productName: string;
  quantity: number;
  unit: string;
  price: number;          // indicative
}
```

Cart is customer-level. No shop scoping.

### `mutateCart` — `retailerId` dropped

```ts
mutateCart(
  customerId: string,
  op: CartOp
): Promise<Cart>              // returns complete cart, as before

type CartOp = {
  action: "add" | "remove" | "set";
  productId: string;          // catalog.id
  quantity: number;
  unit: string;
}
```

All original validation rules still apply:
- Must return complete cart, never a diff
- Must reject unknown `productId` (must exist in `catalog` table)
- Must reject `quantity <= 0` on `add` and `set`
- Must reject adding a product that no nearby shop carries

### `requestOrderConfirmation` — `retailerId` dropped, response expanded

```ts
requestOrderConfirmation(
  customerId: string,
  nearbyShopIds: string[]     // from resolveRetailer().nearby
): Promise<{
  summary: CartLine[];
  total: number;
  confirmationToken: string;
  expiresAt: string;          // ISO 8601, 5 min TTL
  shopBreakdown: {
    shopId: string;
    shopName: string;
    items: CartLine[];
    subtotal: number;
  }[];
}>
```

This is where the splitting algorithm runs. The response includes `shopBreakdown` so the agent can tell the customer:
*"Your order will be packed by Fresh Mart (₹480) and Green Grocers (₹220)."*

**`nearbyShopIds`** is passed so the backend knows which shops to consider for splitting. The agent gets this from `resolveRetailer().nearby` at the start of the turn and passes it here.

Token rules unchanged: 5 min TTL, single use, bound to customer.
Implementation: `confirmation_token` and `token_expires_at` columns on `master_order` (draft status). No separate table.

### `createOrder` — unchanged

```ts
createOrder(
  confirmationToken: string,
  opts?: { deliveryNote?: string }
): Promise<
  | { orderId: string; status: "placed"; etaMinutes: number }
  | { error: true; reason: "not_found" | "expired" | "cart_changed" }
>
```

Consumes the token, transitions `master_order` from `draft` → `placed`, creates fulfillment(s) per shop (born `accepted`), creates `order_item` rows from the snapshot.

All original rules apply — reject without valid token, place the snapshot not the live cart, return failures as values.

### `transitionOrder` — unchanged

```ts
transitionOrder(orderId: string, to: OrderStatus): Promise<Order>
```

Dashboard-only. Agent never calls this.

---

## What the AI team needs to update

| Tool file | Change needed |
|---|---|
| All tools | `productId` is now `catalog.id`, not `shop_product.id` |
| `search-products.ts` | Pass `customerId` instead of `retailerId`. Remove `retailerId` from input schema. |
| `check-availability.ts` | Signature unchanged. `retailerId` stays. `productIds` are now `catalog.id` values instead of `shop_product.id`. |
| `get-cart.ts` | Drop `retailerId` from input. Cart is customer-level. |
| `update-cart.ts` | Drop `retailerId`. `productId` = `catalog.id`. `sourceText` removed from `CartOp`. |
| `request-confirmation.ts` | Drop `retailerId`, add `nearbyShopIds` (from `resolveRetailer` context). Parse `shopBreakdown` in response to build a reply block telling the customer how the order splits. |
| `place-order.ts` | No change. |
| Agent system prompt | Mention that the order may be split across shops. The agent should communicate this naturally during confirmation. |

### `resolveRetailer` integration

The agent currently calls `resolveRetailer` once per turn and puts `retailerId` into the run context. Now it should:

1. Call `resolveRetailer(customerRef)` → get `{ primary, nearby }`
2. Use `primary.name` and `primary.area` in the system prompt (unchanged)
3. Store `nearby[].retailerId` in run context as `nearbyShopIds`
4. Pass `nearbyShopIds` to `requestOrderConfirmation`

---

## What stays the same

- Reply blocks — unchanged
- Order status machine — unchanged
- `createOrder` gating on confirmation token — unchanged
- Grounding rule — agent only mentions products from tool results
- Error-as-values pattern — unchanged
- `traceId` threading — unchanged (still open question #2 in the contract)
- `POST /notify` ownership — `apps/api` owns it (open question #3)
- Alias table — backend owns the file, AI team seeds entries (open question #4)

---

## Open questions remaining

### 1. Is `lineId` distinct from `productId`?

Yes. `lineId` is `cart_item.id` (auto-generated per row). `productId` is `catalog.id`. `mutateCart` with `remove` and `set` addresses items by `productId` — the backend finds the matching `cart_item` row. If the same catalog product appears twice (different pack sizes), this is ambiguous — we may need to address by `lineId` instead. **Needs agreement.**

### 2. How does the agent show the shop split to the customer?

Proposal: the `requestOrderConfirmation` response includes `shopBreakdown`. The agent builds a text reply like:

> Your order (₹700):
> 🛒 Fresh Mart — Rice, Curd, Tea powder, Oil (₹480)
> 🛒 Green Grocers — Chicken (₹220)
> Shall I place it?

The exact phrasing is the agent's to decide. The backend provides the data.

### 3. What if an item is unavailable at all nearby shops?

`mutateCart` rejects it — same as before. The agent tells the customer the item is not available in their area and offers alternatives (via `checkAvailability` substitutes from the catalog).

---

## Changelog

| Date | What changed | Why |
|---|---|---|
| 2026-09-16 | Initial response to agent domain contract | — |
| 2026-09-16 | Multi-shop splitting: `resolveRetailer` returns nearby list, cart is catalog-level, order splits at placement | Backend architecture is multi-vendor. Single-shop scoping does not hold. |
| 2026-09-16 | `sourceText` removed from `CartLine` and `CartOp` | Backend decision — not part of domain contract for now. |
| 2026-09-16 | `retailerId` dropped from cart and confirmation functions | Cart is customer-scoped. Shop assignment happens at order time. |
| 2026-09-16 | `requestOrderConfirmation` response includes `shopBreakdown` | Agent needs to communicate the split to the customer before they confirm. |
| 2026-09-16 | Order confirmation via `master_order` status columns, not separate table | `draft` → `placed` flow with `confirmation_token` + `token_expires_at` on `master_order`. Simpler. |
