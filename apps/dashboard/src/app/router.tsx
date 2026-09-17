import { createBrowserRouter, Navigate } from 'react-router-dom';
import { LoginPage } from '@/features/auth/LoginPage';
import { DashboardPage } from '@/features/dashboard/DashboardPage';
import { HistoryPage } from '@/features/history/HistoryPage';
import { InventoryPage } from '@/features/inventory/InventoryPage';
import { OrdersPage } from '@/features/orders/OrdersPage';
import { SettingsPage } from '@/features/settings/SettingsPage';
import { AppShell } from './AppShell';
import { RequireAuth } from './RequireAuth';

/**
 * Five screens, split by the job rather than by the data.
 *
 *   /           what needs me right now
 *   /orders     work in flight — a queue, with actions
 *   /history    finished records — no actions, searchable
 *   /inventory  what the shop can sell
 *   /settings   how orders reach the shop
 *
 * Order detail is a child route of both /orders and /history, so the drawer is
 * deep-linkable and the list underneath keeps polling while it is open.
 */
export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    element: <RequireAuth />,
    children: [
      {
        path: '/',
        element: <AppShell />,
        children: [
          { index: true, element: <DashboardPage /> },
          { path: 'orders', element: <OrdersPage /> },
          { path: 'orders/:orderId', element: <OrdersPage /> },
          { path: 'history', element: <HistoryPage /> },
          { path: 'history/:orderId', element: <HistoryPage /> },
          { path: 'inventory', element: <InventoryPage /> },
          { path: 'settings', element: <SettingsPage /> },
          { path: '*', element: <Navigate to="/" replace /> },
        ],
      },
    ],
  },
]);
