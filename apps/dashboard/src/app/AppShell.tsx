import { NavLink, Outlet } from 'react-router-dom';
import { Boxes, ClipboardList, Clock, LayoutGrid, SlidersHorizontal } from 'lucide-react';
import { useFulfillments } from '@/features/orders/useOrders';
import { useInventory } from '@/features/inventory/useInventory';
import { useSession } from '@/features/auth/useSession';
import { shopStatusMeta, formatHours } from '@/features/settings/shopStatus';
import { useShopSettings } from '@/features/settings/useShopSettings';
import { timeAgo } from '@/lib/format';
import { cn } from '@/lib/cn';

interface NavItem {
  to: string;
  label: string;
  icon: typeof ClipboardList;
  end?: boolean;
  /** Clay pill — work waiting. */
  badge?: number;
  /** Clay text, no pill — a nudge, not a queue. */
  note?: string;
}

function useNavItems(): NavItem[] {
  /**
   * The badge counts `accepted` — arrived and untouched. It shares a query key
   * with the Orders page's default view, so the 3s poll feeds both from one
   * request rather than two.
   */
  const { data } = useFulfillments({ status: 'accepted' });
  const { data: stock } = useInventory({});
  const low = stock?.counts.low ?? 0;

  return [
    { to: '/', label: 'Dashboard', icon: LayoutGrid, end: true },
    { to: '/orders', label: 'Orders', icon: ClipboardList, badge: data?.counts.accepted },
    { to: '/history', label: 'Order history', icon: Clock },
    { to: '/inventory', label: 'Inventory', icon: Boxes, note: low ? `${low} low` : undefined },
    { to: '/settings', label: 'Settings', icon: SlidersHorizontal },
  ];
}

function SidebarLink({ item }: { item: NavItem }) {
  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={({ isActive }) =>
        cn(
          'flex h-11 items-center gap-2.5 rounded-md border px-3 text-body',
          'transition-colors duration-[120ms]',
          isActive
            ? 'border-border bg-surface font-semibold text-text'
            : 'border-transparent font-medium text-text-secondary hover:bg-sidebar-hover',
        )
      }
    >
      <item.icon className="size-[17px] shrink-0" aria-hidden />
      {item.label}
      {item.badge ? (
        <span className="font-numeric ml-auto inline-flex h-[22px] min-w-[22px] items-center justify-center rounded-full bg-warning px-[7px] text-xs font-semibold text-white">
          {item.badge}
        </span>
      ) : item.note ? (
        <span className="font-numeric ml-auto text-[11.5px] font-semibold text-warning-fg">
          {item.note}
        </span>
      ) : null}
    </NavLink>
  );
}

export function AppShell() {
  const session = useSession();
  const items = useNavItems();
  const { data: settings, dataUpdatedAt, isError } = useShopSettings();

  const shop = session.data?.shop;
  const openState = settings?.openState ?? shop?.openState;
  const status = openState ? shopStatusMeta[openState] : null;
  const hours = formatHours(
    settings?.openingTime ?? shop?.openingTime ?? null,
    settings?.closingTime ?? shop?.closingTime ?? null,
  );

  return (
    <div className="flex min-h-screen bg-canvas">
      <aside className="fixed inset-y-0 hidden w-sidebar flex-col border-r border-sidebar-border bg-sidebar md:flex">
        <div className="flex flex-col gap-3 border-b border-sidebar-border px-4.5 pt-5.5 pb-4.5">
          <div className="flex flex-col gap-[3px]">
            <p className="truncate text-h2">{shop?.name ?? '—'}</p>
            <p className="truncate text-xs text-text-muted">
              {[settings?.ownerName, session.data?.user.name]
                .filter(Boolean)[0] ?? ''}
            </p>
          </div>

          {/*
            The shop's state lives here, not in the page header — it is a
            property of the shop, true on every screen, and the shopkeeper
            should never have to go looking for it.
          */}
          {status ? (
            <span
              className={cn(
                'font-numeric inline-flex items-center gap-1.5 self-start rounded-full border py-1 pr-2.5 pl-2 text-xs font-semibold',
                status.tone === 'success'
                  ? 'border-success-border bg-success-bg text-success-fg'
                  : 'border-border bg-surface text-text-secondary',
              )}
            >
              <span
                className={cn(
                  'size-[7px] rounded-full',
                  status.tone === 'success' ? 'bg-success-fg' : 'bg-text-disabled',
                )}
                aria-hidden
              />
              {status.label}
              {hours ? ` · ${hours}` : ''}
            </span>
          ) : null}
        </div>

        <nav className="flex flex-col gap-[3px] px-2.5 py-3">
          {items.map((item) => (
            <SidebarLink key={item.to} item={item} />
          ))}
        </nav>

        <div className="mt-auto flex items-center gap-2 border-t border-sidebar-border px-4.5 py-3.5">
          <span
            className={cn(
              'size-[7px] shrink-0 rounded-full',
              isError ? 'bg-text-disabled' : 'bg-accent',
            )}
            aria-hidden
          />
          <span className="font-numeric text-xs text-text-muted">
            {isError
              ? 'Not updating'
              : `Live · updated ${dataUpdatedAt ? timeAgo(new Date(dataUpdatedAt).toISOString()) : 'just now'}`}
          </span>
        </div>
      </aside>

      {/*
        Mobile keeps a bottom bar rather than a hamburger. A shopkeeper away
        from the counter still needs the new-order count in their eyeline.
      */}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-border bg-surface/95 backdrop-blur-md md:hidden">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              cn(
                'flex flex-1 flex-col items-center gap-1 py-2.5 text-caption font-medium tracking-normal',
                'transition-colors duration-[120ms]',
                isActive ? 'text-accent' : 'text-text-disabled',
              )
            }
          >
            <span className="relative">
              <item.icon className="size-5" aria-hidden />
              {item.badge ? (
                <span className="font-numeric absolute -top-1.5 -right-2.5 rounded-full bg-warning px-1 text-caption font-bold tracking-normal text-white">
                  {item.badge}
                </span>
              ) : null}
            </span>
            {item.label}
          </NavLink>
        ))}
      </nav>

      <main className="min-w-0 flex-1 pb-20 md:ml-sidebar md:pb-0">
        <Outlet />
      </main>
    </div>
  );
}
