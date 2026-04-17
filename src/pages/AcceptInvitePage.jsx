import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { Compass, Eye, EyeOff, CheckCircle } from 'lucide-react';
import PhoneInput from '../components/shared/PhoneInput';

export default function AcceptInvitePage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const [loading, setLoading] = useState(true);
  const [inviteData, setInviteData] = useState(null);
  const [error, setError] = useState(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!token) { setError('No invite token provided'); setLoading(false); return; }
    api.get(`/auth/invite/${token}`)
      .then(({ data }) => { setInviteData(data); setLoading(false); })
      .catch((err) => { setError(err.response?.data?.message || 'Invalid or expired invite'); setLoading(false); });
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password !== confirmPassword) { toast.error('Passwords don\'t match'); return; }
    if (password.length < 6) { toast.error('Password must be at least 6 characters'); return; }
    setSubmitting(true);
    try {
      const { data } = await api.post(`/auth/invite/${token}`, { name, password, phone });
      localStorage.setItem('token', data.token);
      setDone(true);
      setTimeout(() => { navigate('/'); window.location.reload(); }, 2000);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Setup failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="bg-card rounded-xl shadow-sm border border-border p-6 sm:p-8 max-w-md w-full text-center">
          <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
            <span className="text-red-500 text-lg">!</span>
          </div>
          <h2 className="text-lg font-bold text-foreground mb-2">Invite Link Invalid</h2>
          <p className="text-sm text-muted-foreground mb-4">{error}</p>
          <a href="/login" className="text-sm text-primary hover:underline">Go to login</a>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="bg-card rounded-xl shadow-sm border border-border p-6 sm:p-8 max-w-md w-full text-center animate-scale-in">
          <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-6 h-6 text-green-500" />
          </div>
          <h2 className="text-lg font-bold text-foreground mb-2">You're all set!</h2>
          <p className="text-sm text-muted-foreground">Redirecting you to the dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="bg-card rounded-xl shadow-sm border border-border p-6 sm:p-8 max-w-md w-full">
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center mx-auto mb-3">
            <Compass className="w-6 h-6 text-white" />
          </div>
          <h2 className="text-lg font-bold text-foreground">Set up your account</h2>
          <p className="text-sm text-muted-foreground mt-1">
            You've been invited to join <strong className="text-foreground">{inviteData?.orgName}</strong>
          </p>
          <p className="text-xs text-muted-foreground/70 mt-0.5">{inviteData?.email}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Your Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-lg bg-card border border-border text-sm text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30"
              placeholder="Full name"
              required
              autoFocus
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Password</label>
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg bg-card border border-border text-sm text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 pr-10"
                placeholder="At least 6 characters"
                required
                minLength={6}
              />
              <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/70">
                {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Confirm Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-lg bg-card border border-border text-sm text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30"
              placeholder="Repeat password"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">WhatsApp Number</label>
            <PhoneInput value={phone} onChange={setPhone} />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary transition-colors disabled:opacity-50"
          >
            {submitting ? 'Setting up...' : 'Create My Account'}
          </button>
        </form>
      </div>
    </div>
  );
}
