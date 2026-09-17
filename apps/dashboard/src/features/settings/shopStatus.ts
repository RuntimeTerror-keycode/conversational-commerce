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
