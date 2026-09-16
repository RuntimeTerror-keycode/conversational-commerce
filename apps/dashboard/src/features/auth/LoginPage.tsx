import { Navigate } from 'react-router-dom';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { MessageCircle, Store } from 'lucide-react';
import { ApiRequestError } from '@/api/client';
import type { LoginRequest } from '@/api/types';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useLogin, useSession } from './useSession';

/** Schema derived from LoginRequest (src/api/types.ts). */
const loginSchema = z.object({
  identifier: z.string().min(1, 'Enter your phone number'),
  password: z.string().min(1, 'Enter your password'),
}) satisfies z.ZodType<LoginRequest>;

type LoginForm = z.infer<typeof loginSchema>;

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
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) });

  if (session.data) return <Navigate to="/" replace />;

  const onSubmit = handleSubmit((values) => loginMutation.mutate(values));

  const serverError = loginMutation.error;
  const serverMessage =
    serverError instanceof ApiRequestError
      ? serverError.message
      : serverError
        ? 'Could not sign in. Try again.'
        : undefined;

  return (
    <div className="flex min-h-screen bg-canvas">
      <div className="flex flex-1 items-center justify-center px-5 py-10">
        <div className="animate-slide-up w-full max-w-form">
          <div className="mb-8 flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-lg bg-accent text-white">
              <Store className="size-4.5" aria-hidden />
            </div>
            <div>
              <p className="text-h3">Shop Portal</p>
              <p className="text-caption text-text-muted">Sign in to manage your orders</p>
            </div>
          </div>

          <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
            <Input
              label="Phone number"
              inputMode="tel"
              autoComplete="username"
              placeholder="98470 12345"
              error={errors.identifier?.message}
              {...register('identifier')}
            />
            <Input
              label="Password"
              type="password"
              autoComplete="current-password"
              error={errors.password?.message ?? serverMessage}
              {...register('password')}
            />

            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="mt-1 w-full"
              loading={loginMutation.isPending}
            >
              Sign in
            </Button>
          </form>
        </div>
      </div>

      <aside className="hidden flex-1 border-l border-border bg-surface lg:flex lg:items-center lg:justify-center">
        <div className="max-w-sm px-10">
          <div className="mb-5 flex size-10 items-center justify-center rounded-xl bg-success-bg text-success-fg">
            <MessageCircle className="size-5" aria-hidden />
          </div>

          <p className="text-h3">Your shop, on WhatsApp.</p>
          <p className="mt-2 text-body text-text-secondary">
            Customers order in their own words — English, Malayalam, or both. Orders
            arrive here already accepted, so nothing waits on you to reply.
          </p>

          <div className="mt-7 rounded-xl border border-border bg-canvas p-4">
            <p className="text-caption text-text-muted uppercase tracking-wide">
              What a customer sends
            </p>
            <p className="mt-2 text-body text-text italic">“2 kg ari, chaya podi”</p>
            <div className="my-3 h-px bg-border" />
            <p className="text-caption text-text-muted uppercase tracking-wide">
              What you see
            </p>
            <p className="mt-2 text-body">
              Jaya rice 5kg <span className="text-text-muted">× 2</span>
              <br />
              Tea powder 500g <span className="text-text-muted">× 1</span>
            </p>
          </div>
        </div>
      </aside>
    </div>
  );
}
