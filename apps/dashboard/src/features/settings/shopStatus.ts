import { CircleCheck, CirclePause, Clock } from 'lucide-react';
import type { ComponentType } from 'react';
import type { ShopOpenState } from '@/api/types';

export interface ShopStatusMeta {
  label: string;
  tone: 'success' | 'warning' | 'neutral';
  icon: ComponentType<{ className?: string }>;
  hint: string;
}

/**
 * One place decides how each state reads, so the sidebar, the dashboard header
 * and the settings page never describe the same shop differently.
 */
export const shopStatusMeta: Record<ShopOpenState, ShopStatusMeta> = {
  open: {
    label: 'Open',
    tone: 'success',
    icon: CircleCheck,
    hint: 'Taking orders on WhatsApp',
  },
  // Neutral, not amber. A shop being shut at midnight is its normal state,
  // not a warning — the only thing that separates this from `offline` is
  // whether it fixes itself, and the label carries that.
  closed: {
    label: 'Closed now',
    tone: 'neutral',
    icon: Clock,
    hint: 'Outside opening hours — reopens automatically at the set time',
  },
  // Same visual weight as `closed` — the distinction that matters is the
  // word, because this one does NOT fix itself.
  offline: {
    label: 'Switched off',
    tone: 'neutral',
    icon: CirclePause,
    hint: 'You turned the shop off — it stays off until you turn it back on',
  },
  always_open: {
    label: 'Open',
    tone: 'success',
    icon: CircleCheck,
    hint: 'No hours set, so the shop always takes orders',
  },
};

/** "07:00 – 22:00", or null when the shop has no hours configured. */
export function formatHours(
  openingTime: string | null,
  closingTime: string | null,
): string | null {
  if (!openingTime || !closingTime) return null;
  return `${openingTime} – ${closingTime}`;
}

/**
 * The line under the status word — and it must always name when it changes.
 *
 * "Open" alone leaves the shopkeeper wondering how long they have; "Closed
 * now" alone leaves them wondering whether they need to do anything. Both
 * questions are answered by saying when the state flips, and whether it flips
 * on its own.
 */
export function statusDetail(shop: {
  openState: ShopOpenState;
  openingTime: string | null;
  closingTime: string | null;
}, now: Date = new Date()): string {
  if (shop.openState === 'offline') return 'Stays off until you turn it back on';
  if (shop.openState === 'always_open') return 'No hours set — taking orders around the clock';
  if (shop.openState === 'closed') {
    return shop.openingTime ? `Reopens at ${shop.openingTime}` : 'Reopens at the set time';
  }

  const until = shop.closingTime ? minutesUntil(shop.closingTime, now) : null;
  if (!shop.closingTime || until === null) return 'Taking orders on WhatsApp';

  return `Closes at ${shop.closingTime}, in ${formatGap(until)}`;
}

/** Minutes from `now` to the next occurrence of "HH:MM". */
function minutesUntil(time: string, now: Date): number | null {
  const [hours, minutes] = time.split(':').map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;

  const target = new Date(now);
  target.setHours(hours, minutes, 0, 0);
  // A closing time already past today belongs to tomorrow — an overnight shop.
  if (target <= now) target.setDate(target.getDate() + 1);

  return Math.round((target.getTime() - now.getTime()) / 60000);
}

/** "8h 12m", "47m". */
function formatGap(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest}m`;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}
