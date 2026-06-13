import React from 'react';
import { Navigate, useLocation } from 'react-router';
import { useApp } from '../context/AppContext';
import {
  PATH_TO_PERMISSION,
  PermissionKey,
  firstAllowedPath,
  isAllowed,
  useCurrentMemberPermissions,
} from '../utils/permissions';

export function RequirePermission({ children }: { children: React.ReactNode }) {
  const { user, tenantId, isSuperAdmin, tenantLoading } = useApp();
  const { perms, loading, disabled } = useCurrentMemberPermissions(user?.id, tenantId, isSuperAdmin);
  const location = useLocation();

  if (tenantLoading || loading) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Disabled members: allow viewing the frozen main dashboard only,
  // block every other route by redirecting back to /dashboard.
  if (disabled) {
    if (location.pathname !== '/dashboard') {
      return <Navigate to="/dashboard" replace />;
    }
    return <>{children}</>;
  }

  const key: PermissionKey | undefined = PATH_TO_PERMISSION[location.pathname];
  if (!key) return <>{children}</>; // unknown route — let it render
  const allowed = perms === 'all' ? true : isAllowed(perms, key);
  if (!allowed) {
    const dest = firstAllowedPath(perms);
    if (dest === location.pathname) return <>{children}</>;
    return <Navigate to={dest} replace />;
  }
  return <>{children}</>;
}

export default RequirePermission;