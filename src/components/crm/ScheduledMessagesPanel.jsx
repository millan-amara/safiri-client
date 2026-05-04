import { useState, useEffect } from 'react';
import { renderMarkdownSafe } from '../../utils/sanitizeMarkdown';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import ScheduledMessageModal from './ScheduledMessageModal';
import {
  Plus, Mail, Clock, Edit2, Trash2, CheckCircle2,
  AlertCircle, XCircle, AlertTriangle, Send,
} from 'lucide-react';

const STATUS_META = {
  scheduled: { label: 'Scheduled', icon: Clock, className: 'bg-blue-50 text-blue-700 border-blue-200' },
  sending:   { label: 'Sending', icon: Send, className: 'bg-amber-50 text-amber-700 border-amber-200' },
  sent:      { label: 'Sent', icon: CheckCircle2, className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  failed:    { label: 'Failed', icon: AlertCircle, className: 'bg-red-50 text-red-700 border-red-200' },
  cancelled: { label: 'Cancelled', icon: XCircle, className: 'bg-muted text-muted-foreground border-border' },
  overdue:   { label: 'Overdue — review', icon: AlertTriangle, className: 'bg-amber-50 text-amber-700 border-amber-200' },
};

const TIMING_LABEL = {
  before_travel_start: (offset) => `${offset} day${offset === 1 ? '' : 's'} before travel start`,
  after_travel_end:    (offset) => `${offset} day${offset === 1 ? '' : 's'} after travel end`,
  absolute:            () => 'Specific date',
};

function fmtSendAt(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

export default function ScheduledMessagesPanel({ deal }) {
  const { user } = useAuth();
  const canManage = user && user.role !== 'viewer';
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalMessage, setModalMessage] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [expanded, setExpanded] = useState(null);

  const fetchMessages = async () => {
    try {
      const { data } = await api.get('/scheduled-messages', { params: { deal: deal._id } });
      setMessages(data.messages || []);
    } catch {
      // silent — empty state covers it
      setMessages([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchMessages(); }, [deal._id]);

  const handleDelete = async (id) => {
    if (!confirm('Cancel and remove this scheduled message?')) return;
    try {
      await api.delete(`/scheduled-messages/${id}`);
      toast.success('Removed');
      fetchMessages();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Delete failed');
    }
  };

  const openCreate = () => {
    setModalMessage(null);
    setShowModal(true);
  };

  const openEdit = (msg) => {
    setModalMessage(msg);
    setShowModal(true);
  };

  // Pending first, then sent, then everything else.
  const orderRank = { scheduled: 0, overdue: 0, sending: 1, sent: 2, failed: 3, cancelled: 4 };
  const sorted = [...messages].sort((a, b) => {
    const ra = orderRank[a.status] ?? 5;
    const rb = orderRank[b.status] ?? 5;
    if (ra !== rb) return ra - rb;
    return new Date(a.sendAt) - new Date(b.sendAt);
  });

  return (
    <div className="bg-card rounded-xl border border-border p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <Mail className="w-4 h-4 text-primary" /> Scheduled messages
          </h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Pre-trip nudges, packing tips, post-trip follow-ups — sent automatically to the client.
          </p>
        </div>
        {canManage && (
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-medium hover:bg-primary transition-colors shrink-0"
          >
            <Plus className="w-3.5 h-3.5" /> Schedule
          </button>
        )}
      </div>

      {loading ? (
        <div className="py-6 flex items-center justify-center">
          <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : sorted.length === 0 ? (
        <div className="py-6 text-center">
          <Mail className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-xs text-muted-foreground">No scheduled messages yet.</p>
          {!deal.contact?.email && (
            <p className="text-[11px] text-amber-600 mt-2">Add a contact email to this deal to enable scheduling.</p>
          )}
        </div>
      ) : (
        <ul className="divide-y divide-border -mx-1">
          {sorted.map((msg) => {
            const meta = STATUS_META[msg.status] || STATUS_META.scheduled;
            const Icon = meta.icon;
            const timingLabel = TIMING_LABEL[msg.timing?.mode]?.(msg.timing?.offsetDays || 0) || '—';
            const isOpen = expanded === msg._id;
            const editable = ['scheduled', 'overdue'].includes(msg.status);
            return (
              <li key={msg._id} className="px-1 py-2.5">
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        onClick={() => setExpanded(isOpen ? null : msg._id)}
                        className="text-sm font-medium text-foreground hover:text-primary text-left truncate"
                      >
                        {msg.subject || '(no subject)'}
                      </button>
                      <span className={`text-[10px] inline-flex items-center gap-1 px-1.5 py-0.5 rounded border ${meta.className} font-medium uppercase tracking-wide`}>
                        <Icon className="w-3 h-3" /> {meta.label}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {timingLabel} · {fmtSendAt(msg.sendAt)}
                      {msg.createdBy && <> · by {msg.createdBy.name}</>}
                    </p>
                    {msg.status === 'failed' && msg.errorMessage && (
                      <p className="text-[11px] text-red-600 mt-1">⚠ {msg.errorMessage}</p>
                    )}
                    {isOpen && msg.body && (
                      <div
                        className="mt-2 p-2 rounded-md bg-background border border-border text-xs text-foreground leading-relaxed prose prose-sm max-w-none"
                        dangerouslySetInnerHTML={{ __html: renderMarkdownSafe(msg.body) }}
                      />
                    )}
                  </div>
                  {canManage && msg.status !== 'sent' && (
                    <div className="flex items-center gap-1 shrink-0">
                      {editable && (
                        <button
                          onClick={() => openEdit(msg)}
                          className="p-1 rounded text-muted-foreground hover:text-primary hover:bg-muted"
                          title="Edit"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(msg._id)}
                        className="p-1 rounded text-muted-foreground hover:text-red-500 hover:bg-muted"
                        title={editable ? 'Cancel & remove' : 'Remove'}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {showModal && (
        <ScheduledMessageModal
          deal={deal}
          message={modalMessage}
          onClose={() => { setShowModal(false); setModalMessage(null); }}
          onSaved={fetchMessages}
        />
      )}
    </div>
  );
}
