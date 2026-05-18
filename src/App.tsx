import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
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
    return <Navigate to="/vet/login" replace />;
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

export default function VetApp() {
  return (
    <div className="light-mode text-gray-800 bg-gray-50 min-h-screen w-full">
      <AuthInit>
        <Routes>
          <Route path="login" element={<Login />} />
          <Route path="register" element={<Register />} />
          
          <Route element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              <Route index element={<Dashboard />} />
              <Route path="animals" element={<Animals />} />
              <Route path="appointments" element={<Appointments />} />
              <Route path="queue" element={<Queue />} />
              <Route path="prescriptions" element={<Prescriptions />} />
              <Route path="vaccines" element={<Vaccines />} />
              <Route path="exams" element={<Exams />} />
              <Route path="admin" element={<Admin />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/vet" replace />} />
        </Routes>
      </AuthInit>
    </div>
  );
}