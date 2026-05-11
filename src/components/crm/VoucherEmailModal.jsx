import { useState } from 'react';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import { X, Send, AlertTriangle } from 'lucide-react';

// Email-voucher dialog. Pre-fills `to` with the guest's email and the hotel's
// contact email if both are present (operator usually wants the lodge cc'd).
// Sending also flips a draft voucher to issued in the API.
//
// PRN guard: if the voucher has no confirmation number, the server rejects
// the send with code: 'PRN_MISSING'. We surface a warning banner up front and
// require the operator to click an explicit "Send anyway" button to pass
// force: true — vouchers without a PRN are useless to the lodge.
export default function VoucherEmailModal({ voucher, onClose, onSent }) {
  const num = `VCH-${String(voucher.voucherNumber).padStart(4, '0')}`;
  const defaults = [voucher.guest?.email, voucher.hotel?.contactEmail].filter(Boolean).join(', ');
  const missingPRN = !String(voucher.confirmationNumber || '').trim();

  const [to, setTo] = useState(defaults);
  const [subject, setSubject] = useState(`Hotel voucher ${num} — ${voucher.hotel?.name || ''}`.trim());
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const submit = async (force) => {
    if (!to.trim()) { toast.error('Add at least one recipient'); return; }
    setSending(true);
    try {
      await api.post(`/vouchers/${voucher._id}/email`, { to, subject, message, force });
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
          {missingPRN && (
            <div className="flex items-start gap-2 p-3 rounded-lg border border-amber-200 bg-amber-50">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-xs text-amber-900">
                <p className="font-semibold mb-0.5">No confirmation number on this voucher.</p>
                <p>The lodge's PRN is missing — without it, the voucher is just a piece of paper to them. Add the PRN first (close this dialog and edit the voucher), or click "Send anyway" if you really mean to.</p>
              </div>
            </div>
          )}
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
          {missingPRN ? (
            <button
              onClick={() => submit(true)}
              disabled={sending}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-600 text-white text-sm font-medium hover:bg-amber-700 disabled:opacity-50"
            >
              <AlertTriangle className="w-4 h-4" /> {sending ? 'Sending...' : 'Send anyway'}
            </button>
          ) : (
            <button
              onClick={() => submit(false)}
              disabled={sending}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary disabled:opacity-50"
            >
              <Send className="w-4 h-4" /> {sending ? 'Sending...' : 'Send'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
