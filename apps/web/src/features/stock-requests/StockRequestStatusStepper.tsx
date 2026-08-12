import { Ban, Check, X } from 'lucide-react';
import type { StockRequestStatus } from '@inventory-ms/contracts';
import { cn } from '@/lib/utils';

const STEPS: { key: string; label: string; statuses: StockRequestStatus[] }[] = [
  { key: 'draft', label: 'Draft', statuses: ['draft'] },
  { key: 'submitted', label: 'Submitted', statuses: ['submitted'] },
  { key: 'approved', label: 'Approved', statuses: ['approved'] },
  { key: 'fulfilled', label: 'Fulfilled', statuses: ['partially_fulfilled', 'fulfilled'] },
];

const TERMINAL_LABEL: Partial<Record<StockRequestStatus, string>> = {
  rejected: 'Rejected',
  cancelled: 'Cancelled',
};

/** Index of the furthest step reached before a terminal rejection/cancellation. */
function stepIndexForStatus(status: StockRequestStatus): number {
  const found = STEPS.findIndex((step) => step.statuses.includes(status));
  if (found >= 0) return found;
  // Rejections happen out of `submitted`; cancellations can happen from any open state.
  // Without a stored "stopped at" step, anchor both at the submitted step.
  return 1;
}

export function StockRequestStatusStepper({ status }: { status: StockRequestStatus }) {
  const isTerminal = status === 'rejected' || status === 'cancelled';
  const currentIndex = stepIndexForStatus(status);

  return (
    <div className="flex items-center overflow-x-auto py-2">
      {STEPS.map((step, index) => {
        const isComplete = !isTerminal && index < currentIndex;
        const isCurrent = !isTerminal && index === currentIndex;
        const isStoppedHere = isTerminal && index === currentIndex;
        const isFuture = index > currentIndex;

        return (
          <div key={step.key} className="flex flex-1 items-center last:flex-none">
            <div className="flex flex-col items-center gap-1.5">
              <span
                className={cn(
                  'flex size-8 shrink-0 items-center justify-center rounded-full border text-xs font-semibold',
                  isComplete && 'border-emerald-500 bg-emerald-500 text-white',
                  isCurrent && 'border-primary bg-primary text-primary-foreground',
                  isStoppedHere &&
                    (status === 'rejected'
                      ? 'border-destructive bg-destructive text-destructive-foreground'
                      : 'border-muted-foreground/40 bg-muted text-muted-foreground'),
                  isFuture && !isTerminal && 'border-border bg-background text-muted-foreground',
                  index > currentIndex &&
                    isTerminal &&
                    'border-border bg-background text-muted-foreground opacity-50',
                )}
              >
                {isComplete && <Check className="size-4" />}
                {isStoppedHere && status === 'rejected' && <X className="size-4" />}
                {isStoppedHere && status === 'cancelled' && <Ban className="size-4" />}
                {!isComplete && !isStoppedHere && index + 1}
              </span>
              <span
                className={cn(
                  'whitespace-nowrap text-xs font-medium',
                  (isComplete || isCurrent) && 'text-foreground',
                  isFuture && 'text-muted-foreground',
                )}
              >
                {isStoppedHere ? TERMINAL_LABEL[status] : step.label}
              </span>
            </div>
            {index < STEPS.length - 1 && (
              <div
                className={cn(
                  'mx-2 h-0.5 flex-1',
                  index < currentIndex && !isTerminal ? 'bg-emerald-500' : 'bg-border',
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
