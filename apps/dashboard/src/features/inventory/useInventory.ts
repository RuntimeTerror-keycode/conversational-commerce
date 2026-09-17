import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createProduct,
  fetchCatalogOptions,
  fetchProducts,
  updateProduct,
} from '@/api/inventory';
import { queryKeys } from '@/api/keys';
import type {
  InventoryCreateInput,
  InventoryListQuery,
  InventoryUpdateInput,
} from '@/api/types';

export function useInventory(query: InventoryListQuery) {
  return useQuery({
    queryKey: queryKeys.inventory(query),
    queryFn: () => fetchProducts(query),
    placeholderData: (previous) => previous,
  });
}

export function useUpdateProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, patch }: { id: number; patch: InventoryUpdateInput }) =>
      updateProduct(id, patch),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['inventory'] });
    },
  });
}

/** Catalogue picker for "add product". Only searches once there is a term. */
export function useCatalogOptions(q: string) {
  return useQuery({
    queryKey: queryKeys.catalogOptions(q),
    queryFn: () => fetchCatalogOptions(q),
    enabled: q.trim().length > 1,
  });
}

export function useCreateProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: InventoryCreateInput) => createProduct(input),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['inventory'] });
      void queryClient.invalidateQueries({ queryKey: ['catalog-options'] });
    },
  });
}
