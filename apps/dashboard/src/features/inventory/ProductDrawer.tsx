import { useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { ApiRequestError } from '@/api/client';
import type { InventoryUpdateInput, Product } from '@/api/types';
import { Button } from '@/components/ui/Button';
import { Drawer } from '@/components/ui/Drawer';
import { Input } from '@/components/ui/Input';
import { Toggle } from '@/components/ui/Toggle';
import { useToast } from '@/components/ui/Toast';
import { useUpdateProduct } from './useInventory';

interface ProductDrawerProps {
  product: Product | null;
  open: boolean;
  onClose: () => void;
}

const numeric = (message: string) =>
  z.string().refine((value) => value === '' || Number.isFinite(Number(value)), message);

/**
 * Only the four fields `PATCH /api/inventory/:id` actually accepts.
 *
 * The API exposes no create or delete for products, and name / SKU / brand /
 * category / unit / local name all live on the shared catalogue rather than on
 * the shop's row — so they are shown read-only here rather than offered as
 * inputs that would silently do nothing.
 */
const productSchema = z.object({
  sellingPrice: numeric('Enter a valid price').refine(
    (v) => v === '' || Number(v) >= 0,
    'Price cannot be negative',
  ),
  stockQuantity: numeric('Enter a valid stock count').refine(
    (v) => v === '' || Number(v) >= 0,
    'Stock cannot be negative',
  ),
  lowStockThreshold: numeric('Enter a valid threshold'),
  inStock: z.boolean(),
});

type ProductForm = z.infer<typeof productSchema>;

function toForm(product: Product): ProductForm {
  return {
    sellingPrice: String(product.sellingPrice),
    stockQuantity: String(product.stockQuantity),
    lowStockThreshold: String(product.lowStockThreshold),
    inStock: product.inStock,
  };
}

function ReadOnlyRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5">
      <span className="text-caption text-text-muted uppercase tracking-wide">{label}</span>
      <span className="text-small text-text-secondary">{value}</span>
    </div>
  );
}

/**
 * Edit a shop's own price and stock — managed mode only.
 *
 * Stock count is an ordinary field here, not a separate mechanism: the same
 * form a shopkeeper opens for a price change is the one that corrects a
 * stock-take.
 */
export function ProductDrawer({ product, open, onClose }: ProductDrawerProps) {
  const toast = useToast();
  const update = useUpdateProduct();

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isDirty },
  } = useForm<ProductForm>({ resolver: zodResolver(productSchema) });

  useEffect(() => {
    if (product) reset(toForm(product));
  }, [product, reset]);

  if (!product) return null;

  const onSubmit = handleSubmit((values) => {
    const patch: InventoryUpdateInput = {
      sellingPrice: values.sellingPrice === '' ? undefined : Number(values.sellingPrice),
      stockQuantity:
        values.stockQuantity === '' ? undefined : Math.floor(Number(values.stockQuantity)),
      lowStockThreshold:
        values.lowStockThreshold === ''
          ? undefined
          : Math.floor(Number(values.lowStockThreshold)),
      inStock: values.inStock,
    };

    update.mutate(
      { id: product.id, patch },
      {
        onSuccess: () => {
          toast(`${product.name} updated`, 'success');
          onClose();
        },
        onError: (error) => {
          toast(
            error instanceof ApiRequestError && error.status === 403
              ? 'This inventory syncs from your billing system and cannot be edited here.'
              : 'Could not save that change.',
            'error',
          );
        },
      },
    );
  });

  const inStock = watch('inStock');

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={
        <div className="min-w-0">
          <p className="truncate text-h3">{product.name}</p>
          {product.localName ? (
            <p className="truncate text-caption text-text-muted">{product.localName}</p>
          ) : null}
        </div>
      }
      footer={
        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            className="flex-1"
            loading={update.isPending}
            disabled={!isDirty}
            onClick={() => void onSubmit()}
          >
            Save changes
          </Button>
        </div>
      }
    >
      <form
        onSubmit={onSubmit}
        noValidate
        className="flex flex-col gap-5"
      >
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Selling price"
            inputMode="decimal"
            error={errors.sellingPrice?.message}
            {...register('sellingPrice')}
          />
          <Input
            label="Stock count"
            inputMode="numeric"
            error={errors.stockQuantity?.message}
            {...register('stockQuantity')}
          />
        </div>

        <Input
          label="Low stock threshold"
          inputMode="numeric"
          hint="Flagged as low at or below this count"
          error={errors.lowStockThreshold?.message}
          {...register('lowStockThreshold')}
        />

        <div className="flex items-center justify-between gap-4 rounded-lg border border-border px-3.5 py-3">
          <div>
            <p className="text-body font-medium">Available to customers</p>
            <p className="text-caption text-text-muted">
              Turn this off and the assistant stops offering it on WhatsApp
            </p>
          </div>
          <Toggle
            checked={inStock}
            label="Available to customers"
            onChange={(value) => setValue('inStock', value, { shouldDirty: true })}
          />
        </div>

        {/* Catalogue-owned fields. Shown for context, not editable here. */}
        <div className="rounded-lg border border-border bg-canvas px-3.5 py-2.5">
          <ReadOnlyRow label="SKU" value={product.sku ?? '—'} />
          <ReadOnlyRow label="Brand" value={product.brand ?? '—'} />
          <ReadOnlyRow label="Category" value={product.category ?? '—'} />
          <ReadOnlyRow label="Unit" value={product.unit ?? '—'} />
          <ReadOnlyRow label="Regular price" value={String(product.regularPrice)} />
        </div>
      </form>
    </Drawer>
  );
}
