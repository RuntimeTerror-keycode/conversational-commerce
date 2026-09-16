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
          'group relative flex items-center gap-2.5 rounded-md px-3 py-2',
          'text-small font-medium transition-colors duration-150',
          'focus-visible:outline-none focus-visible:ring focus-visible:ring-border-focus focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar',
          isActive
            ? 'bg-sidebar-active text-sidebar-text-active'
            : 'text-sidebar-text hover:bg-sidebar-hover hover:text-sidebar-text-active',
        )
      }
    >
      <item.icon className="size-4 shrink-0" aria-hidden />
      <span className="flex-1">{item.label}</span>
      {item.badge ? (
        <span className="font-numeric rounded-full bg-white/20 px-1.5 py-0.5 text-caption font-bold tracking-normal text-white">
          {item.badge}
        </span>
      ) : null}
    </NavLink>
  );
}

export function AppShell() {
  const session = useSession();
  const items = useNavItems();
  const retailer = session.data?.retailer;

  return (
    <div className="flex min-h-screen bg-canvas">
      <aside className="fixed inset-y-0 hidden w-sidebar flex-col bg-sidebar md:flex">
        <div className="flex items-center gap-2.5 px-5 py-4">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent text-white">
            <Store className="size-4" aria-hidden />
          </div>
          <div className="min-w-0">
            <p className="truncate text-small font-semibold text-sidebar-text-active">
              {retailer?.name ?? '—'}
            </p>
            <p className="truncate text-caption text-sidebar-text">{retailer?.area}</p>
          </div>
        </div>

        <nav className="flex flex-col gap-0.5 px-3 py-2">
          {items.map((item) => (
            <SidebarLink key={item.to} item={item} />
          ))}
        </nav>

        <div className="mt-auto px-5 py-4">
          <div className="flex items-center gap-2 rounded-lg border border-sidebar-border bg-sidebar-hover px-2.5 py-2">
            <span
              className={cn(
                'size-1.5 shrink-0 rounded-full',
                retailer?.shopOpen ? 'bg-success' : 'bg-sidebar-text',
              )}
              aria-hidden
            />
            <span className="text-caption text-sidebar-text">
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
      <nav className="fixed inset-x-0 bottom-0 z-20 flex border-t border-border bg-surface/95 backdrop-blur-md md:hidden">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              cn(
                'flex flex-1 flex-col items-center gap-1 py-2.5 text-caption font-medium tracking-normal',
                'transition-colors duration-150',
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
