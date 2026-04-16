import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import QuoteRenderer from '../components/quote/QuoteRenderer';

export default function QuoteSharePage() {
  const { token } = useParams();
  const [quote, setQuote] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const apiBase = import.meta.env.VITE_API_URL || '/api';
    fetch(`${apiBase}/quotes/share/${token}`)
      .then(r => { if (!r.ok) throw new Error(r.status === 410 ? 'expired' : 'not_found'); return r.json(); })
      .then(setQuote)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));

    // Track time on page
    const start = Date.now();
    return () => {
      const duration = Math.round((Date.now() - start) / 1000);
      navigator.sendBeacon?.(`${apiBase}/quotes/share/${token}/duration`, JSON.stringify({ duration }));
    };
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-3 border-amber-700 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-stone-500">Loading your itinerary...</p>
        </div>
      </div>
    );
  }

  if (error || !quote) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50 p-6">
        <div className="bg-white rounded-2xl border border-stone-200 p-8 max-w-md w-full text-center">
          <h1 className="text-xl font-bold text-stone-800 mb-2" style={{ fontFamily: 'Playfair Display, serif' }}>
            {error === 'expired' ? 'Quote Expired' : 'Quote Not Found'}
          </h1>
          <p className="text-sm text-stone-500">
            {error === 'expired'
              ? 'This quote has expired. Please contact the operator for an updated version.'
              : 'This quote link is invalid or has been removed.'}
          </p>
        </div>
      </div>
    );
  }

  return <QuoteRenderer quote={quote} token={token} previewMode={false} />;
}