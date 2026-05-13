// Superadmin-only view into every /api/search call across all orgs.
// Two API calls on mount: /admin/search-logs (table) and
// /admin/search-logs/stats (top strip with intent/outcome/destination/mustHave
// counts plus zero-result queries — the high-signal feedback loop for what
// operators want but aren't getting).
//
// Logs auto-expire after 90 days (TTL on the model), so the table is always
// recent.

import { useEffect, useState } from 'react';
import api from '../utils/api';
import { Search, Loader2, AlertCircle, ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';

const INTENT_LABELS = { search: 'Search', lookup: 'Lookup', diagnostic: 'Diagnostic' };
const OUTCOME_LABELS = {
  results: 'Results',
  no_results: 'No results',
  clarification: 'Clarification',
  lookup_answer: 'Answered',
  lookup_candidates: 'Disambiguation',
  diagnostic_items: 'Items found',
  diagnostic_clean: 'Clean',
  error: 'Error',
};
const OUTCOME_TONE = {
  results: 'bg-green-50 text-green-700',
  no_results: 'bg-amber-50 text-amber-700',
  clarification: 'bg-blue-50 text-blue-700',
  lookup_answer: 'bg-green-50 text-green-700',
  lookup_candidates: 'bg-blue-50 text-blue-700',
  diagnostic_items: 'bg-amber-50 text-amber-700',
  diagnostic_clean: 'bg-green-50 text-green-700',
  error: 'bg-red-50 text-red-700',
};

function fmtRelative(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const diffMs = Date.now() - d.getTime();
  const m = Math.floor(diffMs / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 30) return `${days}d ago`;
  return d.toLocaleDateString();
}

function StatCard({ label, value, sub }) {
  return (
    <div className="bg-card rounded-xl border border-border p-4">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-foreground tabular-nums">{value ?? '—'}</div>
      {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  );
}

function BreakdownCard({ title, entries, emptyLabel }) {
  return (
    <div className="bg-card rounded-xl border border-border p-4">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium mb-2">{title}</div>
      {entries.length === 0 ? (
        <div className="text-xs text-muted-foreground">{emptyLabel || 'No data yet'}</div>
      ) : (
        <div className="space-y-1.5">
          {entries.map((e, i) => (
            <div key={i} className="flex items-center justify-between text-sm">
              <span className="text-foreground truncate">{e.label}</span>
              <span className="text-muted-foreground tabular-nums ml-2 flex-shrink-0">{e.count}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function SearchLogsPage() {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [q, setQ] = useState('');
  const [intent, setIntent] = useState('');
  const [outcome, setOutcome] = useState('');
  const [page, setPage] = useState(1);
  const limit = 50;

  const loadStats = async () => {
    setStatsLoading(true);
    try {
      const res = await api.get('/admin/search-logs/stats');
      setStats(res.data);
    } catch (err) {
      // Non-fatal; the table view still works without stats.
      setStats(null);
    } finally {
      setStatsLoading(false);
    }
  };

  const loadLogs = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = { page, limit };
      if (q.trim()) params.q = q.trim();
      if (intent) params.intent = intent;
      if (outcome) params.outcome = outcome;
      const res = await api.get('/admin/search-logs', { params });
      setItems(res.data.items || []);
      setTotal(res.data.total || 0);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load logs.');
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadStats(); }, []);
  useEffect(() => { loadLogs(); /* eslint-disable-next-line */ }, [page, intent, outcome]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    loadLogs();
  };

  const totalPages = Math.max(1, Math.ceil(total / limit));

  // Build breakdown entries
  const intentEntries = stats
    ? Object.entries(stats.byIntent || {}).map(([k, v]) => ({ label: INTENT_LABELS[k] || k, count: v }))
    : [];
  const outcomeEntries = stats
    ? Object.entries(stats.byOutcome || {}).map(([k, v]) => ({ label: OUTCOME_LABELS[k] || k, count: v }))
    : [];
  const destinationEntries = (stats?.topDestinations || []).map(d => ({ label: d.name, count: d.count }));
  const mustHaveEntries = (stats?.topMustHave || []).map(d => ({ label: d.term, count: d.count }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Search logs</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Every /api/search call across all orgs (kept 90 days). Use this to see what operators actually type — and which queries return nothing.
        </p>
      </div>

      {/* Top stats strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <StatCard label="Total" value={statsLoading ? '…' : (stats?.total ?? 0)} sub="last 90 days" />
        <StatCard label="Last 30 days" value={statsLoading ? '…' : (stats?.last30d ?? 0)} />
        <StatCard label="Last 7 days" value={statsLoading ? '…' : (stats?.last7d ?? 0)} />
      </div>

      {/* Breakdowns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <BreakdownCard title="By intent (30d)" entries={intentEntries} emptyLabel="No searches yet" />
        <BreakdownCard title="By outcome (30d)" entries={outcomeEntries} emptyLabel="No searches yet" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <BreakdownCard title="Top destinations searched (30d)" entries={destinationEntries} />
        <BreakdownCard title="Top qualifiers (30d)" entries={mustHaveEntries} emptyLabel="No qualitative cues seen yet" />
      </div>

      {/* Zero-result queries — the load-bearing signal: what operators wanted that
          they didn't get. Each row is a candidate for fixing the parser, fixing
          the inventory, or both. */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <AlertCircle className="w-4 h-4 text-amber-700" />
          <h3 className="text-sm font-semibold text-amber-900">Zero-result queries (30d)</h3>
        </div>
        <p className="text-xs text-amber-800 mb-3">
          Queries operators typed where the inventory returned nothing. Each is a chance to fix the parser, add a partner, or both.
        </p>
        {statsLoading ? (
          <Loader2 className="w-4 h-4 animate-spin text-amber-700" />
        ) : (stats?.zeroResultQueries || []).length === 0 ? (
          <div className="text-xs text-amber-700">Nothing to flag — operators are finding what they ask for.</div>
        ) : (
          <div className="space-y-1.5">
            {stats.zeroResultQueries.map((z, i) => (
              <div key={i} className="flex items-baseline justify-between text-sm bg-white rounded-lg px-3 py-2 border border-amber-100">
                <span className="text-foreground italic">"{z.query}"</span>
                <span className="text-xs text-muted-foreground ml-2 flex-shrink-0">
                  {z.count} time{z.count === 1 ? '' : 's'} · last {fmtRelative(z.last)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Filters */}
      <form onSubmit={handleSearchSubmit} className="bg-card rounded-xl border border-border p-3 flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Filter by query text…"
            className="w-full pl-8 pr-3 py-2 text-sm bg-background border border-border rounded-lg outline-none focus:border-primary"
          />
        </div>
        <select
          value={intent}
          onChange={(e) => { setIntent(e.target.value); setPage(1); }}
          className="px-3 py-2 text-sm bg-background border border-border rounded-lg outline-none focus:border-primary"
        >
          <option value="">All intents</option>
          <option value="search">Search</option>
          <option value="lookup">Lookup</option>
          <option value="diagnostic">Diagnostic</option>
        </select>
        <select
          value={outcome}
          onChange={(e) => { setOutcome(e.target.value); setPage(1); }}
          className="px-3 py-2 text-sm bg-background border border-border rounded-lg outline-none focus:border-primary"
        >
          <option value="">All outcomes</option>
          {Object.entries(OUTCOME_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <button
          type="submit"
          className="px-4 py-2 text-sm font-medium bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
        >
          Apply
        </button>
      </form>

      {/* Table */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        {loading ? (
          <div className="p-8 flex items-center justify-center text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading…
          </div>
        ) : error ? (
          <div className="p-6 text-sm text-red-600">{error}</div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            <Sparkles className="w-5 h-5 inline mb-2 text-muted-foreground" /><br />
            No logs match the current filters.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-2 font-medium">When</th>
                <th className="text-left px-4 py-2 font-medium">Org</th>
                <th className="text-left px-4 py-2 font-medium">User</th>
                <th className="text-left px-4 py-2 font-medium">Query</th>
                <th className="text-left px-4 py-2 font-medium">Intent</th>
                <th className="text-left px-4 py-2 font-medium">Outcome</th>
                <th className="text-right px-4 py-2 font-medium">Results</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr key={row._id} className="border-t border-border hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap" title={new Date(row.createdAt).toLocaleString()}>
                    {fmtRelative(row.createdAt)}
                  </td>
                  <td className="px-4 py-2.5 text-xs">
                    <div className="text-foreground truncate max-w-[180px]" title={row.organization?.name}>
                      {row.organization?.name || '—'}
                    </div>
                    {row.organization?.plan && (
                      <div className="text-[10px] text-muted-foreground capitalize">{row.organization.plan}</div>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground truncate max-w-[160px]" title={row.user?.email}>
                    {row.user?.name || row.user?.email || '—'}
                  </td>
                  <td className="px-4 py-2.5 text-sm text-foreground max-w-md">
                    <span className="italic">"{row.query}"</span>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-medium bg-muted text-foreground capitalize">
                      {INTENT_LABELS[row.intent] || row.intent}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-medium ${OUTCOME_TONE[row.outcome] || 'bg-muted text-foreground'}`}>
                      {OUTCOME_LABELS[row.outcome] || row.outcome}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right text-sm tabular-nums text-foreground">{row.resultCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Pagination */}
        {!loading && total > limit && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-muted/20 text-sm">
            <div className="text-xs text-muted-foreground">
              Page {page} of {totalPages} · {total} log{total === 1 ? '' : 's'}
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="p-1.5 rounded-md text-muted-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="p-1.5 rounded-md text-muted-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
