import { useEffect, useState, type ReactNode } from 'react';
import { Clock, LogOut, Store } from 'lucide-react';
import { ApiRequestError } from '@/api/client';
import { PageHeader } from '@/app/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Panel, PanelHeader } from '@/components/ui/Panel';
import { Skeleton } from '@/components/ui/Skeleton';
import { Toggle } from '@/components/ui/Toggle';
import { useToast } from '@/components/ui/Toast';
import { useSession, useSignOut } from '@/features/auth/useSession';
import { formatHours, shopStatusMeta } from './shopStatus';
import { useShopSettings, useUpdateShopSettings } from './useShopSettings';

function Row({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-6 border-b border-border px-4 py-3.5 last:border-b-0">
      <div className="min-w-0">
        <p className="text-body font-medium">{label}</p>
        {hint ? <p className="mt-0.5 text-small text-text-muted">{hint}</p> : null}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

export function SettingsPage() {
  const session = useSession();
  const signOut = useSignOut();
  const toast = useToast();
  const { data: shop, isPending } = useShopSettings();
  const save = useUpdateShopSettings();

  const [opening, setOpening] = useState('');
  const [closing, setClosing] = useState('');
  const [name, setName] = useState('');
  const [owner, setOwner] = useState('');

  // Mirror the server values until the shopkeeper starts editing them.
  useEffect(() => {
    if (!shop) return;
    setOpening(shop.openingTime ?? '');
    setClosing(shop.closingTime ?? '');
    setName(shop.name);
    setOwner(shop.ownerName ?? '');
  }, [shop?.openingTime, shop?.closingTime, shop?.name, shop?.ownerName]);

  const onError = (error: unknown) => {
    toast(
      error instanceof ApiRequestError ? error.message : 'Could not save that setting.',
      'error',
    );
  };

  if (isPending || !shop || !session.data) {
    return (
      <>
        <PageHeader title="Settings" />
        <div className="max-w-2xl px-4 pb-[30px] md:px-9">
          <Skeleton className="h-96 rounded-xl" />
        </div>
      </>
    );
  }

  const status = shopStatusMeta[shop.openState];
  const savedHours = formatHours(shop.openingTime, shop.closingTime);

  const rightNow = [
    shop.openState === 'offline'
      ? 'Switched off — not taking orders'
      : shop.openState === 'closed'
        ? `Closed now${shop.openingTime ? ` · reopens ${shop.openingTime}` : ''}`
        : savedHours
          ? `Open · ${savedHours}`
          : 'Open · no hours set, so always taking orders',
    shop.inventoryMode === 'managed'
      ? 'inventory managed here'
      : 'inventory synced from your billing system',
  ].join(' · ');
  const hoursDirty =
    opening !== (shop.openingTime ?? '') || closing !== (shop.closingTime ?? '');

  const detailsDirty = name !== shop.name || owner !== (shop.ownerName ?? '');

  const saveDetails = () => {
    if (name.trim().length === 0) {
      toast('Shop name cannot be empty.', 'error');
      return;
    }

    save.mutate(
      { name: name.trim(), ownerName: owner.trim() || null },
      { onSuccess: () => toast('Shop details updated', 'success'), onError },
    );
  };

  const saveHours = () => {
    // Both or neither — a shop with only a closing time has no meaningful
    // open/closed state, and the API rejects it anyway.
    if (Boolean(opening) !== Boolean(closing)) {
      toast('Set both an opening and a closing time, or clear both.', 'error');
      return;
    }

    save.mutate(
      { openingTime: opening || null, closingTime: closing || null },
      {
        onSuccess: () => toast('Opening hours updated', 'success'),
        onError,
      },
    );
  };

  const clearHours = () => {
    save.mutate(
      { openingTime: null, closingTime: null },
      { onSuccess: () => toast('Opening hours cleared', 'success'), onError },
    );
  };

  return (
    <>
      <PageHeader eyebrow="Your shop" title="Settings" />

      <div className="flex max-w-2xl flex-col gap-[22px] px-4 pb-[30px] md:px-9">
        <Panel>
          <div className="flex items-center gap-3 border-b border-border px-4 py-4">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-accent text-white">
              <Store className="size-5" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-h3">{shop.name}</p>
              <p className="text-small text-text-muted">
                {shop.ownerName ? `${shop.ownerName} · ` : ''}
                <span className="font-numeric">{shop.phone}</span>
              </p>
            </div>
            <Badge tone={status.tone} icon={status.icon}>{status.label}</Badge>
          </div>

          <Row label="Current status" hint={status.hint}>
            <span className="font-numeric text-small text-text-secondary">
              {savedHours ?? 'No hours set'}
            </span>
          </Row>

          <Row
            label="Inventory"
            hint={
              shop.inventoryMode === 'managed'
                ? 'Managed here — stock comes down automatically as orders arrive'
                : 'Synced from your own billing system, read-only in this portal'
            }
          >
            <Badge tone={shop.inventoryMode === 'managed' ? 'info' : 'neutral'}>
              {shop.inventoryMode === 'managed' ? 'Managed here' : 'Synced'}
            </Badge>
          </Row>
        </Panel>

        <Panel>
          <PanelHeader title="Taking orders" />

          <Row
            label="Shop is online"
            hint={
              shop.isActive
                ? 'Turn this off to stop new WhatsApp orders. Orders already in flight stay in your list.'
                : 'Customers are told the shop is closed. You can still pack existing orders.'
            }
          >
            <Toggle
              checked={shop.isActive}
              label="Shop is online"
              disabled={save.isPending}
              onChange={(isActive) =>
                save.mutate(
                  { isActive },
                  {
                    onSuccess: () =>
                      toast(isActive ? 'Shop is online' : 'Shop is offline', 'success'),
                    onError,
                  },
                )
              }
            />
          </Row>

          <Row
            label="Auto-accept"
            hint="Orders are accepted for you, so nothing waits on a reply"
          >
            <Badge tone="success">On</Badge>
          </Row>

          {/*
            Which state fixes itself is the only thing that separates these,
            and it is the thing a shopkeeper needs at 9am when orders are not
            arriving. Spelled out rather than implied by a colour.
          */}
          <div className="border-t border-border bg-surface-sunken px-4 py-4">
            <p className="text-caption text-text-muted uppercase">
              The three states, and which one fixes itself
            </p>

            <dl className="mt-3 flex flex-col gap-2.5">
              {[
                {
                  term: 'Open',
                  detail: 'Inside opening hours and switched on.',
                  strong: null,
                },
                {
                  term: 'Closed now',
                  detail: 'Outside your hours.',
                  strong: shop.openingTime
                    ? `Reopens by itself at ${shop.openingTime} — nothing to do.`
                    : 'Reopens by itself — nothing to do.',
                },
                {
                  term: 'Switched off',
                  detail: 'You turned it off.',
                  strong: 'Stays off until you turn it back on, even in opening hours.',
                },
              ].map((state) => (
                <div key={state.term} className="flex gap-2.5 text-small">
                  <dt className="w-24 shrink-0 font-semibold text-text">{state.term}</dt>
                  <dd className="text-text-secondary">
                    {state.detail}
                    {state.strong ? (
                      <span className="text-text"> {state.strong}</span>
                    ) : null}
                  </dd>
                </div>
              ))}
            </dl>

            <p className="mt-3.5 border-t border-border pt-3 text-small text-text-muted">
              Only you see this. Customers are never shown whether the shop is open —
              the assistant simply stops taking their orders. Orders already in flight
              can still be packed and handed over.
            </p>
          </div>
        </Panel>

        <Panel>
          <PanelHeader
            title="Opening hours"
            action={
              savedHours ? (
                <button
                  type="button"
                  onClick={clearHours}
                  disabled={save.isPending}
                  className="text-small font-medium text-text-secondary transition-colors hover:text-text disabled:opacity-50"
                >
                  Clear
                </button>
              ) : null
            }
          />

          <div className="flex flex-col gap-4 px-4 py-4">
            <p className="flex items-start gap-2 text-small text-text-muted">
              <Clock className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              <span>
                Outside these hours the shop shows as closed and stops taking orders,
                without you having to switch it off. Leave them blank to stay open
                around the clock. An overnight window like 22:00 – 06:00 works.
              </span>
            </p>

            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Opens at"
                type="time"
                value={opening}
                onChange={(event) => setOpening(event.target.value)}
              />
              <Input
                label="Closes at"
                type="time"
                value={closing}
                onChange={(event) => setClosing(event.target.value)}
              />
            </div>

            <Button
              variant="primary"
              className="self-start"
              disabled={!hoursDirty}
              loading={save.isPending}
              onClick={saveHours}
            >
              Save hours
            </Button>
          </div>
        </Panel>

        <Panel>
          <PanelHeader title="Shop" />

          <div className="flex flex-col gap-4 px-4 py-4">
            <Input
              label="Shop name"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
            <Input
              label="Owner"
              value={owner}
              onChange={(event) => setOwner(event.target.value)}
            />
            {/*
              No "Town" field: location lives in the separate shop_address
              table, not on `shop`, so there is nothing here to write to.
            */}
            <Button
              variant="primary"
              className="self-start"
              disabled={!detailsDirty}
              loading={save.isPending}
              onClick={saveDetails}
            >
              Save shop details
            </Button>
          </div>
        </Panel>

        <Panel>
          <PanelHeader title="Account" />

          <Row
            label={`Signed in as ${session.data.user.username}`}
            hint="There is no password on this account. Sign out if you are leaving this device at the counter."
          >
            <Button
              variant="secondary"
              loading={signOut.isPending}
              onClick={() => signOut.mutate()}
            >
              <LogOut className="size-3.5" aria-hidden />
              Sign out
            </Button>
          </Row>
        </Panel>

        <div className="rounded-lg border border-border bg-surface-sunken px-4 py-3">
          <p className="text-caption text-text-muted uppercase">Right now</p>
          <p className="mt-1 text-small text-text-secondary">{rightNow}</p>
        </div>
      </div>
    </>
  );
}
