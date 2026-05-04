import { useState } from 'react';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import { X, Send } from 'lucide-react';

// Email an invoice PDF to a client. Mirrors VoucherEmailModal — pre-fills To
// with the snapshotted client email, sends via Resend with operator's account
// email as Reply-To, and auto-flips the invoice draft → sent on success.
export default function InvoiceEmailModal({ invoice, onClose, onSent }) {
  const num = `INV-${String(invoice.invoiceNumber).padStart(4, '0')}`;
  const typeLabel = invoice.type === 'deposit' ? 'Deposit invoice'
    : invoice.type === 'balance' ? 'Balance invoice'
    : 'Invoice';

  const [to, setTo] = useState(invoice.client?.email || '');
  const [cc, setCc] = useState('');
  const [subject, setSubject] = useState(`${typeLabel} ${num}${invoice.client?.company ? ` — ${invoice.client.company}` : ''}`);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!to.trim()) { toast.error('Add at least one recipient'); return; }
    setSending(true);
    try {
      await api.post(`/invoices/${invoice._id}/email`, { to, cc, subject, message });
      toast.success('Invoice emailed');
      onSent?.();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Send failed');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card rounded-xl border border-border w-full max-w-lg" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-base font-semibold text-foreground">Email {typeLabel.toLowerCase()} {num}</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-muted">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-foreground mb-1">To (comma-separated)</label>
            <input
              value={to}
              onChange={e => setTo(e.target.value)}
              placeholder="client@example.com"
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
            />
            <p className="text-[11px] text-muted-foreground mt-1">
              Replies will go to your account email. Sending will flip a draft to sent.
            </p>
          </div>
          <div>
            <label className="block text-xs font-medium text-foreground mb-1">Cc <span className="text-muted-foreground">(optional)</span></label>
            <input
              value={cc}
              onChange={e => setCc(e.target.value)}
              placeholder="finance@example.com"
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
            <label className="block text-xs font-medium text-foreground mb-1">Message <span className="text-muted-foreground">(optional)</span></label>
            <textarea
              rows={4}
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="Anything else you'd like to add — appears above the standard invoice message."
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            The invoice PDF and your saved payment instructions are attached automatically.
          </p>
        </div>

        <div className="flex items-center justify-end gap-2 p-4 border-t border-border">
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
