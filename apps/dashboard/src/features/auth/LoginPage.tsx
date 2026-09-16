import { useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { MessageCircle, Store } from 'lucide-react';
import { ApiRequestError } from '@/api/client';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useLogin, useSession } from './useSession';

/**
 * The form is real; what it calls is not settled yet (Q-A1/Q-A2).
 *
 * Phone + password is the assumption — shopkeepers here are phone-first, and
 * OTP needs an SMS provider we do not have. Swapping to email or OTP changes
 * this file and src/api/auth.ts, nothing else.
 *
 * The right-hand panel is not decoration: a shopkeeper signing in for the
 * first time has no idea what this portal is for, and one line about WhatsApp
 * orders does more than a logo would.
 */
export function LoginPage() {
  const session = useSession();
  const loginMutation = useLogin();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');

  if (session.data) return <Navigate to="/" replace />;

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    loginMutation.mutate({ identifier, password });
  };

  const error = loginMutation.error;
  const message =
    error instanceof ApiRequestError
      ? error.message
      : error
        ? 'Could not sign in. Try again.'
        : undefined;

  return (
    <div className="flex min-h-screen bg-paper">
      <div className="flex flex-1 items-center justify-center px-5 py-10">
        <div className="animate-rise w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-lg bg-ink text-white">
              <Store className="size-4.5" aria-hidden />
            </div>
            <div>
              <p className="text-lg font-semibold">Shop Portal</p>
              <p className="text-xs text-ink-3">Sign in to manage your orders</p>
            </div>
          </div>

          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <Input
              label="Phone number"
              inputMode="tel"
              autoComplete="username"
              placeholder="98470 12345"
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
              required
            />
            <Input
              label="Password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              error={message}
            />

            <Button
              type="submit"
              variant="primary"
              className="mt-1 w-full"
              loading={loginMutation.isPending}
            >
              Sign in
            </Button>
          </form>
        </div>
      </div>

      <aside className="hidden flex-1 border-l border-line bg-surface lg:flex lg:items-center lg:justify-center">
        <div className="max-w-sm px-10">
          <div className="mb-5 flex size-10 items-center justify-center rounded-xl bg-done-soft text-done">
            <MessageCircle className="size-5" aria-hidden />
          </div>

          <p className="text-xl font-semibold">Your shop, on WhatsApp.</p>
          <p className="mt-2 text-base text-ink-2">
            Customers order in their own words — English, Malayalam, or both. Orders
            arrive here already accepted, so nothing waits on you to reply.
          </p>

          <div className="mt-7 rounded-xl border border-line bg-paper p-4">
            <p className="label">What a customer sends</p>
            <p className="mt-2 text-base text-ink italic">“2 kg ari, chaya podi”</p>
            <div className="my-3 h-px bg-line" />
            <p className="label">What you see</p>
            <p className="mt-2 text-base">
              Jaya rice 5kg <span className="text-ink-3">× 2</span>
              <br />
              Tea powder 500g <span className="text-ink-3">× 1</span>
            </p>
          </div>
        </div>
      </aside>
    </div>
  );
}
