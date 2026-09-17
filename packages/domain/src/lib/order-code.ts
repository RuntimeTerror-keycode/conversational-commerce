import { randomBytes } from 'crypto';

export function generateOrderCode(): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = randomBytes(2).toString('hex').toUpperCase();
  return `ORD-${ts}-${rand}`;
}
