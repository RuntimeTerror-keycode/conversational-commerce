// STUB in-memory cart, shared by get-cart.ts and update-cart.ts. Replace with
// domain.getCart / domain.mutateCart (Postgres-backed) per docs/contracts.md
// §C1 once packages/domain exists. Never write cart state anywhere else.
export type CartLine = {
  lineId: string;
  productName: string;
  sourceText?: string;
  quantity: number;
  unit: string;
  price: number;
};

export type Cart = {
  items: CartLine[];
  total: number;
  currency: "INR";
};

const carts = new Map<string, CartLine[]>();

function cartKey(retailerId: string, customerId: string): string {
  return `${retailerId}:${customerId}`;
}

export function readCart(retailerId: string, customerId: string): Cart {
  const items = carts.get(cartKey(retailerId, customerId)) ?? [];
  return { items, total: total(items), currency: "INR" };
}

export function writeCart(retailerId: string, customerId: string, items: CartLine[]): Cart {
  carts.set(cartKey(retailerId, customerId), items);
  return { items, total: total(items), currency: "INR" };
}

function total(items: CartLine[]): number {
  return items.reduce((sum, line) => sum + line.price * line.quantity, 0);
}
