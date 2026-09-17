import type { ReactNode } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { IconButton } from './Button';

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}

/**
 * Radix Dialog underneath — focus trap, Escape-to-close, scroll lock and
 * return-focus-to-trigger all come from the primitive instead of being
 * hand-rolled. We only style it and pin it to the right edge as a drawer.
 */
export function Drawer({ open, onClose, title, children, footer }: DrawerProps) {
  return (
    <Dialog.Root open={open} onOpenChange={(next) => !next && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="animate-fade-in fixed inset-0 z-40 bg-text/25" />

        <Dialog.Content className="animate-slide-up fixed inset-y-0 right-0 z-40 flex h-full w-full max-w-lg flex-col bg-surface shadow-lg focus:outline-none md:animate-none">
          <header className="flex shrink-0 items-start justify-between gap-3 border-b border-border px-5 py-3.5">
            <div className="min-w-0">
              <Dialog.Title asChild>
                <div>{title}</div>
              </Dialog.Title>
              <Dialog.Description className="sr-only">Details panel</Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <IconButton label="Close panel">
                <X className="size-4" aria-hidden />
              </IconButton>
            </Dialog.Close>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5">
            {children}
          </div>

          {footer ? (
            <footer className="shrink-0 border-t border-border bg-canvas px-5 py-3">
              {footer}
            </footer>
          ) : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
