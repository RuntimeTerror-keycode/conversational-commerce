import { NavLink, Outlet } from 'react-router-dom';
import {
  Boxes,
  ClipboardList,
  History,
  LayoutGrid,
  Settings,
  Store,
} from 'lucide-react';
import { useOrders } from '@/features/orders/useOrders';
import { useSession } from '@/features/auth/useSession';
import { cn } from '@/lib/cn';

interface NavItem {
  to: string;
  label: string;
  icon: typeof ClipboardList;
  end?: boolean;
  badge?: number;
}

function useNavItems(): NavItem[] {
  /**
   * The badge counts `accepted` — arrived and untouched.
   *
   * It shares a query key with the Orders page's default filter, so the 3s
   * poll feeds the sidebar and the list from one request rather than two.
   */
  const { data } = useOrders({ status: ['accepted'] });

  return [
    { to: '/', label: 'Dashboard', icon: LayoutGrid, end: true },
    { to: '/orders', label: 'Orders', icon: ClipboardList, badge: data?.counts.accepted },
    { to: '/inventory', label: 'Inventory', icon: Boxes },
    { to: '/history', label: 'History', icon: History },
    { to: '/settings', label: 'Settings', icon: Settings },
  ];
}

function SidebarLink({ item }: { item: NavItem }) {
  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={({ isActive }) =>
        cn(
          'group relative flex items-center gap-2.5 rounded-md px-2.5 py-2',
          'text-base font-medium transition-colors duration-150',
          isActive ? 'bg-sunk text-ink' : 'text-ink-2 hover:bg-sunk/60 hover:text-ink',
        )
      }
    >
      {({ isActive }) => (
        <>
          {/* A rail marks the active item instead of a filled block — it keeps
              the sidebar quiet while still being unmistakable. */}
          <span
            className={cn(
              'absolute top-1.5 bottom-1.5 -left-2 w-0.5 rounded-full transition-all duration-200',
              isActive ? 'bg-ink opacity-100' : 'opacity-0',
            )}
            aria-hidden
          />
          <item.icon
            className={cn('size-4 shrink-0', isActive ? 'text-ink' : 'text-ink-3')}
            aria-hidden
          />
          <span className="flex-1">{item.label}</span>
          {item.badge ? (
            <span className="tnum rounded-full bg-new px-1.5 py-0.5 text-2xs font-bold tracking-normal text-white">
              {item.badge}
            </span>
          ) : null}
        </>
      )}
    </NavLink>
  );
}

export function AppShell() {
  const session = useSession();
  const items = useNavItems();
  const retailer = session.data?.retailer;

  return (
    <div className="flex min-h-screen bg-paper">
      <aside className="fixed inset-y-0 hidden w-60 flex-col border-r border-line bg-surface md:flex">
        <div className="flex items-center gap-2.5 px-5 py-4">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-ink text-white">
            <Store className="size-4" aria-hidden />
          </div>
          <div className="min-w-0">
            <p className="truncate text-base font-semibold">{retailer?.name ?? '—'}</p>
            <p className="truncate text-xs text-ink-3">{retailer?.area}</p>
          </div>
        </div>

        <nav className="flex flex-col gap-0.5 px-4 py-2">
          {items.map((item) => (
            <SidebarLink key={item.to} item={item} />
          ))}
        </nav>

        <div className="mt-auto px-5 py-4">
          <div className="flex items-center gap-2 rounded-lg border border-line-soft bg-paper px-2.5 py-2">
            <span
              className={cn(
                'size-1.5 shrink-0 rounded-full',
                retailer?.shopOpen ? 'bg-done' : 'bg-ink-4',
              )}
              aria-hidden
            />
            <span className="text-xs text-ink-2">
              {retailer?.shopOpen ? 'Taking orders' : 'Closed'}
            </span>
          </div>
        </div>
      </aside>

      {/*
        Mobile keeps a bottom bar rather than a hamburger. A shopkeeper away
        from the counter still needs the new-order count in their eyeline —
        hiding it behind a menu defeats the point of the badge.
      */}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-line bg-surface/95 backdrop-blur-md md:hidden">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              cn(
                'flex flex-1 flex-col items-center gap-1 py-2.5 text-2xs font-medium tracking-normal',
                'transition-colors duration-150',
                isActive ? 'text-ink' : 'text-ink-4',
              )
            }
          >
            <span className="relative">
              <item.icon className="size-5" aria-hidden />
              {item.badge ? (
                <span className="tnum absolute -top-1.5 -right-2.5 rounded-full bg-new px-1 text-2xs font-bold tracking-normal text-white">
                  {item.badge}
                </span>
              ) : null}
            </span>
            {item.label}
          </NavLink>
        ))}
      </nav>

      <main className="min-w-0 flex-1 pb-20 md:ml-60 md:pb-0">
        <Outlet />
      </main>
    </div>
  );
}
