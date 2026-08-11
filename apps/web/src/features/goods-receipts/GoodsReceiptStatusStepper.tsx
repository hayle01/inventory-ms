import { Check, Undo2 } from 'lucide-react';
import type { GoodsReceiptStatus } from '@inventory-ms/contracts';
import { cn } from '@/lib/utils';

const STEPS: { key: GoodsReceiptStatus; label: string }[] = [
  { key: 'draft', label: 'Draft' },
  { key: 'verified', label: 'Verified' },
  { key: 'posted', label: 'Posted' },
];

/**
 * `reversed` is not a step this receipt itself moves through -- it is a
 * metadata stamp on an original posted receipt once a linked reversal
 * receipt exists for it (see GoodsReceipt.reversedAt). Shown as a banner
 * below the stepper instead of a fourth step.
 */
export function GoodsReceiptStatusStepper({
  status,
  isReversed,
}: {
  status: GoodsReceiptStatus;
  isReversed: boolean;
}) {
  const currentIndex = STEPS.findIndex((step) => step.key === status);
  const effectiveIndex = currentIndex >= 0 ? currentIndex : STEPS.length - 1;

  return (
    <div className="space-y-3">
      <div className="flex items-center overflow-x-auto py-2">
        {STEPS.map((step, index) => {
          const isComplete = index < effectiveIndex;
          const isCurrent = index === effectiveIndex;
          const isFuture = index > effectiveIndex;

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
          This receipt has been reversed by a linked reversal receipt.
        </div>
      )}
    </div>
  );
}
