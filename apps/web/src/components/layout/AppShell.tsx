import { Outlet } from 'react-router-dom';
import { AppBar } from './AppBar';

export function AppShell() {
  return (
    <div className="min-h-screen bg-muted/30">
      <AppBar />
      <Outlet />
    </div>
  );
}
