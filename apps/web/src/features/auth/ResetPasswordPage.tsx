import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ApiError } from '@/lib/apiClient';
import { useResetPassword } from './useResetPassword';

const formSchema = z
  .object({
    newPassword: z.string().min(8).max(256),
    confirmPassword: z.string().min(1),
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    message: 'Passwords do not match.',
    path: ['confirmPassword'],
  });
type FormValues = z.infer<typeof formSchema>;

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const resetPassword = useResetPassword();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(formSchema) });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await resetPassword.mutateAsync({ token, newPassword: values.newPassword });
    } catch (error) {
      setError('root', {
        message:
          error instanceof ApiError
            ? error.message
            : 'Something went wrong. Please request a new reset link.',
      });
    }
  });

  if (!token) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
        <div className="w-full max-w-sm">
          <Card>
            <CardContent className="space-y-4 pt-6">
              <Alert variant="destructive">
                <AlertCircle />
                <AlertDescription>
                  This reset link is missing its token. Request a new one from the sign-in page.
                </AlertDescription>
              </Alert>
              <Link to="/forgot-password" className="text-sm font-medium underline">
                Request a new link
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
            <CardTitle className="text-base">Set your password</CardTitle>
            <CardDescription>Choose a new password to finish signing in.</CardDescription>
          </CardHeader>
          <CardContent>
            {resetPassword.isSuccess ? (
              <div className="space-y-4">
                <Alert>
                  <CheckCircle2 />
                  <AlertDescription>
                    Your password has been changed. You can now sign in.
                  </AlertDescription>
                </Alert>
                <Button className="w-full" onClick={() => void navigate('/login')}>
                  Go to sign in
                </Button>
              </div>
            ) : (
              <form className="space-y-4" onSubmit={(event) => void onSubmit(event)} noValidate>
                <div className="space-y-1.5">
                  <Label htmlFor="newPassword">New password</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    autoComplete="new-password"
                    aria-invalid={Boolean(errors.newPassword)}
                    {...register('newPassword')}
                  />
                  {errors.newPassword && (
                    <p role="alert" className="text-xs text-destructive">
                      {errors.newPassword.message}
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="confirmPassword">Confirm password</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    autoComplete="new-password"
                    aria-invalid={Boolean(errors.confirmPassword)}
                    {...register('confirmPassword')}
                  />
                  {errors.confirmPassword && (
                    <p role="alert" className="text-xs text-destructive">
                      {errors.confirmPassword.message}
                    </p>
                  )}
                </div>

                {errors.root && (
                  <Alert variant="destructive">
                    <AlertCircle />
                    <AlertDescription>{errors.root.message}</AlertDescription>
                  </Alert>
                )}

                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="animate-spin" />}
                  {isSubmitting ? 'Saving…' : 'Set password'}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
