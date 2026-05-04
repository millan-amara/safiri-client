import { useState } from 'react';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import { X, Send } from 'lucide-react';

// Email-voucher dialog. Pre-fills `to` with the guest's email and the hotel's
// contact email if both are present (operator usually wants the lodge cc'd).
// Sending also flips a draft voucher to issued in the API.
export default function VoucherEmailModal({ voucher, onClose, onSent }) {
  const num = `VCH-${String(voucher.voucherNumber).padStart(4, '0')}`;
  const defaults = [voucher.guest?.email, voucher.hotel?.contactEmail].filter(Boolean).join(', ');

  const [to, setTo] = useState(defaults);
  const [subject, setSubject] = useState(`Hotel voucher ${num} — ${voucher.hotel?.name || ''}`.trim());
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!to.trim()) { toast.error('Add at least one recipient'); return; }
    setSending(true);
    try {
      await api.post(`/vouchers/${voucher._id}/email`, { to, subject, message });
      toast.success('Voucher emailed');
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
          <h2 className="text-base font-semibold text-foreground">Email voucher {num}</h2>
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
              placeholder="guest@example.com, reservations@lodge.com"
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
            />
            <p className="text-[11px] text-muted-foreground mt-1">
              Replies will go to your account email.
            </p>
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
            <label className="block text-xs font-medium text-foreground mb-1">Message (optional)</label>
            <textarea
              rows={4}
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="Anything else you'd like to add — appears above the standard voucher message."
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            The voucher PDF will be attached automatically. Sending a draft voucher will mark it as issued.
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
