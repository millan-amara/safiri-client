import { useState, useEffect } from 'react';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import { X, Send, Mail, Paperclip } from 'lucide-react';

// Operator email composer. Picks a template (4 starters + Custom blank),
// pre-fills subject + body with deal context, lets the operator edit before
// sending. Replies route to the operator's account email via Reply-To.
//
// Optional voucher attachment is offered when there are vouchers on the deal —
// useful for the "request lodge confirmation" template, where the lodge needs
// the voucher PDF to confirm the booking.
export default function SendEmailModal({ deal, onClose, onSent }) {
  const [templates, setTemplates] = useState([]);
  const [vouchers, setVouchers] = useState([]);
  const [templateKey, setTemplateKey] = useState('custom');
  const [audience, setAudience] = useState('client');
  const [to, setTo] = useState('');
  const [cc, setCc] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [attachVoucherId, setAttachVoucherId] = useState('');
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [sending, setSending] = useState(false);

  // Load templates + vouchers once.
  useEffect(() => {
    Promise.all([
      api.get('/messages/templates'),
      api.get('/vouchers', { params: { deal: deal._id } }).catch(() => ({ data: { vouchers: [] } })),
    ]).then(([t, v]) => {
      setTemplates(t.data.templates || []);
      setVouchers(v.data.vouchers || []);
    });
  }, [deal._id]);

  // Whenever the operator picks a different template, re-fetch the rendered
  // preview (server interpolates {{vars}}). Custom = blank fields.
  useEffect(() => {
    if (templateKey === 'custom') {
      setSubject('');
      setBody('');
      setAudience('client');
      return;
    }
    setLoadingPreview(true);
    api.get(`/messages/templates/${templateKey}/preview`, { params: { dealId: deal._id } })
      .then(({ data }) => {
        setSubject(data.subject || '');
        setBody(data.body || '');
        setAudience(data.audience || 'client');
      })
      .catch(err => toast.error(err.response?.data?.message || 'Could not load template'))
      .finally(() => setLoadingPreview(false));
  }, [templateKey, deal._id]);

  // Default the recipient based on audience: client → contact email; lodge →
  // first attached voucher's hotel contact (if any). Operator can override.
  useEffect(() => {
    if (audience === 'client') {
      setTo(deal.contact?.email || '');
    } else if (audience === 'lodge') {
      const first = vouchers[0];
      setTo(first?.hotel?.contactEmail || '');
    }
  }, [audience, deal, vouchers]);

  const handleSend = async () => {
    if (!to.trim()) { toast.error('Add at least one recipient'); return; }
    if (!subject.trim()) { toast.error('Subject is required'); return; }
    if (!body.trim()) { toast.error('Body is required'); return; }
    setSending(true);
    try {
      await api.post('/messages/send', {
        dealId: deal._id,
        templateKey,
        to,
        cc,
        subject,
        body,
        attachVoucherId: attachVoucherId || null,
      });
      toast.success('Email sent');
      onSent?.();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Send failed');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div
        className="bg-card rounded-xl border border-border w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-border sticky top-0 bg-card">
          <h2 className="text-base font-semibold text-foreground inline-flex items-center gap-1.5">
            <Mail className="w-4 h-4 text-primary" /> Send email
          </h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-muted">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-3">
          {/* Template picker */}
          <div>
            <label className="block text-xs font-medium text-foreground mb-1">Template</label>
            <select
              value={templateKey}
              onChange={e => setTemplateKey(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
            >
              {templates.map(t => (
                <option key={t.key} value={t.key}>{t.label}</option>
              ))}
            </select>
            {templates.find(t => t.key === templateKey)?.description && (
              <p className="text-[11px] text-muted-foreground mt-1">
                {templates.find(t => t.key === templateKey).description}
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-foreground mb-1">To</label>
            <input
              value={to}
              onChange={e => setTo(e.target.value)}
              placeholder="comma-separated"
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-foreground mb-1">Cc <span className="text-muted-foreground">(optional)</span></label>
            <input
              value={cc}
              onChange={e => setCc(e.target.value)}
              placeholder="comma-separated"
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-foreground mb-1">Subject</label>
            <input
              value={subject}
              onChange={e => setSubject(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-foreground mb-1">
              Body {loadingPreview && <span className="text-muted-foreground italic">(loading...)</span>}
            </label>
            <textarea
              rows={14}
              value={body}
              onChange={e => setBody(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm font-mono leading-relaxed"
              placeholder="Type your message..."
            />
            <p className="text-[11px] text-muted-foreground mt-1">
              Replies go to your account email, not the noreply address.
            </p>
          </div>

          {vouchers.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">
                <Paperclip className="w-3 h-3 inline mr-1" /> Attach voucher PDF <span className="text-muted-foreground">(optional)</span>
              </label>
              <select
                value={attachVoucherId}
                onChange={e => setAttachVoucherId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
              >
                <option value="">None</option>
                {vouchers.map(v => (
                  <option key={v._id} value={v._id}>
                    VCH-{String(v.voucherNumber).padStart(4, '0')} · {v.hotel?.name} · {v.checkIn ? new Date(v.checkIn).toLocaleDateString() : ''}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 p-4 border-t border-border sticky bottom-0 bg-card">
          <button onClick={onClose} className="px-3 py-2 text-sm rounded-lg hover:bg-muted">Cancel</button>
          <button
            onClick={handleSend}
            disabled={sending}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary disabled:opacity-50"
          >
            <Send className="w-4 h-4" /> {sending ? 'Sending...' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  );
}
