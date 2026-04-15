import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import {
  CreditCard, Sparkles, CheckCircle2, Clock, FileText, RefreshCw,
} from 'lucide-react';

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Sentinel for "unlimited" — must match server/config/plans.js UNLIMITED.
const UNLIMITED_THRESHOLD = 1_000_000;
const isUnlimited = (n) => typeof n === 'number' && n >= UNLIMITED_THRESHOLD;

const fmtKes = (kes) => new Intl.NumberFormat('en-KE', {
  style: 'currency', currency: 'KES', minimumFractionDigits: 0,
}).format(kes);

const planLabel = (key) => key.charAt(0).toUpperCase() + key.slice(1);

function StatusBadge({ status }) {
  const styles = {
    trialing: 'bg-amber-100 text-amber-800', active: 'bg-green-100 text-green-800',
    past_due: 'bg-orange-100 text-orange-800', cancelled: 'bg-slate-100 text-slate-700',
    expired: 'bg-red-100 text-red-700',
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
    trial: 'bg-amber-100 text-amber-800', starter: 'bg-sky-100 text-sky-800',
    pro: 'bg-blue-100 text-blue-800', business: 'bg-purple-100 text-purple-800',
    enterprise: 'bg-slate-800 text-white',
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold tracking-wide uppercase ${styles[plan] || 'bg-slate-100'}`}>
      {plan}
    </span>
  );
}

function UsageBar({ used, limit, label, resetAt }) {
  const unlimited = isUnlimited(limit);
  const pct = unlimited ? 0 : Math.min(100, Math.round(((used || 0) / limit) * 100));
  const warn = !unlimited && pct >= 80;
  const danger = !unlimited && pct >= 100;

  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1.5">
        <span className="text-muted-foreground font-medium">{label}</span>
        <span className={`font-semibold ${danger ? 'text-red-600' : warn ? 'text-orange-600' : 'text-foreground'}`}>
          {unlimited ? '∞ unlimited' : `${used || 0} / ${limit}`}
        </span>
      </div>
      {!unlimited && (
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${danger ? 'bg-red-500' : warn ? 'bg-orange-400' : 'bg-primary'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
      {resetAt && !unlimited && (
        <p className="text-[11px] text-muted-foreground mt-1">
          Resets {new Date(resetAt).toLocaleDateString('en-KE', { day: 'numeric', month: 'long' })}
        </p>
      )}
    </div>
  );
}

// Build the bullet list shown on each plan card from the catalog entry.
function planFeatures(p) {
  const seats = isUnlimited(p.seats) ? 'Unlimited team members' : `Up to ${p.seats} team members`;
  const quotes = isUnlimited(p.quotesPerMonth) ? 'Unlimited quotes' : `${p.quotesPerMonth} quotes / month`;
  const credits = `${p.aiCredits.toLocaleString()} AI credits / month`;
  const features = [seats, quotes, credits];

  const caps = p.partnerCaps || {};
  const hotelsCap = isUnlimited(caps.hotel) ? 'Unlimited' : caps.hotel;
  const actsCap   = isUnlimited(caps.activity) ? 'Unlimited' : caps.activity;
  features.push(`${hotelsCap} hotels · ${actsCap} activities`);
  if (!isUnlimited(p.maxImagesPerRecord)) features.push(`${p.maxImagesPerRecord} images per record`);
  if (p.pipelines && !isUnlimited(p.pipelines)) features.push(`${p.pipelines} pipeline${p.pipelines === 1 ? '' : 's'}`);
  else if (isUnlimited(p.pipelines)) features.push('Unlimited pipelines');
  if (p.csvImportRows && !isUnlimited(p.csvImportRows)) features.push(`CSV imports up to ${p.csvImportRows.toLocaleString()} rows`);

  if (p.whiteLabel) features.push('White-label quote share pages');
  features.push(p.whatsapp ? 'WhatsApp notifications' : 'Email notifications');
  if (p.webhooks) features.push('Webhooks (Zapier, n8n)');
  if (p.customPdfPresets) features.push('Custom PDF presets');
  return features;
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function BillingPage() {
  const { refreshOrganization } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const [billing, setBilling] = useState(null);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [annual, setAnnual] = useState(false);
  const [upgrading, setUpgrading] = useState(null);
  const [cancelling, setCancelling] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);

  const fetchAll = useCallback(async () => {
    try {
      const [{ data: billingData }, { data: plansData }] = await Promise.all([
        api.get('/billing/status'),
        api.get('/billing/plans'),
      ]);
      setBilling(billingData);
      setPlans(plansData.plans || []);
    } catch {
      toast.error('Could not load billing information.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Handle post-payment redirect params
  useEffect(() => {
    const success = searchParams.get('success');
    const planParam = searchParams.get('plan');
    const error = searchParams.get('error');

    if (success === 'true') {
      toast.success(planParam ? `Upgraded to ${planLabel(planParam)}! Welcome aboard.` : 'Payment successful!');
      fetchAll();
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
    if (success || error) setSearchParams({}, { replace: true });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleUpgrade = async (planKey) => {
    setUpgrading(planKey);
    try {
      const { data } = await api.post('/billing/checkout', { plan: planKey, annual });
      window.location.href = data.authorizationUrl;
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not start checkout. Please try again.');
      setUpgrading(null);
    }
  };

  const handleScheduleDowngrade = async (planKey) => {
    if (!window.confirm(`Schedule a downgrade to ${planLabel(planKey)}? You'll keep your current plan until the end of this billing period, then move automatically.`)) return;
    setUpgrading(planKey);
    try {
      const { data } = await api.post('/billing/schedule-downgrade', { plan: planKey });
      toast.success(data.message);
      fetchAll();
      refreshOrganization();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not schedule downgrade.');
    } finally {
      setUpgrading(null);
    }
  };

  const handleCancelDowngrade = async () => {
    try {
      const { data } = await api.post('/billing/cancel-downgrade');
      toast.success(data.message);
      fetchAll();
      refreshOrganization();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not cancel downgrade.');
    }
  };

  const handleCancel = async () => {
    setCancelling(true);
    try {
      const { data } = await api.post('/billing/cancel');
      toast.success(data.message);
      setConfirmCancel(false);
      fetchAll();
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
        <button onClick={fetchAll} className="mt-3 text-sm text-primary underline">Retry</button>
      </div>
    );
  }

  const {
    subscriptionStatus, plan, trialDaysLeft, trialQuotesLeft, currentPeriodEnd,
    aiCreditsUsed, aiCreditsLimit, aiCreditsResetAt,
    paystackSubscriptionCode, pendingPlan,
  } = billing;

  const selfServePlans = plans.filter((p) => p.selfServe);
  const currentPlanRow = plans.find((p) => p.key === plan);
  const currentPriceKes = currentPlanRow?.monthlyPriceKES ?? 0;
  const isPaidPlan = ['starter', 'pro', 'business'].includes(plan);
  const canCancel = isPaidPlan && paystackSubscriptionCode && subscriptionStatus === 'active';

  return (
    <div className="space-y-8 animate-fade-in max-w-3xl">
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
              {billing.annual && <span className="text-[10px] uppercase font-bold text-green-700 bg-green-50 px-1.5 py-0.5 rounded">Annual</span>}
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

        <div className="pt-2 border-t border-border">
          <UsageBar
            used={aiCreditsUsed}
            limit={aiCreditsLimit}
            label="AI credits this month (heavy=10 · medium=3 · light=1)"
            resetAt={aiCreditsResetAt}
          />
        </div>

        {pendingPlan && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-3">
            <Clock className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1 text-xs">
              <p className="font-semibold text-amber-900">Scheduled downgrade to {planLabel(pendingPlan)}</p>
              <p className="text-amber-800 mt-0.5">
                You'll keep {planLabel(plan)} access until{' '}
                {currentPeriodEnd
                  ? new Date(currentPeriodEnd).toLocaleDateString('en-KE', { day: 'numeric', month: 'long', year: 'numeric' })
                  : 'period end'}
                , then switch to {planLabel(pendingPlan)} automatically.
              </p>
              <button
                onClick={handleCancelDowngrade}
                className="mt-1.5 text-amber-900 underline font-medium hover:text-amber-700"
              >
                Cancel scheduled downgrade
              </button>
            </div>
          </div>
        )}

        {canCancel && !confirmCancel && !pendingPlan && (
          <div className="pt-1">
            <button
              onClick={() => setConfirmCancel(true)}
              className="text-xs text-muted-foreground hover:text-red-600 underline transition-colors"
            >
              Cancel subscription
            </button>
          </div>
        )}

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

      {/* Plan picker */}
      {plan !== 'enterprise' && !pendingPlan && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-foreground">
              {isPaidPlan ? 'Change plan' : 'Choose your plan'}
            </h2>
            <div className="inline-flex items-center bg-muted rounded-lg p-0.5 text-xs">
              <button
                onClick={() => setAnnual(false)}
                className={`px-3 py-1 rounded-md font-medium transition-colors ${!annual ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground'}`}
              >
                Monthly
              </button>
              <button
                onClick={() => setAnnual(true)}
                className={`px-3 py-1 rounded-md font-medium transition-colors ${annual ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground'}`}
              >
                Annual <span className="text-green-600 font-bold">·2 months free</span>
              </button>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            {selfServePlans.filter((p) => p.key !== plan).map((p) => {
              const isDowngrade = p.monthlyPriceKES < currentPriceKes;
              const actionLabel = isDowngrade ? 'Downgrade to' : 'Upgrade to';
              const price = annual ? p.annualPriceKES : p.monthlyPriceKES;
              const period = annual ? '/year' : '/month';
              const highlighted = p.key === 'pro';

              return (
                <div
                  key={p.key}
                  className={`relative bg-card border rounded-xl p-5 flex flex-col gap-4 ${
                    highlighted ? 'border-primary shadow-sm' : 'border-border'
                  }`}
                >
                  {highlighted && (
                    <span className="absolute -top-2.5 left-4 px-2.5 py-0.5 bg-primary text-white text-[10px] font-bold uppercase tracking-wide rounded-full">
                      Most popular
                    </span>
                  )}

                  <div>
                    <p className="font-semibold text-foreground">{p.label}</p>
                    <p className="mt-2 text-2xl font-bold text-foreground">
                      {fmtKes(price)}
                      <span className="text-sm font-normal text-muted-foreground">{period}</span>
                    </p>
                    {annual && (
                      <p className="text-[11px] text-green-700 font-medium mt-0.5">
                        Saves {fmtKes(p.monthlyPriceKES * 2)} vs monthly
                      </p>
                    )}
                  </div>

                  <ul className="space-y-1.5 flex-1">
                    {planFeatures(p).map((f) => (
                      <li key={f} className="flex items-start gap-2 text-xs text-muted-foreground">
                        <CheckCircle2 className="w-3.5 h-3.5 text-green-500 flex-shrink-0 mt-0.5" />
                        {f}
                      </li>
                    ))}
                  </ul>

                  <button
                    onClick={() => (isDowngrade ? handleScheduleDowngrade(p.key) : handleUpgrade(p.key))}
                    disabled={upgrading === p.key}
                    className={`w-full py-2 rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-60 ${
                      highlighted
                        ? 'bg-primary hover:bg-primary/90 text-white'
                        : 'bg-muted hover:bg-muted/80 text-foreground'
                    }`}
                  >
                    {upgrading === p.key ? (
                      <><RefreshCw className="w-4 h-4 animate-spin" /> Redirecting…</>
                    ) : (
                      <><CreditCard className="w-4 h-4" /> {actionLabel} {p.label}</>
                    )}
                  </button>
                </div>
              );
            })}
          </div>

          <p className="text-xs text-muted-foreground mt-3 text-center">
            Need more? <a href="mailto:sales@safiripro.com" className="underline text-primary">Talk to sales about Enterprise</a> · Payments via Paystack · Cancel anytime
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
