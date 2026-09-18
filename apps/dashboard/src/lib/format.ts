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

/**
 * "7 min", "1h 53m" — how long a stage took.
 *
 * Rounds to the minute because nobody packs an order in 38 seconds and the
 * extra precision would only make the figure look more exact than it is.
 */
export function formatDuration(seconds: number): string {
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;

  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}

/** "07:00" from an hour index. */
export function formatHour(hour: number): string {
  return `${String(hour).padStart(2, '0')}:00`;
}

/**
 * "+91 98471 00001" from "919847100001".
 *
 * Stored as raw digits, never shown as them — a twelve-digit run is unreadable
 * and unmemorable, and this is the number the shopkeeper recognises as theirs.
 * Anything that does not look like an Indian number is returned untouched
 * rather than mangled into a shape it is not.
 */
export function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) {
    return `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `${digits.slice(0, 5)} ${digits.slice(5)}`;
  }
  return phone;
}

/** "SK" from "Suresh Kumar" — at most two letters. */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}
