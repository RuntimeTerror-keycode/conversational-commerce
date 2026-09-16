import type {
  Order,
  OrderLine,
  OrderListResponse,
  OrderStatusCounts,
  OrderSummary,
  Product,
  ProductListResponse,
  Retailer,
  Session,
  StatsSummary,
  VisibleOrderStatus,
} from '@/api/types';
import { ApiRequestError } from '@/api/client';
import { buildOrders, buildProducts, demoRetailer, demoUser } from './data';

/**
 * In-memory stand-in for apps/api.
 *
 * Exists so the dashboard can be built and demoed before the backend routes
 * land, and so a dead API on stage is not a dead demo. It is deliberately a
 * plain adapter rather than MSW — there is no service worker to go wrong, and
 * the whole thing is one file to delete when the real API arrives.
 *
 * It mutates: status changes and inventory edits persist for the session, and
 * a new order arrives periodically so the 3s poll visibly does something.
 */
export const usingFixtures = import.meta.env.VITE_USE_FIXTURES !== 'false';

const now = new Date();

interface Store {
  retailer: Retailer;
  products: Product[];
  orders: Order[];
  authenticated: boolean;
  nextOrderCode: number;
}

/**
 * Session survives a reload.
 *
 * Without this the whole store resets on every refresh and signing out silently
 * signs you back in, which makes the auth flow impossible to test or demo.
 */
const SESSION_KEY = 'cc.fixtures.authenticated';

function readAuthenticated(): boolean {
  try {
    return window.sessionStorage.getItem(SESSION_KEY) !== 'false';
  } catch {
    return true;
  }
}

function writeAuthenticated(value: boolean): void {
  try {
    window.sessionStorage.setItem(SESSION_KEY, String(value));
  } catch {
    // Private browsing or blocked storage — in-memory state still works.
  }
}

const products = buildProducts(now);

const store: Store = {
  retailer: { ...demoRetailer },
  products,
  orders: buildOrders(now, products),
  // Starts signed in, since auth is undecided (Q-A4) and the login screen
  // should not stand between the demo and the orders list.
  authenticated: readAuthenticated(),
  nextOrderCode: 1043,
};

/**
 * `?inventoryMode=external` flips the fixture shop to the synced-POS variant.
 *
 * Both retailer types have to be demoable without a rebuild — the read-only
 * inventory screen is half the product and would otherwise never be seen.
 */
const modeOverride = new URLSearchParams(window.location.search).get('inventoryMode');

if (modeOverride === 'external') {
  store.retailer.inventoryMode = 'external';
  store.retailer.sync = {
    provider: 'Vyapar',
    lastSyncedAt: new Date(now.getTime() - 4 * 60_000).toISOString(),
    status: 'ok',
    nextSyncAt: new Date(now.getTime() + 11 * 60_000).toISOString(),
  };

  // Their POS owns the count, so we hold none of our own.
  for (const product of store.products) {
    product.stockQuantity = null;
    product.lowStockThreshold = null;
    product.isLow = false;
    product.syncedAt = store.retailer.sync.lastSyncedAt;
  }
}

const visibleStatuses: VisibleOrderStatus[] = [
  'accepted',
  'packed',
  'out_for_delivery',
  'delivered',
  'rejected',
];

const transitions: Record<VisibleOrderStatus, VisibleOrderStatus | null> = {
  accepted: 'packed',
  packed: 'out_for_delivery',
  out_for_delivery: 'delivered',
  delivered: null,
  rejected: null,
};

/* ------------------------------------------------------------------ *
 * A new order every so often, so polling has something to find.
 * ------------------------------------------------------------------ */

const incomingOrders: Array<{ name: string; ref: string; lines: Array<[string, number, string]> }> = [
  { name: 'Priya', ref: '919847044556', lines: [['p_201', 1, 'chaya podi onnu'], ['p_801', 1, 'panchasara']] },
  { name: 'Hari', ref: '919847088113', lines: [['p_910', 2, 'ulli 2 kg'], ['p_401', 1, 'mulaku podi']] },
  { name: 'Sara', ref: '919847022907', lines: [['p_101', 1, 'ari oru packet']] },
];

let incomingIndex = 0;

function spawnOrder(): void {
  const seed = incomingOrders[incomingIndex % incomingOrders.length];
  incomingIndex += 1;

  const placedAt = new Date().toISOString();
  const code = `#${store.nextOrderCode}`;
  store.nextOrderCode += 1;

  const items: OrderLine[] = seed.lines.map(([productId, quantity, sourceText], index) => {
    const product = store.products.find((candidate) => candidate.id === productId);
    const unitPrice = product?.price ?? 0;

    return {
      lineId: `${code.replace('#', 'ln_')}_${index}`,
      productId,
      productName: product?.name ?? productId,
      sourceText,
      quantity,
      unit: product?.unit ?? 'unit',
      unitPrice,
      lineTotal: unitPrice * quantity,
      availability: product?.inStock ? 'in_stock' : 'out_of_stock',
      substitutedFor: null,
    };
  });

  const subtotal = items.reduce((sum, line) => sum + line.lineTotal, 0);

  store.orders.unshift({
    id: code.replace('#', 'ord_'),
    orderCode: code,
    status: 'accepted',
    customer: { ref: seed.ref, displayName: seed.name, phone: `+${seed.ref}` },
    items,
    subtotal,
    deliveryFee: 0,
    total: subtotal,
    currency: 'INR',
    delivery: { mode: 'delivery', address: 'Kadavanthra, Kochi', note: null, etaMinutes: 45 },
    payment: { method: 'cod', status: 'pending' },
    timeline: {
      placedAt,
      acceptedAt: placedAt,
      packedAt: null,
      outForDeliveryAt: null,
      deliveredAt: null,
      rejectedAt: null,
    },
    placedAt,
    acceptedAt: placedAt,
    rejectionReason: null,
    events: [
      { at: placedAt, type: 'placed', actor: 'customer' },
      { at: placedAt, type: 'accepted', actor: 'system', note: 'Auto-accepted' },
    ],
    traceId: `trc_${code.replace('#', '')}`,
    updatedAt: placedAt,
  });

  applyStockDecrement(items);
}

/**
 * Managed mode decrements after each order.
 *
 * Mirrors what packages/domain will do for real (docs/frontend-contract.md
 * §3.4.1). External-mode shops are skipped — their own POS already recorded
 * the sale and our sync overwrites whatever we hold.
 */
function applyStockDecrement(items: OrderLine[]): void {
  if (store.retailer.inventoryMode !== 'managed') return;

  for (const line of items) {
    const product = store.products.find((candidate) => candidate.id === line.productId);
    if (!product || product.stockQuantity === null) continue;

    product.stockQuantity = Math.max(0, product.stockQuantity - line.quantity);
    product.inStock = product.stockQuantity > 0;
    product.isLow =
      product.inStock && product.stockQuantity <= (product.lowStockThreshold ?? 0);
    product.updatedAt = new Date().toISOString();
  }
}

if (usingFixtures) {
  window.setInterval(spawnOrder, 45_000);
}

/* ------------------------------------------------------------------ *
 * Request routing
 * ------------------------------------------------------------------ */

function toSummary(order: Order): OrderSummary {
  return {
    id: order.id,
    orderCode: order.orderCode,
    status: order.status,
    customer: { ref: order.customer.ref, displayName: order.customer.displayName },
    itemCount: order.items.length,
    firstLineSourceText: order.items[0]?.sourceText ?? null,
    total: order.total,
    currency: order.currency,
    placedAt: order.placedAt,
    acceptedAt: order.acceptedAt,
    updatedAt: order.updatedAt,
  };
}

function countByStatus(orders: Order[]): OrderStatusCounts {
  const counts = Object.fromEntries(
    visibleStatuses.map((status) => [status, 0]),
  ) as OrderStatusCounts;

  for (const order of orders) counts[order.status] += 1;
  return counts;
}

function listOrders(params: URLSearchParams): OrderListResponse {
  const statusParam = params.get('status');
  const search = params.get('q')?.toLowerCase().trim();

  let filtered = [...store.orders].sort(
    (a, b) => new Date(b.placedAt).getTime() - new Date(a.placedAt).getTime(),
  );

  if (statusParam) {
    const wanted = new Set(statusParam.split(','));
    filtered = filtered.filter((order) => wanted.has(order.status));
  }

  if (search) {
    filtered = filtered.filter((order) =>
      [
        order.orderCode,
        order.customer.displayName ?? '',
        order.customer.ref,
        ...order.items.map((line) => `${line.productName} ${line.sourceText ?? ''}`),
      ]
        .join(' ')
        .toLowerCase()
        .includes(search),
    );
  }

  const page = Number(params.get('page') ?? 1);
  const limit = Number(params.get('limit') ?? 20);
  const start = (page - 1) * limit;

  return {
    data: filtered.slice(start, start + limit).map(toSummary),
    page: {
      page,
      limit,
      total: filtered.length,
      hasMore: start + limit < filtered.length,
    },
    counts: countByStatus(store.orders),
    serverTime: new Date().toISOString(),
  };
}

function listProducts(params: URLSearchParams): ProductListResponse {
  const search = params.get('q')?.toLowerCase().trim();
  const category = params.get('category');
  const stockState = params.get('stockState') ?? 'all';

  let filtered = [...store.products];

  if (search) {
    filtered = filtered.filter((product) =>
      [product.name, product.sku ?? '', product.brand ?? '', ...product.aliases]
        .join(' ')
        .toLowerCase()
        .includes(search),
    );
  }

  if (category) filtered = filtered.filter((product) => product.category === category);

  if (stockState === 'in_stock') filtered = filtered.filter((product) => product.inStock);
  if (stockState === 'out') filtered = filtered.filter((product) => !product.inStock);
  if (stockState === 'low') filtered = filtered.filter((product) => product.isLow);

  return {
    data: filtered,
    page: { page: 1, limit: 100, total: filtered.length, hasMore: false },
    counts: {
      total: store.products.length,
      inStock: store.products.filter((product) => product.inStock).length,
      low: store.products.filter((product) => product.isLow).length,
      out: store.products.filter((product) => !product.inStock).length,
    },
    categories: [...new Set(store.products.map((p) => p.category ?? ''))]
      .filter(Boolean)
      .sort(),
  };
}

function advanceOrder(orderId: string, status: VisibleOrderStatus): Order {
  const order = store.orders.find((candidate) => candidate.id === orderId);
  if (!order) throw new ApiRequestError(404, { code: 'not_found', message: 'No such order' });

  if (transitions[order.status] !== status) {
    throw new ApiRequestError(409, {
      code: 'conflict',
      message: `Cannot move ${order.status} to ${status}`,
      details: { order },
    });
  }

  const at = new Date().toISOString();
  order.status = status;
  order.updatedAt = at;
  order.events = [...order.events, { at, type: status, actor: 'retailer' }];

  if (status === 'packed') order.timeline.packedAt = at;
  if (status === 'out_for_delivery') order.timeline.outForDeliveryAt = at;
  if (status === 'delivered') order.timeline.deliveredAt = at;

  return order;
}

function patchProduct(productId: string, patch: Partial<Product>): Product {
  if (store.retailer.inventoryMode === 'external') {
    throw new ApiRequestError(409, {
      code: 'read_only_inventory',
      message: 'This inventory syncs from your billing system',
    });
  }

  const product = store.products.find((candidate) => candidate.id === productId);
  if (!product) throw new ApiRequestError(404, { code: 'not_found', message: 'No such product' });

  Object.assign(product, patch);

  if (patch.stockQuantity !== undefined && patch.stockQuantity !== null) {
    product.inStock = patch.stockQuantity > 0;
  }
  product.isLow =
    product.inStock &&
    product.stockQuantity !== null &&
    product.stockQuantity <= (product.lowStockThreshold ?? 0);
  product.updatedAt = new Date().toISOString();

  return product;
}

function buildStats(): StatsSummary {
  const counts = countByStatus(store.orders);

  return {
    range: 'today',
    newOrders: counts.accepted,
    activeOrders: counts.packed + counts.out_for_delivery,
    completedToday: counts.delivered,
    revenue: store.orders
      .filter((order) => order.status === 'delivered')
      .reduce((sum, order) => sum + order.total, 0),
    currency: 'INR',
    lowStockCount: store.products.filter((product) => product.isLow).length,
    outOfStockCount: store.products.filter((product) => !product.inStock).length,
  };
}

const latency = () => new Promise((resolve) => window.setTimeout(resolve, 120));

export async function fixtureRequest<T>(
  method: string,
  fullPath: string,
  body: unknown,
): Promise<T> {
  await latency();

  const [path, search] = fullPath.split('?');
  const params = new URLSearchParams(search ?? '');
  const segments = path.split('/').filter(Boolean);

  const requireSession = () => {
    if (!store.authenticated) {
      throw new ApiRequestError(401, { code: 'unauthorized', message: 'Session expired' });
    }
  };

  // --- auth ---
  if (path === '/auth/login' && method === 'POST') {
    const credentials = body as { identifier?: string; password?: string };
    if (!credentials?.identifier || !credentials?.password) {
      throw new ApiRequestError(401, {
        code: 'unauthorized',
        message: 'Check your phone number and password',
      });
    }
    store.authenticated = true;
    writeAuthenticated(true);
    return { user: demoUser, retailer: store.retailer } as Session as T;
  }

  if (path === '/auth/logout' && method === 'POST') {
    store.authenticated = false;
    writeAuthenticated(false);
    return undefined as T;
  }

  if (path === '/auth/me') {
    requireSession();
    return { user: demoUser, retailer: store.retailer } as Session as T;
  }

  requireSession();

  // --- orders ---
  if (path === '/orders') return listOrders(params) as T;

  if (segments[0] === 'orders' && segments.length === 2) {
    const order = store.orders.find((candidate) => candidate.id === segments[1]);
    if (!order) throw new ApiRequestError(404, { code: 'not_found', message: 'No such order' });

    if (method === 'PATCH') {
      const patch = body as { status: VisibleOrderStatus };
      return advanceOrder(segments[1], patch.status) as T;
    }
    return order as T;
  }

  // --- inventory ---
  if (path === '/inventory' && method === 'GET') return listProducts(params) as T;

  if (segments[0] === 'inventory' && segments.length === 2) {
    if (method === 'PATCH') return patchProduct(segments[1], body as Partial<Product>) as T;

    const product = store.products.find((candidate) => candidate.id === segments[1]);
    if (!product) throw new ApiRequestError(404, { code: 'not_found', message: 'No such product' });
    return product as T;
  }

  // --- misc ---
  if (path === '/stats/summary') return buildStats() as T;

  if (path === '/retailer' && method === 'PATCH') {
    Object.assign(store.retailer, body as Partial<Retailer>);
    return store.retailer as T;
  }

  throw new ApiRequestError(404, {
    code: 'not_found',
    message: `No fixture for ${method} ${path}`,
  });
}
