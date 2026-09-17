import { useState } from 'react';
import { Ban, Boxes, Info, Plus, Search, TriangleAlert } from 'lucide-react';
import { ApiRequestError } from '@/api/client';
import type { InventoryListQuery, Product, SessionShop } from '@/api/types';
import { PageHeader } from '@/app/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Input } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';
import { Toggle } from '@/components/ui/Toggle';
import { useToast } from '@/components/ui/Toast';
import { useSession } from '@/features/auth/useSession';
import { cn } from '@/lib/cn';
import { AddProductDrawer } from './AddProductDrawer';
import { CategoryChips } from './CategoryChips';
import { PriceCell } from './PriceCell';
import { StockStepper } from './StockStepper';
import { SyncBanner } from './SyncBanner';
import { useInventory, useUpdateProduct } from './useInventory';

/** 'all' is UI-only — the API filter is simply omitted for it. */
type StockState = NonNullable<InventoryListQuery['stockState']> | 'all';

const grid =
  'grid grid-cols-[minmax(0,1fr)_176px_132px_196px_128px] items-center gap-4 px-6';

function InventoryTable({ shop }: { shop: SessionShop }) {
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  // Kept so the dashboard can deep-link to a filtered view; there is no
  // on-screen control for it, per the design.
  const [stockState, setStockState] = useState<StockState>('all');

  const editable = shop.inventoryMode === 'managed';
  const { data, isPending, error, refetch, isPlaceholderData } = useInventory({
    q: search || undefined,
    category: category || undefined,
    stockState: stockState === 'all' ? undefined : stockState,
  });
  const update = useUpdateProduct();

  const onError = (mutationError: unknown) => {
    toast(
      mutationError instanceof ApiRequestError && mutationError.status === 403
        ? 'This inventory syncs from your billing system and cannot be edited here.'
        : 'Could not save that change.',
      'error',
    );
  };

  const patch = (product: Product, body: Parameters<typeof update.mutate>[0]['patch']) =>
    update.mutate({ id: product.id, patch: body }, { onError });

  const products = data?.data ?? [];
  const hasFilters = Boolean(search || category || stockState !== 'all');

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <div className="w-full sm:w-[340px]">
          <Input
            placeholder="Search your products"
            aria-label="Search inventory"
            leading={<Search className="size-3.5" aria-hidden />}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        <CategoryChips
          categories={data?.categories ?? []}
          value={category}
          total={data?.counts.total}
          onChange={setCategory}
        />
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-surface">
        <div
          className={cn(
            grid,
            'border-b border-border bg-surface-sunken py-2.5 text-caption text-text-muted uppercase',
          )}
        >
          <div>Product · your name</div>
          <div>Category</div>
          <div>Your price</div>
          <div>Stock</div>
          <div className="text-right">Available</div>
        </div>

        {isPending && !data ? (
          <div className="divide-y divide-neutral-bg">
            {Array.from({ length: 6 }, (_, index) => (
              <div key={index} className={cn(grid, 'py-3.5')}>
                {Array.from({ length: 5 }, (_, cell) => (
                  <Skeleton key={cell} className="h-8" />
                ))}
              </div>
            ))}
          </div>
        ) : error ? (
          <ErrorState title="Could not load inventory" onRetry={() => void refetch()} />
        ) : products.length === 0 ? (
          <EmptyState
            icon={<Boxes className="size-4.5" aria-hidden />}
            title={hasFilters ? 'No products match these filters' : 'No products yet'}
            description={
              hasFilters
                ? 'Try a different search or clear the filters.'
                : 'Products come from the shared catalogue — nothing is stocked here yet.'
            }
            action={
              hasFilters ? (
                <Button
                  onClick={() => {
                    setSearch('');
                    setCategory('');
                    setStockState('all');
                  }}
                >
                  Clear filters
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className={isPlaceholderData ? 'opacity-50 transition-opacity' : undefined}>
            {products.map((product) => (
              <div
                key={product.id}
                className={cn(
                  grid,
                  'border-b border-neutral-bg py-3 last:border-b-0',
                  'transition-colors duration-[120ms] hover:bg-surface-hover',
                  !product.inStock && 'text-text-muted opacity-70',
                )}
              >
                <div className="flex min-w-0 flex-col gap-0.5">
                  {/*
                    The shop's own word for it leads — "ari", "ചായ പൊടി" — because
                    that is what makes a Malayalam message match. The catalogue
                    name sits under it for when the two differ.
                  */}
                  <span className="truncate text-[14.5px] font-semibold">
                    {product.localName ?? product.name}
                  </span>
                  {product.localName ? (
                    <span className="truncate text-xs font-normal text-text-muted">
                      {product.name}
                    </span>
                  ) : null}
                </div>

                <div className="truncate text-small text-text-secondary">
                  {product.category ?? '—'}
                </div>

                <PriceCell
                  value={product.sellingPrice}
                  disabled={!editable}
                  onCommit={(sellingPrice) => patch(product, { sellingPrice })}
                />

                <div className="flex items-center gap-2.5">
                  <StockStepper
                    value={product.stockQuantity}
                    isLow={product.isLow}
                    disabled={!editable}
                    onCommit={(stockQuantity) => patch(product, { stockQuantity })}
                  />
                  {product.isLow ? (
                    <Badge tone="warning" icon={TriangleAlert}>
                      Low
                    </Badge>
                  ) : !product.inStock ? (
                    <Badge tone="neutral" icon={Ban}>
                      Out
                    </Badge>
                  ) : null}
                </div>

                <div className="flex justify-end">
                  <Toggle
                    checked={product.inStock}
                    disabled={!editable}
                    label={`${product.localName ?? product.name} available`}
                    onChange={(inStock) => patch(product, { inStock })}
                  />
                </div>
              </div>
            ))}
          </div>
        )}

      </div>

      <div className="flex items-start gap-2.5 rounded-lg border border-border bg-surface px-3.5 py-3">
        <Info className="mt-0.5 size-4 shrink-0 text-text-disabled" aria-hidden />
        <p className="text-small text-text-secondary">
          Products are never deleted. Switch one off and customers stop being offered
          it, while every past order still reads correctly.
          {editable
            ? ' Price and stock save as you type — there is no Save button to forget.'
            : ''}
        </p>
      </div>
    </>
  );
}

export function InventoryPage() {
  const session = useSession();
  const shop = session.data?.shop;
  const [addOpen, setAddOpen] = useState(false);
  const editable = shop?.inventoryMode === 'managed';

  return (
    <>
      <PageHeader
        eyebrow="What the shop sells"
        title="Inventory"
        actions={
          editable ? (
            <Button variant="primary" onClick={() => setAddOpen(true)}>
              <Plus className="size-3.5" aria-hidden />
              Add from catalogue
            </Button>
          ) : undefined
        }
      />

      <div className="mx-auto flex max-w-content flex-col gap-5 px-4 pb-[30px] md:px-9">
        {shop ? (
          <>
            <SyncBanner shop={shop} />
            <InventoryTable shop={shop} />
          </>
        ) : (
          <Skeleton className="h-96 rounded-lg" />
        )}
      </div>

      {editable ? (
        <AddProductDrawer open={addOpen} onClose={() => setAddOpen(false)} />
      ) : null}
    </>
  );
}
