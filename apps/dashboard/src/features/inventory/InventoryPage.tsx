import { useState } from 'react';
import { Boxes, Search } from 'lucide-react';
import { ApiRequestError } from '@/api/client';
import type { ProductListQuery, Retailer } from '@/api/types';
import { PageHeader } from '@/app/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Input } from '@/components/ui/Input';
import { Panel } from '@/components/ui/Panel';
import { Segmented, type SegmentItem } from '@/components/ui/Segmented';
import { Select } from '@/components/ui/Select';
import { Skeleton } from '@/components/ui/Skeleton';
import { Toggle } from '@/components/ui/Toggle';
import { useToast } from '@/components/ui/Toast';
import { useSession } from '@/features/auth/useSession';
import { formatMoney, timeAgo } from '@/lib/format';
import { cn } from '@/lib/cn';
import { StockCell } from './StockCell';
import { SyncBanner } from './SyncBanner';
import { useInventory, useUpdateProduct } from './useInventory';

type StockState = NonNullable<ProductListQuery['stockState']>;

function InventoryTable({ retailer }: { retailer: Retailer }) {
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [stockState, setStockState] = useState<StockState>('all');

  const editable = retailer.inventoryMode === 'managed';
  const { data, isPending, error, refetch, isPlaceholderData } = useInventory({
    q: search || undefined,
    category: category || undefined,
    stockState,
  });
  const update = useUpdateProduct();

  const onError = (mutationError: unknown) => {
    toast(
      mutationError instanceof ApiRequestError &&
        mutationError.code === 'read_only_inventory'
        ? 'This inventory syncs from your billing system and cannot be edited here.'
        : 'Could not save that change.',
      'error',
    );
  };

  const categoryOptions = [
    { value: '', label: 'All categories' },
    ...(data?.categories ?? []).map((name) => ({ value: name, label: name })),
  ];

  const stockFilters: SegmentItem<StockState>[] = [
    { value: 'all', label: 'All', count: data?.counts.total },
    { value: 'low', label: 'Low', count: data?.counts.low, tone: 'new' },
    { value: 'out', label: 'Out', count: data?.counts.out },
  ];

  const products = data?.data ?? [];

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented items={stockFilters} value={stockState} onChange={setStockState} />

        <div className="flex flex-1 flex-wrap items-center justify-end gap-2">
          <Select
            aria-label="Category"
            options={categoryOptions}
            value={category}
            onChange={(event) => setCategory(event.target.value)}
          />
          <div className="w-full sm:w-60">
            <Input
              placeholder="Search products"
              aria-label="Search inventory"
              leading={<Search className="size-3.5" aria-hidden />}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
        </div>
      </div>

      <Panel>
        {isPending && !data ? (
          <div className="divide-y divide-line-soft">
            {Array.from({ length: 7 }, (_, index) => (
              <div key={index} className="flex items-center gap-4 px-4 py-3">
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-14" />
              </div>
            ))}
          </div>
        ) : error ? (
          <ErrorState title="Could not load inventory" onRetry={() => void refetch()} />
        ) : products.length === 0 ? (
          <EmptyState
            icon={<Boxes className="size-4.5" aria-hidden />}
            title="No products match"
            description="Try a different search or clear the filters."
          />
        ) : (
          <div className="overflow-x-auto">
            <table
              className={cn(
                'w-full min-w-md border-collapse transition-opacity duration-200',
                isPlaceholderData && 'opacity-50',
              )}
            >
              <thead>
                <tr className="border-b border-line bg-paper text-left">
                  <th className="label px-4 py-2.5 font-semibold">Product</th>
                  <th className="label hidden px-4 py-2.5 font-semibold lg:table-cell">
                    Category
                  </th>
                  <th className="label px-4 py-2.5 text-right font-semibold">Price</th>
                  {editable ? (
                    <th className="label px-4 py-2.5 text-right font-semibold">Stock</th>
                  ) : null}
                  <th className="label px-4 py-2.5 font-semibold">Availability</th>
                  <th className="label hidden px-4 py-2.5 text-right font-semibold xl:table-cell">
                    Updated
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-line-soft">
                {products.map((product) => (
                  <tr
                    key={product.id}
                    className={cn(
                      'group transition-colors duration-150 hover:bg-paper',
                      !product.inStock && 'bg-bad-soft/30',
                    )}
                  >
                    <td className="px-4 py-2.5">
                      <p className="text-base font-medium">{product.name}</p>
                      <p className="text-xs text-ink-4">
                        <span className="tnum">{product.sku}</span>
                        {product.unit ? ` · ${product.unit}` : ''}
                      </p>
                      {/*
                        Aliases are the highest-leverage field in the product
                        for Kerala — "ari" is how a customer asks for rice, and
                        the alias table is what turns that into a match.
                      */}
                      {product.aliases.length > 0 ? (
                        <p className="mt-1 flex flex-wrap gap-1">
                          {product.aliases.slice(0, 3).map((alias) => (
                            <span
                              key={alias}
                              className="rounded bg-sunk px-1.5 py-px text-2xs tracking-normal text-ink-3"
                            >
                              {alias}
                            </span>
                          ))}
                        </p>
                      ) : null}
                    </td>

                    <td className="hidden px-4 py-2.5 text-sm text-ink-2 lg:table-cell">
                      {product.category ?? '—'}
                    </td>

                    <td className="tnum px-4 py-2.5 text-right text-base font-medium">
                      {formatMoney(product.price)}
                    </td>

                    {editable ? (
                      <td className="px-4 py-2.5 text-right">
                        <StockCell
                          value={product.stockQuantity ?? 0}
                          isLow={product.isLow}
                          editable={editable}
                          onCommit={(stockQuantity) =>
                            update.mutate(
                              { productId: product.id, patch: { stockQuantity } },
                              { onError },
                            )
                          }
                        />
                      </td>
                    ) : null}

                    <td className="px-4 py-2.5">
                      {editable ? (
                        <div className="flex items-center gap-2.5">
                          <Toggle
                            checked={product.inStock}
                            offTone="bad"
                            label={`${product.name} in stock`}
                            onChange={(inStock) =>
                              update.mutate(
                                { productId: product.id, patch: { inStock } },
                                { onError },
                              )
                            }
                          />
                          {product.isLow ? (
                            <Badge tone="new" dot>
                              Low
                            </Badge>
                          ) : !product.inStock ? (
                            <Badge tone="bad" dot>
                              Out
                            </Badge>
                          ) : null}
                        </div>
                      ) : product.inStock ? (
                        <Badge tone="done" dot>
                          In stock
                        </Badge>
                      ) : (
                        <Badge tone="bad" dot>
                          Out of stock
                        </Badge>
                      )}
                    </td>

                    <td className="hidden px-4 py-2.5 text-right text-xs whitespace-nowrap text-ink-4 xl:table-cell">
                      {timeAgo(product.updatedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  );
}

export function InventoryPage() {
  const session = useSession();
  const retailer = session.data?.retailer;

  return (
    <>
      <PageHeader
        title="Inventory"
        subtitle={
          retailer
            ? retailer.inventoryMode === 'managed'
              ? 'Managed in this portal'
              : 'Synced from your billing system'
            : null
        }
      />

      <div className="flex flex-col gap-4 px-5 py-5 md:px-7">
        {retailer ? (
          <>
            <SyncBanner retailer={retailer} />
            <InventoryTable retailer={retailer} />
          </>
        ) : (
          <Skeleton className="h-96 rounded-xl" />
        )}
      </div>
    </>
  );
}
