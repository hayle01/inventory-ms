import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, Boxes, Loader2 } from 'lucide-react';
import { loginRequestSchema, type LoginRequest } from '@inventory-ms/contracts';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ApiError } from '../../lib/apiClient';
import { useLogin } from './useLogin';

export function LoginPage() {
  const navigate = useNavigate();
  const login = useLogin();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginRequest>({ resolver: zodResolver(loginRequestSchema) });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await login.mutateAsync(values);
      void navigate('/apps', { replace: true });
    } catch (error) {
      // Generic message only -- never disclose whether the account exists.
      if (error instanceof ApiError) {
        setError('root', { message: 'Invalid username/email or password.' });
      } else {
        setError('root', { message: 'Something went wrong. Please try again.' });
      }
    }
  });

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="flex size-10 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Boxes className="size-5" />
          </div>
          <h1 className="text-lg font-semibold tracking-tight">Inventory Management System</h1>
          <p className="text-sm text-muted-foreground">Sign in to continue</p>
        </div>

        <Card>
          <CardHeader className="space-y-1">
            <CardTitle className="text-base">Welcome back</CardTitle>
            <CardDescription>Enter your credentials to access your workspace</CardDescription>
          </CardHeader>
          <CardContent>
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

              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  aria-invalid={Boolean(errors.password)}
                  {...register('password')}
                />
                {errors.password && (
                  <p role="alert" className="text-xs text-destructive">
                    {errors.password.message}
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
                {isSubmitting ? 'Signing in…' : 'Sign in'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
