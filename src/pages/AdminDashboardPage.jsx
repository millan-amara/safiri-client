import { useState, useEffect, useMemo } from 'react';
import { Navigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import {
  Building2, Users, FileText, Sparkles, ShieldCheck, RefreshCw,
  TrendingUp, Activity, Search, X, CalendarPlus, Coins, Ban,
  AlertTriangle,
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

const shortDate = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
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
              placeholder="Search name…"
              className="pl-8 pr-3 py-1.5 text-sm rounded-lg border border-border bg-background w-44"
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
              <th className="text-right py-2 font-medium">Joined</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={7} className="text-center py-6 text-muted-foreground text-xs">Loading…</td></tr>
            )}
            {!loading && data.items.length === 0 && (
              <tr><td colSpan={7} className="text-center py-6 text-muted-foreground text-xs">No organizations match.</td></tr>
            )}
            {!loading && data.items.map((o) => {
              const ends = o.subscriptionStatus === 'trialing' ? o.trialEndsAt : o.currentPeriodEnd;
              const used = o.aiCreditsUsed || 0;
              const limit = o.aiCreditsLimit || 0;
              const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
              return (
                <tr
                  key={o._id}
                  onClick={() => onSelect?.(o._id)}
                  className="border-b border-border/50 last:border-0 hover:bg-muted/40 cursor-pointer"
                >
                  <td className="py-2.5 pr-3">
                    <div className="font-medium text-foreground">{o.name}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {o.owner?.email || '(no owner)'}
                    </div>
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
  const [action, setAction] = useState(null); // 'extend' | 'grant' | 'cancel' | null

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-card border border-border rounded-2xl shadow-2xl">
        <div className="sticky top-0 bg-card border-b border-border px-6 py-4 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              {loading ? 'Loading…' : (org?.name || 'Org')}
            </h2>
            {org && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {org.slug || org._id} · {org.plan} · {(org.subscriptionStatus || '').replace('_', ' ')}
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
          <div className="p-6 space-y-5">
            <DetailGrid org={org} counts={data} />

            {!action && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
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
                  icon={Ban}
                  label="Force cancel"
                  tone="rose"
                  disabled={org.subscriptionStatus === 'cancelled' && org.currentPeriodEnd && new Date(org.currentPeriodEnd) <= new Date()}
                  hint={org.subscriptionStatus === 'cancelled' && org.currentPeriodEnd && new Date(org.currentPeriodEnd) <= new Date() ? 'Already cancelled' : null}
                  onClick={() => setAction('cancel')}
                />
              </div>
            )}

            {action === 'extend' && <ExtendTrialForm orgId={orgId} onCancel={() => setAction(null)} onDone={handleSuccess} />}
            {action === 'grant' && <GrantCreditsForm orgId={orgId} onCancel={() => setAction(null)} onDone={handleSuccess} />}
            {action === 'cancel' && <ForceCancelForm orgId={orgId} orgName={org.name} onCancel={() => setAction(null)} onDone={handleSuccess} />}

            {data?.recentAi?.length > 0 && (
              <div>
                <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">Recent AI calls</h3>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {data.recentAi.map((r) => (
                    <div key={r._id} className="flex items-center justify-between text-xs py-1 border-b border-border/50 last:border-0">
                      <span className="font-mono text-foreground">{r.endpoint}</span>
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
  const rows = [
    ['Owner', org.owner?.email || counts?.members?.find((m) => m._id === org.owner)?.email || '—'],
    ['Members', counts?.members?.length ?? 0],
    ['Quotes', fmtNum(counts?.quoteCount)],
    ['Deals', fmtNum(counts?.dealCount)],
    ['Joined', formatDate(org.createdAt)],
    ['Trial ends', org.trialEndsAt ? formatDate(org.trialEndsAt) : '—'],
    ['Period ends', org.currentPeriodEnd ? formatDate(org.currentPeriodEnd) : '—'],
    ['Paystack sub', org.paystackSubscriptionCode || '—'],
    ['AI credits', `${fmtNum(org.aiCreditsUsed)} / ${fmtNum(org.aiCreditsLimit)}`],
    ['Purchased AI', fmtNum(org.purchasedCredits)],
    ['PDF pages', `${fmtNum(org.pdfPagesUsed)} / ${fmtNum(org.pdfPagesLimit)}`],
    ['Purchased PDF', fmtNum(org.purchasedPdfPages)],
  ];
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
      {rows.map(([k, v]) => (
        <div key={k} className="flex justify-between gap-2">
          <span className="text-muted-foreground">{k}</span>
          <span className="text-foreground tabular-nums truncate" title={String(v)}>{v}</span>
        </div>
      ))}
    </div>
  );
}

function ActionButton({ icon: Icon, label, tone, onClick, disabled, hint }) {
  const tones = {
    blue:    'border-blue-200 text-blue-700 hover:bg-blue-50',
    emerald: 'border-emerald-200 text-emerald-700 hover:bg-emerald-50',
    rose:    'border-rose-200 text-rose-700 hover:bg-rose-50',
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
