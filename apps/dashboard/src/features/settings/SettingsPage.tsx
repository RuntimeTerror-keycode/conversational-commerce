import type { ReactNode } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { LogOut, Store } from 'lucide-react';
import { updateRetailer } from '@/api/stats';
import { queryKeys } from '@/api/keys';
import type { Retailer } from '@/api/types';
import { PageHeader } from '@/app/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Panel, PanelHeader } from '@/components/ui/Panel';
import { Skeleton } from '@/components/ui/Skeleton';
import { Toggle } from '@/components/ui/Toggle';
import { useToast } from '@/components/ui/Toast';
import { useLogout, useSession } from '@/features/auth/useSession';

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
    <div className="flex items-center justify-between gap-6 border-b border-line-soft px-4 py-3.5 last:border-b-0">
      <div className="min-w-0">
        <p className="text-base font-medium">{label}</p>
        {hint ? <p className="mt-0.5 text-sm text-ink-3">{hint}</p> : null}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

export function SettingsPage() {
  const session = useSession();
  const queryClient = useQueryClient();
  const logoutMutation = useLogout();
  const toast = useToast();

  const save = useMutation({
    mutationFn: (patch: Partial<Retailer>) => updateRetailer(patch),
    onSuccess: (retailer) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.session });
      toast(retailer.shopOpen ? 'Shop is taking orders' : 'Shop is closed', 'success');
    },
    onError: () => toast('Could not save that setting.', 'error'),
  });

  if (!session.data) {
    return (
      <>
        <PageHeader title="Settings" />
        <div className="px-5 py-5 md:px-7">
          <Skeleton className="h-72 max-w-2xl rounded-xl" />
        </div>
      </>
    );
  }

  const { retailer, user } = session.data;

  return (
    <>
      <PageHeader title="Settings" subtitle="Shop details and how orders reach you" />

      <div className="flex max-w-2xl flex-col gap-4 px-5 py-5 md:px-7">
        <Panel>
          <div className="flex items-center gap-3 border-b border-line-soft px-4 py-4">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-ink text-white">
              <Store className="size-5" aria-hidden />
            </div>
            <div className="min-w-0">
              <p className="text-lg font-semibold">{retailer.name}</p>
              <p className="text-sm text-ink-3">{retailer.area}</p>
            </div>
          </div>

          <Row label="WhatsApp number" hint="Customers place orders on this number">
            <span className="tnum text-base">{retailer.whatsappNumber ?? '—'}</span>
          </Row>

          <Row
            label="Inventory"
            hint={
              retailer.inventoryMode === 'managed'
                ? 'Managed here — stock comes down automatically as orders arrive'
                : 'Synced from your own billing system, read-only in this portal'
            }
          >
            <Badge tone={retailer.inventoryMode === 'managed' ? 'packed' : 'neutral'}>
              {retailer.inventoryMode === 'managed' ? 'Managed here' : 'Synced'}
            </Badge>
          </Row>
        </Panel>

        <Panel>
          <PanelHeader title="Orders" />

          <Row
            label="Taking orders"
            hint="Turn this off and the assistant tells customers the shop is closed"
          >
            <Toggle
              checked={retailer.shopOpen}
              label="Taking orders"
              disabled={save.isPending}
              onChange={(shopOpen) => save.mutate({ shopOpen })}
            />
          </Row>

          <Row
            label="Auto-accept"
            hint="Orders are accepted for you, so nothing waits on a reply"
          >
            <Badge tone="done" dot>
              On
            </Badge>
          </Row>
        </Panel>

        <Panel>
          <PanelHeader title="Account" />

          <Row label={user.name} hint={user.role === 'owner' ? 'Shop owner' : 'Staff'}>
            <Button
              variant="secondary"
              loading={logoutMutation.isPending}
              onClick={() => logoutMutation.mutate()}
            >
              <LogOut className="size-3.5" aria-hidden />
              Sign out
            </Button>
          </Row>
        </Panel>
      </div>
    </>
  );
}
