import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import * as RadixToast from '@radix-ui/react-toast';
import { AlertCircle, Check } from 'lucide-react';
import { cn } from '@/lib/cn';

type ToastTone = 'success' | 'error' | 'info';

interface Toast {
  id: number;
  message: string;
  tone: ToastTone;
}

const ToastContext = createContext<((message: string, tone?: ToastTone) => void) | null>(
  null,
);

const toneStyles: Record<ToastTone, { ring: string; icon: ReactNode | null }> = {
  success: {
    ring: 'bg-success-bg text-success-fg',
    icon: <Check className="size-3.5" aria-hidden />,
  },
  error: {
    ring: 'bg-danger-bg text-danger-fg',
    icon: <AlertCircle className="size-3.5" aria-hidden />,
  },
  info: { ring: 'bg-surface-sunken text-text-secondary', icon: null },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const push = useCallback((message: string, tone: ToastTone = 'info') => {
    const id = Date.now() + Math.random();
    setToasts((current) => [...current, { id, message, tone }]);
  }, []);

  const value = useMemo(() => push, [push]);

  return (
    <ToastContext.Provider value={value}>
      <RadixToast.Provider swipeDirection="right" duration={4000}>
        {children}

        {toasts.map((toast) => {
          const style = toneStyles[toast.tone];

          return (
            <RadixToast.Root
              key={toast.id}
              role={toast.tone === 'error' ? 'alert' : 'status'}
              className={cn(
                'data-[state=open]:animate-slide-up flex items-center gap-2.5 rounded-lg border border-border',
                'bg-surface py-2.5 pr-4 pl-3 text-small text-text shadow-md',
                'data-[swipe=end]:translate-x-(--radix-toast-swipe-end-x) data-[state=closed]:opacity-0',
              )}
              onOpenChange={(open) => {
                if (!open) dismiss(toast.id);
              }}
            >
              {style.icon ? (
                <span
                  className={cn(
                    'flex size-5 shrink-0 items-center justify-center rounded-full',
                    style.ring,
                  )}
                >
                  {style.icon}
                </span>
              ) : null}
              <RadixToast.Description>{toast.message}</RadixToast.Description>
            </RadixToast.Root>
          );
        })}

        <RadixToast.Viewport className="fixed right-4 bottom-4 z-(--z-toast) flex w-80 max-w-full flex-col gap-2 outline-none" />
      </RadixToast.Provider>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used inside ToastProvider');
  return context;
}
