import { createBrowserRouter, Navigate } from 'react-router';
import { useEffect, useState } from 'react';
import { supabase } from '../integrations/supabase/client';
import { LoginPage } from './components/LoginPage';
import { ResetPasswordPage } from './components/ResetPasswordPage';
import { Layout } from './components/Layout';
import { RequireAuth } from './components/RequireAuth';
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

function RootEntry() {
  // When the OAuth callback redirects back with ?oauth_result=install_success,
  // force-sign-out any stale browser session first so we never drop the
  // visitor into a previously-signed-in tenant's dashboard. Then render the
  // LoginPage's "check your email" success screen.
  const hasOAuthResult =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('oauth_result') !== null;
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
  { path: '/reset-password', element: <ResetPasswordPage /> },
  {
    path: '/dashboard',
    element: <RequireAuth><Layout /></RequireAuth>,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'team', element: <TeamPage /> },
      { path: 'conversations', element: <ConversationsPage /> },
      { path: 'tickets', element: <TicketsPage /> },
      { path: 'settings/train-ai', element: <TrainAI /> },
      { path: 'settings/customize', element: <ChatCustomization /> },
      { path: 'settings/test-chat', element: <TestChat /> },
      { path: 'settings/account', element: <AccountSettings /> },
      { path: 'settings/store', element: <StoreInfo /> },
      { path: 'settings/plans', element: <PlansPage /> },
    ],
  },
  {
    path: '/admin',
    element: <RequireAuth requireSuperAdmin><AdminLayout /></RequireAuth>,
    children: [
      { index: true, element: <AdminDashboard /> },
      { path: 'reports/:platform', element: <AdminReports /> },
      { path: 'customers', element: <AdminCustomers /> },
      { path: 'customers/:id', element: <AdminCustomerDetails /> },
      { path: 'invoices/:type', element: <AdminInvoices /> },
      { path: 'team', element: <AdminTeam /> },
      { path: 'pipeline', element: <AdminPipelinePage /> },
      { path: 'pipeline/:id', element: <AdminPipelineDetailPage /> },
      { path: 'ad-automation', element: <AdAutomationPage /> },
      { path: 'ad-automation/:platformRowId', element: <AdAutomationDetailPage /> },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
]);