import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { X, AlertTriangle, CreditCard } from 'lucide-react';

/**
 * Dismissible top-of-page banner shown in three scenarios:
 *  1. Trial is running low (< 3 days OR < 2 quotes remaining)
 *  2. Subscription is past_due (payment failed, grace period)
 *  3. Subscription is expired (also shows the ReadOnlyBanner — this adds upgrade CTA)
 *
 * Dismissed state is per-session (no localStorage) — reappears on next visit
 * so the user doesn't miss it.
 */
export default function PaywallBanner() {
  const { organization } = useAuth();
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(false);

  if (dismissed || !organization) return null;

  const { subscriptionStatus, plan, trialEndsAt, trialQuoteCount, trialQuoteLimit } = organization;

  // Compute trial time/quota remaining
  const now = new Date();
  const trialDaysLeft = trialEndsAt
    ? Math.max(0, Math.ceil((new Date(trialEndsAt) - now) / (1000 * 60 * 60 * 24)))
    : 0;
  const trialQuotesLeft = Math.max(0, (trialQuoteLimit || 10) - (trialQuoteCount || 0));

  const isTrialLow = plan === 'trial' && subscriptionStatus === 'trialing'
    && (trialDaysLeft < 3 || trialQuotesLeft < 2);
  const isPastDue = subscriptionStatus === 'past_due';
  const isExpired = subscriptionStatus === 'expired';

  if (!isTrialLow && !isPastDue && !isExpired) return null;

  // ── Message variants ────────────────────────────────────────────────────────
  let message, cta;

  if (isPastDue) {
    message = 'Your last payment failed. Update your payment method to avoid losing access.';
    cta = 'Update payment';
  } else if (isExpired) {
    message = 'Your trial has ended. Your data is safe — reactivate to resume full access.';
    cta = 'Reactivate';
  } else {
    // Trial low
    const parts = [];
    if (trialDaysLeft < 3) parts.push(`${trialDaysLeft} day${trialDaysLeft !== 1 ? 's' : ''} left in your trial`);
    if (trialQuotesLeft < 2) parts.push(`${trialQuotesLeft} trial quote${trialQuotesLeft !== 1 ? 's' : ''} remaining`);
    message = parts.join(' · ') + '. Upgrade to keep working without interruption.';
    cta = 'Upgrade now';
  }

  const bgClass = isPastDue
    ? 'bg-orange-50 border-orange-200 text-orange-900'
    : 'bg-amber-50 border-amber-200 text-amber-900';

  const btnClass = isPastDue
    ? 'bg-orange-600 hover:bg-orange-700 text-white'
    : 'bg-amber-600 hover:bg-amber-700 text-white';

  return (
    <div className={`border-b px-4 py-2.5 flex items-center justify-between gap-4 ${bgClass}`}>
      <div className="flex items-center gap-2 min-w-0">
        <AlertTriangle className="w-4 h-4 flex-shrink-0" />
        <p className="text-xs font-medium truncate">{message}</p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          onClick={() => navigate('/settings/billing')}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold transition-colors ${btnClass}`}
        >
          <CreditCard className="w-3.5 h-3.5" />
          {cta}
        </button>
        <button
          onClick={() => setDismissed(true)}
          className="p-1 rounded-md hover:bg-black/10 transition-colors"
          aria-label="Dismiss"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
