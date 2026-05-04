import { useState, useEffect, useRef } from 'react';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import VoucherModal from './VoucherModal';
import VoucherEmailModal from './VoucherEmailModal';
import GenerateVouchersModal from './GenerateVouchersModal';
import {
  Plus, FileText, Download, Edit2, Trash2, Mail, CheckCircle2,
  XCircle, AlertCircle, ChevronDown, ChevronUp, BedDouble, Sparkles, Pencil,
} from 'lucide-react';

const STATUS_META = {
  draft:     { label: 'Draft',     icon: FileText,     className: 'bg-muted text-muted-foreground border-border' },
  issued:    { label: 'Issued',    icon: CheckCircle2, className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  cancelled: { label: 'Cancelled', icon: XCircle,      className: 'bg-muted text-muted-foreground border-border' },
};

function fmtVchNum(n) {
  return `VCH-${String(n).padStart(4, '0')}`;
}

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function VouchersPanel({ deal }) {
  const { user } = useAuth();
  const canManage = user && user.role !== 'viewer';
  const [vouchers, setVouchers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [editing, setEditing] = useState(null);
  const [emailing, setEmailing] = useState(null);
  const [expanded, setExpanded] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  // Close the create menu when the user clicks anywhere outside it.
  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [menuOpen]);

  const fetchVouchers = async () => {
    try {
      const { data } = await api.get('/vouchers', { params: { deal: deal._id } });
      setVouchers(data.vouchers || []);
    } catch {
      setVouchers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchVouchers(); }, [deal._id]);

  const handleAction = async (id, action, label) => {
    setBusyId(id);
    try {
      await api.post(`/vouchers/${id}/${action}`);
      toast.success(label);
      fetchVouchers();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Action failed');
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this voucher? Issued vouchers must be cancelled instead.')) return;
    setBusyId(id);
    try {
      await api.delete(`/vouchers/${id}`);
      toast.success('Deleted');
      fetchVouchers();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Delete failed');
    } finally {
      setBusyId(null);
    }
  };

  const downloadPdf = async (vch) => {
    try {
      const { downloadFile } = await import('../../utils/api');
      await downloadFile(`/vouchers/${vch._id}/pdf`, `${fmtVchNum(vch.voucherNumber)}.pdf`);
    } catch {
      toast.error('PDF download failed');
    }
  };

  const orderRank = { draft: 0, issued: 1, cancelled: 2 };
  const sorted = [...vouchers].sort((a, b) => {
    const ra = orderRank[a.status] ?? 3;
    const rb = orderRank[b.status] ?? 3;
    if (ra !== rb) return ra - rb;
    return new Date(b.createdAt) - new Date(a.createdAt);
  });

  return (
    <div className="bg-card rounded-xl border border-border p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <BedDouble className="w-4 h-4 text-primary" /> Hotel vouchers
          </h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Issue check-in vouchers for confirmed lodge bookings on this deal.
          </p>
        </div>
        {canManage && (
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen(o => !o)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-medium hover:bg-primary transition-colors shrink-0"
            >
              <Plus className="w-3.5 h-3.5" /> Create voucher
              <ChevronDown className="w-3 h-3 -mr-0.5" />
            </button>
            {menuOpen && (
              <div className="absolute right-0 mt-1 w-56 bg-card border border-border rounded-lg shadow-lg z-10 py-1">
                <button
                  onClick={() => { setMenuOpen(false); setGenerating(true); }}
                  className="w-full flex items-start gap-2 px-3 py-2 text-left hover:bg-muted text-xs"
                >
                  <Sparkles className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
                  <div>
                    <p className="font-medium text-foreground">From a quote</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">Auto-fill hotels, dates, guests from an existing quote.</p>
                  </div>
                </button>
                <button
                  onClick={() => { setMenuOpen(false); setCreating(true); }}
                  className="w-full flex items-start gap-2 px-3 py-2 text-left hover:bg-muted text-xs"
                >
                  <Pencil className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
                  <div>
                    <p className="font-medium text-foreground">Manual entry</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">Type in hotel and stay details from scratch.</p>
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
          <BedDouble className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-xs text-muted-foreground">No vouchers yet.</p>
          <p className="text-[11px] text-muted-foreground/70 mt-1">
            Generate them from an existing quote, or create one manually.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-border -mx-1">
          {sorted.map((vch) => {
            const meta = STATUS_META[vch.status] || STATUS_META.draft;
            const Icon = meta.icon;
            const isOpen = expanded === vch._id;
            const isBusy = busyId === vch._id;
            const editable = vch.status === 'draft';

            return (
              <li key={vch._id} className="px-1 py-2.5">
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        onClick={() => setExpanded(isOpen ? null : vch._id)}
                        className="text-sm font-medium text-foreground hover:text-primary inline-flex items-center gap-1"
                      >
                        {fmtVchNum(vch.voucherNumber)}
                        {isOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      </button>
                      <span className={`text-[10px] inline-flex items-center gap-1 px-1.5 py-0.5 rounded border ${meta.className} font-medium uppercase tracking-wide`}>
                        <Icon className="w-3 h-3" /> {meta.label}
                      </span>
                      <span className="text-sm text-foreground truncate max-w-[16rem]" title={vch.hotel?.name}>
                        {vch.hotel?.name || '(no hotel)'}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {fmtDate(vch.checkIn)} → {fmtDate(vch.checkOut)} · {vch.nights || 0} night{vch.nights === 1 ? '' : 's'}
                      {vch.guest?.name && <> · {vch.guest.name}</>}
                      {vch.confirmationNumber && <> · #{vch.confirmationNumber}</>}
                    </p>

                    {isOpen && (
                      <div className="mt-2 p-2.5 rounded-md bg-background border border-border text-xs space-y-2">
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                          <div><span className="text-muted-foreground">Hotel:</span> <span className="text-foreground">{vch.hotel?.name || '—'}</span></div>
                          <div><span className="text-muted-foreground">Location:</span> <span className="text-foreground">{vch.hotel?.location || '—'}</span></div>
                          <div><span className="text-muted-foreground">Room:</span> <span className="text-foreground">{vch.rooms || 1} × {vch.roomType || 'Standard'}</span></div>
                          <div><span className="text-muted-foreground">Meal plan:</span> <span className="text-foreground">{vch.mealPlan || '—'}</span></div>
                          <div><span className="text-muted-foreground">Adults:</span> <span className="text-foreground">{vch.adults || 0}</span></div>
                          <div><span className="text-muted-foreground">Children:</span> <span className="text-foreground">{vch.children || 0}</span></div>
                        </div>
                        {vch.inclusions?.length > 0 && (
                          <div>
                            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Inclusions</p>
                            <ul className="list-disc list-inside text-foreground">
                              {vch.inclusions.map((it, i) => <li key={i}>{it}</li>)}
                            </ul>
                          </div>
                        )}
                        {vch.specialRequests && (
                          <div>
                            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Special requests</p>
                            <p className="text-foreground whitespace-pre-wrap">{vch.specialRequests}</p>
                          </div>
                        )}
                        {vch.lastSentAt && (
                          <p className="text-[10px] text-muted-foreground italic">
                            Last emailed {fmtDate(vch.lastSentAt)} to {vch.lastSentTo?.join(', ')}
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => downloadPdf(vch)}
                      className="p-1.5 rounded text-muted-foreground hover:text-primary hover:bg-muted"
                      title="View / download PDF"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                    {canManage && vch.status !== 'cancelled' && (
                      <button
                        onClick={() => setEmailing(vch)}
                        className="p-1.5 rounded text-muted-foreground hover:text-primary hover:bg-muted"
                        title="Email voucher"
                      >
                        <Mail className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {canManage && editable && (
                      <button
                        onClick={() => setEditing(vch)}
                        className="p-1.5 rounded text-muted-foreground hover:text-primary hover:bg-muted"
                        title="Edit"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {canManage && vch.status === 'draft' && (
                      <button
                        onClick={() => handleAction(vch._id, 'issue', 'Voucher issued')}
                        disabled={isBusy}
                        className="px-2 py-1 rounded text-[10px] font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                        title="Mark as issued"
                      >
                        Issue
                      </button>
                    )}
                    {canManage && vch.status !== 'cancelled' && (
                      <button
                        onClick={() => handleAction(vch._id, 'cancel', 'Cancelled')}
                        disabled={isBusy}
                        className="p-1.5 rounded text-muted-foreground hover:text-amber-600 hover:bg-muted"
                        title="Cancel"
                      >
                        <AlertCircle className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {canManage && vch.status !== 'issued' && (
                      <button
                        onClick={() => handleDelete(vch._id)}
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

      {creating && (
        <VoucherModal
          deal={deal}
          onClose={() => setCreating(false)}
          onSaved={() => { setCreating(false); fetchVouchers(); }}
        />
      )}
      {generating && (
        <GenerateVouchersModal
          deal={deal}
          onClose={() => setGenerating(false)}
          onGenerated={() => { setGenerating(false); fetchVouchers(); }}
        />
      )}
      {editing && (
        <VoucherModal
          deal={deal}
          voucher={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); fetchVouchers(); }}
        />
      )}
      {emailing && (
        <VoucherEmailModal
          voucher={emailing}
          onClose={() => setEmailing(null)}
          onSent={() => { setEmailing(null); fetchVouchers(); }}
        />
      )}
    </div>
  );
}
