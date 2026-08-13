import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { forgotPasswordRequestSchema, type ForgotPasswordRequest } from '@inventory-ms/contracts';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useForgotPassword } from './useForgotPassword';

export function ForgotPasswordPage() {
  const navigate = useNavigate();
  const forgotPassword = useForgotPassword();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordRequest>({ resolver: zodResolver(forgotPasswordRequestSchema) });

  const onSubmit = handleSubmit(async (values) => {
    const result = await forgotPassword.mutateAsync(values);
    void navigate(`/verify-code?challengeId=${encodeURIComponent(result.challengeId)}`, {
      state: { devResetCode: result.devResetCode },
    });
  });

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <div className="w-full max-w-sm space-y-6">
        <Card>
          <CardHeader className="space-y-1">
            <CardTitle className="text-base">Forgot your password?</CardTitle>
            <CardDescription>
              Enter your username or email and, if it matches an account, we&rsquo;ll email you a
              6-digit verification code.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form className="space-y-4" onSubmit={(event) => void onSubmit(event)} noValidate>
              <div className="space-y-1.5">
                <Label htmlFor="usernameOrEmail">Username or email</Label>
                <Input
                  id="usernameOrEmail"
                  type="text"
                  autoComplete="username"
                  aria-invalid={Boolean(errors.usernameOrEmail)}
                  {...register('usernameOrEmail')}
                />
                {errors.usernameOrEmail && (
                  <p role="alert" className="text-xs text-destructive">
                    {errors.usernameOrEmail.message}
                  </p>
                )}
              </div>

              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="animate-spin" />}
                {isSubmitting ? 'Sending…' : 'Send verification code'}
              </Button>
            </form>

            <Link
              to="/login"
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="size-4" />
              Back to sign in
            </Link>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
