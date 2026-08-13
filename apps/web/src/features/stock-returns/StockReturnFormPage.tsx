import * as React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { STOCK_RETURN_CONDITIONS, type StockReturnCondition } from '@inventory-ms/contracts';
import { FormPage, FormSection } from '@/components/data/FormPage';
import { FieldError } from '@/components/data/FieldError';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { errorMessage } from '@/lib/errorMessage';
import { useStockIssue } from '@/features/stock-issues/api';
import { useCreateStockReturn } from './api';

const DECIMAL_PATTERN = /^\d+(\.\d+)?$/;

interface LineDraft {
  stockIssueLineNumber: number;
  productName: string;
  productSku: string;
  outstanding: string;
  quantity: string;
  condition: StockReturnCondition;
  reason: string;
  include: boolean;
}

export function StockReturnFormPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const stockIssueId = searchParams.get('stockIssueId') ?? undefined;

  const stockIssue = useStockIssue(stockIssueId);
  const createStockReturn = useCreateStockReturn();

  const [notes, setNotes] = React.useState('');
  const [lines, setLines] = React.useState<LineDraft[]>([]);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const hydrated = React.useRef(false);

  React.useEffect(() => {
    if (hydrated.current || !stockIssue.data) return;
    hydrated.current = true;
    setLines(
      stockIssue.data.items
        .map((item): LineDraft => {
          const outstanding = (
            Number(item.pickedQuantity) - Number(item.returnedQuantity)
          ).toString();
          return {
            stockIssueLineNumber: item.lineNumber,
            productName: item.productName,
            productSku: item.productSku,
            outstanding,
            quantity: outstanding,
            condition: 'good',
            reason: '',
            include: Number(outstanding) > 0,
          };
        })
        .filter((line) => Number(line.outstanding) > 0),
    );
  }, [stockIssue.data]);

  if (!stockIssueId) {
    return (
      <main className="mx-auto max-w-6xl space-y-4 px-4 py-8 sm:px-6">
        <p className="text-sm text-destructive">
          Start a return from a posted stock issue&apos;s detail page.
        </p>
      </main>
    );
  }

  if (stockIssue.isLoading) {
    return (
      <main className="mx-auto max-w-6xl space-y-4 px-4 py-8 sm:px-6">
        <Skeleton className="h-96" />
      </main>
    );
  }

  if (stockIssue.isError || !stockIssue.data) {
    return (
      <main className="mx-auto max-w-6xl space-y-4 px-4 py-8 sm:px-6">
        <p className="text-sm text-destructive">Stock issue not found.</p>
      </main>
    );
  }

  const updateLine = (lineNumber: number, patch: Partial<LineDraft>) => {
    setLines((current) =>
      current.map((line) =>
        line.stockIssueLineNumber === lineNumber ? { ...line, ...patch } : line,
      ),
    );
  };

  const handleSubmit = () => {
    const nextErrors: Record<string, string> = {};
    const included = lines.filter((line) => line.include);

    if (included.length === 0) {
      nextErrors['general'] = 'Select at least one line to return.';
    }

    included.forEach((line) => {
      const key = `line-${String(line.stockIssueLineNumber)}`;
      if (!DECIMAL_PATTERN.test(line.quantity.trim()) || Number(line.quantity) <= 0) {
        nextErrors[key] = 'Enter a valid quantity greater than zero.';
        return;
      }
      if (Number(line.quantity) > Number(line.outstanding)) {
        nextErrors[key] =
          `Cannot return more than the outstanding picked quantity (${line.outstanding}).`;
      }
    });

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const items = included.map((line) => ({
      stockIssueLineNumber: line.stockIssueLineNumber,
      quantity: line.quantity.trim(),
      condition: line.condition,
      reason: line.reason.trim() || null,
    }));

    void createStockReturn
      .mutateAsync({ stockIssueId, items, notes: notes.trim() || null })
      .then((result) => void navigate(`/apps/stock-returns/${result.id}`));
  };

  return (
    <FormPage
      title={`Return from ${stockIssue.data.issueNumber}`}
      description="Select which picked lines are coming back, how much, and their condition."
      backTo={`/apps/stock-issues/${stockIssueId}`}
      onSubmit={handleSubmit}
      submitLabel="Create draft return"
      isSubmitting={createStockReturn.isPending}
      errorMessage={createStockReturn.isError ? errorMessage(createStockReturn.error) : undefined}
    >
      <FormSection title="Lines to return">
        <FieldError message={errors['general']} />
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead />
              <TableHead>Product</TableHead>
              <TableHead>Outstanding</TableHead>
              <TableHead>Quantity</TableHead>
              <TableHead>Condition</TableHead>
              <TableHead>Reason</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lines.map((line) => {
              const lineError = errors[`line-${String(line.stockIssueLineNumber)}`];
              return (
                <TableRow key={line.stockIssueLineNumber}>
                  <TableCell>
                    <input
                      type="checkbox"
                      checked={line.include}
                      onChange={(event) => {
                        updateLine(line.stockIssueLineNumber, { include: event.target.checked });
                      }}
                    />
                  </TableCell>
                  <TableCell>
                    <p className="font-medium">{line.productName}</p>
                    <p className="font-mono text-xs text-muted-foreground">{line.productSku}</p>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{line.outstanding}</TableCell>
                  <TableCell>
                    <Input
                      className="w-24"
                      inputMode="decimal"
                      disabled={!line.include}
                      aria-invalid={Boolean(lineError)}
                      value={line.quantity}
                      onChange={(event) => {
                        updateLine(line.stockIssueLineNumber, { quantity: event.target.value });
                      }}
                    />
                    <FieldError message={lineError} />
                  </TableCell>
                  <TableCell className="min-w-32">
                    <Select
                      value={line.condition}
                      onValueChange={(value) => {
                        updateLine(line.stockIssueLineNumber, {
                          condition: value as StockReturnCondition,
                        });
                      }}
                      disabled={!line.include}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STOCK_RETURN_CONDITIONS.map((condition) => (
                          <SelectItem key={condition} value={condition}>
                            {condition}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="min-w-40">
                    <Input
                      disabled={!line.include}
                      value={line.reason}
                      onChange={(event) => {
                        updateLine(line.stockIssueLineNumber, { reason: event.target.value });
                      }}
                    />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>

        <div className="space-y-1.5">
          <Label htmlFor="ret-notes">Notes</Label>
          <Textarea
            id="ret-notes"
            value={notes}
            onChange={(event) => {
              setNotes(event.target.value);
            }}
            rows={2}
          />
        </div>
      </FormSection>
    </FormPage>
  );
}
