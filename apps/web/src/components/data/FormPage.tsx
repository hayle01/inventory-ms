import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface FormPageProps {
  title: string;
  description?: string;
  backTo: string;
  children: ReactNode;
  onSubmit: () => void;
  submitLabel?: string;
  isSubmitting?: boolean;
  errorMessage?: string | undefined;
  /** Extra actions shown next to Cancel/Save, e.g. a delete or archive button. */
  extraActions?: ReactNode;
}

/**
 * Full-page create/edit layout for entities with enough fields that a modal
 * would be cramped (products, suppliers, purchase orders, roles, users).
 * Simple reference data (departments, categories, units, ...) still uses
 * FormDialog.
 */
export function FormPage({
  title,
  description,
  backTo,
  children,
  onSubmit,
  submitLabel = 'Save',
  isSubmitting = false,
  errorMessage,
  extraActions,
}: FormPageProps) {
  const navigate = useNavigate();

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="mb-4 -ml-2"
        onClick={() => void navigate(backTo)}
      >
        <ArrowLeft />
        Back
      </Button>

      <div className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
      </div>

      <form
        className="space-y-6"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
        noValidate
      >
        {children}

        {errorMessage && (
          <Alert variant="destructive">
            <AlertCircle />
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        )}

        <div className="sticky bottom-0 -mx-4 flex items-center justify-between gap-2 border-t border-border bg-background/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
          <div>{extraActions}</div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => void navigate(backTo)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="animate-spin" />}
              {submitLabel}
            </Button>
          </div>
        </div>
      </form>
    </main>
  );
}

export function FormSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-4 rounded-lg border border-border bg-card p-5">
      <div>
        <h2 className="text-sm font-semibold">{title}</h2>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}
