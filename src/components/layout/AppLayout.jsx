import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getInitials } from '../../utils/helpers';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import NotificationBell from './NotificationBell';
import PaywallBanner from '../../pages/billing/PaywallBanner';
import ReadOnlyBanner from '../../pages/billing/ReadOnlyBanner';
import {
  LayoutDashboard,
  Database,
  Users,
  FileText,
  Settings,
  LogOut,
  Compass,
  ChevronRight,
  Menu,
  X,
  MapPin,
  Zap,
  Image as ImageIcon,
} from 'lucide-react';
import { useState } from 'react';

const navItems = [
  { path: '/', icon: LayoutDashboard, label: 'Dashboard', end: true },
  { path: '/partners', icon: Database, label: 'Partners' },
  { path: '/destinations', icon: MapPin, label: 'Destinations' },
  { path: '/crm', icon: Users, label: 'CRM' },
  { path: '/quotes', icon: FileText, label: 'Quotes' },
  { path: '/automations', icon: Zap, label: 'Automations' },
  { path: '/admin/library', icon: ImageIcon, label: 'Image Library', superAdminOnly: true },
  { path: '/settings', icon: Settings, label: 'Settings' },
];

export default function AppLayout() {
  const { user, organization, logout } = useAuth();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen flex bg-sand-50">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed lg:sticky top-0 left-0 z-50 h-screen flex flex-col
          bg-slate-brand text-white transition-all duration-300 ease-in-out
          ${collapsed ? 'w-[72px]' : 'w-64'}
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        {/* Logo */}
        <div className={`flex items-center h-16 px-4 border-b border-white/10 ${collapsed ? 'justify-center' : 'gap-3'}`}>
          {organization?.branding?.logo ? (
            <img
              src={organization.branding.logo}
              alt={organization.name}
              className="w-9 h-9 rounded-lg object-cover flex-shrink-0"
            />
          ) : (
            <div className="w-9 h-9 rounded-lg bg-amber-brand flex items-center justify-center flex-shrink-0">
              <Compass className="w-5 h-5 text-white" />
            </div>
          )}
          {!collapsed && (
            <div className="overflow-hidden">
              <h1 className="text-base font-semibold tracking-tight truncate">
                {organization?.name || 'Safari CRM'}
              </h1>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 px-3 space-y-1">
          {navItems.filter(item => !item.superAdminOnly || user?.isSuperAdmin).map(({ path, icon: Icon, label, end }) => (
            <NavLink
              key={path}
              to={path}
              end={end}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) => `
                flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
                transition-all duration-150
                ${isActive
                  ? 'bg-white/15 text-white'
                  : 'text-white/60 hover:text-white hover:bg-white/8'
                }
                ${collapsed ? 'justify-center' : ''}
              `}
            >
              <Icon className="w-[18px] h-[18px] flex-shrink-0" />
              {!collapsed && <span>{label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* User section */}
        <div className={`p-3 border-t border-white/10 ${collapsed ? 'px-2' : ''}`}>
          {/* Notification bell */}
          <div className={`mb-2 ${collapsed ? 'flex justify-center' : ''}`}>
            <NotificationBell />
          </div>
          <div className={`flex items-center gap-3 ${collapsed ? 'justify-center' : ''}`}>
            <div className="w-8 h-8 rounded-full bg-amber-brand/80 flex items-center justify-center text-xs font-semibold flex-shrink-0">
              {getInitials(user?.name)}
            </div>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{user?.name}</p>
                <p className="text-xs text-white/40 truncate">{user?.role}</p>
              </div>
            )}
            {!collapsed && (
              <button
                onClick={logout}
                className="p-1.5 rounded-md text-white/40 hover:text-white hover:bg-white/10 transition-colors"
                title="Log out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="hidden lg:flex absolute -right-3 top-20 w-6 h-6 rounded-full bg-slate-brand border-2 border-sand-100 items-center justify-center text-white/60 hover:text-white transition-colors"
        >
          <ChevronRight className={`w-3.5 h-3.5 transition-transform ${collapsed ? '' : 'rotate-180'}`} />
        </button>
      </aside>

      {/* Main content */}
      <main className="flex-1 min-w-0">
        {/* Mobile header */}
        <div className="lg:hidden flex items-center h-14 px-4 bg-white border-b border-sand-200">
          <button onClick={() => setMobileOpen(true)} className="p-2 -ml-2 text-slate-brand">
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2 ml-2">
            <div className="w-7 h-7 rounded-md bg-amber-brand flex items-center justify-center">
              <Compass className="w-4 h-4 text-white" />
            </div>
            <span className="text-sm font-semibold text-slate-brand">{organization?.name || 'Safari CRM'}</span>
          </div>
        </div>

        <ReadOnlyBanner />
        <PaywallBanner />
        <EmailVerifyBanner user={user} />
        <div className="p-4 lg:p-8 max-w-[1440px]">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

function EmailVerifyBanner({ user }) {
  const [dismissed, setDismissed] = useState(false);
  const [sending, setSending] = useState(false);

  if (dismissed || user?.emailVerified) return null;

  const handleResend = async () => {
    setSending(true);
    try {
      await api.post('/auth/resend-verification');
      toast.success('Verification email sent — check your inbox');
    } catch (err) {
      toast.error('Failed to send');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="bg-amber-50 border-b border-amber-200 px-4 py-2.5 flex items-center justify-between">
      <p className="text-xs text-amber-800">
        Please verify your email to receive notifications.{' '}
        <button onClick={handleResend} disabled={sending} className="font-semibold underline hover:no-underline disabled:opacity-50">
          {sending ? 'Sending...' : 'Resend verification email'}
        </button>
      </p>
      <button onClick={() => setDismissed(true)} className="text-amber-600 hover:text-amber-800 ml-4">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}