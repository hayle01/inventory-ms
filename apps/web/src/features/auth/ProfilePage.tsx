import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { AlertCircle, Loader2, MonitorSmartphone, ShieldCheck, ShieldOff } from 'lucide-react';
import { z } from 'zod';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/use-toast';
import { ApiError } from '@/lib/apiClient';
import { useMe } from './useMe';
import { useChangePassword } from './useChangePassword';
import { useLogoutAllSessions, useRevokeSession, useSessions } from './useSessions';

const passwordFormSchema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password.'),
    newPassword: z.string().min(8).max(256),
    confirmPassword: z.string().min(1),
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    message: 'Passwords do not match.',
    path: ['confirmPassword'],
  });
type PasswordFormValues = z.infer<typeof passwordFormSchema>;

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString();
}

export function ProfilePage() {
  const me = useMe();

  if (me.isLoading || !me.data) {
    return (
      <main className="mx-auto max-w-3xl space-y-4 px-4 py-8 sm:px-6">
        <Skeleton className="h-64" />
      </main>
    );
  }

  const { user } = me.data;
  const roleNames = user.roleNames;

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-8 sm:px-6">
      <PageHeader title="Profile" description="Your account, security, and active sessions." />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="grid grid-cols-[120px_1fr] gap-y-2">
            <span className="text-muted-foreground">Full name</span>
            <span>{user.fullName}</span>
            <span className="text-muted-foreground">Username</span>
            <span>{user.username}</span>
            <span className="text-muted-foreground">Email</span>
            <span>{user.email}</span>
            <span className="text-muted-foreground">Status</span>
            <span className="capitalize">{user.status}</span>
            <span className="text-muted-foreground">Roles</span>
            <span>
              {roleNames.length > 0
                ? roleNames.join(', ')
                : `${String(user.roleIds.length)} role(s) assigned`}
            </span>
            <span className="text-muted-foreground">Multi-factor auth</span>
            <span className="flex items-center gap-1.5">
              {user.mfaEnabled ? (
                <>
                  <ShieldCheck className="size-4 text-emerald-600" /> Enabled
                </>
              ) : (
                <>
                  <ShieldOff className="size-4 text-muted-foreground" /> Not enabled
                </>
              )}
            </span>
            <span className="text-muted-foreground">Last login</span>
            <span>{user.lastLoginAt ? formatDateTime(user.lastLoginAt) : 'Never'}</span>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="password">
        <TabsList>
          <TabsTrigger value="password">Change password</TabsTrigger>
          <TabsTrigger value="sessions">Active sessions</TabsTrigger>
        </TabsList>
        <TabsContent value="password" className="mt-4">
          <ChangePasswordCard />
        </TabsContent>
        <TabsContent value="sessions" className="mt-4">
          <SessionsCard />
        </TabsContent>
      </Tabs>
    </main>
  );
}

function ChangePasswordCard() {
  const { toast } = useToast();
  const changePassword = useChangePassword();
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<PasswordFormValues>({ resolver: zodResolver(passwordFormSchema) });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await changePassword.mutateAsync({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      });
      reset();
      toast({
        variant: 'success',
        title: 'Password changed',
        description: 'Your other sessions have been signed out for your security.',
      });
    } catch (error) {
      setError('root', {
        message:
          error instanceof ApiError ? error.message : 'Something went wrong. Please try again.',
      });
    }
  });

  return (
    <Card>
      <CardContent className="pt-6">
        <form className="space-y-4" onSubmit={(event) => void onSubmit(event)} noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="currentPassword">Current password</Label>
            <Input
              id="currentPassword"
              type="password"
              autoComplete="current-password"
              aria-invalid={Boolean(errors.currentPassword)}
              {...register('currentPassword')}
            />
            {errors.currentPassword && (
              <p role="alert" className="text-xs text-destructive">
                {errors.currentPassword.message}
              </p>
            )}
          </div>

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
            <Label htmlFor="confirmPassword">Confirm new password</Label>
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

          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="animate-spin" />}
            {isSubmitting ? 'Saving…' : 'Change password'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function SessionsCard() {
  const { toast } = useToast();
  const sessions = useSessions();
  const revokeSession = useRevokeSession();
  const logoutAll = useLogoutAllSessions();

  const handleRevoke = (sessionId: string) => {
    revokeSession.mutate(sessionId, {
      onError: (error: unknown) => {
        toast({
          variant: 'destructive',
          title: 'Could not revoke session',
          description: error instanceof ApiError ? error.message : 'Something went wrong.',
        });
      },
    });
  };

  const handleLogoutAll = () => {
    logoutAll.mutate(undefined, {
      onSuccess: () => {
        window.location.assign('/login');
      },
      onError: (error: unknown) => {
        toast({
          variant: 'destructive',
          title: 'Could not sign out other sessions',
          description: error instanceof ApiError ? error.message : 'Something went wrong.',
        });
      },
    });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Active sessions</CardTitle>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={logoutAll.isPending}
          onClick={handleLogoutAll}
        >
          {logoutAll.isPending && <Loader2 className="animate-spin" />}
          Sign out all sessions
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {sessions.isLoading && <Skeleton className="h-32" />}
        {!sessions.isLoading && (sessions.data?.length ?? 0) === 0 && (
          <p className="text-sm text-muted-foreground">No active sessions found.</p>
        )}
        {sessions.data?.map((session) => (
          <div
            key={session.id}
            className="flex items-center justify-between gap-3 rounded-md border border-border p-3 text-sm"
          >
            <div className="flex items-start gap-2.5">
              <MonitorSmartphone className="mt-0.5 size-4 text-muted-foreground" />
              <div>
                <div className="flex items-center gap-2 font-medium">
                  {session.userAgentSummary ?? 'Unknown device'}
                  {session.isCurrent && <Badge variant="secondary">This device</Badge>}
                </div>
                <p className="text-xs text-muted-foreground">
                  Last active {formatDateTime(session.lastSeenAt)} · Expires{' '}
                  {formatDateTime(session.expiresAt)}
                </p>
              </div>
            </div>
            {!session.isCurrent && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={revokeSession.isPending}
                onClick={() => {
                  handleRevoke(session.id);
                }}
              >
                Revoke
              </Button>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
