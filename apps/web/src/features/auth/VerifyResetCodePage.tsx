import * as React from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, AlertCircle, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { ApiError } from '@/lib/apiClient';
import { useVerifyResetCode } from './useVerifyResetCode';

export function VerifyResetCodePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const challengeId = searchParams.get('challengeId') ?? '';
  const devResetCode = (location.state as { devResetCode?: string } | null)?.devResetCode;

  const [code, setCode] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const verifyResetCode = useVerifyResetCode();

  const handleSubmit = (value: string) => {
    setError(null);
    verifyResetCode.mutate(
      { challengeId, code: value },
      {
        onSuccess: (result) => {
          void navigate(`/reset-password?token=${encodeURIComponent(result.token)}`, {
            replace: true,
          });
        },
        onError: (caught: unknown) => {
          setCode('');
          setError(caught instanceof ApiError ? caught.message : 'Something went wrong.');
        },
      },
    );
  };

  if (!challengeId) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
        <div className="w-full max-w-sm">
          <Card>
            <CardContent className="space-y-4 pt-6">
              <Alert variant="destructive">
                <AlertCircle />
                <AlertDescription>
                  This verification link is missing its challenge id. Request a new code from the
                  sign-in page.
                </AlertDescription>
              </Alert>
              <Link to="/forgot-password" className="text-sm font-medium underline">
                Request a new code
              </Link>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <div className="w-full max-w-sm space-y-6">
        <Card>
          <CardHeader className="space-y-1">
            <CardTitle className="text-base">Enter verification code</CardTitle>
            <CardDescription>
              We emailed a 6-digit code. Enter it below to continue resetting your password.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {devResetCode && (
              <Alert>
                <AlertDescription>
                  Dev mode: no SMTP transport is required to test this — your code is{' '}
                  <span className="font-mono font-semibold">{devResetCode}</span>.
                </AlertDescription>
              </Alert>
            )}

            <div className="flex justify-center">
              <InputOTP
                maxLength={6}
                value={code}
                onChange={setCode}
                disabled={verifyResetCode.isPending}
                onComplete={handleSubmit}
              >
                <InputOTPGroup>
                  <InputOTPSlot index={0} />
                  <InputOTPSlot index={1} />
                  <InputOTPSlot index={2} />
                  <InputOTPSlot index={3} />
                  <InputOTPSlot index={4} />
                  <InputOTPSlot index={5} />
                </InputOTPGroup>
              </InputOTP>
            </div>

            {verifyResetCode.isPending && (
              <p className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> Verifying…
              </p>
            )}

            {error && (
              <Alert variant="destructive">
                <AlertCircle />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Link
              to="/forgot-password"
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="size-4" />
              Request a new code
            </Link>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
