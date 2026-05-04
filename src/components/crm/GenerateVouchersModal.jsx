import { useState, useEffect, useMemo } from 'react';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import { X, Sparkles, BedDouble, Check, AlertCircle } from 'lucide-react';

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// Generate-from-quote modal. Two phases:
//   1. Pick a quote (this deal's quotes, sorted: accepted first, then by version).
//   2. Preview segments + confirm. Already-existing stays are shown but
//      pre-disabled so the operator can see what'll be skipped.
export default function GenerateVouchersModal({ deal, onClose, onGenerated }) {
  const [quotes, setQuotes] = useState([]);
  const [loadingQuotes, setLoadingQuotes] = useState(true);
  const [selectedQuoteId, setSelectedQuoteId] = useState('');
  const [preview, setPreview] = useState(null);
  const [previewError, setPreviewError] = useState('');
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [generating, setGenerating] = useState(false);

  // Load this deal's quotes once.
  useEffect(() => {
    api.get('/quotes', { params: { deal: deal._id } })
      .then(({ data }) => {
        const list = data.quotes || [];
        // Sort: accepted first, then viewed/sent, then drafts; ties broken by
        // version desc so the latest version of each lineage wins.
        const statusRank = { accepted: 0, viewed: 1, sent: 2, draft: 3, rejected: 4, expired: 5 };
        const sorted = [...list].sort((a, b) => {
          const ra = statusRank[a.status] ?? 6;
          const rb = statusRank[b.status] ?? 6;
          if (ra !== rb) return ra - rb;
          return (b.version || 1) - (a.version || 1);
        });
        setQuotes(sorted);
        // Preselect the first quote (likely the accepted one).
        if (sorted.length) setSelectedQuoteId(sorted[0]._id);
      })
      .catch(() => setQuotes([]))
      .finally(() => setLoadingQuotes(false));
  }, [deal._id]);

  // Re-fetch the preview whenever the picked quote changes.
  useEffect(() => {
    if (!selectedQuoteId) { setPreview(null); return; }
    setLoadingPreview(true);
    setPreviewError('');
    api.get(`/vouchers/preview-from-quote/${selectedQuoteId}`)
      .then(({ data }) => setPreview(data))
      .catch(err => {
        setPreview(null);
        setPreviewError(err.response?.data?.message || 'Could not preview vouchers');
      })
      .finally(() => setLoadingPreview(false));
  }, [selectedQuoteId]);

  const newCount = useMemo(
    () => preview?.segments?.filter(s => !s.alreadyExists).length || 0,
    [preview]
  );
  const skipCount = useMemo(
    () => preview?.segments?.filter(s => s.alreadyExists).length || 0,
    [preview]
  );

  const handleGenerate = async () => {
    if (!selectedQuoteId || newCount === 0) return;
    setGenerating(true);
    try {
      const { data } = await api.post('/vouchers/generate-from-quote', { quoteId: selectedQuoteId });
      const msg = `Generated ${data.created.length} draft${data.created.length === 1 ? '' : 's'}`
        + (data.skipped ? ` (skipped ${data.skipped} that already existed)` : '');
      if (data.failed?.length) {
        toast.error(`${msg}, but ${data.failed.length} failed: ${data.failed[0].message}`);
      } else {
        toast.success(msg);
      }
      onGenerated?.();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Generate failed');
    } finally {
      setGenerating(false);
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
            <Sparkles className="w-4 h-4 text-primary" /> Generate vouchers from quote
          </h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-muted">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {loadingQuotes ? (
            <div className="py-8 flex items-center justify-center">
              <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : quotes.length === 0 ? (
            <div className="py-8 text-center">
              <BedDouble className="w-10 h-10 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No quotes on this deal yet.</p>
              <p className="text-xs text-muted-foreground/70 mt-1">Create a quote first to use this shortcut.</p>
            </div>
          ) : (
            <>
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Quote</label>
                <select
                  value={selectedQuoteId}
                  onChange={e => setSelectedQuoteId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
                >
                  {quotes.map(q => (
                    <option key={q._id} value={q._id}>
                      #{q.quoteNumber} · v{q.version || 1} · {q.status} · {q.title}
                    </option>
                  ))}
                </select>
              </div>

              {loadingPreview && (
                <div className="py-4 flex items-center justify-center">
                  <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              )}

              {previewError && (
                <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-900 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{previewError}</span>
                </div>
              )}

              {preview?.segments && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">
                    {newCount === 0
                      ? 'Nothing new to generate — every stay already has a voucher.'
                      : `${newCount} draft${newCount === 1 ? '' : 's'} will be created`}
                    {skipCount > 0 && ` (${skipCount} already covered)`}.
                  </p>
                  <ul className="divide-y divide-border border border-border rounded-lg overflow-hidden">
                    {preview.segments.map((seg, i) => (
                      <li key={i} className={`p-3 ${seg.alreadyExists ? 'bg-muted/30' : 'bg-background'}`}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{seg.hotel.name}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {fmtDate(seg.checkIn)} → {fmtDate(seg.checkOut)} · {seg.nights} night{seg.nights === 1 ? '' : 's'}
                              {seg.roomType && ` · ${seg.roomType}`}
                              {seg.mealPlan && ` · ${seg.mealPlan}`}
                            </p>
                            {seg.hotel.location && (
                              <p className="text-[11px] text-muted-foreground/70 mt-0.5">{seg.hotel.location}</p>
                            )}
                          </div>
                          {seg.alreadyExists ? (
                            <span className="text-[10px] uppercase tracking-wide text-muted-foreground inline-flex items-center gap-1 shrink-0">
                              <Check className="w-3 h-3" /> Exists
                            </span>
                          ) : (
                            <span className="text-[10px] uppercase tracking-wide text-emerald-700 inline-flex items-center gap-1 shrink-0">
                              + New
                            </span>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                  <p className="text-[11px] text-muted-foreground mt-2">
                    Generated vouchers are drafts — add lodge confirmation numbers and review before issuing.
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 p-4 border-t border-border sticky bottom-0 bg-card">
          <button onClick={onClose} className="px-3 py-2 text-sm rounded-lg hover:bg-muted">Cancel</button>
          <button
            onClick={handleGenerate}
            disabled={generating || newCount === 0 || !preview}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary disabled:opacity-50"
          >
            <Sparkles className="w-4 h-4" />
            {generating ? 'Generating...' : (newCount > 0 ? `Generate ${newCount} draft${newCount === 1 ? '' : 's'}` : 'Nothing to generate')}
          </button>
        </div>
      </div>
    </div>
  );
}
