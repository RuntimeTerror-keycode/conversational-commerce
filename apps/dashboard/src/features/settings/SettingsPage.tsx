import { useEffect, type ReactNode } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { LogOut, Store } from 'lucide-react';
import { changePassword, updateProfile } from '@/api/auth';
import { ApiRequestError } from '@/api/client';
import { updateRetailer } from '@/api/stats';
import { queryKeys } from '@/api/keys';
import type { ChangePasswordRequest, ProfilePatch, Retailer } from '@/api/types';
import { PageHeader } from '@/app/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
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
    <div className="flex items-center justify-between gap-6 border-b border-border px-4 py-3.5 last:border-b-0">
      <div className="min-w-0">
        <p className="text-body font-medium">{label}</p>
        {hint ? <p className="mt-0.5 text-small text-text-muted">{hint}</p> : null}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

/** Schema derived from ProfilePatch (src/api/types.ts) — empty string clears the field. */
const profileSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.union([z.literal(''), z.string().email('Enter a valid email')]),
  phone: z.string(),
}) satisfies z.ZodType<{ name: string; email: string; phone: string }>;

type ProfileForm = z.infer<typeof profileSchema>;

function ProfileForm({ name, email, phone }: { name: string; email: string | null; phone: string | null }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: { name, email: email ?? '', phone: phone ?? '' },
  });

  useEffect(
    () => reset({ name, email: email ?? '', phone: phone ?? '' }),
    [name, email, phone, reset],
  );

  const save = useMutation({
    mutationFn: (patch: ProfilePatch) => updateProfile(patch),
    onSuccess: (session) => {
      queryClient.setQueryData(queryKeys.session, session);
      toast('Profile updated', 'success');
    },
    onError: () => toast('Could not save your profile.', 'error'),
  });

  const onSubmit = handleSubmit((values) =>
    save.mutate({ name: values.name, email: values.email || null, phone: values.phone || null }),
  );

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4 px-4 py-4">
      <Input label="Name" error={errors.name?.message} {...register('name')} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input label="Email" type="email" error={errors.email?.message} {...register('email')} />
        <Input label="Phone" inputMode="tel" error={errors.phone?.message} {...register('phone')} />
      </div>
      <Button type="submit" variant="secondary" className="self-start" loading={save.isPending}>
        Save profile
      </Button>
    </form>
  );
}

/** Schema derived from ChangePasswordRequest, plus a UI-only confirm field. */
const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password'),
    newPassword: z.string().min(8, 'New password must be at least 8 characters'),
    confirm: z.string(),
  })
  .refine((data) => data.newPassword === data.confirm, {
    message: 'New passwords do not match',
    path: ['confirm'],
  }) satisfies z.ZodType<ChangePasswordRequest & { confirm: string }>;

type PasswordFormValues = z.infer<typeof passwordSchema>;

function PasswordForm() {
  const toast = useToast();
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirm: '' },
  });

  const save = useMutation({
    mutationFn: (body: ChangePasswordRequest) => changePassword(body),
    onSuccess: () => {
      reset();
      toast('Password changed', 'success');
    },
    onError: (mutationError) => {
      setError('currentPassword', {
        message:
          mutationError instanceof ApiRequestError
            ? mutationError.message
            : 'Could not change your password.',
      });
    },
  });

  const onSubmit = handleSubmit((values) =>
    save.mutate({ currentPassword: values.currentPassword, newPassword: values.newPassword }),
  );

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4 px-4 py-4">
      <Input
        label="Current password"
        type="password"
        autoComplete="current-password"
        error={errors.currentPassword?.message}
        {...register('currentPassword')}
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input
          label="New password"
          type="password"
          autoComplete="new-password"
          error={errors.newPassword?.message}
          {...register('newPassword')}
        />
        <Input
          label="Confirm new password"
          type="password"
          autoComplete="new-password"
          error={errors.confirm?.message}
          {...register('confirm')}
        />
      </div>
      <Button type="submit" variant="secondary" className="self-start" loading={save.isPending}>
        Change password
      </Button>
    </form>
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
        <div className="mx-auto max-w-content px-4 py-6 md:px-8">
          <Skeleton className="h-72 max-w-2xl rounded-xl" />
        </div>
      </>
    );
  }

  const { retailer, user } = session.data;

  return (
    <>
      <PageHeader title="Settings" subtitle="Shop details and how orders reach you" />

      <div className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-6 md:px-8">
        <Panel>
          <div className="flex items-center gap-3 border-b border-border px-4 py-4">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-accent text-white">
              <Store className="size-5" aria-hidden />
            </div>
            <div className="min-w-0">
              <p className="text-h3">{retailer.name}</p>
              <p className="text-small text-text-muted">{retailer.area}</p>
            </div>
          </div>

          <Row label="WhatsApp number" hint="Customers place orders on this number">
            <span className="font-numeric text-body">{retailer.whatsappNumber ?? '—'}</span>
          </Row>

          <Row
            label="Inventory"
            hint={
              retailer.inventoryMode === 'managed'
                ? 'Managed here — stock comes down automatically as orders arrive'
                : 'Synced from your own billing system, read-only in this portal'
            }
          >
            <Badge tone={retailer.inventoryMode === 'managed' ? 'info' : 'neutral'}>
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
            <Badge tone="success">On</Badge>
          </Row>
        </Panel>

        <Panel>
          <PanelHeader title="Profile" />
          <ProfileForm name={user.name} email={user.email} phone={user.phone} />
        </Panel>

        <Panel>
          <PanelHeader title="Password" />
          <PasswordForm />
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
