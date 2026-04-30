import React from 'react';
import { Navigate, useLocation } from 'react-router';
import { useApp } from '../context/AppContext';

export function RequireAuth({ children, requireSuperAdmin = false }: { children: React.ReactNode; requireSuperAdmin?: boolean }) {
  const { session, authLoading, isSuperAdmin, roleLoading } = useApp();
  const location = useLocation();

  if (authLoading || (requireSuperAdmin && roleLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (requireSuperAdmin && !isSuperAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

export default RequireAuth;