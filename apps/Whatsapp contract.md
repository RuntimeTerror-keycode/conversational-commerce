# WhatsApp ↔ Backend API Contract

## 1. WhatsApp → Backend

### 1.1 Customer Ordering Request

Sent when a customer sends a product/order request through WhatsApp.

```json
{
  "messageId": "wamid.demo001",
  "customerRef": "919999999999",
  "text": "Is there 20 kilos rice available?",
  "source": "text",
  "timestamp": "1700000000",
  "address": {
    "addressLine": "",
    "latitude": 10.0159,
    "longitude": 76.3419
  },
  "paymentMode": "COD"
}
```

### Fields

| Field               | Type   | Required | Description                           |
| ------------------- | ------ | -------- | -------------------------------------- |
| `messageId`         | string | Yes      | Unique WhatsApp message ID            |
| `customerRef`       | string | Yes      | Customer identifier / WhatsApp number |
| `text`              | string | Yes      | Customer's request                    |
| `source`            | string | Yes      | Input source: `text`, `voice`         |
| `timestamp`         | string | Yes      | Message timestamp                     |
| `address`           | object | Yes      | Customer delivery location            |
| `address.addressLine` | string | No     | Human-readable address                |
| `address.latitude`  | float  | Yes      | Latitude                              |
| `address.longitude` | float  | Yes      | Longitude                             |
| `paymentMode`       | string | Yes      | `COD` or `GPAY`                       |

**Auth**: all endpoints below require an `X-Service-Token` header matching the shared `SERVICE_SHARED_SECRET`.

---

# 2. Backend → WhatsApp

## 2.1 Product Found

Sent when the backend can identify the requested product.

```json
{
  "customerRef": "919999999999",
  "orderId": 1,
  "tag": "found",
  "rows": [
    {
      "id": 22,
      "title": "Jaya rice 5kg",
      "price": "Rs 320"
    }
  ]
}
```

### Fields

| Field          | Type    | Required | Description         |
| -------------- | ------- | -------- | ------------------- |
| `customerRef`  | string  | Yes      | Customer identifier |
| `orderId`      | integer | Yes      | Current order ID (a lightweight session/draft handle, created on the customer's first message — not yet a placed order) |
| `tag`          | string  | Yes      | `found`             |
| `rows`         | array   | Yes      | Matching products   |
| `rows[].id`    | integer | Yes      | Product ID — the canonical catalog id (`catalog.id`), the same regardless of which shop fulfills it |
| `rows[].title` | string  | Yes      | Product name        |
| `rows[].price` | string  | Yes      | Display price       |

---

# 2.2 Product Uncertain / Customer Choice Required

Sent when the backend cannot confidently determine which product the customer wants.

```json
{
  "customerRef": "919999999999",
  "orderId": 1,
  "tag": "choice",
  "body": "Rice ind. Ethu venam?",
  "rows": [
    {
      "id": 22,
      "title": "Jaya rice 5kg",
      "description": "Jaya",
      "price": "Rs 320"
    },
    {
      "id": 23,
      "title": "Matta rice 5kg",
      "description": "Palakkadan",
      "price": "Rs 380"
    }
  ]
}
```

### Fields

| Field                | Type    | Required | Description                        |
| -------------------- | ------- | -------- | ---------------------------------- |
| `customerRef`        | string  | Yes      | Customer identifier                |
| `orderId`            | integer | Yes      | Current order ID                   |
| `tag`                | string  | Yes      | `choice`                           |
| `body`               | string  | Yes      | Message/question shown to customer |
| `rows`               | array   | Yes      | Available choices                  |
| `rows[].id`          | integer | Yes      | Product ID — canonical `catalog.id` |
| `rows[].title`       | string  | Yes      | Product name                       |
| `rows[].description` | string  | No       | Additional product information     |
| `rows[].price`       | string  | Yes      | Display price                      |

---

# 2.3 Product Not Found

Sent when no products match the customer's request at all.

```json
{
  "customerRef": "919999999999",
  "orderId": 1,
  "tag": "not_found",
  "body": "Sorry, we couldn't find that at Krishna Supermart."
}
```

### Fields

| Field         | Type    | Required | Description                |
| ------------- | ------- | -------- | -------------------------- |
| `customerRef` | string  | Yes      | Customer identifier        |
| `orderId`     | integer | Yes      | Current order ID           |
| `tag`         | string  | Yes      | `not_found`                |
| `body`        | string  | Yes      | Message shown to customer  |

---

# 3. WhatsApp → Backend

## 3.1 Customer Selects Product

Sent when the customer selects one of the products returned by the backend.

```json
{
  "customerRef": "919999999999",
  "orderId": 1,
  "productId": 22
}
```

### Fields

| Field         | Type    | Required | Description         |
| ------------- | ------- | -------- | -------------------- |
| `customerRef` | string  | Yes      | Customer identifier  |
| `orderId`     | integer | Yes      | Current order ID     |
| `productId`   | integer | Yes      | Selected product ID — canonical `catalog.id` |

---

# 3.2 Selection Result

Sent back in response to 3.1 — the customer's selection either gets added to their cart, or the item went out of stock in the time between search and selection.

```json
{
  "customerRef": "919999999999",
  "orderId": 1,
  "tag": "added",
  "cart": {
    "items": [
      { "lineId": "1", "productName": "Jaya Rice 5kg Bag", "quantity": 1, "unit": "kg", "price": 310 }
    ],
    "total": 310,
    "currency": "INR"
  }
}
```

```json
{
  "customerRef": "919999999999",
  "orderId": 1,
  "tag": "unavailable",
  "body": "That item just went out of stock at Krishna Supermart.",
  "substitutes": [
    { "id": 23, "name": "Palakkadan Matta Rice", "unit": "kg", "price": 365 }
  ]
}
```

### Fields

| Field         | Type    | Required | Description                          |
| ------------- | ------- | -------- | ------------------------------------- |
| `customerRef` | string  | Yes      | Customer identifier                   |
| `orderId`     | integer | Yes      | Current order ID                      |
| `tag`         | string  | Yes      | `added` or `unavailable`              |
| `cart`        | object  | If `added` | Updated cart (items, total, currency) |
| `body`        | string  | If `unavailable` | Message shown to customer       |
| `substitutes` | array   | If `unavailable` | Alternative products at this shop |

---

# Message Flow

```text
WhatsApp
   │
   │  Order Request
   ▼
Backend
   │
   ├── Product identified
   │       │
   │       ▼
   │    tag: "found"
   │
   └── Product uncertain
           │
           ▼
        tag: "choice"
           │
           ▼
       Customer selects
           │
           │ productId
           ▼
        Backend
```

## Standard Tags

| Tag           | Meaning                                        |
| ------------- | ----------------------------------------------- |
| `found`       | Backend identified/matched exactly one product  |
| `choice`      | Customer must select a product                  |
| `not_found`   | No products matched the request                 |
| `added`       | Selected product added to cart                  |
| `unavailable` | Selected product went out of stock              |

## Endpoints

| Method | Path                          | Implements |
| ------ | ------------------------------ | ---------- |
| POST   | `/api/whatsapp/orders/search`  | §1.1 → §2.1 / §2.2 / §2.3 |
| POST   | `/api/whatsapp/orders/select`  | §3.1 → §3.2 |

Both require header `X-Service-Token: <SERVICE_SHARED_SECRET>`.

