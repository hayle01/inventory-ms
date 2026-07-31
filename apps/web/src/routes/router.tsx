import { createBrowserRouter, Navigate } from 'react-router-dom';
import { LoginPage } from '../features/auth/LoginPage';
import { ProtectedRoute } from '../components/ProtectedRoute';
import { AppShell } from '../components/layout/AppShell';
import { AppLauncherPage } from '../features/launcher/AppLauncherPage';
import { ComingSoonPage } from '../features/placeholder/ComingSoonPage';
import { APP_MODULES } from '../features/launcher/modules';

export const router = createBrowserRouter([
  { path: '/', element: <Navigate to="/apps" replace /> },
  { path: '/login', element: <LoginPage /> },
  {
    path: '/apps',
    element: (
      <ProtectedRoute>
        <AppShell />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <AppLauncherPage /> },
      ...APP_MODULES.map((module) => ({
        path: module.href.replace('/apps/', ''),
        element: <ComingSoonPage title={module.label} />,
      })),
    ],
  },
]);
