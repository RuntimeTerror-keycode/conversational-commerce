import { Navigate, Outlet } from 'react-router-dom';
import { Store } from 'lucide-react';
import { useSession } from '@/features/auth/useSession';

export function RequireAuth() {
  const session = useSession();

  if (session.isPending) {
    // Deliberately just the mark, not a skeleton of the whole shell. This
    // resolves in a few hundred milliseconds and a full ghost app flashing
    // past is more distracting than a quiet hold.
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas">
        <div className="animate-shimmer flex size-10 items-center justify-center rounded-xl bg-accent text-white">
          <Store className="size-5" aria-hidden />
        </div>
      </div>
    );
  }

  // The session is whatever localStorage holds — there is no server session to
  // validate, so "no stored shop" is the only signed-out condition.
  if (!session.data) return <Navigate to="/login" replace />;

  return <Outlet />;
}
