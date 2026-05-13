import { useState, useEffect, useMemo, useRef } from 'react';
import { Navigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, BarChart, Bar,
} from 'recharts';
import {
  Building2, Users, FileText, Sparkles, ShieldCheck, RefreshCw,
  TrendingUp, Activity, Search, X, CalendarPlus, Coins, Ban,
  AlertTriangle, Mail, MailCheck, UserX, UserCheck, Key, ArrowRightLeft,
  Webhook, Wallet, CheckCircle2, XCircle, LogIn, Crown, Eye, MessageCircle, Phone,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import { formatDate } from '../utils/helpers';

// Plan-tier colors — kept in sync with the Tailwind palette used elsewhere.
const PLAN_COLORS = {
  trial: '#94a3b8',
  starter: '#3b82f6',
  pro: '#8b5cf6',
  business: '#f59e0b',
  enterprise: '#10b981',
};

const STATUS_COLORS = {
  trialing: '#3b82f6',
  active: '#10b981',
  past_due: '#f59e0b',
  expired: '#ef4444',
  cancelled: '#6b7280',
};

const fmtMoney = (n) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(n || 0);

const fmtNum = (n) =>
  new Intl.NumberFormat('en-US').format(n || 0);

const fmtPct = (n) => `${((n || 0) * 100).toFixed(1)}%`;

// Strip everything that isn't a digit or leading + for click-to-WhatsApp /
// tel: URLs. wa.me requires no leading + (just digits); tel: tolerates both
// but stripping spaces/dashes keeps it consistent. Returns null when there
// aren't enough digits to be a real number.
const phoneDigits = (raw) => {
  if (!raw) return null;
  const digits = String(raw).replace(/[^0-9]/g, '');
  return digits.length >= 6 ? digits : null;
};

const shortDate = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

// Relative-time string used by the "last active" column and the member list.
// Designed to read at a glance: "2h", "3d", "5w". Beyond 60 days falls back
// to the date so it doesn't look like a healthy "30+ days" when an org has
// actually been dormant for years.
const relTime = (iso) => {
  if (!iso) return 'never';
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 0) return 'just now';
  const minutes = ms / 60000;
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${Math.floor(minutes)}m`;
  const hours = minutes / 60;
  if (hours < 24) return `${Math.floor(hours)}h`;
  const days = hours / 24;
  if (days < 14) return `${Math.floor(days)}d`;
  if (days < 60) return `${Math.floor(days / 7)}w`;
  return formatDate(iso);
};

export default function AdminDashboardPage() {
  const { user } = useAuth();

  // Hard-block non-superadmins at the route level. The server enforces this
  // too — but redirecting here avoids flashing a broken page on unauthorized
  // navigation.
  if (!user?.isSuperAdmin) return <Navigate to="/" replace />;

  const [stats, setStats] = useState(null);
  const [aiUsage, setAiUsage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedOrgId, setSelectedOrgId] = useState(null);
  // Bumped after a successful write action so OrgsTable + KPIs reload.
  const [version, setVersion] = useState(0);

  const loadAll = async () => {
    setRefreshing(true);
    try {
      const [s, a] = await Promise.all([
        api.get('/admin/stats'),
        api.get('/admin/ai-usage?days=30'),
      ]);
      setStats(s.data);
      setAiUsage(a.data);
    } catch (err) {
      // Errors surface via the global 401/402 toast interceptor; for 500s the
      // page just stays empty and the user can hit Refresh.
      console.error('Admin load failed:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { loadAll(); }, [version]);

  const handleChanged = () => setVersion((v) => v + 1);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-8 h-8 border-2 border-border border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-[1440px] mx-auto pb-12 animate-fade-in">
      <Header onRefresh={loadAll} refreshing={refreshing} generatedAt={stats?.generatedAt} />
      <KpiStrip stats={stats} />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <AiCostChart usage={aiUsage} />
        </div>
        <div className="space-y-4">
          <PlanMixCard stats={stats} />
          <StatusMixCard stats={stats} />
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <EndpointBreakdown usage={aiUsage} />
        </div>
        <TopOrgsByAi usage={aiUsage} />
      </div>
      <UserSearchPanel onOpenOrg={setSelectedOrgId} />
      <OrgsTable onSelect={setSelectedOrgId} version={version} />
      {selectedOrgId && (
        <OrgDetailModal
          orgId={selectedOrgId}
          onClose={() => setSelectedOrgId(null)}
          onChanged={handleChanged}
        />
      )}
    </div>
  );
}

// ─── Header ─────────────────────────────────────────────────────────────────

function Header({ onRefresh, refreshing, generatedAt }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-primary" />
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-foreground">
            Operator dashboard
          </h1>
        </div>
        <p className="text-xs sm:text-sm text-muted-foreground mt-1">
          Cross-tenant view · superadmin only
          {generatedAt && (
            <span className="ml-2 text-muted-foreground/70">
              · as of {new Date(generatedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
            </span>
          )}
        </p>
      </div>
      <button
        onClick={onRefresh}
        disabled={refreshing}
        className="inline-flex items-center gap-2 text-sm px-3 py-2 rounded-lg border border-border bg-card hover:bg-muted transition-colors disabled:opacity-50"
      >
        <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
        Refresh
      </button>
    </div>
  );
}

// ─── KPI strip ──────────────────────────────────────────────────────────────

function KpiStrip({ stats }) {
  const cards = [
    {
      label: 'Organizations',
      value: fmtNum(stats?.orgs?.total),
      sub: `+${fmtNum(stats?.orgs?.signups30d)} in 30d`,
      icon: Building2,
      iconBg: 'bg-blue-50',
      iconColor: 'text-blue-600',
    },
    {
      label: 'Users',
      value: fmtNum(stats?.users?.total),
      sub: `${fmtNum(stats?.users?.activeRecent)} active in 30d`,
      icon: Users,
      iconBg: 'bg-violet-50',
      iconColor: 'text-violet-600',
    },
    {
      label: 'Quotes',
      value: fmtNum(stats?.quotes?.total),
      sub: `+${fmtNum(stats?.quotes?.last30d)} in 30d`,
      icon: FileText,
      iconBg: 'bg-amber-50',
      iconColor: 'text-amber-600',
    },
    {
      label: 'AI cost (30d)',
      value: fmtMoney(stats?.ai30d?.totalCostUsd),
      sub: `${fmtNum(stats?.ai30d?.calls)} calls`,
      icon: Sparkles,
      iconBg: 'bg-emerald-50',
      iconColor: 'text-emerald-600',
    },
    {
      label: 'Cache hit',
      value: fmtPct(stats?.ai30d?.cacheHitRatio),
      sub: `${fmtNum(stats?.ai30d?.cacheReadTokens)} cached tokens`,
      icon: TrendingUp,
      iconBg: 'bg-rose-50',
      iconColor: 'text-rose-600',
    },
  ];
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
      {cards.map(({ label, value, sub, icon: Icon, iconBg, iconColor }) => (
        <div key={label} className="bg-card border border-border rounded-xl p-4 sm:p-5">
          <div className="flex items-start justify-between mb-3">
            <div className={`w-9 h-9 rounded-lg ${iconBg} flex items-center justify-center`}>
              <Icon className={`w-4 h-4 ${iconColor}`} />
            </div>
          </div>
          <div className="text-2xl font-semibold text-foreground">{value}</div>
          <div className="text-xs text-muted-foreground mt-1">{label}</div>
          <div className="text-[11px] text-muted-foreground/70 mt-0.5">{sub}</div>
        </div>
      ))}
    </div>
  );
}

// ─── AI cost daily area chart ───────────────────────────────────────────────

function AiCostChart({ usage }) {
  const data = usage?.series || [];
  return (
    <div className="bg-card border border-border rounded-xl p-4 sm:p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
            <Activity className="w-4 h-4 text-muted-foreground" />
            AI cost · last {usage?.windowDays || 30} days
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Daily Claude API spend in USD (estimated from token usage).
          </p>
        </div>
      </div>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="costGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity={0.4} />
                <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="date"
              tickFormatter={shortDate}
              tick={{ fontSize: 11, fill: '#6b7280' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tickFormatter={(v) => `$${v.toFixed(2)}`}
              tick={{ fontSize: 11, fill: '#6b7280' }}
              axisLine={false}
              tickLine={false}
              width={55}
            />
            <Tooltip
              contentStyle={{ borderRadius: 8, fontSize: 12, border: '1px solid #e5e7eb' }}
              labelFormatter={(d) => formatDate(d)}
              formatter={(value, name) => {
                if (name === 'cost') return [fmtMoney(value), 'Cost'];
                return [fmtNum(value), name];
              }}
            />
            <Area type="monotone" dataKey="cost" stroke="#10b981" strokeWidth={2} fill="url(#costGrad)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ─── Plan mix donut ─────────────────────────────────────────────────────────

function PlanMixCard({ stats }) {
  const data = useMemo(() => {
    const byPlan = stats?.orgs?.byPlan || {};
    return Object.entries(byPlan)
      .map(([plan, count]) => ({ name: plan, value: count, color: PLAN_COLORS[plan] || '#94a3b8' }))
      .filter((d) => d.value > 0);
  }, [stats]);

  return (
    <MixCard title="Plans" data={data} />
  );
}

function StatusMixCard({ stats }) {
  const data = useMemo(() => {
    const byStatus = stats?.orgs?.byStatus || {};
    return Object.entries(byStatus)
      .map(([s, count]) => ({ name: s, value: count, color: STATUS_COLORS[s] || '#94a3b8' }))
      .filter((d) => d.value > 0);
  }, [stats]);

  return (
    <MixCard title="Subscription status" data={data} />
  );
}

function MixCard({ title, data }) {
  if (!data.length) {
    return (
      <div className="bg-card border border-border rounded-xl p-4 sm:p-5">
        <h3 className="text-sm font-medium text-foreground mb-2">{title}</h3>
        <p className="text-xs text-muted-foreground">No data</p>
      </div>
    );
  }
  return (
    <div className="bg-card border border-border rounded-xl p-4 sm:p-5">
      <h3 className="text-sm font-medium text-foreground mb-2">{title}</h3>
      <div className="h-44">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={36}
              outerRadius={62}
              paddingAngle={2}
            >
              {data.map((entry, i) => (
                <Cell key={i} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{ borderRadius: 8, fontSize: 12, border: '1px solid #e5e7eb' }}
              formatter={(value, name) => [fmtNum(value), name]}
            />
            <Legend
              iconSize={8}
              wrapperStyle={{ fontSize: 11 }}
              formatter={(v) => v.replace('_', ' ')}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ─── AI endpoint breakdown ──────────────────────────────────────────────────

function EndpointBreakdown({ usage }) {
  const rows = usage?.byEndpoint || [];
  const max = rows[0]?.cost || 1;
  return (
    <div className="bg-card border border-border rounded-xl p-4 sm:p-5">
      <h3 className="text-sm font-medium text-foreground mb-1">AI cost by endpoint</h3>
      <p className="text-xs text-muted-foreground mb-3">
        Where your Claude budget actually goes. Last {usage?.windowDays || 30} days.
      </p>
      <div className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="text-[11px] uppercase tracking-wide text-muted-foreground border-b border-border">
            <tr>
              <th className="text-left py-2 font-medium">Endpoint</th>
              <th className="text-right py-2 font-medium">Calls</th>
              <th className="text-right py-2 font-medium">Success</th>
              <th className="text-right py-2 font-medium">Avg</th>
              <th className="text-right py-2 font-medium pr-2">Total</th>
              <th className="w-[120px]"></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={6} className="text-center py-6 text-muted-foreground text-xs">No AI calls in this window.</td></tr>
            )}
            {rows.map((r) => (
              <tr key={r.endpoint} className="border-b border-border/50 last:border-0">
                <td className="py-2 font-mono text-xs text-foreground">{r.endpoint}</td>
                <td className="text-right py-2 tabular-nums text-foreground">{fmtNum(r.calls)}</td>
                <td className="text-right py-2 tabular-nums text-muted-foreground">{fmtPct(r.successRate)}</td>
                <td className="text-right py-2 tabular-nums text-muted-foreground">{fmtMoney(r.avgCost)}</td>
                <td className="text-right py-2 tabular-nums font-medium text-foreground pr-2">{fmtMoney(r.cost)}</td>
                <td className="py-2">
                  <div className="w-full bg-muted h-1.5 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500"
                      style={{ width: `${(r.cost / max) * 100}%` }}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Top orgs by AI spend ───────────────────────────────────────────────────

function TopOrgsByAi({ usage }) {
  const rows = usage?.topOrgs || [];
  return (
    <div className="bg-card border border-border rounded-xl p-4 sm:p-5">
      <h3 className="text-sm font-medium text-foreground mb-1">Top orgs by AI spend</h3>
      <p className="text-xs text-muted-foreground mb-3">Last {usage?.windowDays || 30} days.</p>
      <div className="space-y-2">
        {rows.length === 0 && (
          <p className="text-xs text-muted-foreground py-2">No data.</p>
        )}
        {rows.map((r) => (
          <div key={r.organizationId} className="flex items-center justify-between gap-3 py-1.5 border-b border-border/50 last:border-0">
            <div className="min-w-0 flex-1">
              <div className="text-sm text-foreground truncate">{r.name}</div>
              <div className="text-[11px] text-muted-foreground">
                {r.plan || '—'} · {(r.subscriptionStatus || '').replace('_', ' ')}
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="text-sm font-medium tabular-nums text-foreground">{fmtMoney(r.cost)}</div>
              <div className="text-[11px] text-muted-foreground tabular-nums">{fmtNum(r.calls)} calls</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Orgs table ─────────────────────────────────────────────────────────────

const PLAN_OPTIONS = ['', 'trial', 'starter', 'pro', 'business', 'enterprise'];
const STATUS_OPTIONS = ['', 'trialing', 'active', 'past_due', 'expired', 'cancelled'];

function OrgsTable({ onSelect, version }) {
  const [data, setData] = useState({ items: [], total: 0, page: 1, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [plan, setPlan] = useState('');
  const [status, setStatus] = useState('');

  // Snapshot "now" per fetch so the dormant-row classifier doesn't call
  // Date.now() per row. The 30-day threshold is coarse enough that a single
  // timestamp per fetch is plenty — purity rule still fires for Date.now()
  // even inside useMemo, but the value is stable across renders here.
  // eslint-disable-next-line react-hooks/purity, react-hooks/exhaustive-deps
  const dormantThreshold = useMemo(() => new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), [data]);

  // Debounce the search input — typing shouldn't fire a request per keystroke.
  const [qDebounced, setQDebounced] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setQDebounced(q), 300);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: '25' });
    if (qDebounced) params.set('q', qDebounced);
    if (plan) params.set('plan', plan);
    if (status) params.set('status', status);
    api.get(`/admin/orgs?${params.toString()}`)
      .then(({ data }) => setData(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [page, qDebounced, plan, status, version]);

  // Reset to page 1 whenever the filter changes — otherwise a filter on
  // page 5 silently shows empty results.
  useEffect(() => { setPage(1); }, [qDebounced, plan, status]);

  return (
    <div className="bg-card border border-border rounded-xl p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h3 className="text-sm font-medium text-foreground">Organizations</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {fmtNum(data.total)} total · page {data.page} of {data.pages}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search name, email, phone…"
              title="Phone search ignores formatting and the leading 0 / +254, so 0734…, +254 734…, and 734… all find the same number."
              className="pl-8 pr-3 py-1.5 text-sm rounded-lg border border-border bg-background w-56"
            />
          </div>
          <select
            value={plan}
            onChange={(e) => setPlan(e.target.value)}
            className="text-sm rounded-lg border border-border bg-background px-2 py-1.5"
          >
            {PLAN_OPTIONS.map((p) => (
              <option key={p || 'all'} value={p}>{p || 'All plans'}</option>
            ))}
          </select>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="text-sm rounded-lg border border-border bg-background px-2 py-1.5"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s || 'all'} value={s}>{s ? s.replace('_', ' ') : 'All statuses'}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-[11px] uppercase tracking-wide text-muted-foreground border-b border-border">
            <tr>
              <th className="text-left py-2 font-medium">Org</th>
              <th className="text-left py-2 font-medium">Plan</th>
              <th className="text-left py-2 font-medium">Status</th>
              <th className="text-left py-2 font-medium">Trial / period ends</th>
              <th className="text-right py-2 font-medium">AI credits</th>
              <th className="text-right py-2 font-medium">Members</th>
              <th className="text-right py-2 font-medium">Last active</th>
              <th className="text-right py-2 font-medium">Joined</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={8} className="text-center py-6 text-muted-foreground text-xs">Loading…</td></tr>
            )}
            {!loading && data.items.length === 0 && (
              <tr><td colSpan={8} className="text-center py-6 text-muted-foreground text-xs">No organizations match.</td></tr>
            )}
            {!loading && data.items.map((o) => {
              const ends = o.subscriptionStatus === 'trialing' ? o.trialEndsAt : o.currentPeriodEnd;
              const used = o.aiCreditsUsed || 0;
              const limit = o.aiCreditsLimit || 0;
              const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
              // "Dormant" classes: visually fade rows the operator should investigate.
              const dormant = !o.lastActiveAt || new Date(o.lastActiveAt) < dormantThreshold;
              return (
                <tr
                  key={o._id}
                  onClick={() => onSelect?.(o._id)}
                  className="border-b border-border/50 last:border-0 hover:bg-muted/40 cursor-pointer"
                >
                  <td className="py-2.5 pr-3">
                    <div className="font-medium text-foreground flex items-center gap-1.5">
                      {o.name}
                      {o.whiteLabel && (
                        <span title="White-label enabled">
                          <Crown className="w-3 h-3 text-amber-500" />
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {o.owner?.email || '(no owner)'}
                    </div>
                    {/* Surface the phone *digits* on the home row so you can
                        WhatsApp/call without first clicking into the org. The
                        owner's personal phone wins; the org's businessInfo
                        phone (set in Settings) is the fallback. */}
                    {(o.owner?.phone || o.businessInfo?.phone) && (
                      <div className="text-[11px] text-muted-foreground/90 flex items-center gap-1.5 mt-0.5">
                        <span className="tabular-nums">{o.owner?.phone || o.businessInfo?.phone}</span>
                        <PhoneActions phone={o.owner?.phone || o.businessInfo?.phone} compact />
                      </div>
                    )}
                  </td>
                  <td className="py-2.5 pr-3">
                    <span
                      className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full"
                      style={{
                        backgroundColor: `${PLAN_COLORS[o.plan] || '#94a3b8'}1a`,
                        color: PLAN_COLORS[o.plan] || '#94a3b8',
                      }}
                    >
                      {o.plan}{o.annual ? ' · annual' : ''}
                    </span>
                  </td>
                  <td className="py-2.5 pr-3">
                    <span
                      className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full"
                      style={{
                        backgroundColor: `${STATUS_COLORS[o.subscriptionStatus] || '#94a3b8'}1a`,
                        color: STATUS_COLORS[o.subscriptionStatus] || '#94a3b8',
                      }}
                    >
                      {(o.subscriptionStatus || '').replace('_', ' ')}
                    </span>
                  </td>
                  <td className="py-2.5 pr-3 text-muted-foreground text-xs">
                    {ends ? formatDate(ends) : '—'}
                  </td>
                  <td className="py-2.5 pr-3 text-right">
                    <div className="tabular-nums text-xs text-foreground">{fmtNum(used)} / {fmtNum(limit)}</div>
                    <div className="w-24 ml-auto bg-muted h-1 rounded-full overflow-hidden mt-1">
                      <div
                        className={`h-full ${pct >= 90 ? 'bg-rose-500' : pct >= 70 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </td>
                  <td className="py-2.5 pr-3 text-right tabular-nums text-foreground">{fmtNum(o.userCount)}</td>
                  <td
                    className={`py-2.5 pr-3 text-right text-xs tabular-nums ${dormant ? 'text-muted-foreground/60' : 'text-foreground'}`}
                    title={o.lastActiveAt ? new Date(o.lastActiveAt).toLocaleString() : 'No activity recorded'}
                  >
                    {relTime(o.lastActiveAt)}
                  </td>
                  <td className="py-2.5 text-right text-muted-foreground text-xs">{formatDate(o.createdAt)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {data.pages > 1 && (
        <div className="flex items-center justify-between mt-4 text-xs">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="px-3 py-1.5 rounded-lg border border-border bg-card hover:bg-muted disabled:opacity-40"
          >
            Previous
          </button>
          <span className="text-muted-foreground">
            Page {data.page} of {data.pages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(data.pages, p + 1))}
            disabled={page >= data.pages}
            className="px-3 py-1.5 rounded-lg border border-border bg-card hover:bg-muted disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Org detail modal — drill-down + the three write actions ───────────────

function OrgDetailModal({ orgId, onClose, onChanged }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  // 'extend' | 'grant' | 'cancel' | 'plan' | 'reset' | 'apikey' | 'whitelabel' | null
  const [action, setAction] = useState(null);

  const reload = async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/admin/orgs/${orgId}`);
      setData(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { reload(); }, [orgId]);

  const handleSuccess = async () => {
    setAction(null);
    await reload();
    onChanged?.();
  };

  // Close on Escape — common modal expectation, no extra mouse trip needed.
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const org = data?.org;
  const isCancelled = org?.subscriptionStatus === 'cancelled' && org?.currentPeriodEnd && new Date(org.currentPeriodEnd) <= new Date();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-card border border-border rounded-2xl shadow-2xl">
        <div className="sticky top-0 z-10 bg-card border-b border-border px-6 py-4 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
              {loading ? 'Loading…' : (org?.name || 'Org')}
              {org?.whiteLabel && (
                <span title="White-label enabled" className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                  <Crown className="w-3 h-3" /> white-label
                </span>
              )}
            </h2>
            {org && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {org.slug || org._id} · {org.plan}{org.annual ? ' · annual' : ''} · {(org.subscriptionStatus || '').replace('_', ' ')}
              </p>
            )}
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-muted">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {loading || !org ? (
          <div className="p-12 flex justify-center">
            <div className="w-6 h-6 border-2 border-border border-t-primary rounded-full animate-spin" />
          </div>
        ) : (
          <div className="p-6 space-y-6">
            <DetailGrid org={org} counts={data} />

            {!action && (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                <ActionButton
                  icon={CalendarPlus}
                  label="Extend trial"
                  tone="blue"
                  disabled={!!org.paystackSubscriptionCode}
                  hint={org.paystackSubscriptionCode ? 'Paid org — N/A' : null}
                  onClick={() => setAction('extend')}
                />
                <ActionButton
                  icon={Coins}
                  label="Grant credits"
                  tone="emerald"
                  onClick={() => setAction('grant')}
                />
                <ActionButton
                  icon={ArrowRightLeft}
                  label="Change plan"
                  tone="violet"
                  onClick={() => setAction('plan')}
                />
                <ActionButton
                  icon={RefreshCw}
                  label="Reset counters"
                  tone="amber"
                  onClick={() => setAction('reset')}
                />
                <ActionButton
                  icon={Key}
                  label="Rotate API key"
                  tone="slate"
                  onClick={() => setAction('apikey')}
                />
                <ActionButton
                  icon={Ban}
                  label="Force cancel"
                  tone="rose"
                  disabled={isCancelled}
                  hint={isCancelled ? 'Already cancelled' : null}
                  onClick={() => setAction('cancel')}
                />
              </div>
            )}

            {!action && (
              <button
                onClick={() => setAction('whitelabel')}
                className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5"
              >
                <Crown className="w-3 h-3" />
                {org.whiteLabel ? 'Disable' : 'Enable'} white-label override
              </button>
            )}

            {action === 'extend'     && <ExtendTrialForm     orgId={orgId} onCancel={() => setAction(null)} onDone={handleSuccess} />}
            {action === 'grant'      && <GrantCreditsForm    orgId={orgId} onCancel={() => setAction(null)} onDone={handleSuccess} />}
            {action === 'cancel'     && <ForceCancelForm     orgId={orgId} orgName={org.name} onCancel={() => setAction(null)} onDone={handleSuccess} />}
            {action === 'plan'       && <ChangePlanForm      orgId={orgId} currentPlan={org.plan} currentAnnual={!!org.annual} onCancel={() => setAction(null)} onDone={handleSuccess} />}
            {action === 'reset'      && <ResetCountersForm   orgId={orgId} org={org} onCancel={() => setAction(null)} onDone={handleSuccess} />}
            {action === 'apikey'     && <RotateApiKeyForm    orgId={orgId} currentKey={org.apiKey} onCancel={() => setAction(null)} onDone={handleSuccess} />}
            {action === 'whitelabel' && <WhiteLabelForm      orgId={orgId} currentValue={!!org.whiteLabel} onCancel={() => setAction(null)} onDone={handleSuccess} />}

            <ActivityPanel orgId={orgId} />

            <MembersPanel members={data?.members || []} ownerId={org.owner} onUserChanged={reload} />

            {data?.recentFailedWebhooks?.length > 0 && (
              <FailedWebhooksPanel rows={data.recentFailedWebhooks} />
            )}

            {data?.recentAi?.length > 0 && (
              <div>
                <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1.5">
                  <Sparkles className="w-3 h-3" /> Recent AI calls
                </h3>
                <div className="space-y-1 max-h-48 overflow-y-auto border border-border/50 rounded-lg p-2">
                  {data.recentAi.map((r) => (
                    <div key={r._id} className="flex items-center justify-between text-xs py-1 border-b border-border/50 last:border-0">
                      <span className="font-mono text-foreground flex items-center gap-1.5">
                        {r.success === false && <XCircle className="w-3 h-3 text-rose-500" />}
                        {r.endpoint}
                      </span>
                      <span className="text-muted-foreground">
                        {fmtMoney(r.estimatedCostUsd)} · {new Date(r.timestamp).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function DetailGrid({ org, counts }) {
  const invoiced = counts?.invoices?.totalInvoiced || 0;
  const paid = counts?.invoices?.totalPaid || 0;
  const outstanding = counts?.invoices?.outstanding || 0;
  const openValue = counts?.deals?.openPipelineValue || 0;
  const wonValue = counts?.deals?.wonValue || 0;
  const ccy = org.defaults?.currency || 'USD';
  const fmtOrgMoney = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: ccy, minimumFractionDigits: 0 }).format(n || 0);

  // The owner is the User doc that matches org.owner. /admin/orgs/:id returns
  // members already filtered to this org, so we look up the owner there to
  // get their phone (not exposed on the org itself).
  const ownerMember = counts?.members?.find((m) => String(m._id) === String(org.owner));
  const ownerPhone = ownerMember?.phone || org.businessInfo?.phone || '';

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
        <StatTile label="Members" value={fmtNum(counts?.members?.length ?? 0)} icon={Users} />
        <StatTile label="Quotes" value={fmtNum(counts?.quoteCount)} icon={FileText} />
        <StatTile label="Deals (won)" value={`${fmtNum(counts?.dealCount)} (${fmtNum(counts?.deals?.wonCount || 0)})`} icon={TrendingUp} />
        <StatTile label="Invoiced (paid)" value={`${fmtOrgMoney(invoiced)} (${fmtOrgMoney(paid)})`} icon={Wallet} />
      </div>

      {ownerPhone && (
        <div className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg bg-emerald-50/40 border border-emerald-100">
          <span className="text-muted-foreground">Contact owner:</span>
          <span className="font-medium text-foreground">{ownerMember?.email || org.owner?.email || '—'}</span>
          <PhoneActions phone={ownerPhone} />
        </div>
      )}

      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
        <DetailRow k="Owner"          v={ownerMember?.email || org.owner?.email || '—'} />
        <DetailRow k="Outstanding AR" v={fmtOrgMoney(outstanding)} />
        <DetailRow k="Open pipeline"  v={fmtOrgMoney(openValue)} />
        <DetailRow k="Won value"      v={fmtOrgMoney(wonValue)} />
        <DetailRow k="Joined"         v={formatDate(org.createdAt)} />
        <DetailRow k="Trial ends"     v={org.trialEndsAt ? formatDate(org.trialEndsAt) : '—'} />
        <DetailRow k="Period ends"    v={org.currentPeriodEnd ? formatDate(org.currentPeriodEnd) : '—'} />
        <DetailRow k="Paystack sub"   v={org.paystackSubscriptionCode || '—'} />
        <DetailRow k="AI credits"     v={`${fmtNum(org.aiCreditsUsed)} / ${fmtNum(org.aiCreditsLimit)}`} />
        <DetailRow k="Purchased AI"   v={fmtNum(org.purchasedCredits)} />
        <DetailRow k="PDF pages"      v={`${fmtNum(org.pdfPagesUsed)} / ${fmtNum(org.pdfPagesLimit)}`} />
        <DetailRow k="Purchased PDF"  v={fmtNum(org.purchasedPdfPages)} />
        <DetailRow k="Quotes (month)" v={fmtNum(org.quotesThisMonth)} />
        <DetailRow k="Business phone" v={org.businessInfo?.phone || '—'} />
        <DetailRow k="Business email" v={org.businessInfo?.email || '—'} />
        <DetailRow k="API key"        v={org.apiKey ? `${org.apiKey.slice(0, 10)}…${org.apiKey.slice(-4)}` : '—'} mono />
        <DetailRow k="Webhook URL"    v={org.webhookUrl || '—'} mono />
        <DetailRow k="Accounting hook" v={org.preferences?.accountingWebhookUrl || '—'} mono />
      </div>
    </div>
  );
}

function StatTile({ label, value, icon: Icon }) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
        <Icon className="w-3 h-3" /> {label}
      </div>
      <div className="text-sm font-semibold text-foreground tabular-nums mt-0.5">{value}</div>
    </div>
  );
}

function DetailRow({ k, v, mono }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-muted-foreground">{k}</span>
      <span
        className={`text-foreground tabular-nums truncate ${mono ? 'font-mono text-[11px]' : ''}`}
        title={String(v)}
      >
        {v}
      </span>
    </div>
  );
}

function ActionButton({ icon: Icon, label, tone, onClick, disabled, hint }) {
  const tones = {
    blue:    'border-blue-200 text-blue-700 hover:bg-blue-50',
    emerald: 'border-emerald-200 text-emerald-700 hover:bg-emerald-50',
    rose:    'border-rose-200 text-rose-700 hover:bg-rose-50',
    violet:  'border-violet-200 text-violet-700 hover:bg-violet-50',
    amber:   'border-amber-200 text-amber-700 hover:bg-amber-50',
    slate:   'border-slate-200 text-slate-700 hover:bg-slate-50',
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={hint || undefined}
      className={`flex items-center justify-center gap-2 text-sm py-2.5 rounded-lg border bg-card transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${tones[tone]}`}
    >
      <Icon className="w-4 h-4" />
      {label}
    </button>
  );
}

// ── Action forms ──

function ExtendTrialForm({ orgId, onCancel, onDone }) {
  const [days, setDays] = useState(7);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      const { data } = await api.post(`/admin/orgs/${orgId}/extend-trial`, { days: Number(days) });
      toast.success(data.message);
      onDone();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Extend failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <FormShell title="Extend trial" onCancel={onCancel} onSubmit={submit} submitLabel={`Extend by ${days} day${days === 1 ? '' : 's'}`} busy={busy}>
      <label className="text-xs text-muted-foreground">Days to extend (1–90)</label>
      <input
        type="number"
        min={1}
        max={90}
        value={days}
        onChange={(e) => setDays(e.target.value)}
        className="w-32 px-3 py-1.5 text-sm rounded-lg border border-border bg-background"
      />
      <p className="text-[11px] text-muted-foreground">
        Pushes trial end date out from today (or current trial end, whichever is later). If the org is currently expired, status flips back to trialing.
      </p>
    </FormShell>
  );
}

function GrantCreditsForm({ orgId, onCancel, onDone }) {
  const [ai, setAi] = useState(0);
  const [pdf, setPdf] = useState(0);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (Number(ai) <= 0 && Number(pdf) <= 0) {
      toast.error('Set at least one credit field above zero.');
      return;
    }
    setBusy(true);
    try {
      const { data } = await api.post(`/admin/orgs/${orgId}/grant-credits`, {
        ai: Number(ai) || 0,
        pdf: Number(pdf) || 0,
        note: note || undefined,
      });
      toast.success(data.message);
      onDone();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Grant failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <FormShell title="Grant credits" onCancel={onCancel} onSubmit={submit} submitLabel="Grant" busy={busy}>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-muted-foreground">AI credits</label>
          <input
            type="number"
            min={0}
            max={100000}
            value={ai}
            onChange={(e) => setAi(e.target.value)}
            className="w-full px-3 py-1.5 text-sm rounded-lg border border-border bg-background"
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">PDF pages</label>
          <input
            type="number"
            min={0}
            max={100000}
            value={pdf}
            onChange={(e) => setPdf(e.target.value)}
            className="w-full px-3 py-1.5 text-sm rounded-lg border border-border bg-background"
          />
        </div>
      </div>
      <label className="text-xs text-muted-foreground">Note (optional, server log only)</label>
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="e.g. 'Goodwill — botched onboarding'"
        className="w-full px-3 py-1.5 text-sm rounded-lg border border-border bg-background"
      />
      <p className="text-[11px] text-muted-foreground">
        Grants land in the carry-indefinitely pool — they survive the monthly reset and are spent only after the plan allowance.
      </p>
    </FormShell>
  );
}

function ForceCancelForm({ orgId, orgName, onCancel, onDone }) {
  const [reason, setReason] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [ignorePaystack, setIgnorePaystack] = useState(false);
  const [busy, setBusy] = useState(false);

  // Type-to-confirm gate: makes a destructive click impossible to fat-finger.
  const canSubmit = confirmText.trim() === orgName;

  const submit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    try {
      const { data } = await api.post(`/admin/orgs/${orgId}/force-cancel`, {
        reason: reason || undefined,
        ignorePaystack,
      });
      toast.success(data.message);
      onDone();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Force-cancel failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <FormShell
      title="Force cancel"
      onCancel={onCancel}
      onSubmit={submit}
      submitLabel="Force cancel now"
      submitTone="rose"
      busy={busy}
      submitDisabled={!canSubmit}
    >
      <div className="flex gap-2 p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700">
        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
        <div>
          Disables the Paystack subscription, marks the org cancelled, ends the period immediately,
          and revokes all existing user sessions. There is no grace period.
        </div>
      </div>
      <label className="text-xs text-muted-foreground">Reason (logged)</label>
      <input
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="e.g. 'TOS violation — fraudulent chargebacks'"
        className="w-full px-3 py-1.5 text-sm rounded-lg border border-border bg-background"
      />
      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        <input
          type="checkbox"
          checked={ignorePaystack}
          onChange={(e) => setIgnorePaystack(e.target.checked)}
        />
        Ignore Paystack failure (only if subscription is already cancelled on their side)
      </label>
      <label className="text-xs text-muted-foreground">
        Type <span className="font-mono text-foreground">{orgName}</span> to confirm
      </label>
      <input
        value={confirmText}
        onChange={(e) => setConfirmText(e.target.value)}
        className="w-full px-3 py-1.5 text-sm rounded-lg border border-border bg-background"
      />
    </FormShell>
  );
}

function FormShell({ title, children, onCancel, onSubmit, submitLabel, submitTone = 'primary', busy, submitDisabled }) {
  const submitClass = submitTone === 'rose'
    ? 'bg-rose-600 hover:bg-rose-700 text-white'
    : 'bg-primary hover:bg-primary/90 text-primary-foreground';
  return (
    <div className="border border-border rounded-xl p-4 space-y-3">
      <div className="text-sm font-medium text-foreground">{title}</div>
      <div className="space-y-2">{children}</div>
      <div className="flex justify-end gap-2 pt-1">
        <button
          onClick={onCancel}
          disabled={busy}
          className="px-3 py-1.5 text-sm rounded-lg border border-border hover:bg-muted disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          onClick={onSubmit}
          disabled={busy || submitDisabled}
          className={`px-3 py-1.5 text-sm rounded-lg disabled:opacity-50 ${submitClass}`}
        >
          {busy ? 'Working…' : submitLabel}
        </button>
      </div>
    </div>
  );
}

// ─── New action forms ───────────────────────────────────────────────────────

const PLAN_LIST = ['trial', 'starter', 'pro', 'business', 'enterprise'];

function ChangePlanForm({ orgId, currentPlan, currentAnnual, onCancel, onDone }) {
  const [plan, setPlan] = useState(currentPlan || 'pro');
  const [annual, setAnnual] = useState(!!currentAnnual);
  const [syncLimits, setSyncLimits] = useState(true);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (plan === currentPlan && annual === currentAnnual) {
      toast.error('Pick a different plan or billing cadence.');
      return;
    }
    setBusy(true);
    try {
      const { data } = await api.post(`/admin/orgs/${orgId}/change-plan`, {
        plan, annual, syncLimits, reason: reason || undefined,
      });
      toast.success(data.message);
      onDone();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Change failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <FormShell title="Change plan" onCancel={onCancel} onSubmit={submit} submitLabel="Apply" busy={busy}>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-muted-foreground">New plan</label>
          <select
            value={plan}
            onChange={(e) => setPlan(e.target.value)}
            className="w-full px-3 py-1.5 text-sm rounded-lg border border-border bg-background"
          >
            {PLAN_LIST.map((p) => (
              <option key={p} value={p}>{p}{p === currentPlan ? ' (current)' : ''}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Billing</label>
          <select
            value={annual ? 'annual' : 'monthly'}
            onChange={(e) => setAnnual(e.target.value === 'annual')}
            className="w-full px-3 py-1.5 text-sm rounded-lg border border-border bg-background"
            disabled={plan === 'trial'}
          >
            <option value="monthly">Monthly</option>
            <option value="annual">Annual</option>
          </select>
        </div>
      </div>
      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        <input
          type="checkbox"
          checked={syncLimits}
          onChange={(e) => setSyncLimits(e.target.checked)}
        />
        Re-seed limits + white-label flag from plan defaults (recommended)
      </label>
      <label className="text-xs text-muted-foreground">Reason (logged)</label>
      <input
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="e.g. 'Enterprise contract finalised'"
        className="w-full px-3 py-1.5 text-sm rounded-lg border border-border bg-background"
      />
      <p className="text-[11px] text-muted-foreground">
        Bypasses Paystack — for goodwill upgrades, enterprise comps, or correcting state when a webhook didn't land. Period end is extended to at least today + {annual ? '12' : '1'} {annual ? 'months' : 'month'}.
      </p>
    </FormShell>
  );
}

function ResetCountersForm({ orgId, org, onCancel, onDone }) {
  const [ai, setAi] = useState(false);
  const [pdf, setPdf] = useState(false);
  const [quotes, setQuotes] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!ai && !pdf && !quotes) {
      toast.error('Select at least one counter to reset.');
      return;
    }
    setBusy(true);
    try {
      const { data } = await api.post(`/admin/orgs/${orgId}/reset-counters`, {
        ai, pdf, quotes, reason: reason || undefined,
      });
      toast.success(data.message);
      onDone();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Reset failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <FormShell title="Reset monthly counters" onCancel={onCancel} onSubmit={submit} submitLabel="Reset to zero" busy={busy}>
      <p className="text-[11px] text-muted-foreground">
        Zeroes the monthly counter without waiting for the 1st. Does NOT touch the carry-pool (purchasedCredits / purchasedPdfPages). Use this to refund usage after a bug or unblock an org mid-cycle.
      </p>
      <label className="flex items-start gap-2 text-xs text-muted-foreground p-2 rounded-lg border border-border">
        <input type="checkbox" checked={ai} onChange={(e) => setAi(e.target.checked)} className="mt-0.5" />
        <span>
          <span className="text-foreground font-medium">AI credits used</span>
          <span className="block text-[10px]">currently {fmtNum(org.aiCreditsUsed)} / {fmtNum(org.aiCreditsLimit)}</span>
        </span>
      </label>
      <label className="flex items-start gap-2 text-xs text-muted-foreground p-2 rounded-lg border border-border">
        <input type="checkbox" checked={pdf} onChange={(e) => setPdf(e.target.checked)} className="mt-0.5" />
        <span>
          <span className="text-foreground font-medium">PDF pages used</span>
          <span className="block text-[10px]">currently {fmtNum(org.pdfPagesUsed)} / {fmtNum(org.pdfPagesLimit)}</span>
        </span>
      </label>
      <label className="flex items-start gap-2 text-xs text-muted-foreground p-2 rounded-lg border border-border">
        <input type="checkbox" checked={quotes} onChange={(e) => setQuotes(e.target.checked)} className="mt-0.5" />
        <span>
          <span className="text-foreground font-medium">Quotes this month</span>
          <span className="block text-[10px]">currently {fmtNum(org.quotesThisMonth)}</span>
        </span>
      </label>
      <label className="text-xs text-muted-foreground">Reason (logged)</label>
      <input
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="e.g. 'CSV importer double-charged credits'"
        className="w-full px-3 py-1.5 text-sm rounded-lg border border-border bg-background"
      />
    </FormShell>
  );
}

function RotateApiKeyForm({ orgId, currentKey, onCancel, onDone }) {
  const [confirmed, setConfirmed] = useState(false);
  const [newKey, setNewKey] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      const { data } = await api.post(`/admin/orgs/${orgId}/rotate-api-key`);
      setNewKey(data.apiKey);
      toast.success(data.message);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Rotate failed');
    } finally {
      setBusy(false);
    }
  };

  if (newKey) {
    return (
      <div className="border border-emerald-200 bg-emerald-50/50 rounded-xl p-4 space-y-2">
        <div className="text-sm font-medium text-emerald-800 flex items-center gap-1.5">
          <CheckCircle2 className="w-4 h-4" /> New API key generated
        </div>
        <p className="text-[11px] text-emerald-700">
          The old key is now invalid. Copy this somewhere safe — it won't be shown in full again.
        </p>
        <code className="block bg-white border border-emerald-200 rounded-lg p-2 text-xs font-mono break-all text-foreground">
          {newKey}
        </code>
        <div className="flex justify-end">
          <button
            onClick={onDone}
            className="px-3 py-1.5 text-sm rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <FormShell title="Rotate API key" onCancel={onCancel} onSubmit={submit} submitLabel="Generate new key" busy={busy} submitDisabled={!confirmed}>
      <div className="flex gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800">
        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
        <div>
          Any external integration (n8n, Zapier, custom scripts) using the existing key will stop working immediately. Make sure the owner is ready to update them.
        </div>
      </div>
      <div className="text-xs text-muted-foreground">
        Current: <code className="font-mono text-[11px] text-foreground">{currentKey ? `${currentKey.slice(0, 10)}…${currentKey.slice(-4)}` : 'none'}</code>
      </div>
      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
        I've coordinated with the org owner.
      </label>
    </FormShell>
  );
}

function WhiteLabelForm({ orgId, currentValue, onCancel, onDone }) {
  const [enabled, setEnabled] = useState(!currentValue);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      const { data } = await api.post(`/admin/orgs/${orgId}/toggle-white-label`, {
        enabled, reason: reason || undefined,
      });
      toast.success(data.message);
      onDone();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Toggle failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <FormShell title="White-label override" onCancel={onCancel} onSubmit={submit} submitLabel={enabled ? 'Enable' : 'Disable'} busy={busy}>
      <p className="text-[11px] text-muted-foreground">
        Independent of the plan default. Use to hand-comp white-label to a Pro org as a sweetener, or pull it from a tier that hasn't paid for it. Re-seeded if you later run "Change plan" with sync-limits on.
      </p>
      <label className="flex items-center gap-2 text-xs text-foreground">
        <input type="radio" name="wl" checked={enabled} onChange={() => setEnabled(true)} />
        Enable (hide "Powered by SafiriPro" on shared quotes)
      </label>
      <label className="flex items-center gap-2 text-xs text-foreground">
        <input type="radio" name="wl" checked={!enabled} onChange={() => setEnabled(false)} />
        Disable (restore SafiriPro attribution)
      </label>
      <label className="text-xs text-muted-foreground">Reason (logged)</label>
      <input
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="e.g. 'Comp — botched onboarding'"
        className="w-full px-3 py-1.5 text-sm rounded-lg border border-border bg-background"
      />
    </FormShell>
  );
}

// ─── Org modal: activity panel ──────────────────────────────────────────────

const TIMELINE_ICONS = {
  quote_created:    { Icon: FileText,    color: 'text-amber-600 bg-amber-50' },
  deal_created:     { Icon: TrendingUp,  color: 'text-blue-600 bg-blue-50' },
  deal_won:         { Icon: CheckCircle2,color: 'text-emerald-600 bg-emerald-50' },
  deal_lost:        { Icon: XCircle,     color: 'text-rose-600 bg-rose-50' },
  invoice_created:  { Icon: Wallet,      color: 'text-violet-600 bg-violet-50' },
  payment_recorded: { Icon: Coins,       color: 'text-emerald-600 bg-emerald-50' },
  user_login:       { Icon: LogIn,       color: 'text-slate-500 bg-slate-50' },
};

function ActivityPanel({ orgId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);

  useEffect(() => {
    // Matches the fetch-on-deps pattern used by OrgsTable above. The
    // set-state-in-effect rule fires here but not on the identical pattern
    // in OrgsTable — leaving consistent with the rest of the page.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    api.get(`/admin/orgs/${orgId}/activity?days=${days}`)
      .then(({ data }) => setData(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [orgId, days]);

  return (
    <div className="border border-border rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
            <Activity className="w-3 h-3" /> Activity · last {days} days
          </h3>
          {data?.lastActiveAt && (
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Last activity {relTime(data.lastActiveAt)} ({new Date(data.lastActiveAt).toLocaleString()})
            </p>
          )}
        </div>
        <select
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          className="text-xs rounded-lg border border-border bg-background px-2 py-1"
        >
          <option value={7}>7d</option>
          <option value={30}>30d</option>
          <option value={90}>90d</option>
        </select>
      </div>

      {loading ? (
        <div className="h-32 flex items-center justify-center">
          <div className="w-5 h-5 border-2 border-border border-t-primary rounded-full animate-spin" />
        </div>
      ) : (
        <>
          <div className="h-28 mb-3">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data?.sparkline || []} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <XAxis
                  dataKey="date"
                  tickFormatter={shortDate}
                  tick={{ fontSize: 10, fill: '#6b7280' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: '#6b7280' }}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                  width={28}
                />
                <Tooltip
                  contentStyle={{ borderRadius: 8, fontSize: 11, border: '1px solid #e5e7eb' }}
                  labelFormatter={(d) => formatDate(d)}
                />
                <Bar dataKey="quotes"   stackId="a" fill="#f59e0b" radius={[0, 0, 0, 0]} />
                <Bar dataKey="deals"    stackId="a" fill="#3b82f6" />
                <Bar dataKey="invoices" stackId="a" fill="#8b5cf6" />
                <Bar dataKey="payments" stackId="a" fill="#10b981" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="flex items-center gap-3 text-[10px] text-muted-foreground mb-2 flex-wrap">
            <LegendDot color="#f59e0b" label="Quotes" />
            <LegendDot color="#3b82f6" label="Deals" />
            <LegendDot color="#8b5cf6" label="Invoices" />
            <LegendDot color="#10b981" label="Payments" />
          </div>

          {data?.timeline?.length ? (
            <div className="max-h-72 overflow-y-auto space-y-1 border-t border-border pt-2">
              {data.timeline.map((e, i) => {
                const def = TIMELINE_ICONS[e.kind] || { Icon: Activity, color: 'text-slate-500 bg-slate-50' };
                return (
                  <div key={`${e.refId || ''}-${e.kind}-${i}`} className="flex items-start gap-2 text-xs py-1">
                    <div className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 ${def.color}`}>
                      <def.Icon className="w-3 h-3" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-foreground truncate">{e.label}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {new Date(e.ts).toLocaleString()}{e.by?.email ? ` · ${e.by.email}` : ''}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground text-center py-4 border-t border-border">
              No activity in this window.
            </p>
          )}
        </>
      )}
    </div>
  );
}

function LegendDot({ color, label }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}

// ─── Org modal: members panel with per-user actions ─────────────────────────

function MembersPanel({ members, ownerId, onUserChanged }) {
  const [busyUserId, setBusyUserId] = useState(null);

  const run = async (userId, label, fn) => {
    setBusyUserId(userId);
    try {
      const { data } = await fn();
      toast.success(data.message || `${label} done`);
      await onUserChanged?.();
    } catch (err) {
      toast.error(err.response?.data?.message || `${label} failed`);
    } finally {
      setBusyUserId(null);
    }
  };

  return (
    <div>
      <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1.5">
        <Users className="w-3 h-3" /> Members ({members.length})
      </h3>
      <div className="border border-border rounded-lg overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-muted/40 text-[10px] uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="text-left py-1.5 px-3 font-medium">User</th>
              <th className="text-left py-1.5 px-3 font-medium">Role</th>
              <th className="text-left py-1.5 px-3 font-medium">Phone</th>
              <th className="text-left py-1.5 px-3 font-medium">Status</th>
              <th className="text-left py-1.5 px-3 font-medium">Last login</th>
              <th className="text-right py-1.5 px-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => {
              const isOwner = String(m._id) === String(ownerId);
              const busy = busyUserId === m._id;
              return (
                <tr key={m._id} className="border-t border-border/60">
                  <td className="py-2 px-3">
                    <div className="text-foreground flex items-center gap-1.5">
                      {m.email}
                      {isOwner && <Crown className="w-3 h-3 text-amber-500" />}
                      {!m.emailVerified && (
                        <span title="Email not verified">
                          <Mail className="w-3 h-3 text-amber-500" />
                        </span>
                      )}
                    </div>
                    {m.name && <div className="text-[10px] text-muted-foreground">{m.name}</div>}
                  </td>
                  <td className="py-2 px-3 text-muted-foreground">{m.role}</td>
                  <td className="py-2 px-3">
                    {m.phone ? <PhoneActions phone={m.phone} /> : <span className="text-muted-foreground/60">—</span>}
                  </td>
                  <td className="py-2 px-3">
                    <span className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full ${
                      m.status === 'pending' ? 'bg-amber-50 text-amber-700' :
                      m.status === 'disabled' || !m.isActive ? 'bg-rose-50 text-rose-700' :
                      'bg-emerald-50 text-emerald-700'
                    }`}>
                      {m.status}{!m.isActive && m.status === 'active' ? ' · blocked' : ''}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-muted-foreground">{m.lastLogin ? relTime(m.lastLogin) : 'never'}</td>
                  <td className="py-2 px-3 text-right">
                    <div className="inline-flex items-center gap-1">
                      {!m.emailVerified && (
                        <IconActionButton
                          title="Mark email as verified"
                          icon={MailCheck}
                          disabled={busy}
                          onClick={() => run(m._id, 'Verify',
                            () => api.post(`/admin/users/${m._id}/verify-email`))}
                        />
                      )}
                      {m.status === 'pending' && (
                        <IconActionButton
                          title="Resend invite email"
                          icon={Mail}
                          disabled={busy}
                          onClick={() => run(m._id, 'Resend invite',
                            () => api.post(`/admin/users/${m._id}/resend-invite`))}
                        />
                      )}
                      {!isOwner && m.isActive !== false && (
                        <IconActionButton
                          title="Disable user (block login)"
                          icon={UserX}
                          tone="rose"
                          disabled={busy}
                          onClick={() => {
                            if (window.confirm(`Disable ${m.email}? Their sessions will be revoked immediately.`)) {
                              run(m._id, 'Disable',
                                () => api.post(`/admin/users/${m._id}/set-active`, { isActive: false }));
                            }
                          }}
                        />
                      )}
                      {m.isActive === false && (
                        <IconActionButton
                          title="Re-enable user"
                          icon={UserCheck}
                          tone="emerald"
                          disabled={busy}
                          onClick={() => run(m._id, 'Enable',
                            () => api.post(`/admin/users/${m._id}/set-active`, { isActive: true }))}
                        />
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {members.length === 0 && (
              <tr><td colSpan={6} className="text-center py-3 text-muted-foreground">No members.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Inline phone display + click-to-WhatsApp + tel: link. Used everywhere we
// want to fast-track a call/chat without copy-pasting the number. The phone
// itself is shown so the operator can also dial it from a desk phone.
// stopPropagation is on the buttons so clicking them inside a clickable row
// doesn't also trigger that row's onClick.
function PhoneActions({ phone, compact = false }) {
  const digits = phoneDigits(phone);
  if (!phone || !digits) {
    return compact ? null : <span className="text-muted-foreground/60">—</span>;
  }
  const stop = (e) => e.stopPropagation();
  return (
    <span className="inline-flex items-center gap-1.5">
      {!compact && <span className="tabular-nums">{phone}</span>}
      <a
        href={`https://wa.me/${digits}`}
        target="_blank"
        rel="noopener noreferrer"
        onClick={stop}
        title={`WhatsApp ${phone}`}
        className="inline-flex items-center justify-center w-5 h-5 rounded-md bg-emerald-50 text-emerald-600 hover:bg-emerald-100"
      >
        <MessageCircle className="w-3 h-3" />
      </a>
      <a
        href={`tel:${digits}`}
        onClick={stop}
        title={`Call ${phone}`}
        className="inline-flex items-center justify-center w-5 h-5 rounded-md bg-blue-50 text-blue-600 hover:bg-blue-100"
      >
        <Phone className="w-3 h-3" />
      </a>
    </span>
  );
}

function IconActionButton({ icon: Icon, title, onClick, disabled, tone = 'slate' }) {
  const tones = {
    slate:   'text-slate-600 hover:bg-slate-100',
    rose:    'text-rose-600 hover:bg-rose-50',
    emerald: 'text-emerald-600 hover:bg-emerald-50',
  };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`p-1 rounded-md ${tones[tone]} disabled:opacity-40 disabled:cursor-not-allowed`}
    >
      <Icon className="w-3.5 h-3.5" />
    </button>
  );
}

// ─── Org modal: failed-webhook panel ────────────────────────────────────────

function FailedWebhooksPanel({ rows }) {
  return (
    <div>
      <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1.5">
        <Webhook className="w-3 h-3 text-rose-500" /> Failed webhook deliveries ({rows.length})
      </h3>
      <div className="border border-rose-200/60 bg-rose-50/30 rounded-lg overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-rose-100/40 text-[10px] uppercase tracking-wide text-rose-700">
            <tr>
              <th className="text-left py-1.5 px-3 font-medium">Event</th>
              <th className="text-left py-1.5 px-3 font-medium">URL</th>
              <th className="text-right py-1.5 px-3 font-medium">Status</th>
              <th className="text-right py-1.5 px-3 font-medium">When</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((w) => (
              <tr key={w._id} className="border-t border-rose-200/40">
                <td className="py-2 px-3 font-mono text-foreground">{w.event}</td>
                <td className="py-2 px-3 text-muted-foreground font-mono text-[10px] max-w-xs truncate" title={w.url}>{w.url}</td>
                <td className="py-2 px-3 text-right text-rose-700 tabular-nums">
                  {w.lastResponseStatus || 'err'} · {w.attempts}/{w.attempts}
                </td>
                <td className="py-2 px-3 text-right text-muted-foreground">{relTime(w.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Top-level: user search ─────────────────────────────────────────────────

function UserSearchPanel({ onOpenOrg }) {
  const [q, setQ] = useState('');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef(null);

  useEffect(() => {
    if (!q || q.length < 2) {
      setItems([]);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const { data } = await api.get(`/admin/users?q=${encodeURIComponent(q)}`);
        setItems(data.items || []);
      } catch {
        setItems([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [q]);

  return (
    <div className="bg-card border border-border rounded-xl p-4 sm:p-5">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div>
          <h3 className="text-sm font-medium text-foreground flex items-center gap-1.5">
            <Eye className="w-3.5 h-3.5 text-muted-foreground" /> Find a user
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Search by email or name across every org. Click a result to open that org's drill-down.
          </p>
        </div>
      </div>
      <div className="relative max-w-md">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder="e.g. jane@example.com"
          className="pl-8 pr-3 py-2 text-sm rounded-lg border border-border bg-background w-full"
        />
        {open && q.length >= 2 && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-lg max-h-72 overflow-y-auto z-10">
            {loading && (
              <div className="px-3 py-2 text-xs text-muted-foreground">Searching…</div>
            )}
            {!loading && items.length === 0 && (
              <div className="px-3 py-2 text-xs text-muted-foreground">No users match.</div>
            )}
            {!loading && items.map((u) => (
              <div
                key={u._id}
                className="px-3 py-2 hover:bg-muted/60 border-b border-border/50 last:border-0 flex items-center gap-2"
              >
                <button
                  onClick={() => {
                    if (u.organization?._id) {
                      onOpenOrg(u.organization._id);
                      setOpen(false);
                    }
                  }}
                  className="text-left flex-1 min-w-0"
                >
                  <div className="text-sm text-foreground truncate">{u.email}</div>
                  <div className="text-[11px] text-muted-foreground truncate">
                    {u.organization?.name || '(no org)'} · {u.organization?.plan || '—'} · {u.role}
                    {!u.isActive && ' · blocked'}
                    {u.status === 'pending' && ' · pending'}
                  </div>
                </button>
                {u.phone && <PhoneActions phone={u.phone} compact />}
                <div className="text-[10px] text-muted-foreground shrink-0 tabular-nums w-12 text-right">
                  {u.lastLogin ? relTime(u.lastLogin) : 'never'}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
