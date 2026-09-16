import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchProducts, updateProduct } from '@/api/inventory';
import { queryKeys } from '@/api/keys';
import type { ProductListQuery, ProductPatch } from '@/api/types';

export function useInventory(query: ProductListQuery) {
  return useQuery({
    queryKey: queryKeys.inventory(query),
    queryFn: () => fetchProducts(query),
    placeholderData: (previous) => previous,
  });
}

export function useUpdateProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ productId, patch }: { productId: string; patch: ProductPatch }) =>
      updateProduct(productId, patch),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['inventory'] });
      void queryClient.invalidateQueries({ queryKey: queryKeys.stats });
    },
  });
}
