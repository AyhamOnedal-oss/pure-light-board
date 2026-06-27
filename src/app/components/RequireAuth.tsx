import React from 'react';
import { Navigate, useLocation } from 'react-router';
import { useApp } from '../context/AppContext';
import { AccountDisabledScreen } from './AccountDisabledScreen';

export function RequireAuth({ children, requireSuperAdmin = false }: { children: React.ReactNode; requireSuperAdmin?: boolean }) {
  const { session, authLoading, isSuperAdmin, isAnyAdmin, roleLoading, isSubscriptionEnded, subscriptionLoading } = useApp();
  const location = useLocation();

  if (authLoading || roleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }

  // `requireSuperAdmin` actually gates the whole admin panel — accept both
  // super_admin (Fuqah founders) and admin (invited Fuqah employees).
  if (requireSuperAdmin && !isAnyAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  // If an admin (super_admin or admin-employee) lands on a user route, send
  // them to the admin panel — these accounts have no tenant.
  if (!requireSuperAdmin && isAnyAdmin && location.pathname.startsWith('/dashboard')) {
    return <Navigate to="/admin" replace />;
  }

  // Block ended/suspended customers from the user dashboard. Admins
  // (super_admin / admin employees) and impersonation sessions are not
  // affected because they don't resolve a tenant subscription.
  if (!requireSuperAdmin && !isAnyAdmin && !subscriptionLoading && isSubscriptionEnded) {
    return <AccountDisabledScreen />;
  }

  return <>{children}</>;
}

export default RequireAuth;