import { useQuery } from '@tanstack/react-query';
import { fetchDashboardStats } from '@/api/stats';
import { queryKeys } from '@/api/keys';

/**
 * Aggregates for the Today screen.
 *
 * Polled far less often than the order queue: a day's takings and a week's
 * busy hours do not move between blinks, and these are the most expensive
 * queries the dashboard makes.
 */
export function useDashboardStats() {
  return useQuery({
    queryKey: queryKeys.dashboardStats,
    queryFn: fetchDashboardStats,
    refetchInterval: 60_000,
  });
}
