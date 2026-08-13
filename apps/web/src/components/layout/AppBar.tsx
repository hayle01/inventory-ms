import * as React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, Boxes, ClipboardCheck, LogOut, UserCircle } from 'lucide-react';
import { useMe } from '@/features/auth/useMe';
import { useLogout } from '@/features/auth/useLogout';
import { usePermissions } from '@/features/auth/usePermissions';
import { usePendingApprovals } from '@/features/approvals/api';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/components/ui/use-toast';
import { APP_MODULE_GROUPS, APP_MODULES } from '@/features/launcher/modules';
import { cn } from '@/lib/utils';

function initialsFor(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return (first + last).toUpperCase();
}

export function AppBar() {
  const me = useMe();
  const logout = useLogout();
  const navigate = useNavigate();
  const location = useLocation();
  const { has } = usePermissions();
  const { toast } = useToast();
  const [hovering, setHovering] = React.useState(false);
  const { items: pendingApprovals } = usePendingApprovals();

  const isLauncher = location.pathname === '/apps';
  const currentModule = [...APP_MODULES]
    .sort((a, b) => b.href.length - a.href.length)
    .find(
      (module) =>
        location.pathname === module.href || location.pathname.startsWith(`${module.href}/`),
    );
  const currentGroup = currentModule
    ? APP_MODULE_GROUPS.find((group) => group.key === currentModule.group)
    : undefined;
  const siblingModules = currentGroup
    ? APP_MODULES.filter(
        (module) => module.group === currentGroup.key && has(module.requiredPermission),
      )
    : [];

  const LeftIcon = hovering && !isLauncher ? ArrowLeft : (currentGroup?.icon ?? Boxes);

  const handleLogout = async () => {
    try {
      await logout.mutateAsync();
    } catch {
      // Even if the server call fails (e.g. session already expired), the
      // local session cache is cleared -- send the user to login regardless.
      toast({
        variant: 'destructive',
        title: 'Sign out failed',
        description: 'You have been signed out locally; please sign in again.',
      });
    } finally {
      void navigate('/login', { replace: true });
    }
  };

  return (
    <header className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur sm:px-6">
      <Link
        to="/apps"
        aria-label={isLauncher ? 'Applications' : 'Back to applications'}
        onMouseEnter={() => {
          setHovering(true);
        }}
        onMouseLeave={() => {
          setHovering(false);
        }}
        className={cn(
          'flex size-9 shrink-0 items-center justify-center rounded-md text-white shadow-sm transition-colors',
          !isLauncher && currentGroup ? currentGroup.tint : 'bg-primary',
        )}
      >
        <LeftIcon className="size-4.5" />
      </Link>

      {siblingModules.length > 1 && (
        <nav className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
          {siblingModules.map((module) => {
            const isActive = module.key === currentModule?.key;
            return (
              <Link
                key={module.key}
                to={module.href}
                className={cn(
                  'whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-accent text-foreground'
                    : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground',
                )}
              >
                {module.label}
              </Link>
            );
          })}
        </nav>
      )}

      <div className="ml-auto flex shrink-0 items-center gap-2">
        {me.data && (
          <Link
            to="/apps/approvals"
            aria-label="Approvals"
            className="relative flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <ClipboardCheck className="size-4.5" />
            {pendingApprovals.length > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] font-medium text-destructive-foreground">
                {pendingApprovals.length > 9 ? '9+' : pendingApprovals.length}
              </span>
            )}
          </Link>
        )}

        {me.data && (
          <DropdownMenu>
            <DropdownMenuTrigger className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring/50">
              <Avatar className="size-8">
                <AvatarFallback>{initialsFor(me.data.user.fullName)}</AvatarFallback>
              </Avatar>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>{me.data.user.fullName}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => void navigate('/apps/profile')}>
                <UserCircle />
                Profile
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                disabled={logout.isPending}
                onSelect={() => void handleLogout()}
              >
                <LogOut />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </header>
  );
}
