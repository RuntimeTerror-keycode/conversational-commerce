import { Navigate } from 'react-router-dom';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Info } from 'lucide-react';
import { ApiRequestError } from '@/api/client';
import type { IdentifyRequest } from '@/api/types';
import { useIdentify, useSession } from './useSession';
import { cn } from '@/lib/cn';

/** Schema derived from IdentifyRequest (src/api/types.ts). */
const identifySchema = z.object({
  username: z.string().min(1, 'Enter your username'),
}) satisfies z.ZodType<IdentifyRequest>;

type IdentifyForm = z.infer<typeof identifySchema>;

/**
 * Username only — there is no password.
 *
 * `POST /api/identify` resolves the username to a shop (docs/contracts.md §C2);
 * the FE keeps the returned `shop.id` and sends it as `X-Shop-Id` afterwards.
 *
 * Laid out from the design canvas "Login" artboard: 58/42 split, the product
 * explained on the left with a real WhatsApp message, the form alone on the
 * right. The left half is not decoration — a shopkeeper signing in for the
 * first time has no idea what this portal is, and the sample message explains
 * it faster than any feature list.
 */
export function LoginPage() {
  const session = useSession();
  const identifyMutation = useIdentify();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<IdentifyForm>({ resolver: zodResolver(identifySchema) });

  if (session.data) return <Navigate to="/" replace />;

  const onSubmit = handleSubmit((values) => identifyMutation.mutate(values.username));

  const serverError = identifyMutation.error;
  const message =
    errors.username?.message ??
    (serverError instanceof ApiRequestError
      ? serverError.message
      : serverError
        ? 'Could not reach the server. Try again.'
        : undefined);

  return (
    <div className="flex min-h-screen bg-canvas max-lg:flex-col">
      <div className="flex flex-col justify-between gap-16 border-border px-8 py-12 max-lg:border-b lg:w-[58%] lg:border-r lg:px-20 lg:py-18">
        <div className="flex flex-col gap-7">
          <div className="flex flex-col gap-1.5">
            <p className="text-[56px] leading-none font-medium tracking-[-0.025em] max-lg:text-[40px]">
              Kadakaran
            </p>
            <p className="text-2xl leading-[1.4] text-text-secondary">കടക്കാരൻ</p>
          </div>

          <div className="h-0.5 w-16 bg-accent" />

          <p className="max-w-[460px] text-[17px] leading-[1.6] text-pretty text-text-secondary">
            The counter view. Customers message the shop on WhatsApp; the assistant
            reads them, matches your stock and places the order. Orders reach this
            screen already accepted — you pack, hand over, and mark them off.
          </p>
        </div>

        <div className="flex flex-col gap-3.5">
          <p className="text-caption tracking-[0.1em] text-text-muted uppercase">
            A typical message
          </p>

          {/* A chat bubble, squared off at the corner it "comes from". */}
          <div className="flex max-w-[380px] flex-col gap-2 self-start rounded-[12px_12px_12px_4px] border border-border bg-surface px-4 py-3.5">
            <p className="text-base leading-[1.5]">
              2 kg ari, chaya podi, 1 litre velichenna
            </p>
            <p className="font-numeric text-xs text-text-muted">Priya · 12:04</p>
          </div>

          <p className="max-w-[420px] text-small leading-[1.5] text-text-muted">
            English, Malayalam and Manglish, often in one sentence. You never reply
            here — the portal is only for packing.
          </p>
        </div>
      </div>

      <div className="flex flex-col justify-center gap-7 bg-surface px-8 py-12 lg:w-[42%] lg:px-20 lg:py-18">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-[30px] font-medium tracking-[-0.015em]">Sign in</h1>
          <p className="text-body text-text-secondary">Your shop username is enough.</p>
        </div>

        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-7">
          <div className="flex flex-col gap-2">
            <label
              htmlFor="login-user"
              className="text-xs font-medium text-text-secondary"
            >
              Username
            </label>
            <input
              id="login-user"
              type="text"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              placeholder="suresh"
              aria-invalid={message ? true : undefined}
              className={cn(
                'h-13 rounded-sm border-[1.5px] bg-surface px-3.5 text-base',
                'transition-[border-color,box-shadow] duration-[120ms]',
                'placeholder:text-text-disabled focus:outline-none',
                message
                  ? 'border-danger-fg'
                  : 'border-border-strong focus:border-accent focus:shadow-[0_0_0_3px_var(--color-accent-subtle)]',
              )}
              {...register('username')}
            />
            {message ? (
              <p className="text-[12.5px] leading-[1.5] text-danger-fg">{message}</p>
            ) : (
              <p className="text-[12.5px] leading-[1.5] text-text-muted">
                No password. If this is not your own device, sign out when you are done.
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={identifyMutation.isPending}
            className={cn(
              'h-13 rounded-md border border-accent bg-accent text-base font-semibold text-on-accent',
              'transition-colors duration-[120ms] hover:border-accent-hover hover:bg-accent-hover',
              'disabled:cursor-not-allowed disabled:opacity-70',
            )}
          >
            {identifyMutation.isPending ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <div className="flex items-start gap-2.5 border-t border-border pt-5">
          <Info className="mt-0.5 size-[15px] shrink-0 text-text-muted" aria-hidden />
          <p className="text-[12.5px] leading-[1.55] text-text-secondary">
            Username not recognised? Only the shop owner can add a counter login.
          </p>
        </div>
      </div>
    </div>
  );
}
