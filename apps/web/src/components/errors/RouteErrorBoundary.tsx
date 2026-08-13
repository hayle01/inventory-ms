import { isRouteErrorResponse, Link, useRouteError } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, Compass, RotateCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

function errorMessage(error: unknown): string | null {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return null;
}

/**
 * Single errorElement for the whole router (see routes/router.tsx) --
 * handles both "no route matched" (404) and uncaught render/loader errors,
 * replacing React Router's default unstyled dev overlay.
 */
export function RouteErrorBoundary() {
  const error = useRouteError();
  const is404 = isRouteErrorResponse(error) && error.status === 404;
  const detail = import.meta.env.DEV ? errorMessage(error) : null;

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <div className="w-full max-w-md space-y-6 text-center">
        <div
          className={
            is404
              ? 'mx-auto flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary'
              : 'mx-auto flex size-14 items-center justify-center rounded-full bg-destructive/10 text-destructive'
          }
        >
          {is404 ? <Compass className="size-7" /> : <AlertTriangle className="size-7" />}
        </div>

        <div className="space-y-1.5">
          <h1 className="text-xl font-semibold tracking-tight">
            {is404 ? 'Page not found' : 'Something went wrong'}
          </h1>
          <p className="text-sm text-muted-foreground">
            {is404
              ? "The page you're looking for doesn't exist or may have moved."
              : 'An unexpected error stopped this page from loading. Try again, or head back to the launcher.'}
          </p>
          {detail && (
            <p className="rounded-md border border-border bg-card px-3 py-2 text-left font-mono text-xs text-muted-foreground">
              {detail}
            </p>
          )}
        </div>

        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" asChild>
            <Link to="/apps">
              <ArrowLeft />
              Back to launcher
            </Link>
          </Button>
          {!is404 && (
            <Button
              onClick={() => {
                window.location.reload();
              }}
            >
              <RotateCw />
              Reload
            </Button>
          )}
        </div>
      </div>
    </main>
  );
}
