import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchShopSettings, updateShopSettings } from '@/api/shop';
import { queryKeys } from '@/api/keys';
import type { ShopSettingsUpdate } from '@/api/types';

/**
 * Re-fetched every minute so `openState` stays honest.
 *
 * The state is derived server-side from the current clock, so a shop that
 * closes at 22:00 flips to "Closed" on its own — without the poll the
 * dashboard would keep claiming it is open until someone reloaded.
 */
export function useShopSettings() {
  return useQuery({
    queryKey: queryKeys.shopSettings,
    queryFn: fetchShopSettings,
    refetchInterval: 60_000,
  });
}

export function useUpdateShopSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (patch: ShopSettingsUpdate) => updateShopSettings(patch),
    onSuccess: (settings) => {
      queryClient.setQueryData(queryKeys.shopSettings, settings);
      // The sidebar reads the shop from the stored session, which does not
      // know about this change.
      void queryClient.invalidateQueries({ queryKey: queryKeys.session });
    },
  });
}
