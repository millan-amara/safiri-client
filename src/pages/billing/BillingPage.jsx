import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import {
  CreditCard, Zap, Users, Sparkles, CheckCircle2, AlertCircle,
  Clock, FileText, RefreshCw, ExternalLink, XCircle,
} from 'lucide-react';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatKes(kobo) {
  return new Intl.NumberFormat('en-KE', {
    style: 'currency', currency: 'KES', minimumFractionDigits: 0,
  }).format(kobo / 100);
}

function StatusBadge({ status }) {
  const styles = {
    trialing:  'bg-amber-100 text-amber-800',
    active:    'bg-green-100 text-green-800',
    past_due:  'bg-orange-100 text-orange-800',
    cancelled: 'bg-slate-100 text-slate-700',
    expired:   'bg-red-100 text-red-700',
  };
  const labels = {
    trialing: 'Trial', active: 'Active', past_due: 'Payment overdue',
    cancelled: 'Cancelled', expired: 'Expired',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${styles[status] || 'bg-slate-100 text-slate-600'}`}>
      {labels[status] || status}
    </span>
  );
}

function PlanBadge({ plan }) {
  const styles = {
    trial:      'bg-amber-100 text-amber-800',
    pro:        'bg-blue-100 text-blue-800',
    business:   'bg-purple-100 text-purple-800',
    enterprise: 'bg-slate-800 text-white',
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold tracking-wide uppercase ${styles[plan] || 'bg-slate-100'}`}>
      {plan}
    </span>
  );
}

function UsageBar({ used, limit, label, resetAt }) {
  const pct = limit >= 999000 ? 0 : Math.min(100, Math.round((used / limit) * 100));
  const isUnlimited = limit >= 999000;
  const isWarning = !isUnlimited && pct >= 80;
  const isDanger  = !isUnlimited && pct >= 100;

  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1.5">
        <span className="text-muted-foreground font-medium">{label}</span>
        <span className={`font-semibold ${isDanger ? 'text-red-600' : isWarning ? 'text-orange-600' : 'text-foreground'}`}>
          {isUnlimited ? '∞ unlimited' : `${used} / ${limit}`}
        </span>
      </div>
      {!isUnlimited && (
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${isDanger ? 'bg-red-500' : isWarning ? 'bg-orange-400' : 'bg-primary'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
      {resetAt && !isUnlimited && (
        <p className="text-[11px] text-muted-foreground mt-1">
          Resets {new Date(resetAt).toLocaleDateString('en-KE', { day: 'numeric', month: 'long' })}
        </p>
      )}
    </div>
  );
}

// ─── Plan cards ───────────────────────────────────────────────────────────────

const PLANS = [
  {
    key: 'pro',
    name: 'Pro',
    priceKobo: 499900,
    period: '/month',
    tagline: 'For growing safari businesses',
    features: [
      'Up to 6 team members',
      'Unlimited contacts, deals & quotes',
      '20 AI itinerary generations / month',
      'AI deal summaries & email drafts',
      'WhatsApp workflow notifications',
    ],
  },
  {
    key: 'business',
    name: 'Business',
    priceKobo: 1299900,
    period: '/month',
    tagline: 'For established operators',
    features: [
      'Unlimited team members',
      'Everything in Pro',
      'Unlimited AI itinerary generations',
      'White-label quote share pages',
      'API access (coming soon)',
    ],
    highlighted: true,
  },
];

// ─── Main page ────────────────────────────────────────────────────────────────

export default function BillingPage() {
  const { refreshOrganization } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [billing, setBilling] = useState(null);
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState(null); // plan key being checked out
  const [cancelling, setCancelling] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);

  const fetchBilling = useCallback(async () => {
    try {
      const { data } = await api.get('/billing/status');
      setBilling(data);
    } catch (err) {
      toast.error('Could not load billing information.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBilling();
  }, [fetchBilling]);

  // Handle post-payment redirect params
  useEffect(() => {
    const success = searchParams.get('success');
    const plan    = searchParams.get('plan');
    const error   = searchParams.get('error');

    if (success === 'true') {
      toast.success(plan ? `Upgraded to ${plan.charAt(0).toUpperCase() + plan.slice(1)}! Welcome aboard.` : 'Payment successful!');
      fetchBilling();
      refreshOrganization();
    }
    if (error) {
      const msgs = {
        payment_failed: 'Payment was not completed.',
        missing_reference: 'Payment reference missing — please try again.',
        server_error: 'Something went wrong verifying your payment. Contact support.',
      };
      toast.error(msgs[error] || 'Payment error. Please try again.');
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleUpgrade = async (planKey) => {
    setUpgrading(planKey);
    try {
      const { data } = await api.post('/billing/checkout', { plan: planKey });
      window.location.href = data.authorizationUrl;
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not start checkout. Please try again.');
      setUpgrading(null);
    }
  };

  const handleCancel = async () => {
    setCancelling(true);
    try {
      const { data } = await api.post('/billing/cancel');
      toast.success(data.message);
      setConfirmCancel(false);
      fetchBilling();
      refreshOrganization();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Cancellation failed. Please try again.');
    } finally {
      setCancelling(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!billing) {
    return (
      <div className="text-center py-16">
        <p className="text-muted-foreground text-sm">Could not load billing information.</p>
        <button onClick={fetchBilling} className="mt-3 text-sm text-primary underline">Retry</button>
      </div>
    );
  }

  const {
    subscriptionStatus, plan, trialEndsAt, trialDaysLeft, trialQuotesLeft,
    trialQuoteCount, trialQuoteLimit, currentPeriodEnd,
    aiItineraryGenerationsUsed, aiItineraryGenerationsLimit, aiCreditsResetAt,
    paystackSubscriptionCode,
  } = billing;

  const isPaidPlan = plan === 'pro' || plan === 'business';
  const canCancel  = isPaidPlan && paystackSubscriptionCode && subscriptionStatus === 'active';

  return (
    <div className="space-y-8 animate-fade-in max-w-2xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground" style={{ fontFamily: 'Playfair Display, serif' }}>
          Billing &amp; Subscription
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">Manage your plan and payment details</p>
      </div>

      {/* Current plan card */}
      <div className="bg-card border border-border rounded-xl p-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-1">Current plan</p>
            <div className="flex items-center gap-2">
              <PlanBadge plan={plan} />
              <StatusBadge status={subscriptionStatus} />
            </div>
          </div>
          {isPaidPlan && currentPeriodEnd && (
            <div className="text-right">
              <p className="text-xs text-muted-foreground">
                {subscriptionStatus === 'cancelled' ? 'Access until' : 'Renews'}
              </p>
              <p className="text-sm font-semibold text-foreground">
                {new Date(currentPeriodEnd).toLocaleDateString('en-KE', { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            </div>
          )}
        </div>

        {/* Trial countdown */}
        {plan === 'trial' && subscriptionStatus === 'trialing' && (
          <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border">
            <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
              <Clock className="w-4 h-4 text-amber-600 flex-shrink-0" />
              <div>
                <p className="text-lg font-bold text-foreground leading-none">{trialDaysLeft}</p>
                <p className="text-xs text-muted-foreground">day{trialDaysLeft !== 1 ? 's' : ''} left</p>
              </div>
            </div>
            <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
              <FileText className="w-4 h-4 text-amber-600 flex-shrink-0" />
              <div>
                <p className="text-lg font-bold text-foreground leading-none">{trialQuotesLeft}</p>
                <p className="text-xs text-muted-foreground">quote{trialQuotesLeft !== 1 ? 's' : ''} remaining</p>
              </div>
            </div>
          </div>
        )}

        {/* AI usage */}
        <div className="pt-2 border-t border-border">
          <UsageBar
            used={aiItineraryGenerationsUsed}
            limit={aiItineraryGenerationsLimit}
            label="AI itinerary generations this month"
            resetAt={aiCreditsResetAt}
          />
        </div>

        {/* Cancel link */}
        {canCancel && !confirmCancel && (
          <div className="pt-1">
            <button
              onClick={() => setConfirmCancel(true)}
              className="text-xs text-muted-foreground hover:text-red-600 underline transition-colors"
            >
              Cancel subscription
            </button>
          </div>
        )}

        {/* Cancel confirmation */}
        {confirmCancel && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg space-y-3">
            <p className="text-sm font-semibold text-red-900">Cancel your subscription?</p>
            <p className="text-xs text-red-700">
              You'll keep full access until{' '}
              {currentPeriodEnd
                ? new Date(currentPeriodEnd).toLocaleDateString('en-KE', { day: 'numeric', month: 'long' })
                : 'the end of your billing period'}
              . Your data is never deleted.
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleCancel}
                disabled={cancelling}
                className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg disabled:opacity-50 transition-colors"
              >
                {cancelling ? 'Cancelling…' : 'Yes, cancel'}
              </button>
              <button
                onClick={() => setConfirmCancel(false)}
                className="px-4 py-1.5 bg-muted text-muted-foreground hover:text-foreground text-xs font-semibold rounded-lg transition-colors"
              >
                Keep subscription
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Upgrade plans */}
      {plan !== 'enterprise' && (
        <div>
          <h2 className="text-base font-semibold text-foreground mb-4">
            {isPaidPlan ? 'Change plan' : 'Upgrade your plan'}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {PLANS.filter((p) => p.key !== plan).map((p) => (
              <div
                key={p.key}
                className={`relative bg-card border rounded-xl p-5 flex flex-col gap-4 ${
                  p.highlighted ? 'border-primary shadow-sm' : 'border-border'
                }`}
              >
                {p.highlighted && (
                  <span className="absolute -top-2.5 left-4 px-2.5 py-0.5 bg-primary text-white text-[10px] font-bold uppercase tracking-wide rounded-full">
                    Most popular
                  </span>
                )}

                <div>
                  <p className="font-semibold text-foreground">{p.name}</p>
                  <p className="text-xs text-muted-foreground">{p.tagline}</p>
                  <p className="mt-2 text-2xl font-bold text-foreground">
                    {formatKes(p.priceKobo)}
                    <span className="text-sm font-normal text-muted-foreground">{p.period}</span>
                  </p>
                </div>

                <ul className="space-y-1.5 flex-1">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-xs text-muted-foreground">
                      <CheckCircle2 className="w-3.5 h-3.5 text-green-500 flex-shrink-0 mt-0.5" />
                      {f}
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => handleUpgrade(p.key)}
                  disabled={upgrading === p.key}
                  className={`w-full py-2 rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-60 ${
                    p.highlighted
                      ? 'bg-primary hover:bg-primary/90 text-white'
                      : 'bg-muted hover:bg-muted/80 text-foreground'
                  }`}
                >
                  {upgrading === p.key ? (
                    <><RefreshCw className="w-4 h-4 animate-spin" /> Redirecting…</>
                  ) : (
                    <><CreditCard className="w-4 h-4" /> Upgrade to {p.name}</>
                  )}
                </button>
              </div>
            ))}
          </div>

          <p className="text-xs text-muted-foreground mt-3 text-center">
            Payments processed securely by Paystack · No hidden fees · Cancel anytime
          </p>
        </div>
      )}

      {plan === 'enterprise' && (
        <div className="bg-card border border-border rounded-xl p-6 text-center">
          <Sparkles className="w-8 h-8 text-primary mx-auto mb-2" />
          <p className="font-semibold text-foreground">Enterprise plan</p>
          <p className="text-xs text-muted-foreground mt-1">
            Your account has custom pricing and unlimited everything.
            Contact your account manager for any changes.
          </p>
        </div>
      )}
    </div>
  );
}
