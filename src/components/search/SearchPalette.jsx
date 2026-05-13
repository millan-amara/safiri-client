import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X, Loader2, Sparkles, MapPin, Calendar, Users, Wallet, Tag, Globe, ArrowRight, Image as ImageIcon, AlertTriangle, CheckCircle2 } from 'lucide-react';
import api from '../../utils/api';
import SearchResultCard from './SearchResultCard';

const EXAMPLES = [
  'tented camp in Maasai Mara for 2 adults',
  'luxury lodge in Amboseli July budget $5000 USD',
  'What\'s the cancellation policy for Mara Serena?',
  'Hotels missing rate lists',
  'Rate lists expiring this month',
];

function formatDateRange(range) {
  if (!range?.from && !range?.to) return null;
  const fmt = (s) => {
    if (!s) return '';
    const d = new Date(s);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };
  if (range.from && range.to) return `${fmt(range.from)} → ${fmt(range.to)}`;
  return fmt(range.from || range.to);
}

function ParsedChip({ icon: Icon, children }) {
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-amber-brand/10 text-amber-brand">
      <Icon className="w-3 h-3" />
      {children}
    </span>
  );
}

const NATIONALITY_LABELS = { citizen: 'citizen', resident: 'resident', nonResident: 'non-resident' };

function ParsedSummary({ parsed, quoteCurrency }) {
  if (!parsed) return null;
  const dateLabel = formatDateRange(parsed.dateRange);
  const paxLabel = parsed.adults || parsed.children?.length
    ? `${parsed.adults || 0} adult${parsed.adults === 1 ? '' : 's'}${parsed.children?.length ? `, ${parsed.children.length} child${parsed.children.length === 1 ? '' : 'ren'}` : ''}`
    : null;
  const budgetLabel = parsed.budgetMax
    ? `≤ ${new Intl.NumberFormat('en-US', { style: 'currency', currency: parsed.currency || quoteCurrency || 'USD', maximumFractionDigits: 0 }).format(parsed.budgetMax)}`
    : null;
  const clientTypeLabel = parsed.clientType ? `${parsed.clientType} rate` : null;
  const nationalityLabel = parsed.nationality ? NATIONALITY_LABELS[parsed.nationality] : null;

  if (!parsed.destinationName && !dateLabel && !paxLabel && !budgetLabel && !clientTypeLabel && !nationalityLabel && !parsed.mustHave?.length) {
    return null;
  }

  return (
    <div className="px-4 py-2 border-b border-sand-100 flex flex-wrap gap-1.5 items-center">
      <span className="text-[10px] uppercase tracking-wide text-sand-500 font-semibold mr-1">Understood as</span>
      {parsed.type && (
        <span className="inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-brand/10 text-slate-brand capitalize">
          {parsed.type}
        </span>
      )}
      {parsed.destinationName && <ParsedChip icon={MapPin}>{parsed.destinationName}</ParsedChip>}
      {dateLabel && <ParsedChip icon={Calendar}>{dateLabel}</ParsedChip>}
      {paxLabel && <ParsedChip icon={Users}>{paxLabel}</ParsedChip>}
      {clientTypeLabel && <ParsedChip icon={Tag}>{clientTypeLabel}</ParsedChip>}
      {nationalityLabel && <ParsedChip icon={Globe}>{nationalityLabel}</ParsedChip>}
      {budgetLabel && <ParsedChip icon={Wallet}>{budgetLabel}</ParsedChip>}
      {parsed.mustHave?.map((t, i) => (
        <span key={i} className="inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded-full bg-sand-100 text-sand-700">
          {t}
        </span>
      ))}
    </div>
  );
}

const TOPIC_LABELS = {
  cancellation_policy: 'Cancellation policy',
  child_policy: 'Child policy',
  inclusions: 'Inclusions',
  exclusions: 'Exclusions',
  fees: 'Fees & levies',
  rates: 'Rates',
  rooms: 'Rooms',
  amenities: 'Amenities',
  general: 'Overview',
};

function DiagnosticHeader({ label, totalCount, canonical }) {
  return (
    <div className="px-4 py-3 border-b border-sand-100 flex items-center gap-2">
      <AlertTriangle className="w-4 h-4 text-amber-brand flex-shrink-0" />
      <span className="text-sm font-semibold text-slate-brand">{label}</span>
      <span className="text-xs text-sand-500">
        · {totalCount} {totalCount === 1 ? 'item' : 'items'}{canonical ? ` in ${canonical}` : ''}
      </span>
    </div>
  );
}

function DiagnosticItem({ item, onSelect }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(item)}
      className="w-full text-left px-4 py-3 hover:bg-sand-50 transition-colors border-b border-sand-100 last:border-b-0 group flex items-start gap-3"
    >
      <div className="w-10 h-10 rounded-lg bg-sand-100 flex-shrink-0 overflow-hidden flex items-center justify-center">
        {item.image
          ? <img src={item.image} alt="" className="w-full h-full object-cover" />
          : <ImageIcon className="w-4 h-4 text-sand-400" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-slate-brand truncate">{item.name}</span>
          {item.destination && (
            <span className="text-[11px] text-sand-500 truncate">· {item.destination}</span>
          )}
        </div>
        <p className="mt-0.5 text-xs text-sand-600 line-clamp-2">{item.issueDetail}</p>
      </div>
      <ArrowRight className="w-4 h-4 text-sand-400 group-hover:text-amber-brand flex-shrink-0 mt-1 transition-colors" />
    </button>
  );
}

function DiagnosticClean({ label }) {
  return (
    <div className="px-4 py-10 text-center">
      <div className="inline-flex w-10 h-10 rounded-full bg-green-50 text-green-600 items-center justify-center mb-3">
        <CheckCircle2 className="w-5 h-5" />
      </div>
      <p className="text-sm text-slate-brand font-medium mb-1">Nothing to fix</p>
      <p className="text-xs text-sand-600">No partners match the "{label}" check.</p>
    </div>
  );
}

function LookupAnswer({ lookup, answer, onView }) {
  return (
    <div className="px-5 py-5">
      {/* Partner header */}
      <div className="flex items-start gap-3">
        <div className="w-12 h-12 rounded-lg bg-sand-100 overflow-hidden flex-shrink-0 flex items-center justify-center">
          {lookup.image
            ? <img src={lookup.image} alt="" className="w-full h-full object-cover" />
            : <ImageIcon className="w-5 h-5 text-sand-400" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-slate-brand truncate">{lookup.name}</div>
          <div className="text-[11px] text-sand-500 truncate capitalize">
            {lookup.kind}
            {lookup.destination ? ` · ${lookup.destination}` : ''}
            {lookup.location ? ` · ${lookup.location}` : ''}
          </div>
        </div>
        <span className="inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded-full bg-amber-brand/10 text-amber-brand whitespace-nowrap">
          {TOPIC_LABELS[lookup.topic] || 'Overview'}
        </span>
      </div>

      {/* Answer body — derived from operator's own data, never hallucinated. */}
      {answer ? (
        <div className="mt-4 flex items-start gap-2">
          <Sparkles className="w-3.5 h-3.5 text-amber-brand mt-1 flex-shrink-0" />
          <p className="text-sm text-slate-brand leading-relaxed whitespace-pre-wrap">{answer}</p>
        </div>
      ) : (
        <p className="mt-4 text-xs text-sand-500 italic">
          Couldn't generate an answer right now. Open the partner to view the underlying data directly.
        </p>
      )}

      {/* Action — deep-link to PartnersPage so the operator can verify. */}
      <button
        type="button"
        onClick={onView}
        className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-amber-brand hover:underline"
      >
        View partner <ArrowRight className="w-3 h-3" />
      </button>
    </div>
  );
}

export default function SearchPalette({ open, onClose }) {
  const [query, setQuery] = useState('');
  const [response, setResponse] = useState(null);
  const [loading, setLoading] = useState(false);
  const [rationalesLoading, setRationalesLoading] = useState(false);
  const [error, setError] = useState(null);
  const inputRef = useRef(null);
  const navigate = useNavigate();
  const reqIdRef = useRef(0);

  // Reset state every time the palette opens.
  useEffect(() => {
    if (open) {
      setQuery('');
      setResponse(null);
      setError(null);
      setLoading(false);
      setRationalesLoading(false);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  // Esc to close.
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Debounced search. The reqId guards against an earlier-but-slower response
  // overwriting a later result if the user typed faster than the network.
  useEffect(() => {
    if (!open) return;
    const trimmed = query.trim();
    if (!trimmed) {
      setResponse(null);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    const myId = ++reqIdRef.current;
    const timer = setTimeout(async () => {
      try {
        const res = await api.post('/search', { query: trimmed });
        if (myId !== reqIdRef.current) return;
        setResponse(res.data);
      } catch (err) {
        if (myId !== reqIdRef.current) return;
        // 402 paywall is already toasted by the global axios interceptor.
        if (err.response?.status !== 402) {
          setError(err.response?.data?.message || 'Search failed.');
        }
        setResponse(null);
      } finally {
        if (myId === reqIdRef.current) setLoading(false);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [query, open]);

  // After the main search returns results, fetch one-line rationales for the
  // top 3. Reference-equality on the results array guards against a stale
  // rationale landing on top of a newer search.
  useEffect(() => {
    if (!open) return;
    if (!response?.results?.length) return;
    if (response.rationales) return; // already attached

    const capturedResults = response.results;
    const top = capturedResults.slice(0, 3);
    setRationalesLoading(true);

    (async () => {
      try {
        const res = await api.post('/search/rationale', {
          query: query.trim(),
          parsed: response.parsed,
          results: top,
        });
        setResponse(prev =>
          prev?.results === capturedResults
            ? { ...prev, rationales: res.data?.rationales || [] }
            : prev
        );
      } catch (err) {
        // Rationale is enhancement, not core. 402/500 fail silently — the
        // global axios interceptor already toasts paywall errors.
        setResponse(prev =>
          prev?.results === capturedResults
            ? { ...prev, rationales: [] }
            : prev
        );
      } finally {
        setRationalesLoading(false);
      }
    })();
  }, [response, open, query]);

  if (!open) return null;

  const handleSelect = (result) => {
    onClose();
    // PartnersPage reads ?focus=<id>&type=<type>, switches to the right tab,
    // clears the search filter, scrolls to the row, and rings it for ~3s.
    navigate(`/partners?focus=${encodeURIComponent(result.id)}&type=${result.type}`);
  };

  const isLookup = response?.intent === 'lookup';
  const isDiagnostic = response?.intent === 'diagnostic';
  const hasLookupAnswer = isLookup && response.lookup;
  const hasLookupCandidates = isLookup && response.candidates?.length > 0;
  const hasDiagnosticItems = isDiagnostic && response.items?.length > 0;
  const diagnosticIsClean = isDiagnostic && response.items?.length === 0;
  const showExamples = !query.trim() && !loading;
  const hasResults = !isLookup && !isDiagnostic && response?.results?.length > 0;
  const noResults = !isLookup && !isDiagnostic && response && !response.needsClarification && response.results?.length === 0;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[10vh] px-4 bg-black/40 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl flex flex-col max-h-[80vh] overflow-hidden animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-sand-200">
          <Search className="w-4 h-4 text-sand-500 flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ask about your hotels, activities, transport, packages…"
            className="flex-1 bg-transparent outline-none text-sm text-slate-brand placeholder:text-sand-400"
          />
          {loading && <Loader2 className="w-4 h-4 text-sand-500 animate-spin flex-shrink-0" />}
          <kbd className="hidden sm:inline-flex text-[10px] font-mono px-1.5 py-0.5 rounded bg-sand-100 text-sand-600 border border-sand-200">
            esc
          </kbd>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-sand-500 hover:text-slate-brand hover:bg-sand-100"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Parsed summary chips — search intent only. Lookup and diagnostic modes have their own headers. */}
        {!isLookup && !isDiagnostic && <ParsedSummary parsed={response?.parsed} quoteCurrency={response?.quoteCurrency} />}

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {/* Examples */}
          {showExamples && (
            <div className="px-4 py-6">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-4 h-4 text-amber-brand" />
                <span className="text-xs font-semibold text-slate-brand uppercase tracking-wide">Try asking</span>
              </div>
              <div className="space-y-1.5">
                {EXAMPLES.map((ex) => (
                  <button
                    key={ex}
                    type="button"
                    onClick={() => setQuery(ex)}
                    className="block w-full text-left text-sm text-sand-700 hover:text-slate-brand hover:bg-sand-50 px-3 py-2 rounded-lg transition-colors"
                  >
                    {ex}
                  </button>
                ))}
              </div>
              <p className="mt-4 text-[11px] text-sand-500">
                Costs 1 AI credit per search. Pricing is computed from your own rate lists — no AI guesses.
              </p>
            </div>
          )}

          {/* Diagnostic — inventory audit results */}
          {isDiagnostic && (
            <>
              <DiagnosticHeader
                label={response.label}
                totalCount={response.totalCount || 0}
                canonical={response.canonical}
              />
              {hasDiagnosticItems && (
                <div>
                  {response.items.map((item) => (
                    <DiagnosticItem
                      key={`${item.type}-${item.id}-${item.rateListName || ''}`}
                      item={item}
                      onSelect={(it) => handleSelect({ id: it.id, type: it.type })}
                    />
                  ))}
                </div>
              )}
              {diagnosticIsClean && <DiagnosticClean label={response.label} />}
            </>
          )}

          {/* Lookup answer — single-partner Q&A response */}
          {hasLookupAnswer && (
            <LookupAnswer
              lookup={response.lookup}
              answer={response.answer}
              onView={() => handleSelect({ id: response.lookup.id, type: response.lookup.kind })}
            />
          )}

          {/* Lookup disambiguation — multiple matches for the named subject */}
          {hasLookupCandidates && (
            <div className="px-4 py-5">
              <p className="text-xs font-semibold text-slate-brand uppercase tracking-wide mb-2">Which one?</p>
              <p className="text-xs text-sand-600 mb-3">
                Multiple partners match "{response.parsed?.subjectName}". Pick one to get the answer.
              </p>
              <div className="space-y-1">
                {response.candidates.map((c) => (
                  <button
                    key={`${c.kind}-${c.id}`}
                    type="button"
                    onClick={() => {
                      // Re-issue the same query but with the canonical name so
                      // the parser resolves to a single subject this time.
                      const subj = response.parsed?.subjectName;
                      if (subj && query.toLowerCase().includes(subj.toLowerCase())) {
                        const re = new RegExp(subj.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
                        setQuery(query.replace(re, c.name));
                      } else {
                        setQuery(`${query} (${c.name})`);
                      }
                    }}
                    className="w-full flex items-center gap-3 text-left px-3 py-2 rounded-lg hover:bg-sand-50 transition-colors"
                  >
                    <div className="w-8 h-8 rounded bg-sand-100 overflow-hidden flex-shrink-0 flex items-center justify-center">
                      {c.image
                        ? <img src={c.image} alt="" className="w-full h-full object-cover" />
                        : <span className="text-[10px] uppercase text-sand-500">{c.kind?.[0] || '?'}</span>}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-slate-brand truncate">{c.name}</div>
                      <div className="text-[11px] text-sand-500 truncate capitalize">
                        {c.kind}{c.destination ? ` · ${c.destination}` : ''}{c.location ? ` · ${c.location}` : ''}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Clarification */}
          {response?.needsClarification && (
            <div className="px-4 py-6 text-center">
              <div className="inline-flex w-10 h-10 rounded-full bg-amber-brand/10 text-amber-brand items-center justify-center mb-3">
                <Sparkles className="w-5 h-5" />
              </div>
              <p className="text-sm text-slate-brand font-medium mb-1">Need a bit more</p>
              <p className="text-xs text-sand-600">{response.needsClarification.prompt}</p>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="px-4 py-6 text-center text-sm text-red-600">{error}</div>
          )}

          {/* Results */}
          {hasResults && (
            <div>
              {(() => {
                const rationaleById = new Map(
                  (response.rationales || []).map(r => [String(r.id), r.rationale])
                );
                return response.results.map((r, i) => (
                  <SearchResultCard
                    key={`${r.type}-${r.id}`}
                    result={r}
                    onSelect={handleSelect}
                    rationale={rationaleById.get(String(r.id)) || null}
                    rationaleLoading={i < 3 && rationalesLoading}
                  />
                ));
              })()}
            </div>
          )}

          {/* No results */}
          {noResults && !loading && (
            <div className="px-4 py-10 text-center">
              <p className="text-sm font-medium text-slate-brand mb-1">No matches</p>
              <p className="text-xs text-sand-600 max-w-sm mx-auto">
                {response.warnings?.length
                  ? response.warnings[0]
                  : 'Try a different destination, widen the date range, or relax the budget. You can also add new partners on the Partners page.'}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        {(hasResults || response?.warnings?.length > 0) && (
          <div className="px-4 py-2 border-t border-sand-200 flex items-center justify-between text-[11px] text-sand-500">
            <span>
              {hasResults
                ? `${response.results.length} result${response.results.length === 1 ? '' : 's'} · sorted by price`
                : null}
            </span>
            <span>↵ open · esc close</span>
          </div>
        )}
      </div>
    </div>
  );
}
