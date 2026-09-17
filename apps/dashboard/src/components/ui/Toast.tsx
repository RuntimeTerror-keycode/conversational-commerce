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

/**
 * The left bar carries the tone; the card itself stays white.
 * Design canvas, "Toasts": 3px bar, radius 8, lifted shadow.
 */
const toneStyles: Record<ToastTone, { bar: string; border: string; icon: ReactNode | null }> = {
  success: {
    bar: 'bg-success',
    border: 'border-success-border',
    icon: <Check className="size-4 shrink-0 text-success-fg" aria-hidden />,
  },
  error: {
    bar: 'bg-danger-fg',
    border: 'border-danger-border',
    icon: <AlertCircle className="size-4 shrink-0 text-danger-fg" aria-hidden />,
  },
  info: { bar: 'bg-border-strong', border: 'border-border', icon: null },
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
                'data-[state=open]:animate-slide-up flex items-center gap-2.5 overflow-hidden rounded-lg border',
                'bg-surface py-3 pr-3.5 pl-0 text-small text-text shadow-lg',
                'data-[swipe=end]:translate-x-(--radix-toast-swipe-end-x) data-[state=closed]:opacity-0',
                style.border,
              )}
              onOpenChange={(open) => {
                if (!open) dismiss(toast.id);
              }}
            >
              <span className={cn('w-[3px] self-stretch', style.bar)} aria-hidden />
              {style.icon ? (
                <span className="flex shrink-0 items-center pl-1">{style.icon}</span>
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
