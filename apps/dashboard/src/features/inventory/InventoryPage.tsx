import { useState } from 'react';
import { Boxes, Plus, Search } from 'lucide-react';
import { ApiRequestError } from '@/api/client';
import type { Product, ProductListQuery, Retailer } from '@/api/types';
import { PageHeader } from '@/app/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Input } from '@/components/ui/Input';
import { Panel } from '@/components/ui/Panel';
import { Segmented, type SegmentItem } from '@/components/ui/Segmented';
import { Select } from '@/components/ui/Select';
import { SkeletonTable } from '@/components/ui/Skeleton';
import { Toggle } from '@/components/ui/Toggle';
import { useToast } from '@/components/ui/Toast';
import { useSession } from '@/features/auth/useSession';
import { formatMoney, timeAgo } from '@/lib/format';
import { cn } from '@/lib/cn';
import { ProductDrawer } from './ProductDrawer';
import { StockCell } from './StockCell';
import { SyncBanner } from './SyncBanner';
import { useInventory, useUpdateProduct } from './useInventory';

type StockState = NonNullable<ProductListQuery['stockState']>;

function AvailabilityBadge({ product, editable }: { product: Product; editable: boolean }) {
  if (editable && product.isLow) return <Badge tone="warning">Low</Badge>;
  if (!product.inStock) return <Badge tone="danger">Out of stock</Badge>;
  return <Badge tone="success">In stock</Badge>;
}

function InventoryTable({ retailer }: { retailer: Retailer }) {
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [stockState, setStockState] = useState<StockState>('all');
  const [drawerProduct, setDrawerProduct] = useState<Product | null | 'new'>(null);

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
    { value: 'low', label: 'Low', count: data?.counts.low, tone: 'attention' },
    { value: 'out', label: 'Out', count: data?.counts.out },
  ];

  const products = data?.data ?? [];
  const hasFilters = Boolean(search || category || stockState !== 'all');

  const clearFilters = () => {
    setSearch('');
    setCategory('');
    setStockState('all');
  };

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented items={stockFilters} value={stockState} onChange={setStockState} />

        <div className="flex flex-1 flex-wrap items-center justify-end gap-2">
          <Select
            aria-label="Category"
            options={categoryOptions}
            value={category}
            onValueChange={setCategory}
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
          {editable ? (
            <Button variant="primary" onClick={() => setDrawerProduct('new')}>
              <Plus className="size-3.5" aria-hidden />
              Add product
            </Button>
          ) : null}
        </div>
      </div>

      <Panel>
        {isPending && !data ? (
          <SkeletonTable editable={editable} />
        ) : error ? (
          <ErrorState title="Could not load inventory" onRetry={() => void refetch()} />
        ) : products.length === 0 ? (
          <EmptyState
            icon={<Boxes className="size-4.5" aria-hidden />}
            title={hasFilters ? 'No products match these filters' : 'No products yet'}
            description={
              hasFilters
                ? 'Try a different search or clear the filters.'
                : 'Add your first product to start tracking inventory.'
            }
            action={
              hasFilters ? (
                <Button variant="secondary" onClick={clearFilters}>Clear filters</Button>
              ) : editable ? (
                <Button variant="primary" onClick={() => setDrawerProduct('new')}>Add product</Button>
              ) : undefined
            }
          />
        ) : (
          <>
            {/* Table at md and up. */}
            <div className={cn('hidden overflow-x-auto md:block', isPlaceholderData && 'opacity-50')}>
              <table className="w-full border-collapse transition-opacity duration-200">
                <caption className="sr-only">Product inventory</caption>
                <thead>
                  <tr className="border-b border-border bg-canvas text-left">
                    <th scope="col" className="px-4 py-2.5 text-caption font-semibold text-text-muted uppercase tracking-wide">Product</th>
                    <th scope="col" className="hidden px-4 py-2.5 text-caption font-semibold text-text-muted uppercase tracking-wide lg:table-cell">Category</th>
                    <th scope="col" className="px-4 py-2.5 text-right text-caption font-semibold text-text-muted uppercase tracking-wide">Price</th>
                    {editable ? (
                      <th scope="col" className="px-4 py-2.5 text-right text-caption font-semibold text-text-muted uppercase tracking-wide">Stock</th>
                    ) : null}
                    <th scope="col" className="px-4 py-2.5 text-caption font-semibold text-text-muted uppercase tracking-wide">Availability</th>
                    <th scope="col" className="hidden px-4 py-2.5 text-right text-caption font-semibold text-text-muted uppercase tracking-wide xl:table-cell">Updated</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-border">
                  {products.map((product) => (
                    <tr
                      key={product.id}
                      className={cn(
                        'group transition-colors duration-150 hover:bg-surface-hover',
                        !product.inStock && 'bg-danger-bg/30',
                      )}
                    >
                      <td className="px-4 py-2.5">
                        <button
                          type="button"
                          onClick={() => editable && setDrawerProduct(product)}
                          className={cn('text-left', editable && 'hover:underline')}
                        >
                          <p className="text-body font-medium">{product.name}</p>
                        </button>
                        <p className="text-caption text-text-disabled">
                          <span className="font-numeric">{product.sku}</span>
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
                                className="rounded bg-surface-sunken px-1.5 py-px text-caption tracking-normal text-text-muted"
                              >
                                {alias}
                              </span>
                            ))}
                          </p>
                        ) : null}
                      </td>

                      <td className="hidden px-4 py-2.5 text-small text-text-secondary lg:table-cell">
                        {product.category ?? '—'}
                      </td>

                      <td className="font-numeric px-4 py-2.5 text-right text-body font-medium">
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
                              offTone="danger"
                              label={`${product.name} in stock`}
                              onChange={(inStock) =>
                                update.mutate(
                                  { productId: product.id, patch: { inStock } },
                                  { onError },
                                )
                              }
                            />
                            <AvailabilityBadge product={product} editable={editable} />
                          </div>
                        ) : (
                          <AvailabilityBadge product={product} editable={editable} />
                        )}
                      </td>

                      <td className="hidden px-4 py-2.5 text-right text-caption whitespace-nowrap text-text-disabled xl:table-cell">
                        {timeAgo(product.updatedAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Card list below md — DESIGN_SYSTEM §10: tables stack into cards. */}
            <div className={cn('divide-y divide-border md:hidden', isPlaceholderData && 'opacity-50')}>
              {products.map((product) => (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => editable && setDrawerProduct(product)}
                  className="flex w-full flex-col gap-1.5 px-4 py-3.5 text-left"
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-body font-medium">{product.name}</p>
                    <p className="font-numeric shrink-0 text-body font-medium">{formatMoney(product.price)}</p>
                  </div>
                  <p className="text-caption text-text-disabled">
                    {product.category ?? '—'}
                    {product.unit ? ` · ${product.unit}` : ''}
                  </p>
                  <AvailabilityBadge product={product} editable={editable} />
                </button>
              ))}
            </div>
          </>
        )}
      </Panel>

      {editable ? (
        <ProductDrawer
          product={drawerProduct === 'new' || drawerProduct === null ? null : drawerProduct}
          open={drawerProduct !== null}
          onClose={() => setDrawerProduct(null)}
        />
      ) : null}
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

      <div className="mx-auto flex max-w-content flex-col gap-4 px-4 py-6 md:px-8">
        {retailer ? (
          <>
            <SyncBanner retailer={retailer} />
            <InventoryTable retailer={retailer} />
          </>
        ) : (
          <Panel className="h-96" />
        )}
      </div>
    </>
  );
}
