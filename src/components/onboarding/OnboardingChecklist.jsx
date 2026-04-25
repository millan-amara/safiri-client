import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import { CheckCircle2, Circle, X, ChevronRight, Sparkles, RotateCcw } from 'lucide-react';

// Dashboard onboarding card. Self-fetches status on mount, hides itself when
// dismissed or when every relevant item is complete (or skipped).
//
// Pass `forceShow` to bypass the dismissed flag — used by the "Getting started"
// sidebar link, which calls /onboarding/reopen and then mounts this with forceShow.
export default function OnboardingChecklist({ forceShow = false }) {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const refetch = async () => {
    try {
      const { data } = await api.get('/onboarding/status');
      setStatus(data);
    } catch {
      // silent — checklist is optional UX, never block the dashboard
      setStatus(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refetch();
  }, []);

  if (loading) return null;
  if (!status) return null;

  const { items, progress, dismissed } = status;
  const allDone = progress.completed >= progress.total;

  // Hide if user dismissed or finished everything — unless caller forces it.
  if (!forceShow && (dismissed || allDone)) return null;

  const handleDismiss = async () => {
    setBusy(true);
    try {
      await api.post('/onboarding/dismiss');
      setStatus({ ...status, dismissed: true });
    } catch {
      toast.error('Could not hide');
    } finally {
      setBusy(false);
    }
  };

  const handleSkipItem = async (itemId) => {
    setBusy(true);
    try {
      await api.post('/onboarding/dismiss-item', { itemId });
      await refetch();
    } catch {
      toast.error('Could not skip');
    } finally {
      setBusy(false);
    }
  };

  const handleRestoreItem = async (itemId) => {
    setBusy(true);
    try {
      await api.post('/onboarding/restore-item', { itemId });
      await refetch();
    } catch {
      toast.error('Could not restore');
    } finally {
      setBusy(false);
    }
  };

  const pct = progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 0;

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-border flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4 text-amber-600" strokeWidth={1.75} />
            </div>
            <h3 className="text-sm font-semibold text-foreground">Getting started</h3>
            <span className="text-xs text-muted-foreground tabular-nums">
              {progress.completed} / {progress.total}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            {allDone
              ? 'You\'re all set — nice work.'
              : 'A few quick steps to get the most out of SafiriPro.'}
          </p>
          {/* Progress bar */}
          <div className="mt-3 h-1.5 w-full bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-amber-500 transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
        <button
          onClick={handleDismiss}
          disabled={busy}
          className="text-muted-foreground/70 hover:text-foreground p-1 rounded-md hover:bg-muted transition-colors disabled:opacity-50 shrink-0"
          title="Hide for now (you can reopen from the sidebar)"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Items */}
      <ul className="divide-y divide-border">
        {items.map((item) => {
          const done = item.completed;
          const skipped = item.skipped;
          return (
            <li
              key={item.id}
              className={`group px-4 sm:px-6 py-3 flex items-start gap-3 transition-colors ${
                done || skipped ? 'opacity-60' : 'hover:bg-muted/40'
              }`}
            >
              <div className="mt-0.5 shrink-0">
                {done ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" strokeWidth={2} />
                ) : skipped ? (
                  <CheckCircle2 className="w-5 h-5 text-muted-foreground/60" strokeWidth={2} />
                ) : (
                  <Circle className="w-5 h-5 text-muted-foreground/50" strokeWidth={1.5} />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className={`text-sm font-medium ${done || skipped ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                  {item.label}
                  {skipped && <span className="ml-2 text-[10px] text-muted-foreground/70 font-normal italic">(skipped)</span>}
                </p>
                {!done && !skipped && item.description && (
                  <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {!done && !skipped && item.link && (
                  <Link
                    to={item.link}
                    className="text-xs text-primary hover:underline flex items-center gap-0.5 whitespace-nowrap"
                  >
                    {item.linkLabel || 'Go'} <ChevronRight className="w-3 h-3" />
                  </Link>
                )}
                {!done && !skipped && item.dismissable && (
                  <button
                    onClick={() => handleSkipItem(item.id)}
                    disabled={busy}
                    className="text-[10px] text-muted-foreground/70 hover:text-foreground hover:underline whitespace-nowrap disabled:opacity-50"
                    title={item.dismissLabel}
                  >
                    {item.dismissLabel || 'Skip'}
                  </button>
                )}
                {skipped && item.dismissable && (
                  <button
                    onClick={() => handleRestoreItem(item.id)}
                    disabled={busy}
                    className="text-[10px] text-muted-foreground/70 hover:text-foreground flex items-center gap-0.5 disabled:opacity-50"
                    title="Restore this step"
                  >
                    <RotateCcw className="w-3 h-3" /> Restore
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
