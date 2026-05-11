import { useState, useMemo } from 'react';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import { X, DollarSign } from 'lucide-react';

const METHODS = [
  { key: 'mpesa',         label: 'M-Pesa' },
  { key: 'bank_transfer', label: 'Bank transfer' },
  { key: 'card',          label: 'Card' },
  { key: 'cash',          label: 'Cash' },
  { key: 'other',         label: 'Other' },
];

function fmtMoney(amount, currency) {
  const n = Number(amount) || 0;
  return `${currency || 'USD'} ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Log a payment against an invoice. The server appends to invoice.payments[]
// and auto-recomputes status (sent → partially_paid → paid). Default amount
// is the outstanding balance so a one-click "they paid in full" still works.
export default function RecordPaymentModal({ invoice, onClose, onRecorded }) {
  const num = `INV-${String(invoice.invoiceNumber).padStart(4, '0')}`;
  const due = useMemo(() => {
    // amountDue is provided as a virtual when the server returns the invoice;
    // fall back to recomputing for older fetches that might lack it.
    if (typeof invoice.amountDue === 'number') return invoice.amountDue;
    const total = Number(invoice.total) || 0;
    const paid = (invoice.payments || []).reduce((s, p) => s + (Number(p.amount) || 0), 0);
    return Math.max(0, Math.round((total - paid) * 100) / 100);
  }, [invoice]);

  const [amount, setAmount] = useState(due > 0 ? due.toFixed(2) : '');
  const [method, setMethod] = useState('mpesa');
  const [reference, setReference] = useState('');
  const [paidAt, setPaidAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const amt = Number(amount);
  const valid = Number.isFinite(amt) && amt > 0 && amt <= due + 0.01;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!valid) {
      toast.error(amt <= 0 ? 'Amount must be positive' : 'Amount exceeds outstanding balance');
      return;
    }
    setSaving(true);
    try {
      await api.post(`/invoices/${invoice._id}/payments`, {
        amount: amt,
        method,
        reference: reference.trim(),
        paidAt,
        notes: notes.trim(),
      });
      toast.success('Payment recorded');
      onRecorded?.();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to record payment');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <form
        className="bg-card rounded-xl border border-border w-full max-w-md"
        onClick={e => e.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-base font-semibold text-foreground inline-flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-emerald-600" /> Record payment
          </h2>
          <button type="button" onClick={onClose} className="p-1 rounded hover:bg-muted">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-3">
          <div className="rounded-lg bg-muted/40 border border-border p-3 text-xs">
            <p className="text-muted-foreground">{num} · {invoice.client?.name || 'Client'}</p>
            <p className="text-foreground tabular-nums mt-0.5">
              <span className="font-semibold">{fmtMoney(due, invoice.currency)}</span>
              <span className="text-muted-foreground"> outstanding of {fmtMoney(invoice.total, invoice.currency)}</span>
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium text-foreground mb-1">
              Amount <span className="text-muted-foreground">({invoice.currency || 'USD'})</span>
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm tabular-nums focus:outline-none focus:border-primary"
              required
            />
            {amt > 0 && amt < due && (
              <p className="text-[11px] text-muted-foreground mt-1">
                Partial — {fmtMoney(due - amt, invoice.currency)} will remain outstanding.
              </p>
            )}
            {amt > due + 0.01 && (
              <p className="text-[11px] text-red-600 mt-1">Exceeds outstanding balance.</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">Method</label>
              <select
                value={method}
                onChange={e => setMethod(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:border-primary"
              >
                {METHODS.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">Date received</label>
              <input
                type="date"
                value={paidAt}
                onChange={e => setPaidAt(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:border-primary"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-foreground mb-1">
              Reference <span className="text-muted-foreground">(optional)</span>
            </label>
            <input
              value={reference}
              onChange={e => setReference(e.target.value)}
              placeholder={method === 'mpesa' ? 'M-Pesa code, e.g. QGH3K8L4XZ' : method === 'bank_transfer' ? 'Bank reference' : ''}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:border-primary"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-foreground mb-1">
              Notes <span className="text-muted-foreground">(optional)</span>
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Anything to remember about this payment"
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm resize-none focus:outline-none focus:border-primary"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 p-4 border-t border-border bg-muted/30">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg border border-border bg-card text-sm text-foreground hover:bg-muted"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!valid || saving}
            className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Record payment'}
          </button>
        </div>
      </form>
    </div>
  );
}
