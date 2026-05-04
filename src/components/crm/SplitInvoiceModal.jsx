import { useState, useEffect } from 'react';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { X, Layers } from 'lucide-react';

// Generate a deposit + balance pair from a deal in one click. Operator can
// override the deposit % per-deal; due dates and amounts come from org
// preferences and the latest quote, computed server-side.
//
// We don't preview the actual amounts here — the latest-quote lookup happens
// server-side and could differ from anything we'd compute in the client.
// Drafts appear in the panel immediately after creation; operator can edit.
export default function SplitInvoiceModal({ deal, onClose, onCreated }) {
  const { organization } = useAuth();
  const orgPct = organization?.preferences?.depositPercent ?? 30;
  const orgDueDays = organization?.preferences?.depositDueDays ?? 7;
  const orgLeadDays = organization?.preferences?.balanceDaysBeforeTravel ?? 60;

  const [depositPercent, setDepositPercent] = useState(orgPct);
  const [depositDueDays, setDepositDueDays] = useState(orgDueDays);
  const [balanceLeadDays, setBalanceLeadDays] = useState(orgLeadDays);
  const [generating, setGenerating] = useState(false);

  const balancePercent = Math.max(0, Math.min(100, 100 - Number(depositPercent || 0)));

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const { data } = await api.post('/invoices/split', {
        dealId: deal._id,
        depositPercent: Number(depositPercent),
        depositDueDays: Number(depositDueDays),
        balanceDaysBeforeTravel: Number(balanceLeadDays),
      });
      const dep = `INV-${String(data.deposit.invoiceNumber).padStart(4, '0')}`;
      const bal = `INV-${String(data.balance.invoiceNumber).padStart(4, '0')}`;
      toast.success(`Created ${dep} (deposit) and ${bal} (balance)`);
      onCreated?.();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Split failed');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card rounded-xl border border-border w-full max-w-lg" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-base font-semibold text-foreground inline-flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-primary" /> Split into deposit + balance
          </h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-muted">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <p className="text-sm text-muted-foreground">
            Two draft invoices will be created from this deal's latest quote (or deal value if no quote exists).
          </p>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">Deposit %</label>
              <input
                type="number" min="1" max="99"
                value={depositPercent}
                onChange={e => setDepositPercent(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm tabular-nums"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">Deposit due (days)</label>
              <input
                type="number" min="0"
                value={depositDueDays}
                onChange={e => setDepositDueDays(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm tabular-nums"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">Balance lead (days)</label>
              <input
                type="number" min="0"
                value={balanceLeadDays}
                onChange={e => setBalanceLeadDays(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm tabular-nums"
              />
            </div>
          </div>

          <div className="rounded-lg border border-border divide-y divide-border">
            <div className="p-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Deposit ({depositPercent}%)</p>
                <p className="text-[11px] text-muted-foreground">
                  Due in {depositDueDays} day{Number(depositDueDays) === 1 ? '' : 's'} from creation
                </p>
              </div>
              <span className="text-[10px] uppercase tracking-wide text-emerald-700">Draft</span>
            </div>
            <div className="p-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Balance ({balancePercent}%)</p>
                <p className="text-[11px] text-muted-foreground">
                  {deal.travelDates?.start
                    ? `Due ${balanceLeadDays} day${Number(balanceLeadDays) === 1 ? '' : 's'} before travel`
                    : `Due in 30 days (no travel date set)`}
                </p>
              </div>
              <span className="text-[10px] uppercase tracking-wide text-emerald-700">Draft</span>
            </div>
          </div>

          <p className="text-[11px] text-muted-foreground">
            Pre-filled from your settings. Edit either draft after creation if anything's still off.
          </p>
        </div>

        <div className="flex items-center justify-end gap-2 p-4 border-t border-border">
          <button onClick={onClose} className="px-3 py-2 text-sm rounded-lg hover:bg-muted">Cancel</button>
          <button
            onClick={handleGenerate}
            disabled={generating || depositPercent < 1 || depositPercent > 99}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary disabled:opacity-50"
          >
            <Layers className="w-4 h-4" /> {generating ? 'Generating...' : 'Generate drafts'}
          </button>
        </div>
      </div>
    </div>
  );
}
