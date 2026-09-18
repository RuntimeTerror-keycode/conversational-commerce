import { useEffect, useState } from 'react';
import { Check, Copy, Lock } from 'lucide-react';
import { ApiRequestError } from '@/api/client';
import type { ShopSettings } from '@/api/types';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';
import { formatPhone } from '@/lib/format';
import { cn } from '@/lib/cn';
import { SectionHeading } from './OpeningHours';
import { useUpdateShopSettings } from './useShopSettings';

/**
 * Name and owner, with a save bar that only exists when there is something to save.
 *
 * The old permanently-disabled "Save shop details" button read as broken — a
 * greyed control with no explanation tells the reader the page is stuck, not
 * that they have not typed anything.
 */
export function ShopDetails({ shop }: { shop: ShopSettings }) {
  const toast = useToast();
  const save = useUpdateShopSettings();
  const [copied, setCopied] = useState(false);

  const [name, setName] = useState(shop.name);
  const [owner, setOwner] = useState(shop.ownerName ?? '');

  useEffect(() => {
    setName(shop.name);
    setOwner(shop.ownerName ?? '');
  }, [shop.name, shop.ownerName]);

  const changed = [
    name !== shop.name,
    owner !== (shop.ownerName ?? ''),
  ].filter(Boolean).length;

  const discard = () => {
    setName(shop.name);
    setOwner(shop.ownerName ?? '');
  };

  const submit = () => {
    if (name.trim().length === 0) {
      toast('Shop name cannot be empty.', 'error');
      return;
    }

    save.mutate(
      { name: name.trim(), ownerName: owner.trim() || null },
      {
        onSuccess: () => toast('Shop details saved', 'success'),
        onError: (error) =>
          toast(
            error instanceof ApiRequestError
              ? error.message
              : 'Could not save the shop details.',
            'error',
          ),
      },
    );
  };

  const copyPhone = async () => {
    try {
      await navigator.clipboard.writeText(formatPhone(shop.phone));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast('Could not copy the number.', 'error');
    }
  };

  return (
    <section className="flex flex-col gap-4">
      <SectionHeading title="Shop details" caption="what customers see on their order" />

      <div className="overflow-hidden rounded-lg border border-border bg-surface">
        <div className="flex flex-col gap-4 px-5 py-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Shop name"
              className="h-[46px]"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
            <Input
              label="Owner"
              className="h-[46px]"
              value={owner}
              onChange={(event) => setOwner(event.target.value)}
            />
          </div>

          {/* Read-only: this is the number the WhatsApp integration is bound to,
              not a field. Shown formatted — raw digits never reach the screen. */}
          <div className="flex items-center gap-3 rounded-md bg-surface-sunken px-3.5 py-3">
            <Lock className="size-4 shrink-0 text-text-disabled" aria-hidden />
            <p className="font-numeric min-w-0 flex-1 text-body font-medium">
              {formatPhone(shop.phone)}
            </p>
            <Button variant="secondary" size="sm" onClick={() => void copyPhone()}>
              {copied ? <Check className="size-3.5" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
              {copied ? 'Copied' : 'Copy'}
            </Button>
          </div>
        </div>

        {/* The bar exists only while there is something to save. */}
        {changed > 0 ? (
          <div
            className={cn(
              'flex items-center gap-3 border-t border-border bg-surface-sunken px-5 py-3',
            )}
          >
            <span className="size-2 shrink-0 rounded-full bg-warning" aria-hidden />
            <p className="font-numeric text-small text-text-secondary">
              {changed === 1 ? '1 unsaved change' : `${changed} unsaved changes`}
            </p>
            <div className="ml-auto flex gap-2.5">
              <Button
                variant="secondary"
                className="h-10"
                disabled={save.isPending}
                onClick={discard}
              >
                Discard
              </Button>
              <Button
                variant="primary"
                className="h-10"
                loading={save.isPending}
                onClick={submit}
              >
                {save.isPending ? 'Saving…' : 'Save changes'}
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
