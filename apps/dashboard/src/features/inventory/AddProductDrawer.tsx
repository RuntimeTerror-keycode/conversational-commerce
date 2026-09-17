import { useState } from 'react';
import { PackagePlus, Search } from 'lucide-react';
import { ApiRequestError } from '@/api/client';
import type { CatalogItem } from '@/api/types';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Drawer } from '@/components/ui/Drawer';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { cn } from '@/lib/cn';
import { useCatalogOptions, useCreateProduct } from './useInventory';

interface AddProductDrawerProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Stocking an item, not inventing one.
 *
 * Products live in a shared catalogue that every shop draws from — the
 * shopkeeper picks what they sell and sets their own price and count. That is
 * also what keeps the WhatsApp agent able to match "Parle G" across shops
 * instead of against a hundred hand-typed spellings.
 */
export function AddProductDrawer({ open, onClose }: AddProductDrawerProps) {
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [picked, setPicked] = useState<CatalogItem | null>(null);
  const [price, setPrice] = useState('');
  const [stock, setStock] = useState('');
  const [localName, setLocalName] = useState('');

  const { data: options, isPending } = useCatalogOptions(search);
  const create = useCreateProduct();

  const reset = () => {
    setSearch('');
    setPicked(null);
    setPrice('');
    setStock('');
    setLocalName('');
  };

  const close = () => {
    reset();
    onClose();
  };

  const submit = () => {
    if (!picked) return;

    const sellingPrice = Number(price);
    if (!Number.isFinite(sellingPrice) || sellingPrice < 0) {
      toast('Enter a valid selling price.', 'error');
      return;
    }

    create.mutate(
      {
        catalogId: picked.catalogId,
        sellingPrice,
        stockQuantity: stock === '' ? 0 : Math.floor(Number(stock)),
        localName: localName.trim() || null,
      },
      {
        onSuccess: () => {
          toast(`${picked.name} added`, 'success');
          close();
        },
        onError: (error) =>
          toast(
            error instanceof ApiRequestError
              ? error.message
              : 'Could not add that product.',
            'error',
          ),
      },
    );
  };

  return (
    <Drawer
      open={open}
      onClose={close}
      title={<p className="text-h3">Add a product</p>}
      footer={
        picked ? (
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => setPicked(null)}>
              Back
            </Button>
            <Button
              variant="primary"
              className="flex-1"
              loading={create.isPending}
              disabled={price === ''}
              onClick={submit}
            >
              Add to shop
            </Button>
          </div>
        ) : undefined
      }
    >
      {picked ? (
        <div className="flex flex-col gap-5">
          <div className="rounded-lg border border-border bg-canvas px-3.5 py-3">
            <p className="text-body font-medium">{picked.name}</p>
            <p className="text-caption text-text-muted">
              {[picked.brand, picked.category, picked.unit].filter(Boolean).join(' · ')}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Your selling price"
              inputMode="decimal"
              autoFocus
              value={price}
              onChange={(event) => setPrice(event.target.value)}
            />
            <Input
              label="Stock count"
              inputMode="numeric"
              placeholder="0"
              value={stock}
              onChange={(event) => setStock(event.target.value)}
            />
          </div>

          <Input
            label="Your name for it"
            placeholder={picked.name}
            hint="What customers call it — this is what makes a Malayalam message match"
            value={localName}
            onChange={(event) => setLocalName(event.target.value)}
          />
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <Input
            placeholder="Search the catalogue"
            aria-label="Search the catalogue"
            autoFocus
            leading={<Search className="size-3.5" aria-hidden />}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />

          {search.trim().length <= 1 ? (
            <EmptyState
              icon={<PackagePlus className="size-4.5" aria-hidden />}
              title="Find something to stock"
              description="Search by name, brand, or SKU."
            />
          ) : isPending ? (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 4 }, (_, index) => (
                <Skeleton key={index} className="h-14" />
              ))}
            </div>
          ) : options && options.length > 0 ? (
            <div className="divide-y divide-border overflow-hidden rounded-lg border border-border">
              {options.map((item) => (
                <button
                  key={item.catalogId}
                  type="button"
                  disabled={item.alreadyStocked}
                  onClick={() => setPicked(item)}
                  className={cn(
                    'flex w-full items-center gap-3 px-3.5 py-3 text-left transition-colors',
                    item.alreadyStocked
                      ? 'cursor-not-allowed opacity-60'
                      : 'hover:bg-surface-hover',
                  )}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-body font-medium">
                      {item.name}
                    </span>
                    <span className="block truncate text-caption text-text-muted">
                      {[item.brand, item.category, item.unit].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                  {item.alreadyStocked ? <Badge tone="neutral">Stocked</Badge> : null}
                </button>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<PackagePlus className="size-4.5" aria-hidden />}
              title="Nothing in the catalogue matches"
              description="Only items in the shared catalogue can be stocked."
            />
          )}
        </div>
      )}
    </Drawer>
  );
}
