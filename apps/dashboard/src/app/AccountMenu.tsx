import { useEffect, useRef, useState } from 'react';
import { ChevronUp, LogOut } from 'lucide-react';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useSession, useSignOut } from '@/features/auth/useSession';
import { useShopSettings } from '@/features/settings/useShopSettings';
import { formatPhone, initials } from '@/lib/format';
import { cn } from '@/lib/cn';

/**
 * Sign out, where people actually look for it.
 *
 * It lives at the foot of the sidebar on every screen; the row in Settings is
 * a second door, not the only one. Hand-rolled rather than a Radix popover —
 * one menu with three rows does not justify another dependency, and the
 * behaviours that matter (click outside, Escape, focus return) are short.
 */
export function AccountMenu() {
  const session = useSession();
  const signOut = useSignOut();
  // `/identify` does not return the phone; `/shops/me` does.
  const { data: settings } = useShopSettings();
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent) => {
      if (!container.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const user = session.data?.user;
  const shop = session.data?.shop;
  if (!user || !shop) return null;

  const row =
    'flex h-10 w-full items-center gap-2.5 rounded-md px-2.5 text-small font-medium transition-colors';

  return (
    <div ref={container} className="relative px-2.5 pb-3">
      {open ? (
        <div
          role="menu"
          className={cn(
            'absolute bottom-[calc(100%-0.25rem)] left-2.5 right-2.5 z-40 flex flex-col gap-0.5',
            'rounded-lg border border-border bg-surface p-1.5',
            'shadow-[0_12px_28px_-12px_rgb(26_25_22_/_0.28)]',
          )}
        >
          <div className="flex flex-col gap-0.5 border-b border-neutral-bg px-2.5 pt-1.5 pb-2.5">
            <p className="truncate text-caption tracking-normal text-text-muted capitalize">
              {user.role} · {shop.name}
            </p>
          </div>

          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              setConfirming(true);
            }}
            className={cn(row, 'bg-danger-bg text-danger-fg hover:brightness-[0.97]')}
          >
            <LogOut className="size-4" aria-hidden />
            Sign out
          </button>
        </div>
      ) : null}

      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className={cn(
          'flex h-[54px] w-full items-center gap-2.5 rounded-lg border border-border bg-surface px-2.5',
          'transition-colors duration-[120ms] hover:bg-surface-sunken',
        )}
      >
        <span className="flex size-[30px] shrink-0 items-center justify-center rounded-full bg-accent text-xs font-semibold text-on-accent">
          {initials(user.name)}
        </span>
        <span className="flex min-w-0 flex-col items-start">
          <span className="truncate text-[13px] font-semibold">{user.name}</span>
          <span className="font-numeric truncate text-caption tracking-normal text-text-muted">
            {settings ? formatPhone(settings.phone) : ''}
          </span>
        </span>
        <ChevronUp
          className={cn(
            'ml-auto size-4 shrink-0 text-text-muted transition-transform duration-[120ms]',
            !open && 'rotate-180',
          )}
          aria-hidden
        />
      </button>

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={`Sign out of ${shop.name}?`}
        body="Orders keep arriving while you are signed out."
        confirmLabel="Sign out"
        tone="danger"
        loading={signOut.isPending}
        onConfirm={() => signOut.mutate()}
      />
    </div>
  );
}
