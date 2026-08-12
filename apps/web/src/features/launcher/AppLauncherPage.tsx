import { Link } from 'react-router-dom';
import { useMe } from '@/features/auth/useMe';
import { Skeleton } from '@/components/ui/skeleton';
import { APP_MODULE_GROUPS, APP_MODULES } from './modules';

export function AppLauncherPage() {
  const me = useMe();

  if (me.isLoading) {
    return (
      <main className="mx-auto max-w-5xl space-y-4 px-4 py-8 sm:px-6">
        <Skeleton className="h-9 w-full max-w-xl" />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-32" />
          ))}
        </div>
      </main>
    );
  }
  if (me.isError || !me.data) {
    return <p className="p-6 text-sm text-destructive">Unable to load your session.</p>;
  }

  const permissions = new Set(me.data.permissions);
  const availableModules = APP_MODULES.filter((module) =>
    permissions.has(module.requiredPermission),
  );

  const groups = APP_MODULE_GROUPS.map((group) => ({
    group,
    modules: availableModules.filter((module) => module.group === group.key),
  })).filter((entry) => entry.modules.length > 0);

  if (groups.length === 0) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <p className="text-sm text-muted-foreground">
          No modules are available for your account yet. Contact an administrator.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
        {groups.map(({ group, modules }) => {
          const Icon = group.icon;
          return (
            <Link
              key={group.key}
              to={modules[0]?.href ?? '/apps'}
              className="group flex flex-col items-center gap-2.5 rounded-sm border border-transparent p-4 text-center transition-colors hover:border-border hover:bg-accent/40"
            >
              <span
                className={`flex size-16 items-center justify-center rounded-lg text-white transition-transform group-hover:scale-105 ${group.tint}`}
              >
                <Icon className="size-7" />
              </span>
              <span className="text-sm font-medium leading-tight">{group.label}</span>
              <span className="text-xs text-muted-foreground">
                {modules.length} {modules.length === 1 ? 'module' : 'modules'}
              </span>
            </Link>
          );
        })}
      </div>
    </main>
  );
}
