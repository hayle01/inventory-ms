import { Ban, Check, Undo2 } from 'lucide-react';
import type { StockIssueStatus } from '@inventory-ms/contracts';
import { cn } from '@/lib/utils';

const STEPS: { key: StockIssueStatus; label: string }[] = [
  { key: 'draft', label: 'Draft' },
  { key: 'picked', label: 'Picked' },
  { key: 'posted', label: 'Posted' },
];

/**
 * `reversed` is a metadata stamp on an original posted issue once a linked
 * reversal issue exists for it, not a step this issue moves through --
 * shown as a banner instead (mirrors GoodsReceiptStatusStepper). `cancelled`
 * only happens before posting, so it's shown as a stopped-here terminal.
 */
export function StockIssueStatusStepper({
  status,
  isReversed,
}: {
  status: StockIssueStatus;
  isReversed: boolean;
}) {
  const isCancelled = status === 'cancelled';
  const currentIndex = isCancelled
    ? 0
    : Math.max(
        0,
        STEPS.findIndex((step) => step.key === status),
      );

  return (
    <div className="space-y-3">
      <div className="flex items-center overflow-x-auto py-2">
        {STEPS.map((step, index) => {
          const isComplete = !isCancelled && index < currentIndex;
          const isCurrent = !isCancelled && index === currentIndex;
          const isStoppedHere = isCancelled && index === currentIndex;
          const isFuture = index > currentIndex;

          return (
            <div key={step.key} className="flex flex-1 items-center last:flex-none">
              <div className="flex flex-col items-center gap-1.5">
                <span
                  className={cn(
                    'flex size-8 shrink-0 items-center justify-center rounded-full border text-xs font-semibold',
                    isComplete && 'border-emerald-500 bg-emerald-500 text-white',
                    isCurrent && 'border-primary bg-primary text-primary-foreground',
                    isStoppedHere && 'border-muted-foreground/40 bg-muted text-muted-foreground',
                    isFuture && 'border-border bg-background text-muted-foreground',
                  )}
                >
                  {isComplete && <Check className="size-4" />}
                  {isStoppedHere && <Ban className="size-4" />}
                  {!isComplete && !isStoppedHere && index + 1}
                </span>
                <span
                  className={cn(
                    'whitespace-nowrap text-xs font-medium',
                    (isComplete || isCurrent) && 'text-foreground',
                    isFuture && 'text-muted-foreground',
                  )}
                >
                  {isStoppedHere ? 'Cancelled' : step.label}
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
          This issue has been reversed by a linked reversal issue.
        </div>
      )}
    </div>
  );
}
