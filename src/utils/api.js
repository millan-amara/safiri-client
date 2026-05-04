import axios from 'axios';
import { createElement } from 'react';
import toast from 'react-hot-toast';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ── 402 toast config by error code ────────────────────────────────────────────
const PAYWALL_MESSAGES = {
  SUBSCRIPTION_INACTIVE: {
    title: 'Subscription ended',
    body: 'Your trial has ended. Reactivate to continue creating content.',
  },
  TRIAL_QUOTE_LIMIT: {
    title: 'Trial quote limit reached',
    body: "You've used all your trial quotes. Upgrade to Pro for unlimited quotes.",
  },
  AI_QUOTA_EXCEEDED: {
    title: 'AI generation limit reached',
    body: 'Monthly itinerary generations exhausted. Resets on the 1st.',
  },
  TEAM_MEMBER_LIMIT: {
    title: 'Team member limit',
    body: 'Upgrade to Business for unlimited team members.',
  },
};

function show402Toast(code, serverMessage) {
  const config = PAYWALL_MESSAGES[code] || {
    title: 'Action blocked',
    body: serverMessage || 'Your current plan does not allow this action.',
  };

  toast(
    (t) =>
      createElement(
        'div',
        { style: { display: 'flex', flexDirection: 'column', gap: 2 } },
        createElement('p', { style: { margin: 0, fontWeight: 600, fontSize: 14 } }, config.title),
        createElement('p', { style: { margin: 0, fontSize: 12, color: '#6B7280' } }, config.body),
        createElement(
          'button',
          {
            onClick: () => { toast.dismiss(t.id); window.location.href = '/settings/billing'; },
            style: {
              marginTop: 6, fontSize: 12, color: '#B45309', fontWeight: 700,
              background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left',
            },
          },
          'Go to Billing →'
        )
      ),
    { duration: 8000, icon: '🔒' }
  );
}

// Routes whose own 401 response should NOT trigger an auto-logout — sign-in,
// sign-up, password reset, OAuth-code redemption are themselves auth flows
// and we want their errors handled by the form, not by a redirect.
const AUTH_ROUTE_PREFIXES = ['/auth/login', '/auth/register', '/auth/forgot-password', '/auth/reset-password', '/auth/oauth-exchange', '/auth/invite'];
const isAuthRouteUrl = (url = '') => AUTH_ROUTE_PREFIXES.some(p => url.startsWith(p) || url.includes(p));

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const isAuthRoute = isAuthRouteUrl(error.config?.url);

    if (status === 401 && !isAuthRoute) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }

    if (status === 402) {
      const code = error.response?.data?.code;
      const message = error.response?.data?.message;
      show402Toast(code, message);
    }

    return Promise.reject(error);
  }
);

// Authenticated file download. Uses the same Bearer header as the rest of the
// app so the JWT never appears in the URL (which leaks via history, Referer,
// and access logs). Triggers a browser save dialog with the chosen filename.
export async function downloadFile(path, filename) {
  const response = await api.get(path, { responseType: 'blob' });
  const blob = response.data;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || 'download';
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoke async to give the browser a chance to start the download.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export default api;