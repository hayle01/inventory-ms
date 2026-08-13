import type { ReactElement } from 'react';
import { Navigate } from 'react-router-dom';
import { useMe } from '../features/auth/useMe';
import { FullPageSpinner } from './layout/FullPageSpinner';

/**
 * Inverse of ProtectedRoute -- keeps an already-authenticated user off
 * public-only pages (login, forgot-password) by bouncing them to the
 * launcher instead. Backend routes like `/auth/login` don't care whether a
 * session already exists, so this is UX-only, same caveat as ProtectedRoute.
 */
export function PublicOnlyRoute({ children }: { children: ReactElement }) {
  const me = useMe();

  if (me.isLoading) return <FullPageSpinner />;
  if (me.data) return <Navigate to="/apps" replace />;

  return children;
}
