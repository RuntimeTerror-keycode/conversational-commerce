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
    "coords": {
      "lat": 10.0159,
      "long": 76.3419
    }
  },
  "paymentMode": "COD"
}
```

### Fields

| Field                 | Type   | Required | Description                           |
| --------------------- | ------ | -------- | ------------------------------------- |
| `messageId`           | string | Yes      | Unique WhatsApp message ID            |
| `customerRef`         | string | Yes      | Customer identifier / WhatsApp number |
| `text`                | string | Yes      | Customer's request                    |
| `source`              | string | Yes      | Input source: `text`, `voice`         |
| `timestamp`           | string | Yes      | Message timestamp                     |
| `address`             | object | Yes      | Customer delivery location            |
| `address.addressLine` | string | No       | Human-readable address                |
| `address.coords.lat`  | float  | Yes      | Latitude                              |
| `address.coords.long` | float  | Yes      | Longitude                             |
| `paymentMode`         | string | Yes      | `COD` or `GPAY`                       |

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
      "id": "p_101",
      "title": "Jaya rice 5kg",
      "price": "Rs 320"
    },
    {
      "id": "p_102",
      "title": "Matta rice 5kg",
      "price": "Rs 380"
    }
  ]
}
```

### Fields

| Field          | Type    | Required | Description         |
| -------------- | ------- | -------- | ------------------- |
| `customerRef`  | string  | Yes      | Customer identifier |
| `orderId`      | integer | Yes      | Current order ID    |
| `tag`          | string  | Yes      | `found`             |
| `rows`         | array   | Yes      | Matching products   |
| `rows[].id`    | string  | Yes      | Product ID          |
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
      "id": "p_101",
      "title": "Jaya rice 5kg",
      "description": "Matta",
      "price": "Rs 320"
    },
    {
      "id": "p_102",
      "title": "Matta rice 5kg",
      "description": "Red rice",
      "price": "Rs 320"
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
| `rows[].id`          | string  | Yes      | Product ID                         |
| `rows[].title`       | string  | Yes      | Product name                       |
| `rows[].description` | string  | No       | Additional product information     |
| `rows[].price`       | string  | Yes      | Display price                      |

---

# 3. WhatsApp → Backend

## 3.1 Customer Selects Product

Sent when the customer selects one of the products returned by the backend.

```json
{
  "customerRef": "919999999999",
  "orderId": 1,
  "productId": "p_101"
}
```

### Fields

| Field         | Type    | Required | Description         |
| ------------- | ------- | -------- | ------------------- |
| `customerRef` | string  | Yes      | Customer identifier |
| `orderId`     | integer | Yes      | Current order ID    |
| `productId`   | string  | Yes      | Selected product ID |

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

| Tag      | Meaning                             |
| -------- | ----------------------------------- |
| `found`  | Backend identified/matched products |
| `choice` | Customer must select a product      |

