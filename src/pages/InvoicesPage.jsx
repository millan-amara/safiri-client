import { useState, useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import toast from 'react-hot-toast';
import {
  Receipt, Search, X, Download, Edit2, Send, CheckCircle2, XCircle,
  FileText, AlertCircle, ExternalLink, FileDown,
} from 'lucide-react';
import InvoiceModal from '../components/crm/InvoiceModal';

const STATUS_META = {
  draft:     { label: 'Draft',     icon: FileText,     className: 'bg-muted text-muted-foreground border-border' },
  sent:      { label: 'Sent',      icon: Send,         className: 'bg-blue-50 text-blue-700 border-blue-200' },
  paid:      { label: 'Paid',      icon: CheckCircle2, className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  cancelled: { label: 'Cancelled', icon: XCircle,      className: 'bg-muted text-muted-foreground border-border' },
};

const STATUS_FILTERS = [
  { key: 'all',       label: 'All' },
  { key: 'draft',     label: 'Drafts' },
  { key: 'sent',      label: 'Sent' },
  { key: 'paid',      label: 'Paid' },
  { key: 'cancelled', label: 'Cancelled' },
];

function fmtMoney(amount, currency) {
  const n = Number(amount) || 0;
  return `${currency || 'USD'} ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtInvNum(n) {
  return `INV-${String(n).padStart(4, '0')}`;
}

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// Sum invoice totals grouped by currency. Returns the "primary" total (the
// currency with the largest sum) plus a count of other currencies present.
// Avoids the "add USD to KES" mistake while still surfacing one headline number.
function summariseByCurrency(invoices) {
  const byCurrency = {};
  for (const inv of invoices) {
    const c = inv.currency || 'USD';
    byCurrency[c] = (byCurrency[c] || 0) + (Number(inv.total) || 0);
  }
  const entries = Object.entries(byCurrency).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) return { primary: null, others: 0 };
  return {
    primary: { currency: entries[0][0], amount: entries[0][1] },
    others: entries.length - 1,
  };
}

export default function InvoicesPage() {
  const { user, organization } = useAuth();
  const canManage = user && user.role !== 'viewer';
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const fetchInvoices = async () => {
    setLoading(true);
    try {
      // Bump default limit so a small org sees its full history at once. If the
      // org grows past 200 active invoices we'll add pagination then.
      const { data } = await api.get('/invoices', { params: { limit: 200 } });
      setInvoices(data.invoices || []);
    } catch (err) {
      toast.error('Failed to load invoices');
      setInvoices([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchInvoices(); }, []);

  // Stats roll across all loaded invoices (not the filtered view) so the
  // numbers stay stable as the operator switches filter pills.
  const stats = useMemo(() => {
    const counts = { all: 0, draft: 0, sent: 0, paid: 0, cancelled: 0 };
    const outstanding = [];
    const paid = [];
    const now = new Date();
    const yearStart = new Date(now.getFullYear(), 0, 1);
    for (const inv of invoices) {
      counts.all++;
      counts[inv.status] = (counts[inv.status] || 0) + 1;
      if (inv.status === 'draft' || inv.status === 'sent') outstanding.push(inv);
      if (inv.status === 'paid' && inv.paidAt && new Date(inv.paidAt) >= yearStart) paid.push(inv);
    }
    return {
      counts,
      outstanding: summariseByCurrency(outstanding),
      paidYtd: summariseByCurrency(paid),
    };
  }, [invoices]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return invoices.filter(inv => {
      if (statusFilter !== 'all' && inv.status !== statusFilter) return false;
      if (q) {
        const hay = [
          fmtInvNum(inv.invoiceNumber),
          inv.client?.name,
          inv.client?.company,
          inv.client?.email,
          inv.deal?.title,
        ].filter(Boolean).join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [invoices, statusFilter, search]);

  const handleAction = async (id, action, label) => {
    setBusyId(id);
    try {
      await api.post(`/invoices/${id}/${action}`);
      toast.success(label);
      fetchInvoices();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Action failed');
    } finally {
      setBusyId(null);
    }
  };

  const downloadPdf = (inv) => {
    const token = localStorage.getItem('token');
    const base = api.defaults.baseURL?.replace(/\/+$/, '') || '/api';
    window.open(`${base}/invoices/${inv._id}/pdf?token=${encodeURIComponent(token || '')}`, '_blank');
  };

  return (
    <div className="space-y-6 max-w-360 mx-auto pb-12 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-foreground">Invoices</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Generated, sent, and paid — across every deal you have access to.
          </p>
        </div>
        <ExportCsvButton statusFilter={statusFilter} search={search} />
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          label="Outstanding"
          subLabel="Draft + sent"
          count={(stats.counts.draft || 0) + (stats.counts.sent || 0)}
          summary={stats.outstanding}
          accent="amber"
        />
        <StatCard
          label="Paid YTD"
          subLabel="Year-to-date"
          count={stats.counts.paid || 0}
          summary={stats.paidYtd}
          accent="emerald"
        />
        <StatCard label="Drafts" subLabel="Awaiting review" count={stats.counts.draft || 0} accent="muted" />
        <StatCard label="Cancelled" subLabel="All-time" count={stats.counts.cancelled || 0} accent="muted" />
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex bg-card border border-border rounded-lg p-1 overflow-x-auto">
          {STATUS_FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => setStatusFilter(f.key)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
                statusFilter === f.key ? 'bg-primary text-white' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {f.label}
              {f.key !== 'all' && (
                <span className={`ml-1.5 text-[10px] tabular-nums ${statusFilter === f.key ? 'opacity-80' : 'opacity-60'}`}>
                  {stats.counts[f.key] || 0}
                </span>
              )}
            </button>
          ))}
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/60 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search invoice #, client, deal..."
            className="w-full pl-8 pr-7 py-1.5 rounded-md bg-card border border-border text-xs focus:outline-none focus:border-primary"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {loading ? (
          <div className="py-16 flex items-center justify-center">
            <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState invoiceCount={invoices.length} />
        ) : (
          <>
            <div className="hidden sm:grid grid-cols-[140px_100px_1fr_1fr_120px_120px_140px] gap-3 px-4 py-2.5 border-b border-border bg-muted/40 text-[10px] uppercase tracking-wide font-medium text-muted-foreground">
              <span>Invoice</span>
              <span>Status</span>
              <span>Deal</span>
              <span>Client</span>
              <span className="text-right">Total</span>
              <span>Issued / due</span>
              <span className="text-right">Actions</span>
            </div>
            <ul className="divide-y divide-border">
              {filtered.map((inv) => (
                <InvoiceRow
                  key={inv._id}
                  inv={inv}
                  canManage={canManage}
                  busy={busyId === inv._id}
                  onDownload={() => downloadPdf(inv)}
                  onEdit={() => setEditing(inv)}
                  onMarkSent={() => handleAction(inv._id, 'mark-sent', 'Marked as sent')}
                  onMarkPaid={() => handleAction(inv._id, 'mark-paid', 'Marked as paid')}
                />
              ))}
            </ul>
          </>
        )}
      </div>

      {editing && (
        <InvoiceModal
          invoice={editing}
          onClose={() => setEditing(null)}
          onSaved={fetchInvoices}
        />
      )}
    </div>
  );
}

// CSV export popover. Opens a small panel with date range + status defaults;
// hits the streaming /export.csv endpoint with the operator's token in the
// query string (window.open can't carry an Authorization header).
function ExportCsvButton({ statusFilter, search }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
  const todayStr = today.toISOString().slice(0, 10);
  const [from, setFrom] = useState(monthStart);
  const [to, setTo] = useState(todayStr);
  const [status, setStatus] = useState(statusFilter || 'all');

  useEffect(() => {
    const handle = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  // Pre-fill status from the current page filter so "Export" matches what the
  // operator is looking at, but they can override before downloading.
  useEffect(() => { setStatus(statusFilter || 'all'); }, [statusFilter]);

  const doExport = () => {
    const token = localStorage.getItem('token');
    const base = api.defaults.baseURL?.replace(/\/+$/, '') || '/api';
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    if (status && status !== 'all') params.set('status', status);
    if (search) params.set('search', search);
    if (token) params.set('token', token);
    window.location.href = `${base}/invoices/export.csv?${params.toString()}`;
    setOpen(false);
  };

  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-card border border-border text-sm font-medium text-foreground hover:border-primary/50 transition-colors"
      >
        <FileDown className="w-4 h-4" /> Export CSV
      </button>
      {open && (
        <div className="absolute right-0 mt-2 z-30 bg-card rounded-xl shadow-2xl border border-border p-4 w-80 space-y-3">
          <div>
            <p className="text-xs font-semibold text-foreground mb-1">Export invoices</p>
            <p className="text-[11px] text-muted-foreground">For your accountant — bank reconciliation, monthly close, etc.</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5">From (issued)</label>
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-full px-2 py-1.5 rounded-md bg-background border border-border text-xs focus:outline-none focus:border-primary" />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5">To (issued)</label>
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-full px-2 py-1.5 rounded-md bg-background border border-border text-xs focus:outline-none focus:border-primary" />
            </div>
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5">Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full px-2 py-1.5 rounded-md bg-background border border-border text-xs focus:outline-none focus:border-primary">
              <option value="all">All statuses</option>
              <option value="draft">Drafts</option>
              <option value="sent">Sent</option>
              <option value="paid">Paid</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
          {search && (
            <p className="text-[10px] text-muted-foreground">
              Search "<strong>{search}</strong>" will also be applied.
            </p>
          )}
          <button
            onClick={doExport}
            className="w-full px-3 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary"
          >
            Download .csv
          </button>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, subLabel, count, summary, accent }) {
  const accentBg = {
    amber: 'bg-amber-50 text-amber-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    muted: 'bg-muted text-muted-foreground',
  }[accent] || 'bg-muted text-muted-foreground';
  return (
    <div className="bg-card border border-border rounded-xl p-4 sm:p-5">
      <div className="flex items-start justify-between mb-3">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${accentBg}`}>
          <Receipt className="w-4 h-4" strokeWidth={1.75} />
        </div>
      </div>
      <p className="text-xl sm:text-2xl font-semibold text-foreground tabular-nums">{count}</p>
      <p className="text-xs text-muted-foreground mt-1 truncate">{label}</p>
      {summary?.primary ? (
        <p className="text-[11px] text-muted-foreground/80 mt-1 truncate tabular-nums">
          {summary.primary.currency} {summary.primary.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          {summary.others > 0 && <span className="opacity-70"> · +{summary.others} other {summary.others === 1 ? 'currency' : 'currencies'}</span>}
        </p>
      ) : (
        <p className="text-[11px] text-muted-foreground/70 mt-1 truncate">{subLabel}</p>
      )}
    </div>
  );
}

function InvoiceRow({ inv, canManage, busy, onDownload, onEdit, onMarkSent, onMarkPaid }) {
  const meta = STATUS_META[inv.status] || STATUS_META.draft;
  const Icon = meta.icon;
  const editable = inv.status === 'draft';
  const dealId = inv.deal?._id || inv.deal;
  const overdue = inv.status === 'sent' && inv.dueDate && new Date(inv.dueDate) < new Date();

  return (
    <li className="px-4 py-3 hover:bg-muted/30 transition-colors">
      <div className="grid grid-cols-1 sm:grid-cols-[140px_100px_1fr_1fr_120px_120px_140px] gap-3 sm:items-center">
        <span className="text-sm font-medium text-foreground tabular-nums">{fmtInvNum(inv.invoiceNumber)}</span>
        <span>
          <span className={`text-[10px] inline-flex items-center gap-1 px-1.5 py-0.5 rounded border ${meta.className} font-medium uppercase tracking-wide`}>
            <Icon className="w-3 h-3" /> {meta.label}
          </span>
          {overdue && (
            <span className="ml-1.5 text-[10px] inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-red-50 text-red-700 border border-red-200 font-medium uppercase tracking-wide">
              <AlertCircle className="w-3 h-3" /> Overdue
            </span>
          )}
        </span>
        <span className="text-sm text-foreground truncate min-w-0">
          {dealId ? (
            <Link to={`/crm/deals/${dealId}`} className="hover:text-primary inline-flex items-center gap-1 truncate">
              <span className="truncate">{inv.deal?.title || '—'}</span>
              <ExternalLink className="w-3 h-3 opacity-50 shrink-0" />
            </Link>
          ) : (inv.deal?.title || '—')}
        </span>
        <span className="text-sm text-muted-foreground truncate min-w-0">
          {inv.client?.name || '—'}
          {inv.client?.company && <span className="text-[11px] opacity-70 ml-1">· {inv.client.company}</span>}
        </span>
        <span className="text-sm font-semibold text-foreground tabular-nums sm:text-right">{fmtMoney(inv.total, inv.currency)}</span>
        <span className="text-[11px] text-muted-foreground">
          <span className="block">{fmtDate(inv.issueDate)}</span>
          {inv.dueDate && <span className="block opacity-70">due {fmtDate(inv.dueDate)}</span>}
        </span>
        <div className="flex items-center justify-end gap-1">
          <button
            onClick={onDownload}
            className="p-1.5 rounded text-muted-foreground hover:text-primary hover:bg-muted"
            title="View / download PDF"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
          {canManage && editable && (
            <button onClick={onEdit} className="p-1.5 rounded text-muted-foreground hover:text-primary hover:bg-muted" title="Edit">
              <Edit2 className="w-3.5 h-3.5" />
            </button>
          )}
          {canManage && inv.status === 'draft' && (
            <button onClick={onMarkSent} disabled={busy} className="px-2 py-1 rounded text-[10px] font-medium text-blue-700 hover:bg-blue-50 disabled:opacity-50">
              Mark sent
            </button>
          )}
          {canManage && (inv.status === 'draft' || inv.status === 'sent') && (
            <button onClick={onMarkPaid} disabled={busy} className="px-2 py-1 rounded text-[10px] font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-50">
              Mark paid
            </button>
          )}
        </div>
      </div>
    </li>
  );
}

function EmptyState({ invoiceCount }) {
  return (
    <div className="py-16 text-center">
      <Receipt className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
      <p className="text-sm text-muted-foreground">
        {invoiceCount === 0
          ? 'No invoices yet.'
          : 'No invoices match the current filter.'}
      </p>
      {invoiceCount === 0 && (
        <p className="text-xs text-muted-foreground/70 mt-2">
          Drafts auto-create when a deal moves to Won, or generate one from a deal's detail page.
        </p>
      )}
    </div>
  );
}
