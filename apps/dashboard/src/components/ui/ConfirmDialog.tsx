import type { ReactNode } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Button } from './Button';
import { cn } from '@/lib/cn';

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  body: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  /** `danger` paints the confirm button clay — for the one action worth a pause. */
  tone?: 'default' | 'danger';
  loading?: boolean;
  onConfirm: () => void;
}

/**
 * One confirmation, never silent.
 *
 * Both buttons are the same width and height: the design's point is that this
 * is a real choice, not a dialog whose only purpose is to be dismissed.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  body,
  confirmLabel,
  cancelLabel = 'Cancel',
  tone = 'default',
  loading,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="data-[state=open]:animate-fade-in fixed inset-0 z-40 bg-[rgb(26_25_22_/_0.24)]" />

        <Dialog.Content
          className={cn(
            'data-[state=open]:animate-fade-in fixed top-1/2 left-1/2 z-50 w-[calc(100vw-2rem)] max-w-[420px]',
            '-translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-surface p-6',
            'shadow-[0_24px_48px_-16px_rgb(26_25_22_/_0.32)]',
          )}
        >
          <Dialog.Title className="text-h3">{title}</Dialog.Title>
          <Dialog.Description asChild>
            <div className="mt-2 text-small leading-[1.55] text-text-secondary">{body}</div>
          </Dialog.Description>

          <div className="mt-6 grid grid-cols-2 gap-3">
            <Dialog.Close asChild>
              <Button variant="secondary" className="h-11 w-full">
                {cancelLabel}
              </Button>
            </Dialog.Close>
            <Button
              variant={tone === 'danger' ? 'destructive' : 'primary'}
              className="h-11 w-full"
              loading={loading}
              onClick={onConfirm}
            >
              {confirmLabel}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
