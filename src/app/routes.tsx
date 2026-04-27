import { createBrowserRouter, Navigate } from 'react-router';
import { LoginPage } from './components/LoginPage';
import { ResetPasswordPage } from './components/ResetPasswordPage';
import { Layout } from './components/Layout';
import { DashboardPage } from './components/DashboardPage';
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

export const router = createBrowserRouter([
  { path: '/', element: <Navigate to="/dashboard" replace /> },
  { path: '/login', element: <LoginPage /> },
  { path: '/admin/login', element: <Navigate to="/login" replace /> },
  { path: '/reset-password', element: <ResetPasswordPage /> },
  {
    path: '/dashboard',
    element: <Layout />,
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
    element: <AdminLayout />,
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
  { path: '*', element: <Navigate to="/dashboard" replace /> },
]);