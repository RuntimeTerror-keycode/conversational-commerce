/**
 * Whether the current time falls within a shop's opening hours.
 *
 * Shared by apps/api (dashboard display) and this package's own order-flow
 * services (real enforcement) so the two can never disagree about whether a
 * shop is taking orders — the thing the separate, duplicated copy in
 * apps/api's ShopService was written to promise but never actually enforced,
 * since apps/agent has no way to import apps/api's code.
 *
 * Null hours means the shop never closes. Overnight windows (22:00 → 06:00)
 * wrap past midnight.
 */
export function isWithinOpeningHours(
  openingTime: string | null,
  closingTime: string | null,
  now: Date = new Date(),
): boolean {
  if (!openingTime || !closingTime) return true;

  const toMinutes = (value: string): number => {
    const [h, m] = value.split(':').map(Number);
    return h * 60 + m;
  };

  const minutes = now.getHours() * 60 + now.getMinutes();
  const open = toMinutes(openingTime);
  const close = toMinutes(closingTime);

  return open <= close ? minutes >= open && minutes < close : minutes >= open || minutes < close;
}
