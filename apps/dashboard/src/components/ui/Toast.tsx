import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
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
    ring: 'bg-done-soft text-done',
    icon: <Check className="size-3" aria-hidden />,
  },
  error: {
    ring: 'bg-bad-soft text-bad',
    icon: <AlertCircle className="size-3" aria-hidden />,
  },
  info: { ring: 'bg-sunk text-ink-2', icon: null },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((message: string, tone: ToastTone = 'info') => {
    const id = Date.now() + Math.random();
    setToasts((current) => [...current, { id, message, tone }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 4000);
  }, []);

  const value = useMemo(() => push, [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}

      <div
        aria-live="polite"
        className="pointer-events-none fixed right-4 bottom-4 z-50 flex flex-col gap-2"
      >
        {toasts.map((toast) => {
          const style = toneStyles[toast.tone];

          return (
            <div
              key={toast.id}
              className={cn(
                'animate-toast-in flex items-center gap-2.5 rounded-lg border border-line',
                'bg-surface py-2.5 pr-4 pl-3 text-sm text-ink shadow-md',
              )}
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
              {toast.message}
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used inside ToastProvider');
  return context;
}
