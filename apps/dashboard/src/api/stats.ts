import { request } from './client';
import type { Retailer, StatsSummary } from './types';

export function fetchStats(): Promise<StatsSummary> {
  return request<StatsSummary>('/stats/summary', { query: { range: 'today' } });
}

export function updateRetailer(patch: Partial<Retailer>): Promise<Retailer> {
  return request<Retailer>('/retailer', { method: 'PATCH', body: patch });
}
