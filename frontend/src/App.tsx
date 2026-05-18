import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';
import { useEffect } from 'react';

import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Layout from './components/Layout';
import Animals from './pages/Animals';
import Appointments from './pages/Appointments';
import Queue from './pages/Queue';
import Prescriptions from './pages/Prescriptions';
import Vaccines from './pages/Vaccines';
import Exams from './pages/Exams';
import Admin from './pages/Admin';

function ProtectedRoute() {
  const { user, isLoading } = useAuthStore();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}

function AuthInit({ children }: { children: React.ReactNode }) {
  const { checkAuth, isLoading } = useAuthStore();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return <>{children}</>;
}

function RootLayout() {
  return (
    <AuthInit>
      <Outlet />
    </AuthInit>
  );
}

export const router = createBrowserRouter(
  [
    {
      element: <RootLayout />,
      children: [
        { path: '/login', element: <Login /> },
        { path: '/register', element: <Register /> },
        {
          element: <ProtectedRoute />,
          children: [
            {
              element: <Layout />,
              children: [
                { index: true, element: <Dashboard /> },
                { path: 'animals', element: <Animals /> },
                { path: 'appointments', element: <Appointments /> },
                { path: 'queue', element: <Queue /> },
                { path: 'prescriptions', element: <Prescriptions /> },
                { path: 'vaccines', element: <Vaccines /> },
                { path: 'exams', element: <Exams /> },
                { path: 'admin', element: <Admin /> },
              ],
            },
          ],
        },
        { path: '*', element: <Navigate to="/" replace /> },
      ],
    },
  ],
  {
    future: {
      v7_startTransition: true,
      v7_relativeSplatPath: true,
      v7_fetcherPersist: true,
      v7_normalizeFormMethod: true,
      v7_partialHydration: true,
      v7_skipActionErrorRevalidation: true,
    } as any,
  }
);