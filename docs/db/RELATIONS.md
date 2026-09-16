# Database relations

No foreign key constraints in the schema — all relations are enforced in
application queries (JOINs, WHERE clauses). This doc is the source of truth
for how tables connect.

## Entity relationship

```
customer (phone is UNIQUE — same as WhatsApp number)
├── customer_address  (customer_id → customer.id)
│   └── address       (address_id → address.id)
├── cart              (customer_id → customer.id)
│   └── cart_item     (cart_id → cart.id)
│       └── shop_product  (shop_product_id → shop_product.id)
├── master_order      (customer_id → customer.id)
│   ├── address       (address_id → address.id)
│   ├── fulfillment   (master_order_id → master_order.id)
│   │   ├── shop      (shop_id → shop.id)
│   │   └── order_item (fulfillment_id → fulfillment.id)
│   │       └── shop_product (shop_product_id → shop_product.id)
│   └── order_event   (master_order_id → master_order.id)
│       └── fulfillment (fulfillment_id → fulfillment.id)  [optional]
└── message           (customer_id → customer.id)

shop
├── shop_address      (shop_id → shop.id)
│   └── address       (address_id → address.id)
├── shop_user         (shop_id → shop.id)  ← dashboard users, username is UNIQUE
├── shop_product      (shop_id → shop.id)
│   ├── catalog       (catalog_id → catalog.id)
│   └── offer         (shop_product_id → shop_product.id)
└── fulfillment       (shop_id → shop.id)

catalog
├── category          (category_id → category.id)
├── tag               (catalog_id → catalog.id)
└── shop_product      (catalog_id → catalog.id)

category
└── category          (parent_id → category.id)  [self-ref, hierarchical]
```

## Table-by-table relations

| Table | Column | References | Cardinality |
|---|---|---|---|
| **customer_address** | `customer_id` | `customer.id` | many → one |
| **customer_address** | `address_id` | `address.id` | many → one |
| **shop_address** | `shop_id` | `shop.id` | many → one |
| **shop_address** | `address_id` | `address.id` | many → one |
| **shop_user** | `shop_id` | `shop.id` | many → one |
| **category** | `parent_id` | `category.id` | many → one (self) |
| **catalog** | `category_id` | `category.id` | many → one |
| **tag** | `catalog_id` | `catalog.id` | many → one |
| **shop_product** | `shop_id` | `shop.id` | many → one |
| **shop_product** | `catalog_id` | `catalog.id` | many → one |
| **offer** | `shop_product_id` | `shop_product.id` | many → one |
| **cart** | `customer_id` | `customer.id` | many → one |
| **cart_item** | `cart_id` | `cart.id` | many → one |
| **cart_item** | `shop_product_id` | `shop_product.id` | many → one |
| **master_order** | `customer_id` | `customer.id` | many → one |
| **master_order** | `address_id` | `address.id` | many → one |
| **fulfillment** | `master_order_id` | `master_order.id` | many → one |
| **fulfillment** | `shop_id` | `shop.id` | many → one |
| **order_item** | `fulfillment_id` | `fulfillment.id` | many → one |
| **order_item** | `shop_product_id` | `shop_product.id` | many → one |
| **order_event** | `master_order_id` | `master_order.id` | many → one (nullable) |
| **order_event** | `fulfillment_id` | `fulfillment.id` | many → one (nullable) |
| **message** | `customer_id` | `customer.id` | many → one |

## Key join paths

**Retailer dashboard — identify the user and their shop:**
```
shop_user → shop (shop_id)
```
FE calls `POST /api/session` with `{ "username": "suresh" }`.
API returns the `shop_user` + `shop`. FE stores `shop.id` and sends `X-Shop-Id` header on every call.

**Retailer dashboard — list my fulfillments with customer info:**
```
fulfillment → master_order (master_order_id) → customer (customer_id)
                                              → address  (address_id)
```

**Retailer dashboard — fulfillment items with product names:**
```
order_item → shop_product (shop_product_id) → catalog (catalog_id)
```

**Retailer dashboard — my inventory:**
```
shop_product → catalog (catalog_id)
             → category (catalog.category_id)
```

**Agent — search products from nearby shops:**
```
tag → catalog (catalog_id) → shop_product (catalog_id) → shop (shop_id)
                                                        → shop_address → address (lat/lng)
```

**Agent — build cart:**
```
cart → cart_item → shop_product (specific shop's price + stock)
```

## Money

All monetary values are `DECIMAL(10,2)` in **rupees with paisa** (e.g., `320.00` = ₹320).

## Status values

**master_order.status:** `placed` | `accepted` | `in_progress` | `delivered` | `partially_delivered`
(derived from fulfillment statuses, updated by application code)

**fulfillment.status:** `accepted` → `packed` → `out_for_delivery` → `delivered`
(also `rejected` as a terminal state; transitions enforced in application code)

## No FK constraints — why

Foreign keys are intentionally omitted. Relations are enforced in application
queries. This keeps inserts fast, avoids cascading lock issues under concurrent
writes, and lets each service manage its own consistency guarantees. Every JOIN
path documented above is the application's responsibility to get right.
