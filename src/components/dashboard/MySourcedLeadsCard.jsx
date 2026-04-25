import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../utils/api';
import { formatCurrency, getInitials } from '../../utils/helpers';
import { Sprout, ChevronRight } from 'lucide-react';

// Per-user feedback view: "What happened to leads I sourced?"
// Counts deals where the current user is the createdBy, regardless of who's
// since taken them over. Critical for marketers handing leads off to sales.
export default function MySourcedLeadsCard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/crm/my-leads-stats')
      .then(({ data }) => setData(data))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading || !data) return null;
  // Don't show the card if the user has never sourced a lead — no signal to give them yet.
  if (!data.totalSourced) return null;

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-border flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
              <Sprout className="w-4 h-4 text-emerald-600" strokeWidth={1.75} />
            </div>
            <h3 className="text-sm font-semibold text-foreground">Your sourced leads</h3>
          </div>
          <p className="text-xs text-muted-foreground">
            Deals you originally created — and what happened to them.
          </p>
        </div>
        <Link
          to="/crm?sourced=me"
          className="text-xs text-primary hover:underline flex items-center gap-0.5 whitespace-nowrap"
        >
          View all <ChevronRight className="w-3 h-3" />
        </Link>
      </div>

      {/* Stat row */}
      <div className="grid grid-cols-2 sm:grid-cols-5 divide-y sm:divide-y-0 sm:divide-x divide-border">
        <Stat label="Sourced" value={data.totalSourced} />
        <Stat label="In progress" value={data.inProgress} hint="Not yet won or lost" />
        <Stat
          label="Won"
          value={data.won}
          accent="emerald"
          hint={data.wonByTeammate > 0 ? `${data.wonByMe} by you · ${data.wonByTeammate} by teammates` : undefined}
        />
        <Stat label="Lost" value={data.lost} accent="muted" />
        <Stat label="Conversion" value={`${data.conversionRate}%`} accent="amber" hint="Won ÷ closed" />
      </div>

      {/* Recent active list */}
      {data.recentActive?.length > 0 && (
        <div className="border-t border-border px-4 sm:px-6 py-3">
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground mb-2">
            Most recent activity
          </p>
          <ul className="space-y-2">
            {data.recentActive.map((deal) => (
              <li key={deal._id}>
                <Link
                  to={`/crm/deals/${deal._id}`}
                  className="flex items-center gap-3 group py-1"
                >
                  <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-medium text-primary shrink-0">
                    {deal.contact ? `${deal.contact.firstName?.[0] || ''}${deal.contact.lastName?.[0] || ''}` : '·'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">
                      {deal.title}
                    </p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {deal.pipeline?.name || 'Pipeline'} · {deal.stage}
                      {deal.assignedTo && ` · ${deal.assignedTo.name}`}
                    </p>
                  </div>
                  {deal.value > 0 && (
                    <span className="text-xs font-medium text-foreground tabular-nums shrink-0">
                      {formatCurrency(deal.value)}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, hint, accent }) {
  const valueClass =
    accent === 'emerald' ? 'text-emerald-600' :
    accent === 'amber' ? 'text-amber-600' :
    accent === 'muted' ? 'text-muted-foreground' :
    'text-foreground';
  return (
    <div className="px-4 sm:px-6 py-3">
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`text-xl sm:text-2xl font-semibold tabular-nums mt-1 ${valueClass}`}>{value}</p>
      {hint && <p className="text-[10px] text-muted-foreground/80 mt-0.5">{hint}</p>}
    </div>
  );
}
