import { Link } from 'react-router-dom';
import { Boxes, LogOut } from 'lucide-react';
import { useMe } from '@/features/auth/useMe';
import { useLogout } from '@/features/auth/useLogout';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

function initialsFor(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return (first + last).toUpperCase();
}

export function AppBar() {
  const me = useMe();
  const logout = useLogout();

  return (
    <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b border-border bg-background/80 px-4 backdrop-blur sm:px-6">
      <Link to="/apps" className="flex items-center gap-2 font-semibold tracking-tight">
        <span className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <Boxes className="size-4.5" />
        </span>
        <span className="hidden sm:inline">Inventory Management System</span>
      </Link>

      <div className="flex items-center gap-3">
        {me.data && (
          <div className="flex items-center gap-2">
            <Avatar className="size-8">
              <AvatarFallback>{initialsFor(me.data.user.fullName)}</AvatarFallback>
            </Avatar>
            <span className="hidden text-sm font-medium sm:inline">{me.data.user.fullName}</span>
          </div>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => void logout.mutateAsync()}
          disabled={logout.isPending}
        >
          <LogOut />
          <span className="hidden sm:inline">Sign out</span>
        </Button>
      </div>
    </header>
  );
}
