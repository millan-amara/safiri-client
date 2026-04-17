import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { LockKeyhole, ShieldCheck } from 'lucide-react';

/**
 * Persistent (non-dismissible) banner shown only when subscriptionStatus === 'expired'.
 *
 * Explains read-only mode clearly and reassures the user their data is safe.
 * Always visible — no way to dismiss it until the account is reactivated.
 */
export default function ReadOnlyBanner() {
  const { organization } = useAuth();
  const navigate = useNavigate();

  // Only show when truly expired (cancelled-with-active-period is not read-only)
  if (!organization) return null;

  const { subscriptionStatus, currentPeriodEnd } = organization;
  const now = new Date();

  const isReadOnly =
    subscriptionStatus === 'expired' ||
    (subscriptionStatus === 'cancelled' &&
      (!currentPeriodEnd || new Date(currentPeriodEnd) < now));

  if (!isReadOnly) return null;

  return (
    <div className="bg-red-50 border-b border-red-200 px-4 py-3">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <LockKeyhole className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-red-900">Your account is in read-only mode</p>
            <p className="text-xs text-red-700 mt-0.5 flex items-start sm:items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 sm:mt-0" />
              <span>Your data is safe. You can view everything — just reactivate to create, edit, or delete.</span>
            </p>
          </div>
        </div>
        <button
          onClick={() => navigate('/settings/billing')}
          className="flex-shrink-0 self-start sm:self-auto px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg transition-colors"
        >
          Reactivate your account
        </button>
      </div>
    </div>
  );
}
