/**
 * All money formatting funnels through here.
 *
 * `Money` is a whole-rupee number today (320 === Rs 320), matching the existing
 * agent/cart stubs. If the backend settles on integer paise instead (Q-X1),
 * this one function changes and nothing else does.
 */
import type { Money, Timestamp } from '@/api/types';

const rupees = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

export function formatMoney(amount: Money): string {
  return rupees.format(amount);
}

const relative = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

/** "just now", "4m ago", "2h ago" — the only time format the order list needs. */
export function timeAgo(at: Timestamp, now: Date = new Date()): string {
  const seconds = Math.round((new Date(at).getTime() - now.getTime()) / 1000);
  const abs = Math.abs(seconds);

  if (abs < 45) return 'just now';
  if (abs < 3600) return relative.format(Math.round(seconds / 60), 'minute');
  if (abs < 86_400) return relative.format(Math.round(seconds / 3600), 'hour');
  return relative.format(Math.round(seconds / 86_400), 'day');
}

const clockTime = new Intl.DateTimeFormat('en-IN', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: true,
});

export function formatTime(at: Timestamp): string {
  return clockTime.format(new Date(at));
}

const dateTime = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hour12: true,
});

export function formatDateTime(at: Timestamp): string {
  return dateTime.format(new Date(at));
}

/** "1 item" / "3 items". Small thing, but "1 items" reads as a bug. */
export function plural(count: number, singular: string, pluralForm?: string): string {
  return `${count} ${count === 1 ? singular : (pluralForm ?? `${singular}s`)}`;
}
