import { useState, useMemo } from 'react';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import { X, Plus, Trash2, Save } from 'lucide-react';

const CURRENCIES = ['USD', 'EUR', 'GBP', 'KES', 'ZAR', 'TZS', 'UGX'];

// Edit modal for a draft invoice. Sent/paid/cancelled invoices are read-only
// at the API layer, so this opens only for status='draft'.
export default function InvoiceModal({ invoice, onClose, onSaved }) {
  const [client, setClient] = useState({ ...invoice.client });
  const [dueDate, setDueDate] = useState(
    invoice.dueDate ? new Date(invoice.dueDate).toISOString().slice(0, 10) : ''
  );
  const [lineItems, setLineItems] = useState(
    (invoice.lineItems || []).length
      ? invoice.lineItems.map(li => ({
          description: li.description || '',
          quantity: li.quantity ?? 1,
          unitPrice: li.unitPrice ?? 0,
          total: li.total ?? 0,
        }))
      : [{ description: '', quantity: 1, unitPrice: 0, total: 0 }]
  );
  const [taxPercent, setTaxPercent] = useState(invoice.taxPercent ?? 0);
  const [currency, setCurrency] = useState(invoice.currency || 'USD');
  const [paymentInstructions, setPaymentInstructions] = useState(invoice.paymentInstructions || '');
  const [notes, setNotes] = useState(invoice.notes || '');
  const [saving, setSaving] = useState(false);

  // Recompute totals whenever line items / tax change. Keeps the on-screen
  // numbers honest before the operator hits Save.
  const totals = useMemo(() => {
    const subtotal = lineItems.reduce((s, li) => s + (Number(li.total) || 0), 0);
    const taxAmount = Math.round(subtotal * ((Number(taxPercent) || 0) / 100) * 100) / 100;
    return { subtotal, taxAmount, total: subtotal + taxAmount };
  }, [lineItems, taxPercent]);

  const updateLine = (idx, patch) => {
    setLineItems(items => items.map((li, i) => {
      if (i !== idx) return li;
      const next = { ...li, ...patch };
      // Auto-recompute the row total when qty or price changes.
      next.total = (Number(next.quantity) || 0) * (Number(next.unitPrice) || 0);
      return next;
    }));
  };

  const addLine = () => {
    setLineItems([...lineItems, { description: '', quantity: 1, unitPrice: 0, total: 0 }]);
  };

  const removeLine = (idx) => {
    if (lineItems.length === 1) {
      toast.error('At least one line item is required');
      return;
    }
    setLineItems(lineItems.filter((_, i) => i !== idx));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data } = await api.put(`/invoices/${invoice._id}`, {
        client,
        dueDate: dueDate ? new Date(dueDate) : null,
        lineItems: lineItems.map(li => ({
          ...li,
          quantity: Number(li.quantity) || 0,
          unitPrice: Number(li.unitPrice) || 0,
          total: Number(li.total) || 0,
        })),
        taxPercent: Number(taxPercent) || 0,
        currency,
        paymentInstructions,
        notes,
      });
      toast.success('Invoice updated');
      onSaved?.(data);
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const inputCls = 'w-full px-3 py-2 rounded-lg bg-background border border-border text-sm text-foreground focus:outline-none focus:border-primary transition-colors';
  const fmt = (n) => `${currency} ${(Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50 animate-fade-in" onClick={onClose}>
      <div
        className="bg-card rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-border flex items-center justify-between sticky top-0 bg-card z-10">
          <div>
            <h3 className="text-base font-semibold text-foreground">
              Edit invoice INV-{String(invoice.invoiceNumber).padStart(4, '0')}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">Drafts are editable. Once sent or paid, the invoice locks.</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md text-muted-foreground hover:bg-muted">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Client snapshot — editable */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-2">Bill to</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input className={inputCls} placeholder="Name" value={client.name || ''} onChange={(e) => setClient({ ...client, name: e.target.value })} />
              <input className={inputCls} placeholder="Company" value={client.company || ''} onChange={(e) => setClient({ ...client, company: e.target.value })} />
              <input className={inputCls} placeholder="Email" value={client.email || ''} onChange={(e) => setClient({ ...client, email: e.target.value })} />
              <input className={inputCls} placeholder="Phone" value={client.phone || ''} onChange={(e) => setClient({ ...client, phone: e.target.value })} />
              <input className={`${inputCls} sm:col-span-2`} placeholder="Address (optional)" value={client.address || ''} onChange={(e) => setClient({ ...client, address: e.target.value })} />
            </div>
          </div>

          {/* Currency + due date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Currency</label>
              <select value={currency} onChange={(e) => setCurrency(e.target.value)} className={inputCls}>
                {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Due date (optional)</label>
              <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={inputCls} />
            </div>
          </div>

          {/* Line items */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-2">Line items</label>
            <div className="space-y-1.5">
              {/* Header row */}
              <div className="hidden sm:grid grid-cols-[1fr_70px_100px_100px_28px] gap-2 px-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                <span>Description</span>
                <span className="text-right">Qty</span>
                <span className="text-right">Unit price</span>
                <span className="text-right">Total</span>
                <span />
              </div>
              {lineItems.map((li, idx) => (
                <div key={idx} className="grid grid-cols-[1fr_70px_100px_100px_28px] gap-2">
                  <input
                    className={`${inputCls} min-w-0`}
                    placeholder="Description"
                    value={li.description}
                    onChange={(e) => updateLine(idx, { description: e.target.value })}
                  />
                  <input
                    type="number" min={0} step="any"
                    className={`${inputCls} text-right`}
                    value={li.quantity}
                    onChange={(e) => updateLine(idx, { quantity: e.target.value })}
                  />
                  <input
                    type="number" min={0} step="any"
                    className={`${inputCls} text-right`}
                    value={li.unitPrice}
                    onChange={(e) => updateLine(idx, { unitPrice: e.target.value })}
                  />
                  <div className="px-2 py-2 text-sm text-foreground text-right tabular-nums truncate" title={fmt(li.total)}>
                    {fmt(li.total)}
                  </div>
                  <button
                    onClick={() => removeLine(idx)}
                    className="p-1.5 rounded text-muted-foreground hover:text-red-500 hover:bg-muted"
                    title="Remove"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
            <button
              onClick={addLine}
              className="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <Plus className="w-3.5 h-3.5" /> Add line
            </button>
          </div>

          {/* Totals + tax */}
          <div className="border-t border-border pt-4 flex justify-end">
            <div className="w-full sm:w-72 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="tabular-nums">{fmt(totals.subtotal)}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground inline-flex items-center gap-2">
                  Tax
                  <input
                    type="number" min={0} max={100} step="any"
                    value={taxPercent}
                    onChange={(e) => setTaxPercent(e.target.value)}
                    className="w-14 px-1.5 py-0.5 rounded border border-border text-xs focus:outline-none focus:border-primary"
                  />
                  %
                </span>
                <span className="tabular-nums">{fmt(totals.taxAmount)}</span>
              </div>
              <div className="flex justify-between text-base font-semibold text-foreground border-t border-border pt-2">
                <span>Total</span>
                <span className="tabular-nums">{fmt(totals.total)}</span>
              </div>
            </div>
          </div>

          {/* Payment instructions + notes */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Payment instructions</label>
            <textarea
              rows={3}
              value={paymentInstructions}
              onChange={(e) => setPaymentInstructions(e.target.value)}
              placeholder="Bank details, M-Pesa paybill, terms..."
              className={`${inputCls} resize-none`}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Internal notes (optional)</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notes to yourself or your team — also shown on the invoice"
              className={`${inputCls} resize-none`}
            />
          </div>
        </div>

        <div className="px-5 py-3 border-t border-border flex items-center justify-end gap-2 sticky bottom-0 bg-card">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:bg-muted">Cancel</button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary disabled:opacity-50"
          >
            <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
