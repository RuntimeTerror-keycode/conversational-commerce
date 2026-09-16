import { Navigate, Outlet } from 'react-router-dom';
import { Store } from 'lucide-react';
import { ApiRequestError } from '@/api/client';
import { useSession } from '@/features/auth/useSession';

export function RequireAuth() {
  const session = useSession();

  if (session.isPending) {
    // Deliberately just the mark, not a skeleton of the whole shell. This
    // resolves in a few hundred milliseconds and a full ghost app flashing
    // past is more distracting than a quiet hold.
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper">
        <div className="animate-shimmer flex size-10 items-center justify-center rounded-xl bg-ink text-white">
          <Store className="size-5" aria-hidden />
        </div>
      </div>
    );
  }

  const unauthorized =
    session.error instanceof ApiRequestError && session.error.isUnauthorized;

  if (unauthorized || !session.data) return <Navigate to="/login" replace />;

  return <Outlet />;
}
