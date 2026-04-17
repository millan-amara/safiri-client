import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import api from '../utils/api';
import { Compass, CheckCircle } from 'lucide-react';

export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!token) { setError('No verification token'); setLoading(false); return; }
    api.get(`/auth/verify-email/${token}`)
      .then(() => { setSuccess(true); setLoading(false); })
      .catch((err) => { setError(err.response?.data?.message || 'Verification failed'); setLoading(false); });
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="bg-card rounded-xl shadow-sm border border-border p-6 sm:p-8 max-w-md w-full text-center">
        {success ? (
          <>
            <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-7 h-7 text-green-500" />
            </div>
            <h2 className="text-lg font-bold text-foreground mb-2">Email Verified!</h2>
            <p className="text-sm text-muted-foreground mb-4">Your email has been verified. You'll now receive all notifications.</p>
            <Link to="/" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary transition-colors">
              Go to Dashboard
            </Link>
          </>
        ) : (
          <>
            <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
              <span className="text-red-500 text-xl">!</span>
            </div>
            <h2 className="text-lg font-bold text-foreground mb-2">Verification Failed</h2>
            <p className="text-sm text-muted-foreground mb-4">{error}</p>
            <Link to="/" className="text-sm text-primary hover:underline">Go to Dashboard</Link>
          </>
        )}
      </div>
    </div>
  );
}
