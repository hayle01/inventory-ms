import { AlertTriangle, Lock } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ApiError } from '@/lib/apiClient';

export function ErrorState({ error }: { error: unknown }) {
  const isForbidden = error instanceof ApiError && error.statusCode === 403;

  return (
    <Alert variant="destructive">
      {isForbidden ? <Lock /> : <AlertTriangle />}
      <AlertDescription>
        {isForbidden
          ? "You don't have permission to view this."
          : error instanceof ApiError
            ? error.message
            : 'Something went wrong loading this page.'}
      </AlertDescription>
    </Alert>
  );
}
