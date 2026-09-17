/**
 * Shared "how many results did we get" branching — every channel (WhatsApp
 * found/choice/not_found today, a future apps/agent ReplyBlock choice
 * tomorrow) needs the same none/single/multiple split on a search result.
 * Keep this here so it isn't reimplemented per caller.
 */
export type MatchClassification<T> =
  | { kind: 'none' }
  | { kind: 'single'; item: T }
  | { kind: 'multiple'; items: T[] };

export function classifyMatches<T>(items: T[]): MatchClassification<T> {
  if (items.length === 0) return { kind: 'none' };
  if (items.length === 1) return { kind: 'single', item: items[0] };
  return { kind: 'multiple', items };
}

/** All prices in this system are INR (see docs/db/schema.sql, master_order has no currency column). */
export function formatIndianPrice(price: number): string {
  return Number.isInteger(price) ? `Rs ${price}` : `Rs ${price.toFixed(2)}`;
}
