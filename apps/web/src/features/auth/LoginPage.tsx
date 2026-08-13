import * as React from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { AlertCircle, Boxes, Eye, EyeOff, Loader2, Lock, Mail } from 'lucide-react';
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
  const [showPassword, setShowPassword] = React.useState(false);
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

        <Card className="rounded-md">
          <CardHeader className="space-y-1">
            <CardTitle className="text-base">Welcome back</CardTitle>
            <CardDescription>Enter your credentials to access your workspace</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={(event) => void onSubmit(event)} noValidate>
              <div className="space-y-1.5">
                <Label htmlFor="usernameOrEmail">Username or email</Label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="usernameOrEmail"
                    type="text"
                    autoComplete="username"
                    aria-invalid={Boolean(errors.usernameOrEmail)}
                    className="rounded-md pl-9"
                    {...register('usernameOrEmail')}
                  />
                </div>
                {errors.usernameOrEmail && (
                  <p role="alert" className="text-xs text-destructive">
                    {errors.usernameOrEmail.message}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <Link
                    to="/forgot-password"
                    className="text-xs font-medium text-muted-foreground hover:text-foreground"
                  >
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    aria-invalid={Boolean(errors.password)}
                    className="rounded-md px-9"
                    {...register('password')}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setShowPassword((value) => !value);
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
                {errors.password && (
                  <p role="alert" className="text-xs text-destructive">
                    {errors.password.message}
                  </p>
                )}
              </div>

              {errors.root && (
                <Alert variant="destructive" className="rounded-md">
                  <AlertCircle />
                  <AlertDescription>{errors.root.message}</AlertDescription>
                </Alert>
              )}

              <Button type="submit" className="w-full rounded-md" disabled={isSubmitting}>
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
