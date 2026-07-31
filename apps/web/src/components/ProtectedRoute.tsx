import type { ReactElement } from 'react';
import { Navigate } from 'react-router-dom';
import { useMe } from '../features/auth/useMe';

/**
 * Route guards are UX only -- they hide unavailable navigation and avoid a
 * flash of content the user cannot use. The backend re-checks every
 * permission on every request regardless of what this component renders.
 */
export function ProtectedRoute({ children }: { children: ReactElement }) {
  const me = useMe();

  if (me.isLoading) return <p>Loading…</p>;
  if (me.isError) return <Navigate to="/login" replace />;

  return children;
}
