import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import AppLayout from './components/layout/AppLayout';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import PartnersPage from './pages/PartnersPage';
import CRMPage from './pages/CRMPage';
import DealDetailPage from './pages/DealDetailPage';
import QuotesPage from './pages/QuotesPage';
import QuoteBuilderPage from './pages/QuoteBuilderPage';
import SettingsPage from './pages/SettingsPage';
import QuoteSharePage from './pages/QuoteSharePage';
import ContactDetailPage from './pages/ContactDetailPage';
import DestinationsPage from './pages/DestinationsPage';
import AutomationsPage from './pages/AutomationsPage';
import AcceptInvitePage from './pages/AcceptInvitePage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import VerifyEmailPage from './pages/VerifyEmailPage';
import BillingPage from './pages/billing/BillingPage';
import LibraryAdminPage from './pages/LibraryAdminPage';
import AdminDashboardPage from './pages/AdminDashboardPage';
import InvoicesPage from './pages/InvoicesPage';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <span className="text-sm text-muted-foreground">Loading...</span>
      </div>
    </div>
  );
  return user ? children : <Navigate to="/login" />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/accept-invite" element={<AcceptInvitePage />} />
      <Route path="/verify-email" element={<VerifyEmailPage />} />
      <Route path="/quote/:token" element={<QuoteSharePage />} />
      
      <Route path="/" element={
        <ProtectedRoute>
          <AppLayout />
        </ProtectedRoute>
      }>
        <Route index element={<DashboardPage />} />
        <Route path="partners" element={<PartnersPage />} />
        <Route path="destinations" element={<DestinationsPage />} />
        <Route path="crm" element={<CRMPage />} />
        <Route path="crm/contacts/:id" element={<ContactDetailPage />} />
        <Route path="crm/deals/:id" element={<DealDetailPage />} />
        <Route path="quotes" element={<QuotesPage />} />
        <Route path="quotes/new" element={<QuoteBuilderPage />} />
        <Route path="quotes/:id" element={<QuoteBuilderPage />} />
        <Route path="invoices" element={<InvoicesPage />} />
        <Route path="automations" element={<AutomationsPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="settings/billing" element={<BillingPage />} />
        <Route path="admin" element={<AdminDashboardPage />} />
        <Route path="admin/library" element={<LibraryAdminPage />} />
      </Route>
    </Routes>
  );
}
