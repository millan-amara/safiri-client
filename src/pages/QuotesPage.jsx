import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { formatCurrency, formatDate } from '../utils/helpers';
import toast from 'react-hot-toast';
import {
  FileText, Plus, Eye, Send, Clock, CheckCircle, XCircle,
  ExternalLink, Copy, Search, Trash2, Star, Edit,
} from 'lucide-react';
import ConfirmDialog from '../components/shared/ConfirmDialog';

const statusConfig = {
  draft: { color: 'bg-gray-100 text-gray-600', icon: Clock, label: 'Draft' },
  sent: { color: 'bg-blue-100 text-blue-600', icon: Send, label: 'Sent' },
  viewed: { color: 'bg-amber-100 text-amber-700', icon: Eye, label: 'Viewed' },
  accepted: { color: 'bg-green-100 text-green-700', icon: CheckCircle, label: 'Accepted' },
  rejected: { color: 'bg-red-100 text-red-600', icon: XCircle, label: 'Rejected' },
  expired: { color: 'bg-gray-100 text-gray-400', icon: Clock, label: 'Expired' },
};

export default function QuotesPage() {
  const navigate = useNavigate();
  const [quotes, setQuotes] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [deleteQuote, setDeleteQuote] = useState(null);
  const [tab, setTab] = useState('quotes');

  const fetchQuotes = () => {
    Promise.all([
      api.get('/quotes'),
      api.get('/quotes?templates=true'),
    ]).then(([q, t]) => {
      setQuotes(q.data.quotes);
      setTemplates(t.data.quotes);
    })
      .catch(() => toast.error('Failed to load quotes'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchQuotes(); }, []);

  const useTemplate = async (template) => {
    try {
      const { data } = await api.post(`/quotes/templates/${template._id}/use`, {});
      toast.success('Quote created from template');
      navigate(`/quotes/${data._id}`);
    } catch (err) {
      toast.error('Failed to use template');
    }
  };

  const copyShareLink = (token) => {
    const url = `${window.location.origin}/quote/${token}`;
    navigator.clipboard.writeText(url);
    toast.success('Share link copied!');
  };

  const filtered = quotes.filter(q =>
    !search ||
    q.title?.toLowerCase().includes(search.toLowerCase()) ||
    q.quoteNumber?.toLowerCase().includes(search.toLowerCase()) ||
    q.contact?.firstName?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-brand" style={{ fontFamily: 'Playfair Display, serif' }}>Quotes</h1>
          <p className="text-sm text-sand-500 mt-0.5">{quotes.length} total quotes</p>
        </div>
        <Link
          to="/quotes/new"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-brand text-white text-sm font-medium hover:bg-amber-700 transition-colors"
        >
          <Plus className="w-4 h-4" /> New Quote
        </Link>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-sand-200">
        {[
          { id: 'quotes', label: 'Quotes', count: quotes.length },
          { id: 'templates', label: 'Templates', count: templates.length },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors relative ${tab === t.id ? 'text-amber-brand' : 'text-sand-500 hover:text-slate-brand'}`}>
            {t.label}
            {t.count > 0 && <span className={`ml-1.5 px-1.5 py-0.5 text-xs rounded-full ${tab === t.id ? 'bg-amber-100 text-amber-700' : 'bg-sand-100 text-sand-500'}`}>{t.count}</span>}
            {tab === t.id && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-brand rounded-full" />}
          </button>
        ))}
      </div>

      {tab === 'quotes' && (
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-sand-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search quotes..."
            className="w-full pl-9 pr-3 py-2 rounded-lg bg-white border border-sand-200 text-sm focus:outline-none focus:border-amber-brand transition-colors"
          />
        </div>
      )}

      {tab === 'templates' && (
        loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="w-6 h-6 border-2 border-amber-brand border-t-transparent rounded-full animate-spin" />
          </div>
        ) : templates.length === 0 ? (
          <div className="bg-white rounded-xl border border-sand-200 p-16 text-center">
            <Star className="w-10 h-10 text-sand-300 mx-auto mb-3" />
            <p className="text-sm font-semibold text-slate-brand">No templates yet</p>
            <p className="text-xs text-sand-400 mt-1 mb-4">Save any quote as a template to reuse it for similar trips</p>
          </div>
        ) : (
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {templates.map((template) => {
              const heroImage = template.days?.find(d => d.images?.[0])?.images?.[0];
              return (
                <div key={template._id} className="bg-white rounded-xl border border-sand-200 overflow-hidden hover:border-sand-300 hover:shadow-sm transition-all group">
                  {heroImage?.url && (
                    <div className="h-32 bg-sand-100 overflow-hidden">
                      <img src={heroImage.url} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                    </div>
                  )}
                  <div className="p-4">
                    <div className="flex items-start gap-2 mb-1">
                      <Star className="w-4 h-4 text-amber-brand flex-shrink-0 mt-0.5" />
                      <p className="text-sm font-semibold text-slate-brand line-clamp-2">{template.templateName}</p>
                    </div>
                    {template.templateDescription && (
                      <p className="text-xs text-sand-500 line-clamp-2 mb-2">{template.templateDescription}</p>
                    )}
                    <div className="flex items-center gap-2 text-[10px] text-sand-400 mb-3">
                      <span>{template.days?.length || 0} days</span>
                      <span>·</span>
                      <span>{formatCurrency(template.pricing?.totalPrice || 0, template.pricing?.currency)}</span>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => useTemplate(template)} className="flex-1 px-3 py-1.5 rounded-lg bg-amber-brand text-white text-xs font-medium hover:bg-amber-700 transition-colors">
                        Use Template
                      </button>
                      <button onClick={() => navigate(`/quotes/${template._id}`)} className="px-2 py-1.5 rounded-lg border border-sand-200 text-xs text-sand-600 hover:bg-sand-50 transition-colors" title="Edit template">
                        <Edit className="w-3 h-3" />
                      </button>
                      <button onClick={() => setDeleteQuote(template)} className="px-2 py-1.5 rounded-lg border border-sand-200 text-sand-400 hover:text-red-500 hover:border-red-200 transition-colors" title="Delete">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {tab === 'quotes' && (
        loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-6 h-6 border-2 border-amber-brand border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-sand-200 p-16 text-center">
          <FileText className="w-10 h-10 text-sand-300 mx-auto mb-3" />
          <p className="text-sm font-semibold text-slate-brand">No quotes yet</p>
          <p className="text-xs text-sand-400 mt-1 mb-4">Create your first quote to get started</p>
          <Link to="/quotes/new" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-brand text-white text-sm font-medium hover:bg-amber-700 transition-colors">
            <Plus className="w-4 h-4" /> Create Quote
          </Link>
        </div>
      ) : (
        <div className="grid gap-3">
          {filtered.map((quote) => {
            const cfg = statusConfig[quote.status] || statusConfig.draft;
            const StatusIcon = cfg.icon;
            return (
              <Link
                key={quote._id}
                to={`/quotes/${quote._id}`}
                className="bg-white rounded-xl border border-sand-200 p-4 hover:border-sand-300 hover:shadow-sm transition-all group flex items-center justify-between"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-sand-100 text-sand-500 flex items-center justify-center">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-slate-brand">{quote.title}</p>
                      <span className="text-xs text-sand-400">#{quote.quoteNumber}</span>
                    </div>
                    <p className="text-xs text-sand-500 mt-0.5">
                      {quote.contact ? `${quote.contact.firstName} ${quote.contact.lastName}` : 'No contact'}
                      {quote.createdBy?.name && ` · by ${quote.createdBy.name}`}
                      {quote.startDate && ` · ${formatDate(quote.startDate)}`}
                      {quote.segments?.length > 0 && ` · ${quote.segments.length} destinations`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  {quote.tracking?.views > 0 && (
                    <span className="text-xs text-sand-500 flex items-center gap-1">
                      <Eye className="w-3 h-3" /> {quote.tracking.views}
                    </span>
                  )}
                  <div className="text-right">
                    <p className="text-sm font-bold text-slate-brand">
                      {formatCurrency(quote.pricing?.totalPrice || 0, quote.pricing?.currency)}
                    </p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full flex items-center gap-1 ${cfg.color}`}>
                    <StatusIcon className="w-3 h-3" /> {cfg.label}
                  </span>
                  <button
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); copyShareLink(quote.shareToken); }}
                    className="p-1.5 rounded-md hover:bg-sand-100 text-sand-400 opacity-0 group-hover:opacity-100 transition-all"
                    title="Copy share link"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); setDeleteQuote(quote); }}
                    className="p-1.5 rounded-md hover:bg-red-50 text-sand-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                    title="Delete quote"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </Link>
            );
          })}
        </div>
      )
      )}

      {deleteQuote && (
        <ConfirmDialog
          title="Delete this quote?"
          message={`"${deleteQuote.title}" (#${deleteQuote.quoteNumber}) will be permanently removed. The share link will stop working.`}
          confirmLabel="Delete Quote"
          onConfirm={async () => {
            await api.delete(`/quotes/${deleteQuote._id}`);
            toast.success('Quote deleted');
            setDeleteQuote(null);
            fetchQuotes();
          }}
          onCancel={() => setDeleteQuote(null)}
        />
      )}
    </div>
  );
}