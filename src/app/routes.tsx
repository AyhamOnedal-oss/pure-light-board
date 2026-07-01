import { createBrowserRouter, Navigate } from 'react-router';
import { useEffect, useState } from 'react';
import { supabase } from '../integrations/supabase/client';
import { LoginPage } from './components/LoginPage';
import { ResetPasswordPage } from './components/ResetPasswordPage';
import { Layout } from './components/Layout';
import { RequireAuth } from './components/RequireAuth';
import { RequirePermission } from './components/RequirePermission';
import { DashboardPage } from './components/DashboardPage';
import { NotFoundPage } from './components/NotFoundPage';
import { TeamPage } from './components/TeamPage';
import { ConversationsPage } from './components/ConversationsPage';
import { TicketsPage } from './components/TicketsPage';
import { TrainAI } from './components/settings/TrainAI';
import { ChatCustomization } from './components/settings/ChatCustomization';
import { TestChat } from './components/settings/TestChat';
import { AccountSettings } from './components/settings/AccountSettings';
import { StoreInfo } from './components/settings/StoreInfo';
import { PlansPage } from './components/settings/PlansPage';
import { AdminLayout } from './components/admin/AdminLayout';
import { AdminLoginPage } from './components/admin/AdminLoginPage';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { AdminReports } from './components/admin/AdminReports';
import { AdminCustomers } from './components/admin/AdminCustomers';
import { AdminCustomerDetails } from './components/admin/AdminCustomerDetails';
import { AdminInvoices } from './components/admin/AdminInvoices';
import { AdminTeam } from './components/admin/AdminTeam';
import { AdAutomationPage } from './components/admin/AdAutomationPage';
import { AdAutomationDetailPage } from './components/admin/AdAutomationDetailPage';
import { AdminPipelinePage } from './components/admin/AdminPipelinePage';
import { AdminPipelineDetailPage } from './components/admin/AdminPipelineDetailPage';
import { AdminLandingLeadDetailPage } from './components/admin/AdminLandingLeadDetailPage';
import { RequireAdminPermission } from './components/admin/RequireAdminPermission';
import { AdminImpersonateRedirect } from './components/admin/AdminImpersonateRedirect';
import { WidgetChatPage } from './components/WidgetChatPage';

function RootEntry() {
  // When the OAuth callback redirects back with ?oauth_result=install_success,
  // force-sign-out any stale browser session first so we never drop the
  // visitor into a previously-signed-in tenant's dashboard. Then render the
  // LoginPage's "check your email" success screen.
  const hasOAuthResult =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('oauth_result') !== null;

  // Supabase password-recovery links can land on `/` instead of
  // `/reset-password` (depends on the redirectTo allowlist + how the link
  // is opened). If we detect recovery tokens in the URL, route to the
  // reset page and preserve the hash/query so Supabase can establish the
  // recovery session there.
  if (typeof window !== 'undefined') {
    const hash = window.location.hash || '';
    const search = window.location.search || '';
    const isRecovery =
      /(?:^|[#&?])type=recovery(?:&|$)/.test(hash) ||
      /(?:^|[?&])type=recovery(?:&|$)/.test(search) ||
      /(?:^|[#&?])access_token=/.test(hash) && /type=recovery/.test(hash);
    if (isRecovery) {
      return <Navigate to={`/reset-password${search}${hash}`} replace />;
    }
  }

  const [signedOut, setSignedOut] = useState(!hasOAuthResult);

  useEffect(() => {
    if (!hasOAuthResult) return;
    let cancelled = false;
    (async () => {
      try { await supabase.auth.signOut(); } catch { /* ignore */ }
      if (!cancelled) setSignedOut(true);
    })();
    return () => { cancelled = true; };
  }, [hasOAuthResult]);

  if (hasOAuthResult) {
    if (!signedOut) return null; // brief blank while we clear stale session
    return <LoginPage />;
  }
  return <Navigate to="/dashboard" replace />;
}

export const router = createBrowserRouter([
  { path: '/', element: <RootEntry /> },
  { path: '/login', element: <LoginPage /> },
  { path: '/check-email', element: <LoginPage /> },
  { path: '/admin/login', element: <AdminLoginPage /> },
  {
    path: '/reset-password',
    element: <ResetPasswordPage />,
    // Never let an upstream render error blank the reset page — render
    // the form itself so the user can still set a new password.
    errorElement: <ResetPasswordPage />,
  },
  // Storefront chat iframe target — public, no auth, no dashboard chrome.
  // Used by supabase/functions/widget-loader as the iframe.src.
  { path: '/widget/chat', element: <WidgetChatPage /> },
  // Public route consumed in a new tab to sign in as a merchant via a
  // short-lived magic-link token_hash issued by the admin-impersonate
  // edge function. The route itself does not require auth.
  { path: '/impersonate', element: <AdminImpersonateRedirect /> },
  {
    path: '/dashboard',
    element: <RequireAuth><Layout /></RequireAuth>,
    children: [
      { index: true, element: <RequirePermission><DashboardPage /></RequirePermission> },
      { path: 'team', element: <RequirePermission><TeamPage /></RequirePermission> },
      { path: 'conversations', element: <RequirePermission><ConversationsPage /></RequirePermission> },
      { path: 'tickets', element: <RequirePermission><TicketsPage /></RequirePermission> },
      { path: 'settings/train-ai', element: <RequirePermission><TrainAI /></RequirePermission> },
      { path: 'settings/customize', element: <RequirePermission><ChatCustomization /></RequirePermission> },
      { path: 'settings/test-chat', element: <RequirePermission><TestChat /></RequirePermission> },
      { path: 'settings/account', element: <RequirePermission><AccountSettings /></RequirePermission> },
      { path: 'settings/store', element: <RequirePermission><StoreInfo /></RequirePermission> },
      { path: 'settings/plans', element: <RequirePermission><PlansPage /></RequirePermission> },
    ],
  },
  {
    path: '/admin',
    element: <RequireAuth requireSuperAdmin><AdminLayout /></RequireAuth>,
    children: [
      { index: true, element: <RequireAdminPermission perm="admin_dashboard"><AdminDashboard /></RequireAdminPermission> },
      { path: 'reports/:platform', element: <RequireAdminPermission perm={['reports_all','reports_zid','reports_salla']}><AdminReports /></RequireAdminPermission> },
      { path: 'customers', element: <RequireAdminPermission perm="customers"><AdminCustomers /></RequireAdminPermission> },
      { path: 'customers/:id', element: <RequireAdminPermission perm="customers"><AdminCustomerDetails /></RequireAdminPermission> },
      { path: 'invoices/:type', element: <RequireAdminPermission perm={['billing_subscriptions','billing_servers','billing_other']}><AdminInvoices /></RequireAdminPermission> },
      { path: 'team', element: <RequireAdminPermission perm="team_management"><AdminTeam /></RequireAdminPermission> },
      { path: 'pipeline', element: <RequireAdminPermission perm="pipeline"><AdminPipelinePage /></RequireAdminPermission> },
      { path: 'pipeline/landing', element: <RequireAdminPermission perm={['landing','pipeline']}><AdminPipelinePage /></RequireAdminPermission> },
      { path: 'pipeline/landing/:id', element: <RequireAdminPermission perm={['landing','pipeline']}><AdminLandingLeadDetailPage /></RequireAdminPermission> },
      { path: 'pipeline/:id', element: <RequireAdminPermission perm="pipeline"><AdminPipelineDetailPage /></RequireAdminPermission> },
      { path: 'ad-automation', element: <RequireAdminPermission perm="ad_automation"><AdAutomationPage /></RequireAdminPermission> },
      { path: 'ad-automation/:platformRowId', element: <RequireAdminPermission perm="ad_automation"><AdAutomationDetailPage /></RequireAdminPermission> },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
]);