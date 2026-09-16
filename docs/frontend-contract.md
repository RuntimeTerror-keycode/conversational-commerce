# Retailer dashboard — frontend architecture & proposed API contract

Status: **DRAFT FOR AGREEMENT.** Nothing here is built. Sections marked
`PROPOSED` require backend agreement before either side codes against them.

Scope: `apps/dashboard` — the shopkeeper-facing web portal. Owner: FE.
Counterpart: `apps/api` — dashboard REST. Owner: BE.

Legend used throughout:

| Tag | Meaning |
|---|---|
| **CONFIRMED** | Explicitly stated in `docs/spec.md`, `docs/contracts.md`, `CLAUDE.md`, or existing code |
| **INFERRED** | Strongly implied but never written down |
| **PROPOSED** | An FE/UX recommendation that needs BE agreement — not yet a requirement |
| **UNKNOWN** | Must be answered before implementation (see §10) |

---

## 1. What the product is

**CONFIRMED.** Customers in Kerala order groceries from a local retailer by
texting or sending voice notes on WhatsApp, in English, Malayalam, or Manglish
(Malayalam in Latin script), often mixed in one message. A Mastra agent
understands them, searches the retailer's catalogue, builds a cart in Postgres,
and places an order behind a code-enforced confirmation gate. The retailer sees
that order arrive in this dashboard and acts on it; the action pushes a WhatsApp
message back to the customer.

Three deploys plus this one:

| Service | Owns | Port |
|---|---|---|
| `apps/edge` (Python/FastAPI) | WhatsApp webhook, STT, outbound send | 8000 |
| `apps/agent` (TS/Mastra) | `POST /agent/turn`, tools, conversation | 4111 |
| `apps/api` (TS/Express) | **Dashboard REST — our counterpart** | 4000 |
| `apps/dashboard` (React) | **This document** | Vite default |

The dashboard never talks to `apps/agent` or `apps/edge`. It talks only to
`apps/api`. `apps/api` and `apps/agent` share `packages/domain` (not built yet),
which is where stock decrements and order transitions actually happen.

### Two kinds of retailer — **INFERRED from product owner, absent from all docs**

This distinction is not in `spec.md` or `contracts.md` and drives a large part
of the inventory UI:

- **`managed`** — the shop has no POS/inventory system of their own. Our
  platform *is* their inventory system. They add, edit, and restock products in
  this portal, and **we must decrement stock ourselves as orders move through
  their lifecycle.**
- **`external`** — the shop bills physically through their own system. We hold a
  **copy** that is refreshed by periodic sync. We must **not** decrement it —
  their own billing flow already does, and our sync picks that up. In the portal
  their catalogue is read-only apart from platform-level fields.

**Architectural position (PROPOSED):** the mode lives on the retailer record as
`inventoryMode`, and the *decision to decrement* belongs in `packages/domain`,
not in either caller. The frontend **reads** `inventoryMode` to decide what is
editable and what copy to show. **The frontend never sends a "decrement or not"
flag** — that would put business logic in the client and let the WhatsApp path
and the dashboard path disagree, which is exactly what `CLAUDE.md` rule 1
forbids.

---

## 2. Shopkeeper workflow

> **This section supersedes `docs/contracts.md` §C3 rules 2 and 5.** Product
> decision, 2026-09-15: **there is no accept or reject in the dashboard.**
> Orders are auto-accepted by the system, and an order becomes visible in this
> UI **only once it has been auto-accepted.** `contracts.md` still says
> "accept and reject must be one click each" and "a visible unaccepted count" —
> both are now obsolete and that file needs updating so the backend dev does not
> build to the old agreement. See Q-O9.

1. Shop opens for the day. Dashboard is left open on a counter screen or phone.
2. A customer orders over WhatsApp. The system auto-accepts. **The shopkeeper is
   not asked to decide anything.**
3. The order appears in the dashboard **already accepted**, as work to be done.
   It must still be impossible to miss — badge, sound, visual prominence — but
   the signal now means *"start packing"*, not *"decide"*.
4. Occasionally the shopkeeper adjusts a line — quantity down, or substitutes an
   out-of-stock item (`contracts.md` §C2 `PATCH /api/orders/:id/items/:lineId`,
   and the `substitution` notify reason).
5. They pack it, hand it to delivery, and it gets delivered — **advancing the
   status at each step from this UI** (confirmed 2026-09-15).
6. Between orders, they manage inventory: fix a price, restock, correct a count,
   or (managed mode) add a new product.

**The dominant state of this app is now step 3, repeated: fulfilment, not
triage.** That is a meaningfully different product from the one
`contracts.md` §C3 describes, and it makes the orders screen a **work queue**
rather than an inbox. `contracts.md` §C3 rule 4 still holds: *"Do not build
inventory editing until orders work."*

**One consequence worth deciding deliberately (Q-O11):** `spec.md` §6 frames
auto-accept as a *60-second fallback for a distracted retailer*. With no
retailer decision left to wait for, those 60 seconds are pure dead time between
the customer ordering and the shop seeing it. Auto-accept should almost
certainly now be **immediate**.

---

## 3. Proposed screens

```
/login                          Login
/                               → redirect to /orders
/orders                         Live Orders   ← the primary screen
/orders/:id                     Order detail (drawer over /orders, deep-linkable)
/inventory                      Inventory
/inventory/:id                  Product detail (drawer)
/settings                       Shop profile, hours, auto-accept, sync status
```

### 3.1 No separate "Dashboard" home — **PROPOSED**

The brief asks for a dashboard/home page. My recommendation is **not** to build a
separate stats landing page, and instead make **Live Orders the home screen**
with a compact KPI strip pinned above it.

Reasoning: `contracts.md` §C3 rule 5 says the unaccepted-count badge is what the
judges look at. A home screen that a shopkeeper has to click *past* to reach the
thing they actually need adds a click to the highest-frequency action in the
product and hides the badge behind a route change. A revenue chart on a
36-hour hackathon build is a screen nobody in the demo will look at.

The KPI strip carries: **Needs action · Active · Completed today · Revenue today
· Low stock**. Each tile is a filter link into Orders or Inventory, so the strip
is navigation, not decoration. If you want a standalone home page anyway, say so
in §10 Q-D1 and it is a small addition.

### 3.2 Live Orders (`/orders`)

Orders auto-accept, so this screen is a **fulfilment work queue**, not a
decision inbox. Layout: a single list, **newest first**, with tabs that are
really status filters:

```
[ New (3) ] [ In progress ] [ Completed ] [ All ]
```

| Tab | Statuses | Meaning |
|---|---|---|
| **New** | `accepted` | Arrived, nothing done yet. **Default tab.** Its count is the badge in the sidebar and the browser tab title |
| In progress | `packed`, `out_for_delivery` | Being worked |
| Completed | `delivered` | Done |
| All | all visible | Includes `rejected` if any ever exist (see Q-O12) |

`New` replaces the old "Needs action" tab. The badge survives the product change
— it just counts *work waiting* instead of *decisions waiting*, which keeps the
spirit of `contracts.md` §C3 rule 5 even though its letter no longer applies.

Each row shows, left to right:
`#1042` · time ago · customer · 4 items · ₹745 · status badge · **[next action]**

- **No Accept or Reject controls anywhere.** The order is already accepted
  before the shopkeeper ever sees it.
- No auto-accept countdown bar — by the time a row exists, auto-accept has
  already happened.
- The row's trailing action is the single next fulfilment step
  (`accepted` → **Mark packed**), one click, optimistic with rollback.
- Row opens the detail drawer on click.
- New rows animate in and fire a short sound (mutable, persisted per browser).
  Still worth having — a missed order is a missed order whether or not a
  decision was required.

**The one thing that must be visible without opening the order:** the customer's
original phrasing. `contracts.md` §C3 rule 3 — *"'2 kg ari' next to 'Rice 2kg' is
the single best proof the AI did something."* The list row shows the first
line's `sourceText`; the detail shows it on every line.

### 3.3 Order detail (`/orders/:id`, right-hand drawer)

- Header: order code, status badge, placed-at, total, contextual primary action.
- **Lifecycle stepper** (see §4).
- Line items table: product name, **`sourceText` in muted type directly beneath
  it**, qty × unit price, line total, substitution marker if any, per-line
  overflow menu (adjust qty / substitute / remove).
- Customer block: display name (if any), phone, delivery address or pickup, note.
- Payment block: method and status.
- **Activity feed**: timestamped events with actor (customer / retailer /
  system / agent), including "auto-accepted by system" so nobody is confused
  when the 60s fallback fires.

### 3.4 Inventory (`/inventory`)

The screen has **two variants driven by `retailer.inventoryMode`**:

| | `managed` | `external` |
|---|---|---|
| Add / edit / delete product | Yes | No — read-only |
| Edit price | Yes | No (comes from their system) |
| Edit stock count | Yes — part of editing the product | No |
| Mark in stock / out of stock | Yes | No |
| Edit search aliases | Yes | Yes *(pending Q-I4)* |
| Header banner | "You manage this inventory here." | "Synced from <system> · last synced 4m ago · [Sync now]" |

Table columns (managed): Product · SKU · Category · Unit/pack · Price ·
**Stock** · Status · Updated.
External mode drops Stock, keeps In stock / Out of stock, and adds Last synced.

Controls: search (debounced 300ms, server-side `q`), category filter, stock-state
filter (All / In stock / Low / Out), sort, pagination. A **Low stock** chip
filter, since that is the actionable slice.

Managed mode: add/edit/delete through the product drawer, where **stock count is
an ordinary field alongside price, name, and category** — not a separate
mechanism. Price and stock also support quick inline edit in the row, since
those are the two fields a shopkeeper touches daily.

#### 3.4.1 How stock counts stay current — **needs BE confirmation (Q-I1)**

Two independent things keep a managed shop's count right, and the split matters
because only one of them is our code:

1. **We decrement automatically after each order.** Order for 2 bags of rice →
   `stockQuantity` drops by 2. This is the behaviour from the original brief and
   it lives in `packages/domain`, triggered by the order transition — never in
   the frontend, never in `apps/api`'s route layer (`CLAUDE.md` rule 1).
2. **The shopkeeper edits the product** when anything else changes it — a
   supplier delivery, a counter sale, a stock-take. This is just the normal
   edit-product flow they already have as managed users. No special UI.

**External mode does neither.** We do not decrement, because their own billing
system already recorded the sale, and our periodic sync overwrites whatever we
hold. Their products are read-only here.

The one thing BE needs to pin down for us is **when** the decrement fires, since
the FE displays the result: at `accepted` (effectively order time, given
auto-accept) is the obvious answer. With no reject and no cancel in the product,
there is no release path and therefore **no need for `reserved` / `available`
columns** — a single count is enough. See Q-I1.

**Per `contracts.md` §C3 rule 4, this whole screen ships after orders work.**
The read-only list can ship early; editing comes last.

### 3.5 Settings (`/settings`)

Shop name, area, WhatsApp number (read-only), `inventoryMode` (read-only —
support changes it), auto-accept window, default low-stock threshold,
**Shop open / closed** toggle *(PROPOSED — see Q-S2; named `shopOpen`, not
`acceptingOrders`, to avoid confusion with the removed per-order accept)*,
sync status and history for external mode, logout.

---

## 4. Order lifecycle

### 4.1 The actual state machine — **CONFIRMED**

Verbatim from `packages/contracts/src/index.ts` and `spec.md` §6. This enum is
already shared with the edge and the agent; the FE imports it rather than
restating it.

```
draft ──> placed ──> accepted ──> packed ──> out_for_delivery ──> delivered
                │
                └──> rejected
```

**Two of these seven states are invisible to the dashboard.** Per the product
decision in §2, an order becomes visible **only once it has been auto-accepted**,
so `GET /api/orders` excludes both `draft` and `placed` by default:

| Status | Visible in dashboard? | Notes |
|---|---|---|
| `draft` | **No** | Cart under construction over WhatsApp — pre-order state |
| `placed` | **No** | Exists only in the window before auto-accept fires. If auto-accept becomes immediate (Q-O11), this state is effectively instantaneous |
| `accepted` | **Yes — entry point** | This is where an order *appears*. Reached by the system, never by a human |
| `packed` | Yes | |
| `out_for_delivery` | Yes | |
| `delivered` | Yes | Terminal success |
| `rejected` | Yes, if reachable | **Nothing in the product can produce it today** — see Q-O12 |

`accepted`, `rejected`, and `out_for_delivery` each push `POST /notify` to the
edge, which messages the customer (`contracts.md` §A2). **The FE does nothing
extra to make this happen.** Note that the `accepted` notify now fires from
auto-accept with no dashboard involvement at all.

**There is no `cancelled`, `failed`, `returned`, or `refunded` state anywhere in
this codebase.** See Q-O3 before the UI implies one exists.

### 4.2 How the UI represents it — **PROPOSED**

**Badges** (list and detail):

| Status | Treatment |
|---|---|
| `accepted` | Amber, **"New"**, subtle pulse — this is the attention state now |
| `packed` | Indigo, "Packed" |
| `out_for_delivery` | Violet, "Out for delivery" |
| `delivered` | Green, solid fill, "Delivered" |
| `rejected` | Red outline, "Rejected" — rendered defensively; nothing produces it today |

Amber moved from `placed` to `accepted`. The colour still means *"this is the
one that needs you"*; only the underlying status changed.

**Stepper** (detail): a horizontal 5-node stepper — Placed → Accepted → Packed →
Out for delivery → Delivered. `placed` and `accepted` will almost always carry
near-identical timestamps (auto-accept), so the stepper renders **Accepted** as
the first meaningful node and labels it *"Auto-accepted"* rather than implying a
person did it. A rejected order, if one ever exists, replaces the stepper from
node 2 onward with a single red terminal node.

**Activity feed** (detail): reverse-chronological timestamped events with actor
attribution. This is where auto-accept, substitutions, and quantity edits show
up. Requires `events[]` on the order detail response — see Q-O6. With
accept/reject gone, this feed is now the **main way the shopkeeper understands
that a decision was made for them** — "Auto-accepted by system" needs to be
legible, not buried.

**Contextual primary action** — **CONFIRMED 2026-09-15: the shopkeeper does
change status.** One button, always the single next step:

| Current | Button |
|---|---|
| `accepted` | **Mark packed** |
| `packed` | **Out for delivery** |
| `out_for_delivery` | **Mark delivered** |
| `delivered`, `rejected` | none — terminal |

So the split is clean: **the system owns the front of the lifecycle
(`placed → accepted`, automatic), the shopkeeper owns the back
(`accepted → packed → out_for_delivery → delivered`, manual).** The dashboard
never touches the first transition and always drives the rest.

---

## 5. Frontend architecture — **PROPOSED**

| Concern | Choice | Why |
|---|---|---|
| Build | **Vite + React + TypeScript** | `Makefile`/`pnpm-workspace.yaml` already expect `pnpm --filter dashboard dev`; Vite is the assumed fit |
| Types | **`@cc/contracts` as `workspace:*`** | Import `OrderStatus`, `CartLine`, and new order/product schemas instead of redeclaring. A contract change then breaks the FE build — which is the point |
| Server state | **TanStack Query**, `refetchInterval: 3000` on the orders list | `contracts.md` §C3 rule 1 mandates 3s polling and forbids websockets. Query gives dedup, background refetch, and optimistic mutate/rollback for one-click accept for free |
| Client state | **None** — URL params + Query cache | Filters and the open drawer belong in the URL so the page is shareable and refresh-safe |
| Routing | React Router | Drawer routes over the list |
| Styling | **Tailwind + ~12 hand-rolled primitives** | Button, Input, Select, Table, Card, Badge, Drawer, Tabs, Toast, EmptyState, Skeleton, Countdown. Fewer dependencies than a component library, and the surface here is small. See Q-U1 if you'd rather use shadcn/ui |
| Forms | react-hook-form + zod resolver, reusing contract schemas | Only inventory needs real forms |
| Icons | lucide-react | |
| Auth | Session bootstrapped via `GET /api/auth/me` on load; route guard; global 401 interceptor → `/login` | See Q-A1 |
| Mocks | One fixture module behind `VITE_USE_FIXTURES=true` | Lets FE build against the contract before `apps/api` exists, and doubles as a demo safety net. Not MSW — a plain adapter is enough |

**Folder layout** (matching the repo's existing flat, explicit style):

```
apps/dashboard/src/
├── main.tsx
├── app/            router, providers, route guard
├── api/            typed fetch client, one file per resource, query keys
├── components/ui/  the primitives
├── features/
│   ├── auth/
│   ├── orders/     OrderList, OrderRow, OrderDrawer, LifecycleStepper, StatusBadge
│   ├── inventory/  InventoryTable, ProductDrawer, StockCell, SyncBanner
│   └── stats/      KpiStrip
├── lib/            formatting (₹, relative time), sound, constants
└── fixtures/
```

**Design system (PROPOSED).** Desktop-first, responsive down to a phone — a
shopkeeper checking orders while away from the counter is a real case. Neutral
slate greys, a single brand accent, and **status colour used only for status**
so that amber always means "needs action" and never decoration. System font
stack (Malayalam product names must render — no webfont that lacks the
Malayalam block). Base 14px, 4px spacing scale, WCAG AA contrast, visible focus
rings, full keyboard operation of the accept/reject path, `aria-live` on the
new-order region. Every list has explicit **empty**, **loading (skeleton, not
spinner)**, **error (with retry)**, and **stale/offline** states — the last one
matters because a 3s poll on conference wifi *will* fail and the screen must say
"reconnecting", not silently show stale orders as if they were live.

---

## 6. Data the frontend needs

Grouped by screen, independent of endpoint shape.

**Session:** logged-in user (id, name, role), their retailer (id, name, area,
`inventoryMode`, currency, timezone, auto-accept window, sync status).

**Orders list:** id, human-readable code, status, placed-at, customer display
name + ref, item count, total, first line's `sourceText`, `updatedAt`; plus
**status counts across the whole result set, not just the current page** (the
badge must not lie when there are 30 orders and a page size of 20).
No `autoAcceptAt` — there is no countdown to render.

**Order detail:** everything above plus every line (product id, name,
`sourceText`, quantity, unit, unit price, line total, substitution origin,
availability), customer phone and address, delivery mode/note/ETA, payment
method and status, all lifecycle timestamps, rejection reason, event feed,
`traceId`.

**Inventory:** id, SKU, name, brand, category, unit, pack size, price,
in-stock boolean, stock count and low-stock threshold (managed only), aliases,
updated-at, synced-at.

**KPI strip:** new-orders count, active count, completed-today count,
revenue-today, low-stock count, out-of-stock count.

---

## 7. Proposed API contract

Base URL `${VITE_API_BASE_URL}` → `http://localhost:4000/api` in dev.
The `/api` prefix is **CONFIRMED** — `contracts.md` §C2 lists `/api/orders`, and
the `feat/be-boiler-plate` branch mounts routes at `/api` in
`RouteRegistrar.register()`.

All money is **integer paise or decimal rupees — see Q-X1.** All timestamps are
ISO 8601 UTC strings. All list endpoints are 1-indexed on `page`.

### 7.0 Conventions

**Error envelope — PROPOSED (extends the existing shape).**
`feat/be-boiler-plate`'s `ErrorHandler` already returns
`{ status: 'error', message, stack? }`. Proposal: keep it and add a stable
machine-readable `code`, because the FE must distinguish an expired session from
a validation failure without string-matching `message`.

```jsonc
{
  "status": "error",
  "code": "unauthorized",       // stable, machine-readable
  "message": "Session expired",  // human, may change freely
  "details": { }                 // optional, field-level for 422
}
```

| HTTP | `code` | FE behaviour |
|---|---|---|
| 400 | `bad_request` | Toast |
| 401 | `unauthorized` | Clear session, redirect `/login` |
| 403 | `forbidden` | "Not your shop" screen — never a redirect loop |
| 404 | `not_found` | Empty state on detail routes |
| 409 | `conflict` | **Invalid status transition or concurrent edit** — refetch and show current state |
| 422 | `validation_failed` | Field errors from `details` |
| 429 | `rate_limited` | Back off polling |
| 500 | `internal_error` | Toast + retry |

**409 matters more than it looks.** Two devices open on the counter both
clicking Accept, or a shopkeeper clicking Accept the instant auto-accept fires,
must not produce a 500. Proposal: return **409 with the current order in
`details.order`** so the FE can silently reconcile.

**Success envelope — PROPOSED, and it conflicts with an agreed contract.**
`contracts.md` §C2 specifies `GET /api/orders → Order[]`, a bare array. A bare
array cannot carry pagination or the cross-page status counts the badge needs.
Proposing an envelope for **list** endpoints only; single-resource endpoints stay
bare. **This is a change to §C2 and needs BE sign-off (Q-X2).**

---

### 7.1 Authentication — **ENTIRELY PROPOSED**

> **Nothing in this repository defines user authentication.** The only auth that
> exists is the service-to-service `X-Service-Token` shared secret between edge
> and agent (`contracts.md` §A), which `contracts.md` §A2 explicitly says must
> stay **out of the frontend**. Shopkeeper login, sessions, and authorization
> are an unfilled gap, not an undocumented decision. Everything below is a
> proposal. See Q-A1–Q-A5.

```
POST /api/auth/login
Body:     { "identifier": "9847012345", "password": "..." }
Response: 200 { "user": {...}, "retailer": {...} }
          Sets httpOnly, SameSite=Lax session cookie
Errors:   401 invalid_credentials · 422 validation_failed · 429 rate_limited
```

```
POST /api/auth/logout      → 204, clears cookie
```

```
GET /api/auth/me           → 200 { user, retailer }   // session bootstrap on app load
                           → 401 unauthorized
```

```jsonc
// user
{ "id": "usr_...", "name": "Rajesh", "role": "owner", "retailerId": "ret_..." }

// retailer
{
  "id": "ret_...", "name": "Demo Store", "area": "Kochi",
  "whatsappNumber": "+91...", "currency": "INR", "timezone": "Asia/Kolkata",
  "inventoryMode": "managed" | "external",      // drives the inventory UI
  "shopOpen": true,                              // PROPOSED, see Q-S2
  "autoAcceptSeconds": 60,                       // spec.md §6
  "lowStockThresholdDefault": 5,
  "sync": {                                      // external mode only
    "provider": "vyapar",
    "lastSyncedAt": "2026-09-15T09:12:00Z",
    "status": "ok" | "stale" | "failed",
    "nextSyncAt": "2026-09-15T09:27:00Z"
  }
}
```

**`retailerId` is never sent by the frontend.** It is derived from the session
server-side. This is `CLAUDE.md` rule 4 applied to the HTTP boundary: scoping is
enforced inside, not by the caller. A client-supplied `retailerId` would be a
tenancy hole.

---

### 7.2 Orders

#### `GET /api/orders` — **partly CONFIRMED** (§C2), envelope PROPOSED

```
Query:
  status     OrderStatus | comma-list | "new" | "in_progress"
             default: all except draft AND placed  (see §4.1 — neither is ever shown)
  since      ISO 8601 — orders with updatedAt > since     (§C2, CONFIRMED)
  q          free text — order code, customer name/phone, product name   PROPOSED
  dateFrom   ISO 8601                                     PROPOSED
  dateTo     ISO 8601                                     PROPOSED
  page       default 1                                    PROPOSED
  limit      default 20, max 100                          PROPOSED
  sort       placedAt:desc (default) | placedAt:asc | total:desc   PROPOSED
```

```jsonc
// 200 — PROPOSED envelope
{
  "data": [ /* OrderSummary[] */ ],
  "page": { "page": 1, "limit": 20, "total": 37, "hasMore": true },
  "counts": {                 // across ALL matching orders, ignoring pagination
    "accepted": 3, "packed": 1, "out_for_delivery": 1,
    "delivered": 28, "rejected": 0
  },                          // `counts.accepted` is the sidebar/tab-title badge
  "serverTime": "2026-09-15T09:30:00Z"   // so the FE can pass it back as `since`
}
```

```jsonc
// OrderSummary
{
  "id": "ord_01H...",
  "orderCode": "#1042",                  // short, human, sayable out loud
  "status": "accepted",                  // never "draft" or "placed" — see §4.1
  "customer": { "ref": "919847012345", "displayName": "Rajesh" },
  "itemCount": 4,
  "firstLineSourceText": "2 kg ari",     // §C3 rule 3, visible without opening
  "total": 745,
  "currency": "INR",
  "placedAt": "2026-09-15T09:28:11Z",
  "acceptedAt": "2026-09-15T09:28:11Z",  // when it became visible here
  "updatedAt": "2026-09-15T09:28:11Z"
}
```

Errors: 401 · 403 · 422 (bad filter) · 500.

**Polling contract (PROPOSED, needs agreement — Q-O7):** the FE polls every 3s.
Open question is whether `since` returns a *delta* (cheap, but the FE must merge
and can drift) or the *full current page* (simple, correct, slightly heavier).
**Recommendation: full page, ignore `since` for correctness, and use
`counts` + `serverTime` for the badge.** At demo scale the payload is trivial
and delta-merge bugs on stage are not. Keep `since` in the contract for later.

#### `GET /api/orders/:id` — **CONFIRMED** (§C2), body PROPOSED

```jsonc
// 200 — Order (full)
{
  "id": "ord_01H...",
  "orderCode": "#1042",
  "status": "accepted",
  "customer": {
    "ref": "919847012345",
    "displayName": "Rajesh",
    "phone": "+919847012345"        // see Q-C1 — same value as ref today
  },
  "items": [
    {
      "lineId": "ln_01",
      "productId": "p_101",
      "productName": "Jaya rice 5kg",
      "sourceText": "2 kg ari",      // §C3 rule 3 — REQUIRED, not optional, in the UI
      "quantity": 2,
      "unit": "5kg",
      "unitPrice": 320,
      "lineTotal": 640,
      "availability": "in_stock",
      "substitutedFor": null          // or { productId, productName }
    }
  ],
  "subtotal": 745, "deliveryFee": 0, "total": 745, "currency": "INR",
  "delivery": {
    "mode": "delivery",               // or "pickup" — see Q-O4
    "address": "...", "note": "no onions", "etaMinutes": 45
  },
  "payment": { "method": "cod", "status": "pending" },   // see Q-O5
  "timeline": {
    "placedAt": "...", "acceptedAt": null, "packedAt": null,
    "outForDeliveryAt": null, "deliveredAt": null, "rejectedAt": null
  },
  "rejectionReason": null,          // no UI can set this — see Q-O12
  "events": [                          // see Q-O6
    { "at": "...", "type": "placed", "actor": "customer" },
    { "at": "...", "type": "accepted", "actor": "system", "note": "auto-accepted" }
  ],
  "traceId": "trc_01H...",
  "updatedAt": "..."
}
```

Errors: 401 · 403 (another shop's order) · 404 · 500.

#### `PATCH /api/orders/:id` — **CONFIRMED** (§C2)

> **Scope reduced by the product decision in §2.** The dashboard **never sends
> `accepted` or `rejected`** — accept is automatic and reject does not exist.
> This endpoint serves fulfilment transitions only. **Confirmed 2026-09-15: it
> is needed.**

```
Body:     { "status": "packed" | "out_for_delivery" | "delivered" }
Response: 200 — full Order
Errors:   401 · 403 · 404
          409 conflict — illegal transition or already advanced;
              returns details.order with the current state
          422 validation_failed — includes attempts to send "accepted"/"rejected"
```

`out_for_delivery` emits `POST /notify` to the edge and messages the customer
(`spec.md` §6, `contracts.md` §A2); the FE takes no further action.
*Ownership of that notify call is an open question in `CLAUDE.md` between
`apps/api` and `apps/agent` — it does not change the FE contract, but it must be
resolved before the demo path works (Q-X3). Note this is now more urgent, not
less: with the dashboard out of the accept path, the `order_accepted` notify
fires from auto-accept, so **whoever owns auto-accept owns the demo's best
moment.***

#### `PATCH /api/orders/:id/items/:lineId` — **CONFIRMED** (§C2), body PROPOSED

```
Body (one of):
  { "quantity": 1 }
  { "substituteProductId": "p_602" }
  { "remove": true }
Response: 200 — full Order (recalculated totals)
Errors:   401 · 403 · 404 · 409 (order no longer editable) · 422
```

**Returns the whole order, not the line** — same reasoning as `mutateCart`
returning the full cart (`CLAUDE.md` rule 2): partial responses let the two
views drift. See Q-O8 for which statuses still allow line edits, and whether a
substitution triggers the `substitution` notify.

---

### 7.3 Inventory

#### `GET /api/inventory` — **partly CONFIRMED** (§C2 defines `?q=`)

```
Query:
  q           free text (name, SKU, brand, alias)     CONFIRMED
  category    string                                   PROPOSED
  stockState  all | in_stock | low | out               PROPOSED
  page, limit, sort (name:asc | price:asc | stockQuantity:asc | updatedAt:desc)   PROPOSED
```

```jsonc
// 200 — PROPOSED envelope
{
  "data": [ /* Product[] */ ],
  "page": { "page": 1, "limit": 50, "total": 218, "hasMore": true },
  "counts": { "total": 218, "inStock": 190, "low": 12, "out": 16 },
  "categories": ["Rice & grains", "Spices", "Dairy"]   // for the filter, saves a call
}
```

```jsonc
// Product — PROPOSED
{
  "id": "p_101",
  "sku": "RIC-JAY-5",
  "name": "Jaya rice 5kg",
  "brand": null,
  "category": "Rice & grains",
  "unit": "5kg",
  "price": 320,
  "currency": "INR",
  "inStock": true,                // present in BOTH modes — the signal the agent grounds on
  "stockQuantity": 24,            // managed only; null in external mode
  "lowStockThreshold": 5,         // managed only
  "isLow": false,                 // derived server-side so the FE never guesses
  "aliases": ["ari", "jaya"],     // see Q-I4
  "updatedAt": "...",
  "syncedAt": null                // external mode only
}
```

> **Contract conflict to resolve.** `contracts.md` §C2 specifies
> `PATCH /api/inventory/:id { inStock, price }` — a *boolean* stock flag only.
> That is enough for external mode, but **managed mode needs a number**, because
> we decrement it after every order. The shape above keeps `inStock` as the
> universal signal the agent grounds on and adds `stockQuantity` as
> managed-only. `reserved` / `available` are deliberately **not** included —
> see §3.4.1. BE needs to agree (Q-I1).

#### `PATCH /api/inventory/:id` — **partly CONFIRMED** (§C2)

```
Body (any subset):
  { "price": 340, "inStock": false, "stockQuantity": 47,
    "name": "...", "category": "...", "lowStockThreshold": 3, "aliases": [...] }

`stockQuantity` is an ordinary field on this endpoint — there is no separate
stock-mutation endpoint. Sending it on an external-mode product is a 409.
Response: 200 — Product
Errors:   401 · 403
          409 read_only_inventory — external mode rejects price/stock/name edits
          404 · 422
```

#### Managed-mode-only endpoints — **PROPOSED**

```
POST   /api/inventory                  { name, sku?, category?, unit, price, inStock, stockQuantity } → 201 Product
DELETE /api/inventory/:id              → 204   (soft archive — see Q-I5)
POST   /api/inventory/bulk             { products: [...] }  → 200  (CSV onboarding, see Q-I6)
```

All return `409 read_only_inventory` when `retailer.inventoryMode === "external"`.
**The server enforces this**, not the client. The client merely hides the
controls — it is not the security boundary.

#### External-mode-only — **PROPOSED**

```
POST /api/inventory/sync    → 202 { "startedAt": "...", "status": "running" }
GET  /api/inventory/sync    → 200 { "lastSyncedAt", "status", "itemsUpdated", "error"? }
```

---

### 7.4 Dashboard KPIs — **PROPOSED**

```
GET /api/stats/summary?range=today | 7d | 30d

200 {
  "range": "today",
  "newOrders": 3,              // status = accepted, untouched
  "activeOrders": 4,           // packed + out_for_delivery
  "completedToday": 28,
  "revenue": 20450, "currency": "INR",
  "lowStockCount": 12,
  "outOfStockCount": 16
}
```

Polled at 15s, not 3s. If this endpoint is a problem to build, **the KPI strip can
be derived entirely from the `counts` block on `GET /api/orders` plus
`GET /api/inventory`** — everything except revenue. Say so and we will drop it.

### 7.5 Shop settings — **PROPOSED**

```
PATCH /api/retailer
Body:     { "name"?, "area"?, "shopOpen"?, "autoAcceptSeconds"?, "lowStockThresholdDefault"? }
Response: 200 — retailer object
Errors:   401 · 403 (role, if roles exist) · 422
```

---

## 8. Facts vs assumptions — summary

### CONFIRMED
- Three-service split; dashboard talks only to `apps/api`; `/api` prefix; port 4000.
- Order status enum: `draft | placed | accepted | rejected | packed | out_for_delivery | delivered`.
- Endpoint set in §C2: orders list/detail/PATCH, order-line PATCH, inventory list/PATCH.
- **Poll every 3s, no websockets** (§C3 rule 1).
- **`sourceText` must be shown on order lines** (§C3 rule 3); BE supplies it.
- **Inventory editing ships after orders work** (§C3 rule 4).
- Accept/reject/out-for-delivery push `/notify` → WhatsApp (§A2, `spec.md` §6).
- **The shopkeeper advances `accepted → packed → out_for_delivery → delivered`
  from this UI; the system owns `placed → accepted`** (product decision,
  2026-09-15).
- **`apps/api` follows the `feat/be-boiler-plate` conventions** — settled by the
  `Makefile` change of 2026-09-15 (`cd apps/api && npx env-cmd npm run dev`).
  Q-X4 is answered.

### SUPERSEDED — was confirmed, now overridden by product decision (2026-09-15)
- ~~Accept and reject are one click, no confirmation modal~~ (§C3 rule 2).
  **There is no accept or reject in the dashboard at all.**
- ~~Orders newest-first with a visible *unaccepted* count~~ (§C3 rule 5).
  Newest-first stands; the badge now counts new **accepted** orders, because the
  dashboard never sees an unaccepted one.
- ~~Auto-accept as a 60s fallback for an inattentive retailer~~ (`spec.md` §6).
  **Auto-accept is now the only path**, not a fallback. See Q-O11 on whether the
  60 seconds should survive.

`docs/contracts.md` §C3 and `docs/spec.md` §6 both need editing to match. I have
not touched them — §C3 is a written agreement with the AI-service dev, and
rewriting someone else's agreement unilaterally is their call, not mine. Say the
word and I will.
- `CartLine`: `lineId, productName, sourceText?, quantity, unit, price`.
- Product fields the agent already sees: `id, name, brand?, unit, price, inStock`.
- Retailer fields: `retailerId, name, area`.
- Currency INR; Kerala; English/Malayalam/Manglish product names must render.
- `traceId` threads through everything and should be surfaced for debugging.
- API house style (`feat/be-boiler-plate`): class-based, kebab-case files, named
  exports, no `any`, `{ status, message }` error body, routes at `/api`.

### INFERRED
- `draft` and `placed` orders are never shown in the dashboard; `accepted` is
  the entry point.
- One shopkeeper account maps to exactly one retailer.
- The shopkeeper drives `packed → out_for_delivery → delivered` from this UI —
  nothing else in the system could.
- Customer identity is a phone number (`customerRef` = `wa_id`); there is no
  customer name field anywhere yet.
- Two inventory modes (from the product owner, absent from all docs).

### PROPOSED (needs BE agreement)
- Every auth endpoint and the session mechanism.
- The entire `Order` / `OrderLine` / `OrderEvent` / `Product` response shapes —
  **no `Order` type exists in `packages/contracts` today**.
- List envelope with `page` + `counts`, replacing §C2's bare `Order[]`.
- `code` on the error envelope; 409 semantics with `details.order`.
- `stockQuantity` / `lowStockThreshold` / `isLow` alongside §C2's boolean
  `inStock`, managed mode only.
- Managed-mode CRUD, bulk, and external-mode sync endpoints.
- `GET /api/stats/summary`.
- `orderCode`, `events[]`, `aliases`.

### UNKNOWN — blocking
Authentication (all of it) · the `Order` shape · payment · delivery vs pickup ·
whether cancellation exists · money units · who owns `/notify` and therefore
auto-accept. See §10.

---

## 9. Known conflicts in the existing documentation

Flagging these because they will bite whoever reads the docs next, not because
the FE cannot proceed.

0. **`contracts.md` §C3 rules 2 and 5 and `spec.md` §6 are now wrong.** The
   product decision of 2026-09-15 removes accept/reject from the dashboard and
   makes auto-accept the only path. Both documents still describe the old flow.
   **This is the most urgent doc fix in the repo** — a backend dev reading §C3
   today will build an accept/reject endpoint nobody will call.

1. **`spec.md` §2 is stale.** It shows dashboard REST living at
   `ai-service/src/api/dashboard/orders.ts` inside a single service. `CLAUDE.md`
   and the current tree put it in `apps/api`, a separate deploy. §C2's endpoints
   are `apps/api`'s.
2. **`/notify` ownership is unresolved** — flagged as an open question in
   `CLAUDE.md`. `spec.md` §6 gives it to the order state machine; order mutation
   now lives in `apps/api`. Does not change the FE contract; does decide whether
   the demo's best moment works.
3. ~~**Two incompatible `apps/api` branches.**~~ **Resolved 2026-09-15** by the
   `Makefile` change: `apps/api` now runs `npx env-cmd npm run dev`, which is
   `feat/be-boiler-plate`'s toolchain (npm, env-cmd, CommonJS, Express 5, class
   architecture, `/api` prefix). This contract is written against those
   conventions. Note `apps/api` is consequently **outside the pnpm workspace's
   dependency graph in practice**, so `apps/dashboard` importing `@cc/contracts`
   via `workspace:*` (§5) still works, but `apps/api` would need its own path to
   those shared types — relevant to Q-X5.
4. **§C2's `inStock` boolean cannot serve managed inventory** (see §7.3). It
   needs a number to decrement after each order.
5. **§C2's bare `Order[]` cannot carry the badge count** §C3 rule 5 demands
   once there is more than one page.
6. **`sessionHint` is documented in §A1 but absent from the actual
   `AgentTurnRequest` schema** — noted in `feat/mastra-shopping-agent`'s
   `agent-turn.ts`. Not an FE concern, but it means the docs and the contracts
   package have already drifted once.

---

## 10. Questions — grouped and prioritised

### P0 — blocking; cannot start without these

**O-flow. The auto-accept-only model** *(product decision 2026-09-15)*
- ~~**Q-O10**~~ **ANSWERED 2026-09-15:** the order view is *not* read-only. The
  shopkeeper advances `accepted → packed → out_for_delivery → delivered` from
  this UI. `PATCH /api/orders/:id` stays, minus `accepted`/`rejected`.
- **Q-O11** **Does auto-accept still wait ~60 seconds?** `spec.md` §6 framed it
  as a fallback for a distracted retailer. With no retailer decision to wait
  for, that minute is pure dead time between the customer ordering and the shop
  seeing the order. **Recommend: immediate.** If it stays at 60s, the dashboard
  is structurally a minute behind reality and I should say so in the UI.
- **Q-O12** **Can `rejected` occur at all any more?** Nothing in the product can
  produce it now. Three options: (a) keep it in the enum and render it
  defensively in case a backend path or a future feature emits it — my default;
  (b) it is genuinely dead, and I drop the badge and the tab; (c) reject is
  coming back later, in which case tell me now so the layout leaves room.
- **Q-O13** Who or what performs auto-accept — `apps/api`, `apps/agent`, or a
  timer somewhere else? It now owns the `order_accepted` notify, which is the
  demo's best moment. Ties into Q-X3, and matters more than it did.
- **Q-O9** Shall I update `docs/contracts.md` §C3 and `docs/spec.md` §6 to match
  this decision? §C3 is a written agreement with the AI-service dev, so I have
  not edited it. As it stands, a backend dev reading it will build an
  accept/reject endpoint nobody calls.

**A. Authentication** *(nothing exists in the repo)*
- **Q-A1** Session mechanism: httpOnly cookie (my recommendation — least FE code,
  no token storage question) or bearer JWT in memory/localStorage? Cookies need
  CORS `credentials: include` + an origin allowlist on `apps/api`.
- **Q-A2** Login identity: email + password, or phone + password, or phone + OTP?
  Phone-first matches the user, OTP costs an SMS provider we do not have.
- **Q-A3** Session lifetime and refresh. Does a shopkeeper with the dashboard
  open all day get logged out mid-shift? A 3s poll returning 401 during a demo
  is the worst possible failure.
- **Q-A4** Is there any auth at all for the hackathon, or is a hardcoded
  single-retailer session acceptable for the demo? **Answer this first — it
  changes whether `/login` gets built at all.**
- **Q-A5** Roles. Owner-only, or owner + staff with different permissions?

**O. Orders**
- **Q-O1** Is there an `Order` type anywhere yet, or is §7.2 the first draft? If
  BE already has a schema in mind, that wins over my proposal.
- **Q-O3** **Can an order be cancelled?** There is no `cancelled` state in the
  enum. What happens when a customer calls to cancel an already-accepted order,
  or the shop cannot fulfil it after accepting? If cancellation is real, the enum
  changes, and `packages/contracts` is shared with the edge and the agent — that
  is a cross-team change.
- **Q-O4** Delivery or pickup? `out_for_delivery` implies delivery, `placeOrder`
  takes a `deliveryNote`, working memory mentions a "default delivery address" —
  but no address model exists. Does the shopkeeper see an address? Is pickup a
  case at all?
- **Q-O5** **Payment is never mentioned in any document.** Cash on delivery only?
  If so the payment block is a static "COD · pending" chip and I will keep it
  minimal. If online payment is in scope it changes the order model and the
  lifecycle.
- **Q-O6** Will BE store an `events[]` audit trail, or only the status
  timestamps? Without events I cannot show "auto-accepted by system" or
  "quantity changed by shopkeeper", and the activity feed degrades to a stepper.
- **Q-O7** Polling: full page every 3s, or `since`-based delta? (Recommendation:
  full page — §7.2.)
- **Q-O8** Which statuses still allow line-item edits — `accepted` only, I
  assume, since `placed` is never visible? And does a substitution fire the
  `substitution` notify automatically, or does the FE need to trigger it?

### P1 — shapes the UI significantly

**I. Inventory**
- **Q-I1** Do you accept `stockQuantity` (managed only) alongside §C2's boolean
  `inStock`? And **at which transition does the decrement fire** — `accepted`,
  which is effectively order time given auto-accept, or later at `packed` /
  `delivered`? The FE only displays the result, but the answer decides what the
  number means on screen.
- **Q-I2** Does `inStock` become false automatically when `stockQuantity` hits
  zero, or are they independent flags the shopkeeper sets separately? Automatic
  is my assumption — it is the thing that keeps the agent from promising stock
  the shop does not have.
- **Q-I10** Is low-stock worth having? It falls out of counts almost free
  (`stockQuantity <= lowStockThreshold`) and gives the shopkeeper a reorder
  list. Costs one threshold field per product plus a shop-wide default. Easy to
  cut if you would rather not.
- **Q-I3** In external mode, is *anything* editable? With "hide from WhatsApp
  catalogue" dropped, my answer is now **nothing** — the screen is a pure
  read-only mirror with a sync banner. Confirm, or name the one field they can
  touch.
- **Q-I4** **Aliases.** `CLAUDE.md` says the hand-seeded alias table "matters more
  than the embedding model". Should the shopkeeper be able to add colloquial
  terms to their own products from this UI? It is genuinely the highest-leverage
  screen in the product for the Kerala use case — and essential for managed-mode
  shops adding products we never seeded. Not in any doc.
- **Q-I5** Delete: hard delete or soft archive? Archive is safer — deleted
  products still appear in historical orders.
- **Q-I6** Managed-mode onboarding: a shop with 200 SKUs cannot type them in one
  by one. Is CSV import in scope, or is demo seeding enough?
- **Q-I7** Do products have categories and images? Neither appears anywhere in
  the code today.

**D. Dashboard**
- **Q-D1** Do you want a separate `/dashboard` home, or is my
  Orders-is-the-home + KPI strip recommendation acceptable?
- **Q-D2** Is `GET /api/stats/summary` worth building, or should the strip be
  derived from the orders and inventory `counts` blocks (everything except
  revenue)?
- **Q-D3** With triage gone, is a KPI strip still worth the space at all, or
  would you rather the orders list start at the top of the viewport? A
  fulfilment queue benefits less from metrics than an inbox does.

**C. Customer data**
- **Q-C1** Does the shopkeeper see the customer's full phone number? They need it
  to deliver, but `customerRef` is a raw `wa_id` and this is a privacy call
  somebody should make deliberately.
- **Q-C2** Is there a customer name anywhere, or only the phone number? The UI
  currently has nothing to show but digits.
- **Q-C3** Can the shopkeeper see a customer's past orders?

### P2 — nice to resolve, will not block

**S. Shop settings**
- **Q-S1** Is the auto-accept delay configurable per shop, or fixed? (Only
  meaningful if Q-O11 keeps a delay at all.)
- **Q-S2** Do you want a **shop open / closed** toggle? It crosses into the
  agent — the agent would need to tell customers the shop is shut — so it is a
  cross-team feature, not just a switch.
- **Q-S3** Do shop opening hours exist as a concept?

**U. UI/UX**
- **Q-U1** Tailwind + hand-rolled primitives (my recommendation), or shadcn/ui?
- **Q-U2** Is the dashboard used on a phone during the demo, or desktop only?
  It changes how much responsive work is worth doing.
- **Q-U3** Sound on new order — yes by default, muted by default, or not at all?
- **Q-U4** Is the UI English-only, or does the shopkeeper need Malayalam? Product
  names will contain Malayalam either way; chrome is a separate question.
- **Q-U5** Dark mode?

**X. Cross-cutting**
- **Q-X1** **Money units: integer paise or decimal rupees?** The stubs use plain
  integers (`price: 320`) that read as whole rupees. Get this wrong in one place
  and the demo shows ₹32,000 for rice. Decide once, put it in
  `packages/contracts`.
- **Q-X2** Do you accept the list envelope (`{ data, page, counts }`) in place of
  §C2's bare `Order[]`? If you would rather keep the bare array, I need the
  unaccepted count somewhere else — a response header or a separate endpoint.
- **Q-X3** Who owns `POST /notify` — `apps/api` or `apps/agent`? Open in
  `CLAUDE.md`. Does not change our contract, but it decides whether a
  dashboard Accept actually reaches WhatsApp.
- **Q-X5** Should the new order/product/auth types go in
  `packages/contracts/src/index.ts` (so the FE imports them and a contract change
  breaks the build) or stay local to `apps/api`? I strongly prefer the former.
  Note `CLAUDE.md` rule 8: contract changes must touch the Python mirror too —
  though dashboard-only types arguably need no Python mirror, which is itself
  worth deciding.
- **Q-X6** Where does the dashboard deploy, and what is its origin? Needed for
  the CORS allowlist and cookie `SameSite`/`Secure` settings.
