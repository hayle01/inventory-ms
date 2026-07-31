import * as React from 'react';
import { Building } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ErrorState } from '@/components/data/ErrorState';
import { ForbiddenState } from '@/components/data/ForbiddenState';
import { usePermissions } from '@/features/auth/usePermissions';
import { errorMessage } from '@/lib/errorMessage';
import { useOrganization, useUpdateOrganization } from './api';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';

export function OrganizationPage() {
  const { has } = usePermissions();
  const organization = useOrganization();
  const updateOrganization = useUpdateOrganization();

  const [name, setName] = React.useState('');
  const [timezone, setTimezone] = React.useState('');
  const [currencyCode, setCurrencyCode] = React.useState('');
  const [saved, setSaved] = React.useState(false);

  React.useEffect(() => {
    if (!organization.data) return;
    setName(organization.data.name);
    setTimezone(organization.data.timezone);
    setCurrencyCode(organization.data.currencyCode);
  }, [organization.data]);

  if (!has('organizations.view')) return <ForbiddenState module="organization settings" />;

  const canManage = has('organizations.manage');

  const handleSubmit = (event: React.SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaved(false);
    updateOrganization
      .mutateAsync({
        name: name.trim(),
        timezone: timezone.trim(),
        currencyCode: currencyCode.trim().toUpperCase(),
      })
      .then(() => {
        setSaved(true);
      })
      .catch(() => undefined);
  };

  return (
    <main className="mx-auto max-w-2xl space-y-6 px-4 py-8 sm:px-6">
      <PageHeader title="Organization" description="Your company profile and locale settings." />

      {organization.isLoading && <Skeleton className="h-64" />}
      {organization.isError && <ErrorState error={organization.error} />}

      {organization.data && (
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Building className="size-4" />
                {organization.data.name}
              </CardTitle>
              <CardDescription>Code {organization.data.code}</CardDescription>
            </div>
            <Badge variant={organization.data.status === 'active' ? 'success' : 'destructive'}>
              {organization.data.status}
            </Badge>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="org-name">Name</Label>
                <Input
                  id="org-name"
                  value={name}
                  onChange={(event) => {
                    setName(event.target.value);
                  }}
                  disabled={!canManage}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="org-timezone">Timezone</Label>
                  <Input
                    id="org-timezone"
                    value={timezone}
                    onChange={(event) => {
                      setTimezone(event.target.value);
                    }}
                    disabled={!canManage}
                    placeholder="e.g. Africa/Mogadishu"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="org-currency">Currency code</Label>
                  <Input
                    id="org-currency"
                    value={currencyCode}
                    onChange={(event) => {
                      setCurrencyCode(event.target.value);
                    }}
                    disabled={!canManage}
                    maxLength={3}
                    placeholder="e.g. USD"
                  />
                </div>
              </div>

              {updateOrganization.isError && (
                <Alert variant="destructive">
                  <AlertCircle />
                  <AlertDescription>{errorMessage(updateOrganization.error)}</AlertDescription>
                </Alert>
              )}
              {saved && !updateOrganization.isPending && (
                <Alert>
                  <CheckCircle2 />
                  <AlertDescription>Organization settings saved.</AlertDescription>
                </Alert>
              )}
            </CardContent>
            {canManage && (
              <CardFooter>
                <Button type="submit" disabled={updateOrganization.isPending}>
                  {updateOrganization.isPending && <Loader2 className="animate-spin" />}
                  Save changes
                </Button>
              </CardFooter>
            )}
          </form>
        </Card>
      )}
    </main>
  );
}
