import { useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Trash2 } from 'lucide-react';
import { ApiRequestError } from '@/api/client';
import type { Product } from '@/api/types';
import { Button } from '@/components/ui/Button';
import { Drawer } from '@/components/ui/Drawer';
import { Input } from '@/components/ui/Input';
import { Toggle } from '@/components/ui/Toggle';
import { useToast } from '@/components/ui/Toast';
import { useCreateProduct, useDeleteProduct, useUpdateProduct } from './useInventory';

interface ProductDrawerProps {
  /** `null` = create mode. */
  product: Product | null;
  open: boolean;
  onClose: () => void;
}

const numeric = (message: string) =>
  z
    .string()
    .refine((value) => value === '' || Number.isFinite(Number(value)), message);

/**
 * Form-level schema, kept as strings (inputs are always strings) — validated
 * here, converted to the numeric ProductCreate/ProductPatch shape (src/api/
 * types.ts) on submit. Non-negative price is the one hard rule; everything
 * else mirrors what those types already allow as optional.
 */
const productSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  sku: z.string(),
  brand: z.string(),
  category: z.string(),
  unit: z.string().min(1, 'Unit is required'),
  price: numeric('Enter a valid price').refine((v) => v === '' || Number(v) >= 0, 'Price cannot be negative'),
  stockQuantity: numeric('Enter a valid stock count'),
  lowStockThreshold: numeric('Enter a valid threshold'),
  aliases: z.string(),
  inStock: z.boolean(),
});

type ProductForm = z.infer<typeof productSchema>;

const emptyForm: ProductForm = {
  name: '',
  sku: '',
  brand: '',
  category: '',
  unit: '',
  price: '',
  stockQuantity: '',
  lowStockThreshold: '',
  aliases: '',
  inStock: true,
};

function toForm(product: Product): ProductForm {
  return {
    name: product.name,
    sku: product.sku ?? '',
    brand: product.brand ?? '',
    category: product.category ?? '',
    unit: product.unit,
    price: String(product.price),
    stockQuantity: product.stockQuantity !== null ? String(product.stockQuantity) : '',
    lowStockThreshold: product.lowStockThreshold !== null ? String(product.lowStockThreshold) : '',
    aliases: product.aliases.join(', '),
    inStock: product.inStock,
  };
}

/**
 * Create/edit, in one drawer — managed mode only.
 *
 * Stock count is an ordinary field here, not a separate mechanism
 * (docs/frontend-contract.md §3.4) — the same field a shopkeeper edits for a
 * price change is the one that corrects a stock-take.
 *
 * Aliases are the highest-leverage field for the Kerala catalogue (CLAUDE.md:
 * "the hand-seeded alias table matters more than the embedding model"), so
 * they get a first-class field rather than being buried as advanced options.
 */
export function ProductDrawer({ product, open, onClose }: ProductDrawerProps) {
  const toast = useToast();
  const create = useCreateProduct();
  const update = useUpdateProduct();
  const remove = useDeleteProduct();

  const isEdit = Boolean(product);
  const saving = create.isPending || update.isPending;

  const {
    register,
    handleSubmit,
    reset,
    setError,
    watch,
    setValue,
    formState: { errors },
  } = useForm<ProductForm>({
    resolver: zodResolver(productSchema),
    defaultValues: emptyForm,
  });

  const inStock = watch('inStock');

  useEffect(() => {
    reset(product ? toForm(product) : emptyForm);
  }, [product, open, reset]);

  const onSubmit = handleSubmit((values) => {
    const price = Number(values.price);
    const stockQuantity = values.stockQuantity === '' ? 0 : Number(values.stockQuantity);
    const aliases = values.aliases
      .split(',')
      .map((alias) => alias.trim())
      .filter(Boolean);

    const onSuccess = () => {
      toast(isEdit ? 'Product updated' : 'Product added', 'success');
      onClose();
    };
    const onError = (mutationError: unknown) => {
      setError('root', {
        message:
          mutationError instanceof ApiRequestError
            ? mutationError.message
            : 'Could not save this product.',
      });
    };

    if (isEdit && product) {
      update.mutate(
        {
          productId: product.id,
          patch: {
            name: values.name,
            sku: values.sku || null,
            brand: values.brand || null,
            category: values.category || null,
            unit: values.unit,
            price,
            stockQuantity,
            lowStockThreshold: values.lowStockThreshold === '' ? null : Number(values.lowStockThreshold),
            aliases,
          },
        },
        { onSuccess, onError },
      );
    } else {
      create.mutate(
        {
          name: values.name,
          unit: values.unit,
          price,
          inStock: values.inStock,
          stockQuantity,
          sku: values.sku || undefined,
          brand: values.brand || undefined,
          category: values.category || undefined,
          lowStockThreshold: values.lowStockThreshold === '' ? undefined : Number(values.lowStockThreshold),
          aliases,
        },
        { onSuccess, onError },
      );
    }
  });

  const onDelete = () => {
    if (!product) return;
    remove.mutate(product.id, {
      onSuccess: () => {
        toast('Product removed', 'success');
        onClose();
      },
      onError: () => toast('Could not remove this product.', 'error'),
    });
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={<span className="text-h3">{isEdit ? 'Edit product' : 'Add product'}</span>}
      footer={
        <div className="flex items-center gap-2">
          {isEdit ? (
            <Button
              variant="danger"
              size="lg"
              loading={remove.isPending}
              onClick={onDelete}
              aria-label="Remove product"
            >
              <Trash2 className="size-3.5" aria-hidden />
            </Button>
          ) : null}
          <Button
            type="submit"
            form="product-form"
            variant="primary"
            size="lg"
            className="flex-1"
            loading={saving}
          >
            {isEdit ? 'Save changes' : 'Add product'}
          </Button>
        </div>
      }
    >
      <form id="product-form" onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <Input label="Name" error={errors.name?.message} {...register('name')} />
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Unit"
            placeholder="1kg, 500g, piece"
            error={errors.unit?.message}
            {...register('unit')}
          />
          <Input
            label="Price (₹)"
            inputMode="decimal"
            error={errors.price?.message}
            {...register('price')}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input label="Category" {...register('category')} />
          <Input label="Brand" {...register('brand')} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Stock count"
            inputMode="numeric"
            hint="Corrects automatically after each order"
            error={errors.stockQuantity?.message}
            {...register('stockQuantity')}
          />
          <Input
            label="Low-stock threshold"
            inputMode="numeric"
            error={errors.lowStockThreshold?.message}
            {...register('lowStockThreshold')}
          />
        </div>

        <Input
          label="Search aliases"
          placeholder="ari, jaya, rice"
          hint="Colloquial terms customers use on WhatsApp — comma separated"
          {...register('aliases')}
        />

        {!isEdit ? (
          <div className="flex items-center justify-between rounded-lg border border-border px-3.5 py-3">
            <div>
              <p className="text-small font-medium">In stock</p>
              <p className="text-caption text-text-muted">Visible to customers on WhatsApp</p>
            </div>
            <Toggle
              checked={inStock}
              label="In stock"
              onChange={(next) => setValue('inStock', next)}
            />
          </div>
        ) : null}

        {errors.root?.message ? (
          <p role="alert" className="text-caption text-danger-fg">
            {errors.root.message}
          </p>
        ) : null}
      </form>
    </Drawer>
  );
}
