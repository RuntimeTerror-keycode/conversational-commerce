import { AlertTriangle } from 'lucide-react';
import { Button } from './Button';

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
}

export function ErrorState({
  title = 'Could not load this',
  message,
  onRetry,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className="animate-fade-in flex flex-col items-center justify-center gap-3 px-6 py-16 text-center"
    >
      <div className="flex size-10 items-center justify-center rounded-full bg-danger-bg text-danger-fg">
        <AlertTriangle className="size-5" aria-hidden />
      </div>

      <div className="space-y-1">
        <p className="font-semibold text-text">{title}</p>
        {message ? (
          <p className="mx-auto max-w-xs text-small text-text-muted">{message}</p>
        ) : null}
      </div>

      {onRetry ? <Button onClick={onRetry}>Try again</Button> : null}
    </div>
  );
}
