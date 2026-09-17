import { request } from './client';
import type { DashboardStats } from './types';

export function fetchDashboardStats(): Promise<DashboardStats> {
  return request<DashboardStats>('/stats/today');
}
