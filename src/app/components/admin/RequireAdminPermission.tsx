import React from 'react';
import { Navigate, useLocation } from 'react-router';
import { useApp } from '../../context/AppContext';
import { firstAllowedAdminPath, type AdminPermKey } from '../../utils/adminPermissions';

/**
 * Route guard for /admin sub-pages. Allows super admin always; for admin
 * employees, requires the matching permission. Redirects to their first
 * allowed admin page when the page is forbidden.
 */
export function RequireAdminPermission({
  perm,
  children,
}: { perm: AdminPermKey | AdminPermKey[]; children: React.ReactNode }) {
  const { adminCan, adminPermissionsLoading, isSuperAdmin } = useApp();
  const location = useLocation();
  if (adminPermissionsLoading) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  const keys = Array.isArray(perm) ? perm : [perm];
  const allowed = isSuperAdmin || keys.some(k => adminCan(k));
  if (allowed) return <>{children}</>;
  const fallback = firstAllowedAdminPath(adminCan);
  if (fallback === location.pathname) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center text-muted-foreground text-[13px]">
        لا تملك صلاحية الوصول إلى هذه الصفحة
      </div>
    );
  }
  return <Navigate to={fallback} replace />;
}

export default RequireAdminPermission;