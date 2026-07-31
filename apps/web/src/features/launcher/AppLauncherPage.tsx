import { Link } from 'react-router-dom';
import { useMe } from '@/features/auth/useMe';
import { APP_MODULES } from './modules';

export function AppLauncherPage() {
  const me = useMe();

  if (me.isLoading) {
    return <p className="p-6 text-sm text-muted-foreground">Loading…</p>;
  }
  if (me.isError || !me.data) {
    return <p className="p-6 text-sm text-destructive">Unable to load your session.</p>;
  }

  const permissions = new Set(me.data.permissions);
  const availableModules = APP_MODULES.filter((module) =>
    permissions.has(module.requiredPermission),
  );

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      {availableModules.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No modules are available for your account yet. Contact an administrator.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {availableModules.map((module) => {
            const Icon = module.icon;
            return (
              <Link
                key={module.key}
                to={module.href}
                className="group flex flex-col items-center gap-2 rounded-sm p-3 text-center transition-colors "
              >
                <span
                  className={`flex size-14 items-center justify-center rounded-md text-white transition-transform group-hover:scale-105 ${module.tint}`}
                >
                  <Icon className="size-6" />
                </span>
                <span className="text-sm font-medium">{module.label}</span>
                {/* <span className="text-xs text-muted-foreground">{module.description}</span> */}
              </Link>
            );
          })}
        </div>
      )}
    </main>
  );
}
