import { Check, Undo2, X } from 'lucide-react';
import type { StockCountStatus } from '@inventory-ms/contracts';
import { cn } from '@/lib/utils';

const STEPS: { key: StockCountStatus; label: string }[] = [
  { key: 'draft', label: 'Draft' },
  { key: 'submitted', label: 'Submitted' },
  { key: 'approved', label: 'Approved' },
  { key: 'posted', label: 'Posted' },
];

/** `reversed` is a stamp on the original posted count, shown as a banner (mirrors GoodsReceiptStatusStepper). */
export function StockCountStatusStepper({
  status,
  isReversed,
}: {
  status: StockCountStatus;
  isReversed: boolean;
}) {
  const isRejected = status === 'rejected';
  const currentIndex = isRejected
    ? 1
    : Math.max(
        0,
        STEPS.findIndex((step) => step.key === status),
      );

  return (
    <div className="space-y-3">
      <div className="flex items-center overflow-x-auto py-2">
        {STEPS.map((step, index) => {
          const isComplete = !isRejected && index < currentIndex;
          const isCurrent = !isRejected && index === currentIndex;
          const isStoppedHere = isRejected && index === currentIndex;
          const isFuture = index > currentIndex;

          return (
            <div key={step.key} className="flex flex-1 items-center last:flex-none">
              <div className="flex flex-col items-center gap-1.5">
                <span
                  className={cn(
                    'flex size-8 shrink-0 items-center justify-center rounded-full border text-xs font-semibold',
                    isComplete && 'border-emerald-500 bg-emerald-500 text-white',
                    isCurrent && 'border-primary bg-primary text-primary-foreground',
                    isStoppedHere && 'border-destructive bg-destructive text-destructive-foreground',
                    isFuture && 'border-border bg-background text-muted-foreground',
                  )}
                >
                  {isComplete && <Check className="size-4" />}
                  {isStoppedHere && <X className="size-4" />}
                  {!isComplete && !isStoppedHere && index + 1}
                </span>
                <span
                  className={cn(
                    'whitespace-nowrap text-xs font-medium',
                    (isComplete || isCurrent) && 'text-foreground',
                    isFuture && 'text-muted-foreground',
                  )}
                >
                  {isStoppedHere ? 'Rejected' : step.label}
                </span>
              </div>
              {index < STEPS.length - 1 && (
                <div
                  className={cn('mx-2 h-0.5 flex-1', isComplete ? 'bg-emerald-500' : 'bg-border')}
                />
              )}
            </div>
          );
        })}
      </div>
      {isReversed && (
        <div className="flex items-center gap-2 rounded-md border border-dashed border-muted-foreground/40 px-3 py-2 text-xs text-muted-foreground">
          <Undo2 className="size-3.5" />
          This count has been reversed by a linked reversal count.
        </div>
      )}
    </div>
  );
}
