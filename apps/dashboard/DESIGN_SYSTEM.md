# Shopkeeper Portal — Design System

Single source of truth for visual decisions. Derived from the project design
brief (section 3) and completed with the values the brief left unspecified.

**Rule: no raw color, size, spacing or radius values in component code.**
If you need a value that isn't here, add it here first with a semantic name.

- Tokens: `src/styles/tokens.css` (CSS custom properties)
- Mapping: `tailwind.config.js` (utility classes)

---

## 1. Color

### From the brief

| Role | Hex | Token |
|---|---|---|
| Primary | `#2563EB` | `accent` |
| Text | `#0F172A` | `text` |
| Muted | `#64748B` | `text-muted` |
| Success | `#10B981` | `success` |
| Warning | `#F59E0B` | `warning` |
| Error | `#EF4444` | `danger` |

### Contrast constraint — read this before using status colors

`success` (#10B981) and `warning` (#F59E0B) **fail WCAG AA as text on white** —
roughly 2.5:1 and 2.1:1 against a 4.5:1 requirement. The brief asks for
accessible contrast, so these cannot be used as `text-success` / `text-warning`
on a light surface.

Use them for **fills, borders, and icons 24px or larger only.**

For any status text or badge label, use the paired foreground/background tokens:

```jsx
// Wrong — 2.5:1, unreadable
<span className="text-success">Delivered</span>

// Right — 6.4:1
<span className="bg-success-bg text-success-fg border border-success-border">
  Delivered
</span>
```

### Surfaces

| Token | Use |
|---|---|
| `bg-canvas` | Page background behind cards |
| `bg-surface` | Cards, tables, panels |
| `bg-surface-sunken` | Table headers, inset wells, code blocks |
| `bg-surface-hover` | Table row and list item hover |
| `border-border` | Default hairline |
| `border-border-strong` | Input outlines, section dividers |

### Sidebar

The navigation rail is dark navy against the light content area.
Use the `sidebar-*` tokens, not the `text-*` scale — the contrast
relationships are inverted there.

| Token | Use |
|---|---|
| `bg-sidebar` | Rail background |
| `bg-sidebar-hover` | Item hover |
| `bg-sidebar-active` | Active item fill |
| `text-sidebar-text` | Inactive item label |
| `text-sidebar-text-active` | Active item label |

---

## 2. Status vocabulary

The brief uses two overlapping sets: an **order lifecycle** (section 6 stepper)
and a **status badge** row. Map them as follows and use nothing else.

### Order status badges

| Status | Background | Text | Lucide icon |
|---|---|---|---|
| Pending | `bg-warning-bg` | `text-warning-fg` | `Clock` |
| Processing | `bg-info-bg` | `text-info-fg` | `Loader` |
| Shipped | `bg-violet-bg` | `text-violet-fg` | `Truck` |
| Delivered | `bg-success-bg` | `text-success-fg` | `CheckCircle2` |
| Cancelled | `bg-danger-bg` | `text-danger-fg` | `XCircle` |

### Stock status badges

| Status | Background | Text |
|---|---|---|
| In Stock | `bg-success-bg` | `text-success-fg` |
| Low Stock | `bg-warning-bg` | `text-warning-fg` |
| Out of Stock | `bg-danger-bg` | `text-danger-fg` |

Every badge pairs color with an **icon and a text label**. Color alone never
carries status — that fails both the colorblind case and screen readers.

### Lifecycle stepper (section 6)

Five steps: Placed → Confirmed → Preparing → Out for Delivery → Delivered.

- Completed step: `bg-success` fill, white check icon, `text-text` label
- Current step: `bg-accent` fill, ring, `text-text` label, weight 600
- Upcoming step: `bg-surface` fill, `border-border-strong`, `text-text-muted`
- Connector line: `bg-success` behind completed, `bg-border` ahead of current
- Cancelled order: replace the entire stepper with a single `danger` state
  block. Do not show a half-complete timeline for a cancelled order.

Each step shows its timestamp in `text-caption text-text-muted` beneath the label.

---

## 3. Typography

Inter. Load weights 400, 500, 600, 700 only — variable font preferred.

| Token | Size | Line height | Weight | Use |
|---|---|---|---|---|
| `text-h1` | 32 | 40 | 700 | Page title, one per screen |
| `text-h2` | 24 | 32 | 600 | Section heading |
| `text-h3` | 20 | 28 | 600 | Card title, modal title |
| `text-body` | 16 | 24 | 400 | Default body |
| `text-small` | 14 | 20 | 400 | Table cells, labels, secondary |
| `text-caption` | 12 | 16 | 500 | Timestamps, helper text, badges |
| `text-metric` | 36 | 40 | 700 | Dashboard stat values |

Rules:

- Maximum three sizes per view. If you need a fourth, the hierarchy is wrong.
- Hierarchy through **weight and color** before size.
- Currency and metrics use `font-numeric` (tabular numerals) so amounts align
  in table columns. `₹1,240` above `₹320` must line up on the decimal.
- Never set `font-size` outside this scale.

---

## 4. Spacing

Base unit 4px. Scale: `1 2 3 4 6 8 12 16` → 4, 8, 12, 16, 24, 32, 48, 64.

Space belongs to the **container** via `gap`, not to children via margin.

Standard rhythm:

| Relationship | Space |
|---|---|
| Icon to its label | `gap-2` (8) |
| Form label to input | `gap-2` (8) |
| Between form fields | `gap-4` (16) |
| Card internal padding | `p-6` (24) |
| Between cards in a grid | `gap-6` (24) |
| Page header to content | `mb-8` (32) |
| Between page sections | `gap-12` (48) |

Page shell: sidebar `w-sidebar` (240), topbar `h-topbar` (64), content
`max-w-content` (1440) with `px-8` on desktop, `px-4` on mobile.

---

## 5. Radius and elevation

| Element | Radius |
|---|---|
| Badge, chip | `rounded-sm` (4) or `rounded-full` |
| Input, small button | `rounded-md` (6) |
| Button, dropdown | `rounded-lg` (8) |
| Card, panel, table | `rounded-xl` (12) |
| Modal | `rounded-2xl` (16) |
| Avatar | `rounded-full` |

| Elevation | Use |
|---|---|
| `shadow-xs` | Resting cards — prefer `border` over shadow at this level |
| `shadow-sm` | Hovered cards, sticky table header |
| `shadow-md` | Dropdowns, popovers, tooltips |
| `shadow-lg` | Modals, drawers |

Cards on a light canvas read better with a border than a shadow. Default to
`border border-border bg-surface`, and add shadow only on hover or for
floating layers.

---

## 6. Component states

Every interactive component implements all seven:

| State | Requirement |
|---|---|
| Default | — |
| Hover | Visible change, `transition-colors duration-fast` |
| Focus-visible | `ring ring-offset-2` — never remove without replacing |
| Active | Distinct from hover |
| Disabled | `text-disabled`, `cursor-not-allowed`, no hover response |
| Loading | Inline spinner, **width preserved**, label retained |
| Error | Message linked via `aria-describedby` |

### Button variants

| Variant | Classes |
|---|---|
| Primary | `bg-accent text-accent-fg hover:bg-accent-hover active:bg-accent-active` |
| Secondary | `bg-surface text-text border border-border-strong hover:bg-surface-hover` |
| Ghost | `text-text-secondary hover:bg-surface-hover` |
| Danger | `bg-danger text-white hover:bg-danger-hover` |

Sizes: `sm` (h-8, text-small), `md` (h-10, text-small), `lg` (h-11, text-body).

**One primary button per view.** On the Inventory screen that's "Add Product";
"Filter" and "Export" are secondary.

---

## 7. Data states

Every view that reads from the API handles four states. None are optional.

**Loading** — skeleton matching the final layout's shape. A table skeleton has
the same column widths and row height as the loaded table, so nothing shifts.
Use `bg-surface-sunken` with the `shimmer` animation. A centered spinner is a
fallback, not a default.

**Empty** — icon, one-line explanation, and the resolving action:

> 📦 No products yet
> Add your first product to start tracking inventory.
> [ Add Product ]

Never render a bare "No data". Distinguish *genuinely empty* ("No products
yet") from *filtered to nothing* ("No products match these filters" +
[Clear filters]).

**Error** — plain-language cause plus a retry button. Never surface a raw
status code or stack trace to a shopkeeper.

**Success** — the content.

---

## 8. Data layer

**No dummy data in application code.** No sample arrays, no faker, no
placeholder objects. Mocks live in tests only.

- Base URL from `VITE_API_BASE_URL`, with no fallback to fake data.
- If the variable is absent, render an explicit configuration-error screen.
- All request and response types derive from `frontend_contract.md`. No
  endpoint or field that isn't in that file.
- Axios instance with interceptors for auth token attachment and 401 handling.

---

## 9. Accessibility

- AA contrast on all text and UI boundaries — see section 1.
- Semantic HTML. `<button>` for actions, `<a>` for navigation. A clickable
  `<div>` is a bug.
- Focus visible everywhere; tab order matches visual order; Escape closes
  overlays; focus traps in modals and returns to the trigger on close.
- Every input has a real `<label>`. Placeholder is not a label.
- Icon-only buttons need `aria-label`.
- Tables use `<th scope="col">` and a `<caption>` or `aria-label`.
- Sortable columns expose `aria-sort`.
- Toasts are `role="status"` (`role="alert"` for errors).
- Status never communicated by color alone.
- `prefers-reduced-motion` handled in `tokens.css`.

---

## 10. Responsive

Breakpoints: `sm` 375, `md` 768, `lg` 1280, `xl` 1536.

- Touch targets ≥44×44px.
- Sidebar: overlay drawer below `lg`, fixed rail at `lg` and above.
- Tables: stack into cards below `md`. The Orders table becomes a card per
  order showing ID, customer, amount, status badge, date.
- Modals become full-height sheets below `md`.
- Dashboard stat cards: 1 column at `sm`, 2 at `md`, 4 at `lg`.
- Nothing overflows horizontally at 375px.

---

## 11. Rejected on review

- Arbitrary values — `w-[437px]`, `text-[#ff0000]`, `mt-[13px]`
- Tailwind default palette classes (`bg-blue-500`) — removed from config
- `!important`
- Nested ternaries in `className`
- Components over ~200 lines
- Copy-pasted components differing only in color
- Fixed heights on text containers
- Ad-hoc `z-index` — use the layer scale
- Loading states that shift layout on resolve
- `text-success` or `text-warning` as body text (contrast failure)
