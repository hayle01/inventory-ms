import { Check, Undo2 } from 'lucide-react';
import type { StockTransferStatus } from '@inventory-ms/contracts';
import { cn } from '@/lib/utils';

const STEPS: { key: string; label: string; statuses: StockTransferStatus[] }[] = [
  { key: 'draft', label: 'Draft', statuses: ['draft'] },
  { key: 'submitted', label: 'Submitted', statuses: ['submitted'] },
  { key: 'approved', label: 'Approved', statuses: ['approved'] },
  { key: 'in_transit', label: 'In transit', statuses: ['in_transit'] },
  { key: 'completed', label: 'Completed', statuses: ['completed'] },
];

/**
 * An `immediate`-policy transfer skips the `in_transit` step entirely (its
 * `post` goes straight to `completed`) -- the stepper still shows the step
 * as "complete" once the transfer reaches `completed`, since the in-transit
 * state was simply instantaneous, not skipped as a workflow concept.
 */
function stepIndexForStatus(status: StockTransferStatus): number {
  const found = STEPS.findIndex((step) => step.statuses.includes(status));
  return found >= 0 ? found : 0;
}

export function StockTransferStatusStepper({
  status,
  isReversed,
}: {
  status: StockTransferStatus;
  isReversed: boolean;
}) {
  const currentIndex = stepIndexForStatus(status);

  return (
    <div className="space-y-3">
      <div className="flex items-center overflow-x-auto py-2">
        {STEPS.map((step, index) => {
          const isComplete = index < currentIndex;
          const isCurrent = index === currentIndex;
          const isFuture = index > currentIndex;

          return (
            <div key={step.key} className="flex flex-1 items-center last:flex-none">
              <div className="flex flex-col items-center gap-1.5">
                <span
                  className={cn(
                    'flex size-8 shrink-0 items-center justify-center rounded-full border text-xs font-semibold',
                    isComplete && 'border-emerald-500 bg-emerald-500 text-white',
                    isCurrent && 'border-primary bg-primary text-primary-foreground',
                    isFuture && 'border-border bg-background text-muted-foreground',
                  )}
                >
                  {isComplete ? <Check className="size-4" /> : index + 1}
                </span>
                <span
                  className={cn(
                    'whitespace-nowrap text-xs font-medium',
                    (isComplete || isCurrent) && 'text-foreground',
                    isFuture && 'text-muted-foreground',
                  )}
                >
                  {step.label}
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
          This transfer has been reversed by a linked reversal transfer.
        </div>
      )}
    </div>
  );
}
