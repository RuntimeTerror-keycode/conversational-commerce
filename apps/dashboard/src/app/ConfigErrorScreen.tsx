import { ServerCog } from 'lucide-react';

/**
 * Shown instead of the app when `VITE_API_BASE_URL` is unset.
 *
 * There is deliberately no fallback to a default host or to fixture data —
 * a misconfigured deploy should say so, not quietly show something that
 * looks like a working shop.
 */
export function ConfigErrorScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-4">
      <div className="flex max-w-sm flex-col items-center gap-3 text-center">
        <div className="flex size-10 items-center justify-center rounded-full bg-danger-bg text-danger-fg">
          <ServerCog className="size-5" aria-hidden />
        </div>

        <div className="space-y-1">
          <p className="font-semibold text-text">This portal isn't configured yet</p>
          <p className="text-small text-text-muted">
            <code className="rounded bg-surface-sunken px-1 py-0.5 text-caption">
              VITE_API_BASE_URL
            </code>{' '}
            is not set, so there is no backend to connect to. Set it in the
            environment and reload.
          </p>
        </div>
      </div>
    </div>
  );
}
