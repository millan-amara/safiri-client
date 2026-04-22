import { Outlet, NavLink, useLocation, Link } from 'react-router-dom';
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
  ChevronDown,
  X,
  MapPin,
  Zap,
  Image as ImageIcon,
  MoreHorizontal,
  User as UserIcon,
} from 'lucide-react';
import { useState, useEffect, useRef } from 'react';

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

const bottomNavPaths = ['/', '/crm', '/quotes', '/partners'];
const bottomNavItems = [
  { path: '/', icon: LayoutDashboard, label: 'Dashboard', end: true },
  { path: '/crm', icon: Users, label: 'CRM' },
  { path: '/quotes', icon: FileText, label: 'Quotes' },
  { path: '/partners', icon: Database, label: 'Partners' },
];

export default function AppLayout() {
  const { user, organization, logout } = useAuth();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  // Derive page title from current route
  const currentPageLabel = (() => {
    const match = navItems.find(item =>
      item.end ? location.pathname === item.path : location.pathname.startsWith(item.path)
    );
    return match?.label || '';
  })();

  return (
    <div className="min-h-screen flex bg-white">
      {/* Sidebar — desktop only */}
      <aside
        className={`
          hidden lg:flex sticky top-0 left-0 z-50 h-screen flex-col
          bg-sand-50 text-slate-brand border-r border-sand-200 transition-all duration-300 ease-in-out
          ${collapsed ? 'w-[72px]' : 'w-64'}
        `}
      >
        {/* Logo */}
        <div className={`flex items-center h-16 px-4 border-b border-sand-200 ${collapsed ? 'justify-center' : 'gap-3'}`}>
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
              className={({ isActive }) => `
                flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
                transition-all duration-150
                ${isActive
                  ? 'bg-amber-brand/10 text-amber-brand'
                  : 'text-sand-600 hover:text-slate-brand hover:bg-sand-100'
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
        <div className={`p-3 border-t border-sand-200 ${collapsed ? 'px-2' : ''}`}>
          <div className={`mb-2 ${collapsed ? 'flex justify-center' : ''}`}>
            <NotificationBell />
          </div>
          <div className={`flex items-center gap-3 ${collapsed ? 'justify-center' : ''}`}>
            <div className="w-8 h-8 rounded-full bg-amber-brand/80 flex items-center justify-center text-xs font-semibold text-white flex-shrink-0">
              {getInitials(user?.name)}
            </div>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-brand truncate">{user?.name}</p>
                <p className="text-xs text-sand-500 truncate">{user?.role}</p>
              </div>
            )}
            {!collapsed && (
              <button
                onClick={logout}
                className="p-1.5 rounded-md text-sand-500 hover:text-slate-brand hover:bg-sand-100 transition-colors"
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
          className="hidden lg:flex absolute -right-3 top-20 w-6 h-6 rounded-full bg-white border border-sand-200 shadow-sm items-center justify-center text-sand-500 hover:text-slate-brand transition-colors"
        >
          <ChevronRight className={`w-3.5 h-3.5 transition-transform ${collapsed ? '' : 'rotate-180'}`} />
        </button>
      </aside>

      {/* Main content */}
      <main className="flex-1 min-w-0">
        {/* Mobile top bar */}
        <MobileTopBar
          organization={organization}
          user={user}
          logout={logout}
          pageLabel={currentPageLabel}
        />

        <ReadOnlyBanner />
        <PaywallBanner />
        <EmailVerifyBanner user={user} />
        <div className="p-4 lg:p-8 max-w-[1440px] pb-24 lg:pb-8">
          <Outlet />
        </div>

        {/* Mobile bottom nav */}
        <MobileBottomNav
          onMoreClick={() => setMoreOpen(true)}
          currentPath={location.pathname}
        />
      </main>

      {/* More sheet */}
      {moreOpen && (
        <MoreSheet
          user={user}
          logout={logout}
          onClose={() => setMoreOpen(false)}
        />
      )}
    </div>
  );
}

function MobileTopBar({ organization, user, logout, pageLabel }) {
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef(null);

  useEffect(() => {
    const handleClick = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) setProfileOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div className="lg:hidden sticky top-0 z-30 flex items-center justify-between h-14 px-4 bg-white border-b border-sand-200">
      <div className="flex items-center gap-2.5 min-w-0">
        {organization?.branding?.logo ? (
          <img
            src={organization.branding.logo}
            alt={organization.name}
            className="w-8 h-8 rounded-lg object-cover flex-shrink-0"
          />
        ) : (
          <div className="w-8 h-8 rounded-md bg-amber-brand flex items-center justify-center flex-shrink-0">
            <Compass className="w-4 h-4 text-white" />
          </div>
        )}
        <span className="text-sm font-semibold text-slate-brand truncate">
          {pageLabel || organization?.name || 'Safari CRM'}
        </span>
      </div>

      <div className="flex items-center gap-1">
        <NotificationBell variant="topbar" />

        <div ref={profileRef} className="relative">
          <button
            onClick={() => setProfileOpen(!profileOpen)}
            className="flex items-center gap-1 p-1 rounded-md hover:bg-muted transition-colors"
          >
            <div className="w-8 h-8 rounded-full bg-amber-brand/80 flex items-center justify-center text-xs font-semibold text-white">
              {getInitials(user?.name)}
            </div>
            <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${profileOpen ? 'rotate-180' : ''}`} />
          </button>

          {profileOpen && (
            <div className="absolute right-0 top-full mt-2 w-56 bg-card rounded-xl shadow-xl border border-border overflow-hidden z-50 animate-scale-in">
              <div className="px-4 py-3 border-b border-border">
                <p className="text-sm font-medium text-foreground truncate">{user?.name}</p>
                <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                <p className="text-[10px] text-muted-foreground capitalize mt-0.5">{user?.role}</p>
              </div>
              <div className="py-1">
                <Link
                  to="/settings"
                  onClick={() => setProfileOpen(false)}
                  className="flex items-center gap-2.5 px-4 py-2 text-sm text-foreground hover:bg-muted transition-colors"
                >
                  <Settings className="w-4 h-4 text-muted-foreground" />
                  Settings
                </Link>
                <button
                  onClick={() => { setProfileOpen(false); logout(); }}
                  className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  Log out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MobileBottomNav({ onMoreClick, currentPath }) {
  const isMoreActive = !bottomNavPaths.some(p =>
    p === '/' ? currentPath === '/' : currentPath.startsWith(p)
  );

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-sand-200 flex items-stretch h-16 pb-safe">
      {bottomNavItems.map(({ path, icon: Icon, label, end }) => (
        <NavLink
          key={path}
          to={path}
          end={end}
          className={({ isActive }) => `
            flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors
            ${isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}
          `}
        >
          <Icon className="w-5 h-5" strokeWidth={2} />
          <span className="text-[10px] font-medium">{label}</span>
        </NavLink>
      ))}
      <button
        onClick={onMoreClick}
        className={`flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors ${
          isMoreActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        <MoreHorizontal className="w-5 h-5" strokeWidth={2} />
        <span className="text-[10px] font-medium">More</span>
      </button>
    </nav>
  );
}

function MoreSheet({ user, logout, onClose }) {
  const moreItems = [
    { path: '/destinations', icon: MapPin, label: 'Destinations' },
    { path: '/automations', icon: Zap, label: 'Automations' },
    ...(user?.isSuperAdmin ? [{ path: '/admin/library', icon: ImageIcon, label: 'Image Library' }] : []),
    { path: '/settings', icon: Settings, label: 'Settings' },
  ];

  return (
    <div className="lg:hidden fixed inset-0 z-50 flex items-end animate-fade-in">
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />
      <div className="relative w-full bg-white rounded-t-2xl shadow-2xl pb-safe animate-sheet-up">
        <div className="flex items-center justify-between px-5 py-4 border-b border-sand-200">
          <h3 className="text-base font-semibold text-slate-brand">More</h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-muted-foreground hover:bg-muted"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="py-2">
          {moreItems.map(({ path, icon: Icon, label }) => (
            <NavLink
              key={path}
              to={path}
              onClick={onClose}
              className={({ isActive }) => `
                flex items-center gap-3 px-5 py-3.5 text-sm transition-colors
                ${isActive ? 'bg-primary/10 text-primary font-semibold' : 'text-foreground hover:bg-muted'}
              `}
            >
              <Icon className="w-5 h-5 flex-shrink-0" strokeWidth={1.8} />
              {label}
            </NavLink>
          ))}
        </div>
        <div className="border-t border-sand-200 py-2">
          <button
            onClick={() => { onClose(); logout(); }}
            className="w-full flex items-center gap-3 px-5 py-3.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
          >
            <LogOut className="w-5 h-5" />
            Log out
          </button>
        </div>
      </div>
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
