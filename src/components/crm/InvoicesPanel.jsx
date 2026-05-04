import { useState, useEffect, useRef } from 'react';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import InvoiceModal from './InvoiceModal';
import InvoiceEmailModal from './InvoiceEmailModal';
import SplitInvoiceModal from './SplitInvoiceModal';
import {
  Plus, FileText, Download, Edit2, Trash2, Send, CheckCircle2,
  XCircle, AlertCircle, ChevronDown, ChevronUp, Receipt, Mail, Layers,
} from 'lucide-react';

const STATUS_META = {
  draft:     { label: 'Draft',     icon: FileText,      className: 'bg-muted text-muted-foreground border-border' },
  sent:      { label: 'Sent',      icon: Send,          className: 'bg-blue-50 text-blue-700 border-blue-200' },
  paid:      { label: 'Paid',      icon: CheckCircle2,  className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  cancelled: { label: 'Cancelled', icon: XCircle,       className: 'bg-muted text-muted-foreground border-border' },
};

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

export default function InvoicesPanel({ deal }) {
  const { user } = useAuth();
  const canManage = user && user.role !== 'viewer';
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [splitting, setSplitting] = useState(false);
  const [emailing, setEmailing] = useState(null);
  const [editing, setEditing] = useState(null);
  const [expanded, setExpanded] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  // Close the create menu when the user clicks outside.
  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [menuOpen]);

  const fetchInvoices = async () => {
    try {
      const { data } = await api.get('/invoices', { params: { deal: deal._id } });
      setInvoices(data.invoices || []);
    } catch {
      setInvoices([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchInvoices(); }, [deal._id]);

  const handleCreate = async () => {
    setCreating(true);
    try {
      const { data } = await api.post('/invoices', { dealId: deal._id });
      toast.success(`Created ${fmtInvNum(data.invoiceNumber)}`);
      fetchInvoices();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Create failed');
    } finally {
      setCreating(false);
    }
  };

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

  const handleDelete = async (id) => {
    if (!confirm('Delete this invoice? Drafts and cancelled invoices can be removed; sent and paid ones stay for audit.')) return;
    setBusyId(id);
    try {
      await api.delete(`/invoices/${id}`);
      toast.success('Deleted');
      fetchInvoices();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Delete failed');
    } finally {
      setBusyId(null);
    }
  };

  const downloadPdf = async (inv) => {
    try {
      const { downloadFile } = await import('../../utils/api');
      await downloadFile(`/invoices/${inv._id}/pdf`, `invoice-${inv.number || inv._id}.pdf`);
    } catch (err) {
      toast.error('PDF download failed');
    }
  };

  // Sort: draft + sent first (actionable), then paid + cancelled.
  const orderRank = { draft: 0, sent: 1, paid: 2, cancelled: 3 };
  const sorted = [...invoices].sort((a, b) => {
    const ra = orderRank[a.status] ?? 4;
    const rb = orderRank[b.status] ?? 4;
    if (ra !== rb) return ra - rb;
    return new Date(b.createdAt) - new Date(a.createdAt);
  });

  return (
    <div className="bg-card rounded-xl border border-border p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <Receipt className="w-4 h-4 text-primary" /> Invoices
          </h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Generate, download, and track payment status for this deal.
          </p>
        </div>
        {canManage && (
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen(o => !o)}
              disabled={creating}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-medium hover:bg-primary disabled:opacity-50 transition-colors shrink-0"
            >
              <Plus className="w-3.5 h-3.5" /> {creating ? 'Creating...' : 'Create invoice'}
              <ChevronDown className="w-3 h-3 -mr-0.5" />
            </button>
            {menuOpen && (
              <div className="absolute right-0 mt-1 w-60 bg-card border border-border rounded-lg shadow-lg z-10 py-1">
                <button
                  onClick={() => { setMenuOpen(false); handleCreate(); }}
                  className="w-full flex items-start gap-2 px-3 py-2 text-left hover:bg-muted text-xs"
                >
                  <FileText className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
                  <div>
                    <p className="font-medium text-foreground">Single invoice</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">One invoice for the full trip total.</p>
                  </div>
                </button>
                <button
                  onClick={() => { setMenuOpen(false); setSplitting(true); }}
                  className="w-full flex items-start gap-2 px-3 py-2 text-left hover:bg-muted text-xs"
                >
                  <Layers className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
                  <div>
                    <p className="font-medium text-foreground">Deposit + balance</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">Two drafts: deposit due soon, balance before travel.</p>
                  </div>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {loading ? (
        <div className="py-6 flex items-center justify-center">
          <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : sorted.length === 0 ? (
        <div className="py-6 text-center">
          <Receipt className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-xs text-muted-foreground">No invoices yet.</p>
          <p className="text-[11px] text-muted-foreground/70 mt-1">
            Drafts auto-create when a deal moves to Won — or click "Create invoice" to make one now.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-border -mx-1">
          {sorted.map((inv) => {
            const meta = STATUS_META[inv.status] || STATUS_META.draft;
            const Icon = meta.icon;
            const isOpen = expanded === inv._id;
            const isBusy = busyId === inv._id;
            const editable = inv.status === 'draft';

            return (
              <li key={inv._id} className="px-1 py-2.5">
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        onClick={() => setExpanded(isOpen ? null : inv._id)}
                        className="text-sm font-medium text-foreground hover:text-primary inline-flex items-center gap-1"
                      >
                        {fmtInvNum(inv.invoiceNumber)}
                        {isOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      </button>
                      <span className={`text-[10px] inline-flex items-center gap-1 px-1.5 py-0.5 rounded border ${meta.className} font-medium uppercase tracking-wide`}>
                        <Icon className="w-3 h-3" /> {meta.label}
                      </span>
                      {inv.type && inv.type !== 'full' && (
                        <span className="text-[10px] inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-primary/30 bg-primary/5 text-primary font-medium uppercase tracking-wide">
                          {inv.type}
                        </span>
                      )}
                      <span className="text-sm font-semibold text-foreground tabular-nums">{fmtMoney(inv.total, inv.currency)}</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Issued {fmtDate(inv.issueDate)}
                      {inv.dueDate && <> · due {fmtDate(inv.dueDate)}</>}
                      {inv.client?.name && <> · {inv.client.name}</>}
                    </p>

                    {isOpen && (
                      <div className="mt-2 p-2.5 rounded-md bg-background border border-border text-xs">
                        <table className="w-full">
                          <thead>
                            <tr className="text-[10px] uppercase tracking-wide text-muted-foreground border-b border-border">
                              <th className="text-left font-medium pb-1">Description</th>
                              <th className="text-right font-medium pb-1">Qty</th>
                              <th className="text-right font-medium pb-1">Unit</th>
                              <th className="text-right font-medium pb-1">Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(inv.lineItems || []).map((li, i) => (
                              <tr key={i} className="border-b border-border/50 last:border-0">
                                <td className="py-1.5 text-foreground">{li.description}</td>
                                <td className="py-1.5 text-right text-muted-foreground tabular-nums">{li.quantity}</td>
                                <td className="py-1.5 text-right text-muted-foreground tabular-nums">{fmtMoney(li.unitPrice, inv.currency)}</td>
                                <td className="py-1.5 text-right text-foreground tabular-nums">{fmtMoney(li.total, inv.currency)}</td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr><td colSpan={3} className="text-right pt-2 text-muted-foreground">Subtotal</td><td className="text-right pt-2 tabular-nums">{fmtMoney(inv.subtotal, inv.currency)}</td></tr>
                            {(inv.taxAmount > 0 || inv.taxPercent > 0) && (
                              <tr><td colSpan={3} className="text-right text-muted-foreground">Tax ({inv.taxPercent}%)</td><td className="text-right tabular-nums">{fmtMoney(inv.taxAmount, inv.currency)}</td></tr>
                            )}
                            <tr><td colSpan={3} className="text-right font-semibold pt-1">Total</td><td className="text-right font-semibold tabular-nums pt-1">{fmtMoney(inv.total, inv.currency)}</td></tr>
                          </tfoot>
                        </table>
                        {inv.paymentInstructions && (
                          <div className="mt-3 pt-2 border-t border-border">
                            <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Payment instructions</p>
                            <p className="text-foreground whitespace-pre-wrap">{inv.paymentInstructions}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Action cluster */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => downloadPdf(inv)}
                      className="p-1.5 rounded text-muted-foreground hover:text-primary hover:bg-muted"
                      title="View / download PDF"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                    {canManage && inv.status !== 'cancelled' && (
                      <button
                        onClick={() => setEmailing(inv)}
                        className="p-1.5 rounded text-muted-foreground hover:text-primary hover:bg-muted"
                        title="Email invoice"
                      >
                        <Mail className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {canManage && editable && (
                      <button
                        onClick={() => setEditing(inv)}
                        className="p-1.5 rounded text-muted-foreground hover:text-primary hover:bg-muted"
                        title="Edit"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {canManage && inv.status === 'draft' && (
                      <button
                        onClick={() => handleAction(inv._id, 'mark-sent', 'Marked as sent')}
                        disabled={isBusy}
                        className="px-2 py-1 rounded text-[10px] font-medium text-blue-700 hover:bg-blue-50 disabled:opacity-50"
                        title="Mark as sent"
                      >
                        Mark sent
                      </button>
                    )}
                    {canManage && (inv.status === 'draft' || inv.status === 'sent') && (
                      <button
                        onClick={() => handleAction(inv._id, 'mark-paid', 'Marked as paid')}
                        disabled={isBusy}
                        className="px-2 py-1 rounded text-[10px] font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                        title="Mark as paid"
                      >
                        Mark paid
                      </button>
                    )}
                    {canManage && inv.status !== 'paid' && inv.status !== 'cancelled' && (
                      <button
                        onClick={() => handleAction(inv._id, 'cancel', 'Cancelled')}
                        disabled={isBusy}
                        className="p-1.5 rounded text-muted-foreground hover:text-amber-600 hover:bg-muted"
                        title="Cancel"
                      >
                        <AlertCircle className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {canManage && (inv.status === 'draft' || inv.status === 'cancelled') && (
                      <button
                        onClick={() => handleDelete(inv._id)}
                        disabled={isBusy}
                        className="p-1.5 rounded text-muted-foreground hover:text-red-500 hover:bg-muted"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {editing && (
        <InvoiceModal
          invoice={editing}
          onClose={() => setEditing(null)}
          onSaved={fetchInvoices}
        />
      )}
      {emailing && (
        <InvoiceEmailModal
          invoice={emailing}
          onClose={() => setEmailing(null)}
          onSent={() => { setEmailing(null); fetchInvoices(); }}
        />
      )}
      {splitting && (
        <SplitInvoiceModal
          deal={deal}
          onClose={() => setSplitting(false)}
          onCreated={() => { setSplitting(false); fetchInvoices(); }}
        />
      )}
    </div>
  );
}
