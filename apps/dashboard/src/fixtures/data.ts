import type {
  Order,
  OrderLine,
  Product,
  Retailer,
  User,
  VisibleOrderStatus,
} from '@/api/types';

/**
 * Demo seed.
 *
 * Deliberately built from the catalogue in apps/agent's fake-catalog.ts and the
 * Manglish phrasings in docs/spec.md §4, so what the dashboard shows matches
 * what the agent would actually produce. `sourceText` is the point — "2 kg ari"
 * beside "Jaya rice 5kg" is the proof the AI did something.
 */

export const demoUser: User = {
  id: 'usr_demo',
  name: 'Rajesh',
  role: 'owner',
  retailerId: 'retailer_demo',
};

export const demoRetailer: Retailer = {
  id: 'retailer_demo',
  name: 'Demo Store',
  area: 'Kochi',
  whatsappNumber: '+91 98470 12345',
  currency: 'INR',
  timezone: 'Asia/Kolkata',
  inventoryMode: 'managed',
  shopOpen: true,
  autoAcceptSeconds: 60,
  lowStockThresholdDefault: 5,
  sync: null,
};

interface SeedProduct {
  id: string;
  name: string;
  brand?: string;
  category: string;
  unit: string;
  price: number;
  stock: number;
  aliases: string[];
}

const seedProducts: SeedProduct[] = [
  { id: 'p_101', name: 'Jaya rice 5kg', category: 'Rice & grains', unit: '5kg', price: 320, stock: 24, aliases: ['ari', 'jaya', 'rice'] },
  { id: 'p_102', name: 'Matta rice 5kg', category: 'Rice & grains', unit: '5kg', price: 380, stock: 3, aliases: ['ari', 'matta', 'rice'] },
  { id: 'p_201', name: 'Tea powder 500g', brand: 'Brooke Bond', category: 'Beverages', unit: '500g', price: 210, stock: 18, aliases: ['chaya podi', 'tea powder', 'tea'] },
  { id: 'p_301', name: 'Chickpeas 1kg', category: 'Pulses', unit: '1kg', price: 145, stock: 12, aliases: ['kadala', 'chickpeas'] },
  { id: 'p_401', name: 'Chilli powder 200g', category: 'Spices', unit: '200g', price: 65, stock: 4, aliases: ['mulaku podi', 'chilli powder'] },
  { id: 'p_501', name: 'Curd 500g', category: 'Dairy', unit: '500g', price: 40, stock: 31, aliases: ['thairu', 'curd', 'yoghurt'] },
  { id: 'p_601', name: 'Chicken 1kg', category: 'Meat', unit: '1kg', price: 220, stock: 0, aliases: ['kozhi', 'chicken'] },
  { id: 'p_602', name: 'Chicken (frozen) 1kg', category: 'Meat', unit: '1kg', price: 195, stock: 9, aliases: ['kozhi', 'frozen chicken'] },
  { id: 'p_701', name: 'Coconut oil 1L', brand: 'KLF', category: 'Oils', unit: '1L', price: 280, stock: 15, aliases: ['velichenna', 'coconut oil'] },
  { id: 'p_801', name: 'Sugar 1kg', category: 'Essentials', unit: '1kg', price: 48, stock: 2, aliases: ['panchasara', 'sugar'] },
  { id: 'p_901', name: 'Toor dal 1kg', category: 'Pulses', unit: '1kg', price: 165, stock: 7, aliases: ['thuvara parippu', 'toor dal'] },
  { id: 'p_910', name: 'Onion 1kg', category: 'Vegetables', unit: '1kg', price: 42, stock: 26, aliases: ['savola', 'ulli', 'onion'] },
];

export function buildProducts(now: Date): Product[] {
  return seedProducts.map((seed) => ({
    id: seed.id,
    sku: seed.id.replace('p_', 'SKU-'),
    name: seed.name,
    brand: seed.brand ?? null,
    category: seed.category,
    unit: seed.unit,
    price: seed.price,
    currency: 'INR' as const,
    inStock: seed.stock > 0,
    stockQuantity: seed.stock,
    lowStockThreshold: demoRetailer.lowStockThresholdDefault,
    isLow: seed.stock > 0 && seed.stock <= demoRetailer.lowStockThresholdDefault,
    aliases: seed.aliases,
    updatedAt: new Date(now.getTime() - 3_600_000).toISOString(),
    syncedAt: null,
  }));
}

interface SeedOrder {
  code: string;
  status: VisibleOrderStatus;
  customerName: string;
  customerRef: string;
  minutesAgo: number;
  note: string | null;
  lines: Array<{ productId: string; quantity: number; sourceText: string }>;
}

const seedOrders: SeedOrder[] = [
  {
    code: '#1042', status: 'accepted', customerName: 'Anjali', customerRef: '919847012345',
    minutesAgo: 2, note: 'no onions please',
    lines: [
      { productId: 'p_101', quantity: 2, sourceText: '2 kg ari' },
      { productId: 'p_201', quantity: 1, sourceText: 'chaya podi' },
    ],
  },
  {
    code: '#1041', status: 'accepted', customerName: 'Sunil', customerRef: '919847099881',
    minutesAgo: 9, note: null,
    lines: [
      { productId: 'p_501', quantity: 2, sourceText: 'thairu randu' },
      { productId: 'p_910', quantity: 1, sourceText: 'ulli 1 kg' },
      { productId: 'p_401', quantity: 1, sourceText: 'mulaku podi' },
    ],
  },
  {
    code: '#1040', status: 'accepted', customerName: 'Fathima', customerRef: '919847077220',
    minutesAgo: 17, note: 'call before delivery',
    lines: [{ productId: 'p_701', quantity: 1, sourceText: 'velichenna oru litre' }],
  },
  {
    code: '#1039', status: 'packed', customerName: 'Joseph', customerRef: '919847055103',
    minutesAgo: 34, note: null,
    lines: [
      { productId: 'p_301', quantity: 2, sourceText: 'kadala 2 kg' },
      { productId: 'p_901', quantity: 1, sourceText: 'thuvara parippu' },
    ],
  },
  {
    code: '#1038', status: 'out_for_delivery', customerName: 'Meera', customerRef: '919847033447',
    minutesAgo: 58, note: 'second floor',
    lines: [
      { productId: 'p_102', quantity: 1, sourceText: 'matta ari' },
      { productId: 'p_801', quantity: 2, sourceText: 'panchasara' },
    ],
  },
  {
    code: '#1037', status: 'delivered', customerName: 'Anjali', customerRef: '919847012345',
    minutesAgo: 126, note: null,
    lines: [{ productId: 'p_602', quantity: 1, sourceText: 'kozhi 1 kg' }],
  },
  {
    code: '#1036', status: 'delivered', customerName: 'Vinod', customerRef: '919847011009',
    minutesAgo: 190, note: null,
    lines: [
      { productId: 'p_101', quantity: 1, sourceText: 'ari' },
      { productId: 'p_501', quantity: 3, sourceText: 'curd 3' },
      { productId: 'p_910', quantity: 2, sourceText: 'savola 2 kg' },
    ],
  },
  {
    code: '#1035', status: 'delivered', customerName: 'Nisha', customerRef: '919847066712',
    minutesAgo: 245, note: 'leave with the watchman',
    lines: [
      { productId: 'p_201', quantity: 2, sourceText: 'rendu chaya podi' },
      { productId: 'p_801', quantity: 1, sourceText: 'sugar' },
    ],
  },
  {
    code: '#1034', status: 'delivered', customerName: 'Thomas', customerRef: '919847001188',
    minutesAgo: 320, note: null,
    lines: [
      { productId: 'p_701', quantity: 2, sourceText: 'velichenna 2' },
      { productId: 'p_901', quantity: 1, sourceText: 'parippu' },
      { productId: 'p_401', quantity: 2, sourceText: 'mulaku podi rendu' },
    ],
  },
  {
    code: '#1033', status: 'delivered', customerName: 'Asha', customerRef: '919847093310',
    minutesAgo: 400, note: null,
    lines: [{ productId: 'p_910', quantity: 3, sourceText: 'ulli 3 kg' }],
  },
  // One rejected order so the terminal-failure branch of the lifecycle is
  // visible in the UI. Nothing in the product can currently produce this
  // state — see Q-O12 — but the enum still carries it.
  {
    code: '#1032', status: 'rejected', customerName: 'Rahim', customerRef: '919847044901',
    minutesAgo: 470, note: null,
    lines: [{ productId: 'p_601', quantity: 2, sourceText: 'kozhi 2 kg' }],
  },
];

/** Which timestamps are filled in depends on how far the order has travelled. */
const statusOrder: VisibleOrderStatus[] = [
  'accepted',
  'packed',
  'out_for_delivery',
  'delivered',
];

export function buildOrders(now: Date, products: Product[]): Order[] {
  return seedOrders.map((seed) => {
    const placedAt = new Date(now.getTime() - seed.minutesAgo * 60_000);
    const reached = statusOrder.indexOf(seed.status);

    const at = (step: number): string | null =>
      reached >= step
        ? new Date(placedAt.getTime() + step * 7 * 60_000).toISOString()
        : null;

    const items: OrderLine[] = seed.lines.map((line, index) => {
      const product = products.find((candidate) => candidate.id === line.productId);
      const unitPrice = product?.price ?? 0;

      return {
        lineId: `${seed.code.replace('#', 'ln_')}_${index}`,
        productId: line.productId,
        productName: product?.name ?? line.productId,
        sourceText: line.sourceText,
        quantity: line.quantity,
        unit: product?.unit ?? 'unit',
        unitPrice,
        lineTotal: unitPrice * line.quantity,
        availability: product?.inStock ? 'in_stock' : 'out_of_stock',
        substitutedFor: null,
      };
    });

    const subtotal = items.reduce((sum, line) => sum + line.lineTotal, 0);
    const rejected = seed.status === 'rejected';
    const acceptedAt = rejected ? null : placedAt.toISOString();
    const rejectedAt = rejected
      ? new Date(placedAt.getTime() + 4 * 60_000).toISOString()
      : null;

    return {
      id: seed.code.replace('#', 'ord_'),
      orderCode: seed.code,
      status: seed.status,
      customer: {
        ref: seed.customerRef,
        displayName: seed.customerName,
        phone: `+${seed.customerRef}`,
      },
      items,
      subtotal,
      deliveryFee: 0,
      total: subtotal,
      currency: 'INR' as const,
      delivery: {
        mode: 'delivery' as const,
        address: 'Panampilly Nagar, Kochi',
        note: seed.note,
        etaMinutes: 45,
      },
      payment: { method: 'cod' as const, status: 'pending' as const },
      timeline: {
        placedAt: placedAt.toISOString(),
        acceptedAt,
        packedAt: at(1),
        outForDeliveryAt: at(2),
        deliveredAt: at(3),
        rejectedAt,
      },
      placedAt: placedAt.toISOString(),
      acceptedAt,
      rejectionReason: seed.status === 'rejected' ? 'Out of stock for the day' : null,
      events: [
        { at: placedAt.toISOString(), type: 'placed' as const, actor: 'customer' as const },
        ...(acceptedAt
          ? [
              {
                at: acceptedAt,
                type: 'accepted' as const,
                actor: 'system' as const,
                note: 'Auto-accepted',
              },
            ]
          : []),
        ...(rejectedAt
          ? [
              {
                at: rejectedAt,
                type: 'rejected' as const,
                actor: 'retailer' as const,
                note: 'Out of stock for the day',
              },
            ]
          : []),
        ...(at(1)
          ? [{ at: at(1)!, type: 'packed' as const, actor: 'retailer' as const }]
          : []),
        ...(at(2)
          ? [
              {
                at: at(2)!,
                type: 'out_for_delivery' as const,
                actor: 'retailer' as const,
              },
            ]
          : []),
        ...(at(3)
          ? [{ at: at(3)!, type: 'delivered' as const, actor: 'retailer' as const }]
          : []),
      ],
      traceId: `trc_${seed.code.replace('#', '')}`,
      updatedAt:
        at(3) ?? at(2) ?? at(1) ?? rejectedAt ?? acceptedAt ?? placedAt.toISOString(),
    };
  });
}
