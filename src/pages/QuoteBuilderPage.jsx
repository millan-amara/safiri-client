import { useState, useEffect, useRef } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { formatCurrency, cldThumb, formatDuration } from '../utils/helpers';
import toast from 'react-hot-toast';
import QuoteRenderer from '../components/quote/QuoteRenderer';
import {
  ArrowLeft, Plus, GripVertical, Trash2, Hotel, Ticket, FileText,
  Truck, DollarSign, Save, Send, Eye, ChevronDown, ChevronUp,
  Sparkles, X, Calendar, Users as UsersIcon, Copy, Image as ImageIcon,
  Coffee, Sun, Sunset, Star, EyeOff, CheckCircle, Clock, AlertTriangle,
  Link2, MoreHorizontal,
} from 'lucide-react';

// Server reason codes → operator-friendly toast text. The companion warning
// toast carries the specifics (e.g. configured validity windows).
const RATE_ERROR_MESSAGES = {
  no_active_rate_lists: 'This hotel has no active rate lists — configure pricing in Partners.',
  stay_window_not_covered: "No rate list's validity window covers this date — roll the pricelist forward in Partners.",
  zero_nights: 'Stay is zero nights — check your start/end dates.',
  no_rate_list_available: 'No rate list available for this stay.',
};
const humanizeRateError = (code) => RATE_ERROR_MESSAGES[code] || `Pricing failed: ${code}`;

// Snapshot of the inputs that drove a price call, stored on the item snapshot
// so we can later detect when the quote header has drifted away from them.
// Hotels depend on the check-in date; activities/transport don't.

// The consecutive run of days sharing one hotel that `dayIndex` belongs to.
// "Same hotel" uses the same key as the pricing rollup (#1.2) and the
// renderer's eachStaySegment: hotelId, falling back to name. Returns null
// when the day has no hotel. { start, end } are 0-based inclusive indices;
// length is the night count used as the resolver's stayNights so
// length-of-stay tiers and minNights/maxNights conditions resolve against
// the WHOLE stay even though each night is priced in its own window.
const stayKeyOfDay = (d) => (d?.hotel ? `${d.hotel.hotelId || d.hotel.name}` : null);
const stayRangeAt = (days, dayIndex) => {
  const list = days || [];
  const key = stayKeyOfDay(list[dayIndex]);
  if (!key) return null;
  let start = dayIndex;
  while (start - 1 >= 0 && stayKeyOfDay(list[start - 1]) === key) start--;
  let end = dayIndex;
  while (end + 1 < list.length && stayKeyOfDay(list[end + 1]) === key) end++;
  return { start, end, length: end - start + 1, key };
};

// Normalize an explicit room split to a stable shape, or null when the
// operator left it blank (→ resolver infers the allocation). Used both
// for the price-stay payload and the staleness fingerprint so they agree.
const normalizeRooms = (rooms) => {
  const s = Math.max(0, Math.floor(Number(rooms?.singles) || 0));
  const d = Math.max(0, Math.floor(Number(rooms?.doubles) || 0));
  const t = Math.max(0, Math.floor(Number(rooms?.triples) || 0));
  const q = Math.max(0, Math.floor(Number(rooms?.quads) || 0));
  return (s || d || t || q) ? { singles: s, doubles: d, triples: t, quads: q } : null;
};

// Symmetric, case-insensitive destination match. "Mara" should match a
// hotel whose destination is "Maasai Mara" AND vice-versa — the old
// one-directional `.includes` rejected the shorter-string case, so
// operators thought they had no inventory. Empty location = match all.
const destMatch = (a, b) => {
  const x = String(a || '').trim().toLowerCase();
  const y = String(b || '').trim().toLowerCase();
  if (!x || !y) return false;
  return x.includes(y) || y.includes(x);
};

// Distinct room types offered by a hotel partner doc, across its active
// rate lists' seasons. Drives the per-stay room-type dropdown (#2.1).
const roomTypesForHotel = (hotelDoc) => {
  if (!hotelDoc) return [];
  const set = new Set();
  for (const list of (hotelDoc.rateLists || [])) {
    if (list.isActive === false) continue;
    for (const season of (list.seasons || [])) {
      for (const r of (season.rooms || [])) {
        if (r?.roomType) set.add(r.roomType);
      }
    }
  }
  return [...set];
};

// Per-night pass-through units accrue every night; everything else
// (per_person_per_entry, flat, or any unrecognized unit) is a one-shot
// charge billed once per stay. Mirrors QuoteRenderer.collectFees and the
// PDF template so the operator total and client-facing display agree.
const PER_NIGHT_PT_UNITS = ['per_person_per_day', 'per_person_per_night', 'per_room_per_night'];

// Mandatory pass-through total (quote currency, face value) attributable
// to day `index`, stay-aware: per-night units every night; one-shot units
// only on the day that starts a new consecutive same-hotel run. Single
// source of truth shared by the pricing rollup and the per-day card chip
// (#3.6) so the two can never drift. Equivalent to the rollup's running
// prevStayKey because that key is reassigned to every day unconditionally,
// so it always equals the immediately-previous day's stay key.
const dayPassThroughFace = (days, index) => {
  const day = days?.[index];
  const fees = day?.hotel?.passThroughFees;
  if (!fees?.length) return 0;
  const key = day.hotel ? `${day.hotel.hotelId || day.hotel.name}` : null;
  const prev = index > 0 ? days[index - 1] : null;
  const prevKey = prev?.hotel ? `${prev.hotel.hotelId || prev.hotel.name}` : null;
  const startsNewStay = key !== null && key !== prevKey;
  return fees
    .filter(f => f.mandatory !== false)
    .filter(f => PER_NIGHT_PT_UNITS.includes(f.unit) || startsNewStay)
    .reduce((s, f) => s + (f.amountInQuoteCurrency || 0), 0);
};

// Lowest per-person-sharing across a hotel's active rate lists (any
// season/room), for the picker's "cheapest" sort (#2.4). Infinity when
// nothing priced so such hotels sort last.
const cheapestPerPersonOf = (hotelDoc) => {
  let min = Infinity;
  for (const list of (hotelDoc?.rateLists || [])) {
    if (list.isActive === false) continue;
    for (const season of (list.seasons || [])) {
      for (const r of (season.rooms || [])) {
        const v = Number(r?.perPersonSharing) || 0;
        if (v > 0 && v < min) min = v;
      }
    }
  }
  return min;
};

// ISO date `n` days after `iso` (yyyy-mm-dd), or null. Mirrors the resolver's
// per-day check-in math (startDate + dayIndex).
const addDaysIso = (iso, n) => {
  if (!iso) return null;
  const d = new Date(iso);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

// The rate-list season that covers `isoDate`, else the first season. Used to
// show the picker rate panel for the actual travel season rather than today's.
const seasonForDate = (rateList, isoDate) => {
  const seasons = rateList?.seasons || [];
  if (!seasons.length) return null;
  if (isoDate) {
    const t = new Date(isoDate).getTime();
    const hit = seasons.find(s => (s.dateRanges || []).some(r =>
      r?.from && r?.to && t >= new Date(r.from).getTime() && t <= new Date(r.to).getTime()
    ));
    if (hit) return hit;
  }
  return seasons[0];
};

// Compact human label for a child bracket — surfaces the own-room vs sharing
// distinction the operator wants to see ("4–11: 50% sharing", "0–3: free").
const childBracketLabel = (b) => {
  const age = `${b.minAge ?? 0}–${b.maxAge ?? 17}`;
  const amt = b.mode === 'free' ? 'free' : b.mode === 'flat' ? `flat ${b.value}` : `${b.value}%`;
  const rule = b.sharingRule === 'own_room' ? 'own room' : b.sharingRule === 'any' ? 'either' : 'sharing';
  const pos = b.position && b.position !== 'any' ? ` (${b.position.replace('_plus', '+')})` : '';
  return `${age}: ${amt} ${rule}${pos}`;
};

// Distinct meal plans offered by a hotel partner doc across its active
// rate lists. Drives the per-stay meal-plan dropdown (#3.12).
const mealPlansForHotel = (hotelDoc) => {
  if (!hotelDoc) return [];
  const set = new Set();
  for (const list of (hotelDoc.rateLists || [])) {
    if (list.isActive === false) continue;
    if (list.mealPlan) set.add(list.mealPlan);
  }
  return [...set];
};

const hotelPricingInputs = (quote, dayIndex) => {
  const checkIn = quote.startDate ? new Date(quote.startDate) : new Date();
  checkIn.setDate(checkIn.getDate() + dayIndex);
  return {
    checkIn: checkIn.toISOString().slice(0, 10),
    adults: quote.travelers.adults,
    childAges: [...(quote.travelers.childAges || [])],
    clientType: quote.clientType,
    nationality: quote.nationality,
    quoteCurrency: quote.pricing.currency,
    // Stay length feeds LoS tiers / minNights conditions. Tracking it here
    // means shortening or splitting a stay (remove/move/duplicate a day)
    // marks the hotel stale so the "Reprice all" banner refreshes it.
    stayNights: stayRangeAt(quote.days || [], dayIndex)?.length || 1,
    // Explicit room split changes which occupancy column the resolver
    // prices; track it so editing the split flags hotels stale.
    rooms: normalizeRooms(quote.travelers?.rooms),
  };
};
const paxPricingInputs = (quote) => ({
  adults: quote.travelers.adults,
  children: quote.travelers.children,
  childAges: [...(quote.travelers.childAges || [])],
  quoteCurrency: quote.pricing.currency,
});
const inputsEqual = (a, b) => JSON.stringify(a) === JSON.stringify(b);
// Snapshot is "stale" when its recorded inputs differ from the current ones.
// Pre-existing snapshots without `pricingInputs` (legacy data, manual edits)
// aren't flagged — we don't know what they were priced against.
const isItemStale = (snap, current) => {
  if (!snap?.pricingInputs) return false;
  return !inputsEqual(snap.pricingInputs, current);
};

export default function QuoteBuilderPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { organization } = useAuth();

  const [quote, setQuote] = useState({
    title: '',
    tourType: 'private',
    contact: '',
    deal: '',
    travelers: { adults: 2, children: 0, childAges: [], rooms: { singles: 0, doubles: 0, triples: 0, quads: 0 } },
    startDate: '',
    endDate: '',
    startPoint: 'Nairobi',
    endPoint: 'Nairobi',
    clientType: 'retail',        // retail | contract | resident
    nationality: 'nonResident',  // citizen | resident | nonResident — for park fees
    days: [],
    coverImage: null,
    pricing: {
      subtotal: 0,
      marginPercent: organization?.defaults?.marginPercent || 20,
      marginAmount: 0,
      totalPrice: 0,
      perPersonPrice: 0,
      currency: organization?.defaults?.currency || 'USD',
      displayMode: 'total_only',
      lineItems: [],
      // Whether to mark up mandatory pass-through fees (park fees etc.).
      // Toggle in the pricing sidebar — default mirrors the schema default.
      markupPassThroughFees: true,
    },
    inclusions: organization?.defaults?.inclusions || [],
    exclusions: organization?.defaults?.exclusions || [],
    paymentTerms: organization?.defaults?.paymentTerms || '',
    blocks: [
      { id: 'cover', enabled: true, order: 0 },
      { id: 'highlights', enabled: true, order: 1 },
      { id: 'day_by_day', enabled: true, order: 2 },
      { id: 'map', enabled: true, order: 3 },
      { id: 'accommodations', enabled: true, order: 4 },
      { id: 'pricing', enabled: true, order: 5 },
      { id: 'inclusions', enabled: true, order: 6 },
      { id: 'exclusions', enabled: true, order: 7 },
      { id: 'payment_terms', enabled: true, order: 8 },
      { id: 'about_us', enabled: false, order: 9 },
      { id: 'terms', enabled: false, order: 10 },
    ],
  });

  const [hotels, setHotels] = useState([]);
  const [activities, setActivities] = useState([]);
  const [transport, setTransport] = useState([]);
  const [packages, setPackages] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [deals, setDeals] = useState([]);
  const [destinations, setDestinations] = useState([]);
  // 'deal' = pick a deal (primary path; auto-derives contact)
  // 'contact' = legacy / speculative quotes — pick a contact, no deal
  const [linkMode, setLinkMode] = useState('deal');
  const [expandedDay, setExpandedDay] = useState(0);
  const [showPreview, setShowPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showPackagePicker, setShowPackagePicker] = useState(false);

  // Skeleton while an existing quote is fetched. Without this the form
  // renders with empty defaults then pops to populated once the GET
  // resolves — it looks broken and the operator can start typing into a
  // form that's about to be overwritten. New quotes need no fetch.
  const [loading, setLoading] = useState(!!id);

  // Styled replacements for native prompt()/confirm() (those are unstyled,
  // browser-blockable, and unusable on mobile). `confirmDialog` is a
  // generic { title, message, confirmLabel, tone, onConfirm } descriptor;
  // `templateModal` carries the Save-as-Template form fields.
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [templateModal, setTemplateModal] = useState(null);
  // Header overflow ("⋯") menu for rare actions, so the action row isn't
  // a wall of equal-weight buttons.
  const [overflowOpen, setOverflowOpen] = useState(false);

  // Unsaved-changes guard. savedRef holds a JSON snapshot of the last
  // saved/loaded state; quoteRef mirrors the latest quote so the
  // beforeunload handler — which can't read React state — can diff it.
  const quoteRef = useRef(quote);
  const savedRef = useRef(null);
  useEffect(() => { quoteRef.current = quote; });
  const isDirty = () => savedRef.current !== null
    && JSON.stringify(quoteRef.current) !== savedRef.current;

  // Load partner data. Each request sets its own slice as it resolves rather
  // than one Promise.all — so the deal/contact pickers (light payloads) populate
  // immediately instead of waiting on the slowest call (hotels, with rate lists
  // + images). Independent .catch keeps one failure from blocking the rest.
  useEffect(() => {
    api.get('/crm/deals').then(r => setDeals(r.data.deals || [])).catch(() => {});
    api.get('/crm/contacts').then(r => setContacts(r.data.contacts || [])).catch(() => {});
    api.get('/destinations').then(r => setDestinations(r.data.destinations || [])).catch(() => {});
    api.get('/partners/hotels').then(r => setHotels(r.data.hotels || [])).catch(() => {});
    api.get('/partners/activities').then(r => setActivities(r.data.activities || [])).catch(() => {});
    api.get('/partners/transport').then(r => setTransport(r.data.transport || [])).catch(() => {});
    api.get('/partners/packages').then(r => setPackages(r.data.packages || [])).catch(() => {});
  }, []);

  // Apply a package: populates quote.days from the (server-hydrated) segments
  // and adds a single line item for the package's priced total. Each day's
  // hotel snapshot now carries the linked Hotel doc's display fields
  // (description, images, amenities, etc.) so the share page renders properly.
  // Package-level metadata (tier, cancellation, deposit, booking terms) is
  // stashed on quote.packageSnapshot for the policy blocks to render.
  // Public entry: gate the destructive replace behind a styled confirm
  // when the operator already has an itinerary; otherwise apply directly.
  const applyPackage = (pkg) => {
    if (quote.days?.length > 0) {
      setConfirmDialog({
        title: 'Replace itinerary?',
        message: 'Applying this package will replace your current itinerary. This can\'t be undone.',
        confirmLabel: 'Replace',
        tone: 'danger',
        onConfirm: () => { setConfirmDialog(null); doApplyPackage(pkg); },
      });
      return;
    }
    doApplyPackage(pkg);
  };

  const doApplyPackage = async (pkg) => {
    try {
      const { data } = await api.post(`/partners/packages/${pkg._id}/price`, {
        adults: quote.travelers.adults,
        childAges: quote.travelers.childAges || [],
        quoteCurrency: quote.pricing.currency,
        clientType: quote.clientType,
        startDate: quote.startDate || undefined,
      });
      if (!data.ok) {
        toast.error(`Can't price package: ${data.reason}`);
        return;
      }

      // Use the SERVER-populated segments (which now include the linked Hotel
      // doc on each segment), not pkg.segments — the client copy only has the
      // ObjectId ref, not the full hotel record.
      const segments = data.segments || [];
      const days = [];
      const dur = data.package?.durationDays || (data.package?.durationNights ? data.package.durationNights + 1 : segments.length || 1);
      for (let i = 1; i <= dur; i++) {
        const seg = segments.find(s => i >= (s.startDay || 1) && i <= (s.endDay || 1));
        const linkedHotel = seg?.hotel || null;
        const displayHotelName = linkedHotel?.name || seg?.hotelName || '';

        days.push({
          dayNumber: i,
          title: seg?.location ? `Day ${i} — ${seg.location}` : `Day ${i}`,
          location: seg?.location || linkedHotel?.location || linkedHotel?.destination || '',
          isTransitDay: false,
          narrative: seg?.notes || '',
          meals: {
            breakfast: data.pricingList?.mealPlan && data.pricingList.mealPlan !== 'RO',
            lunch: ['FB', 'AI', 'GAME_PACKAGE'].includes(data.pricingList?.mealPlan),
            dinner: ['HB', 'FB', 'AI', 'GAME_PACKAGE'].includes(data.pricingList?.mealPlan),
            notes: '',
          },
          hotel: displayHotelName ? {
            hotelId: seg?.hotelId || linkedHotel?._id || null,
            name: displayHotelName,
            description: linkedHotel?.description || '',
            images: linkedHotel?.images || [],
            // Hotel-level enrichment from the linked partner doc
            location: linkedHotel?.location || '',
            type: linkedHotel?.type || '',
            stars: linkedHotel?.stars || null,
            amenities: linkedHotel?.amenities || [],
            contactEmail: linkedHotel?.contactEmail || '',
            contactPhone: linkedHotel?.contactPhone || '',
            coordinates: linkedHotel?.coordinates || null,
            tags: linkedHotel?.tags || [],
            // Package nights are flat-priced — pricing fields stay zero so
            // dayCost rollup ignores them; the package total lives as a
            // single line item.
            ratePerNight: 0,
            ratePerNightInQuoteCurrency: 0,
            sourceCurrency: data.sourceCurrency,
            mealPlan: data.pricingList?.mealPlan,
            mealPlanLabel: data.pricingList?.mealPlanLabel || '',
            rateListName: `${data.package?.name || pkg.name} (package · ${data.pricingList?.name || ''})`,
            // Flag so renderer/PDF can suppress per-night pricing UI for
            // package nights without having to re-derive it from context.
            isPackageNight: true,
          } : null,
          roomType: '',
          activities: [],
          transport: null,
          images: [],
          dayCost: 0,   // package is flat-priced; per-day cost tracked as one line item
          isItemized: true,  // the package line item drives the total for these days
        });
      }

      // Snapshot of package-level info that doesn't fit on a day. Surfaced by
      // the policy / payment-terms blocks (Chunk 6 renders this).
      const packageSnapshot = {
        packageId: data.package?._id,
        name: data.package?.name,
        description: data.package?.description,
        durationNights: data.package?.durationNights,
        durationDays: data.package?.durationDays,
        images: data.package?.images || [],
        pricingListName: data.pricingList?.name,
        audience: data.pricingList?.audience,
        mealPlan: data.pricingList?.mealPlan,
        mealPlanLabel: data.pricingList?.mealPlanLabel,
        seasonLabel: data.pricingList?.seasonLabel,
        notes: data.pricingList?.notes,
        tier: data.tier,
        adults: data.adults,
        childAges: data.childAges,
        adultTotal: data.adultTotal,
        singleSupplement: data.singleSupplement,
        childTotal: data.childTotal,
        childrenBreakdown: data.childrenBreakdown,
        sourceCurrency: data.sourceCurrency,
        quoteCurrency: data.quoteCurrency,
        fxRate: data.fxRate,
        subtotalSource: data.subtotalSource,
        subtotalInQuoteCurrency: data.subtotalInQuoteCurrency,
        cancellationTiers: data.cancellationTiers || [],
        depositPct: data.depositPct || 0,
        bookingTerms: data.bookingTerms || '',
        warnings: data.warnings || [],
      };

      // Pick a cover image: prefer existing quote cover, else the package's
      // hero image, else nothing (render falls back to first day's image).
      const packageHero = (data.package?.images || []).find(img => img.isHero) || (data.package?.images || [])[0];
      const coverImage = quote.coverImage || (packageHero ? { url: packageHero.url, caption: packageHero.caption || '', source: 'package' } : null);

      setQuote({
        ...quote,
        title: quote.title || data.package?.name || pkg.name,
        coverNarrative: quote.coverNarrative || data.package?.description || '',
        coverImage,
        days,
        inclusions: [...new Set([...(quote.inclusions || []), ...((data.inclusions || []))])],
        exclusions: [...new Set([...(quote.exclusions || []), ...((data.exclusions || []))])],
        // If the operator hasn't set their own payment terms, seed from the
        // package's bookingTerms so the policy block isn't blank.
        paymentTerms: quote.paymentTerms || data.bookingTerms || '',
        packageSnapshot,
        pricing: {
          ...quote.pricing,
          // Replace lineItems wholesale — the package IS the itinerary, and
          // any prior line items (including a previously-applied package's
          // line) would otherwise stack and double the displayed total. If
          // the operator has extras to bill, they add them after applying.
          //
          // Line items are stored at client-facing (post-markup) prices —
          // the pricing useEffect sums them directly into totalPrice with
          // no further margin, and the renderer / PDF / invoiceBuilder all
          // consume them at face value. Multiply the package's source-
          // currency-converted cost by the current global markup so the
          // displayed total matches what the operator expects.
          lineItems: [
            {
              description: `${data.package?.name || pkg.name} — ${data.tier.minPax}-${data.tier.maxPax} pax package (${quote.travelers.adults} adult${quote.travelers.adults === 1 ? '' : 's'}${data.childAges.length ? ', ' + data.childAges.length + ' child' + (data.childAges.length === 1 ? '' : 'ren') : ''})`,
              quantity: 1,
              unitPrice: Math.round(data.subtotalInQuoteCurrency * (1 + (quote.pricing.marginPercent || 0) / 100)),
              total: Math.round(data.subtotalInQuoteCurrency * (1 + (quote.pricing.marginPercent || 0) / 100)),
              source: 'package',
            },
          ],
        },
      });
      setShowPackagePicker(false);
      toast.success(`Applied "${data.package?.name || pkg.name}" — ${dur} days`);
      if (data.warnings?.length) {
        data.warnings.slice(0, 2).forEach(w => toast(w, { icon: '⚠️' }));
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to apply package');
    }
  };

  // Load existing quote
  useEffect(() => {
    if (id) {
      api.get(`/quotes/${id}`).then(({ data }) => {
        // Server populates `contact` and `deal` — keep state as bare ID strings
        // so the dropdowns can match `<option value={id}>`. Without this, the
        // populated objects fall through and the dropdowns show "Select..." on
        // reopen, making the user think the link didn't persist.
        const contactId = data.contact?._id || data.contact || '';
        const dealId = data.deal?._id || data.deal || '';
        const loaded = {
          ...data,
          contact: contactId,
          deal: dealId,
          days: data.days || [],
          startDate: data.startDate?.split('T')[0] || '',
          endDate: data.endDate?.split('T')[0] || '',
        };
        setQuote(loaded);
        // Baseline for the unsaved-changes guard. The pricing effect may
        // recompute totals on mount; when they match what was stored the
        // JSON is identical so this stays accurate, and any genuine drift
        // fails safe (warns rather than silently discards).
        savedRef.current = JSON.stringify(loaded);
        // Legacy quotes saved with only a contact (no deal) → start in
        // contact-only mode so the operator sees what's actually linked.
        if (!dealId && contactId) setLinkMode('contact');
      }).catch(() => {
        toast.error('Quote not found');
        navigate('/quotes');
      }).finally(() => setLoading(false));
    }
  }, [id]);

  // New quote: baseline the unsaved-changes snapshot once on mount so an
  // untouched blank form never triggers the discard warning. A deal-sourced
  // prefill (the effect below) counts as a change — that's intentional, the
  // operator almost always wants to keep a deal-derived quote.
  useEffect(() => {
    if (!id) savedRef.current = JSON.stringify(quoteRef.current);
  }, []);

  // Warn before the browser unloads (tab close / refresh / external nav)
  // with unsaved edits. In-app navigation is guarded separately on the
  // back button; sidebar links aren't blockable here because the app uses
  // BrowserRouter, not a data router (useBlocker is unavailable).
  useEffect(() => {
    const onBeforeUnload = (e) => {
      if (!isDirty()) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, []);

  // Apply a deal's context to the quote. Shared by BOTH entry points — the
  // "Create Quote" link from the deal panel and the in-builder deal picker.
  //
  // `overwrite` = the operator is SWITCHING from a previously-selected deal
  // (e.g. they misclicked). The new deal is then authoritative and fully
  // replaces the old deal's values, INCLUDING emptiness ("0 children" really
  // means 0). When false (first pick onto a possibly hand-typed quote), we only
  // fill blanks so the operator's own typing is never clobbered.
  const applyDealToQuote = (source, { overwrite = false } = {}) => {
    if (!source) return;
    const contactId = source.contact?._id || source.contact || '';
    const dealStart = source.travelDates?.start ? new Date(source.travelDates.start).toISOString().slice(0, 10) : '';
    const dealEnd = source.travelDates?.end ? new Date(source.travelDates.end).toISOString().slice(0, 10) : '';
    // Adults: prefer the explicit split, fall back to groupSize-as-adults for
    // legacy deals. Never blanks to 0 — a quote always needs at least the
    // current adult count.
    const dealAdults = source.adults > 0 ? source.adults : (source.groupSize > 0 ? source.groupSize : 0);
    const dealChildren = Number(source.children) || 0;
    const dealChildAges = Array.isArray(source.childAges) ? source.childAges : [];

    setQuote(q => ({
      ...q,
      deal: source._id,
      contact: contactId,
      startDate: overwrite ? dealStart : (q.startDate || dealStart),
      endDate: overwrite ? dealEnd : (q.endDate || dealEnd),
      // Pricing-critical: carry the rate audience + park-fee tier the operator
      // qualified on the deal, so the quote (and the AI draft, which reads these
      // off quote state) don't silently fall back to retail / non-resident.
      clientType: source.clientType || q.clientType,
      nationality: source.nationality || q.nationality,
      travelers: {
        ...q.travelers,
        adults: dealAdults || q.travelers.adults,
        children: overwrite ? dealChildren : (dealChildren || q.travelers.children),
        childAges: overwrite ? dealChildAges : (dealChildAges.length ? dealChildAges : q.travelers.childAges),
      },
      pricing: {
        ...q.pricing,
        currency: source.currency || source.budgetCurrency || q.pricing.currency,
      },
    }));
    setLinkMode('deal');
  };

  // New quote arriving from a deal page (`/quotes/new?deal=<id>`) — pre-fill
  // from the deal so the operator doesn't re-key context. Runs once `deals`
  // has loaded so we can find the source object.
  useEffect(() => {
    if (id) return;                          // editing an existing quote — skip
    const dealParam = searchParams.get('deal');
    if (!dealParam) return;
    if (!deals.length) return;               // wait for fetch
    if (quote.deal) return;                  // already populated (e.g. user edited)
    const source = deals.find(d => d._id === dealParam);
    if (source) applyDealToQuote(source);
  }, [id, deals, searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

  // Recalculate pricing when days change — honors per-day margin overrides.
  //
  // Three buckets feed the total:
  //   1. day.dayCost — operator-resold inventory (hotel rate, activities,
  //      transport). Marked up at the per-day or global margin.
  //      SKIPPED when day.isItemized is true (the day's costs are already
  //      represented inside pricing.lineItems, e.g. by Auto-generate or
  //      by applyPackage). Without this guard, the same costs would be
  //      counted twice — once via dayCost and once via lineItems.
  //   2. mandatory pass-through fees on each day's hotel snapshot (park
  //      fees, conservancy access). Marked up only when
  //      quote.pricing.markupPassThroughFees is true; otherwise billed
  //      at face value. Always applied — PT fees are surfaced as a
  //      separate section by the renderer and are intentionally not
  //      duplicated by Auto-generate.
  //   3. quote.pricing.lineItems — these are CLIENT-FACING totals (the
  //      schema's `unitPrice` doc says "marked-up price", and the renderer
  //      / PDF / invoiceBuilder all consume them at face value). We sum
  //      them into totalPrice directly with no further markup. For the
  //      operator's "Subtotal (cost)" sidebar display, we reverse the
  //      global markup as a best-effort cost estimate; it is approximate
  //      when per-day overrides are mixed in but is correct on average.
  //
  // Margin slider caveat: changing marginPercent updates the day-rollup
  // contribution immediately but does NOT scale already-generated line
  // items. The "Re-generate" affordance in the line items editor is the
  // operator's path to refresh prices after a margin change.
  useEffect(() => {
    const globalMargin = quote.pricing.marginPercent;
    const markupFees = quote.pricing.markupPassThroughFees !== false;
    let subtotal = 0;
    let totalPrice = 0;
    // Stay-aware pass-through accrual is centralised in dayPassThroughFace
    // (one-shot fees once per consecutive same-hotel run, per-night fees
    // every night). The day card chip (#3.6) uses the same helper so the
    // sum of per-day costs reconciles with this rollup.
    const days = quote.days || [];
    days.forEach((day, i) => {
      const margin = day.marginOverride != null ? day.marginOverride : globalMargin;
      if (!day.isItemized) {
        const cost = day.dayCost || 0;
        subtotal += cost;
        totalPrice += cost * (1 + margin / 100);
      }
      const ptTotal = dayPassThroughFace(days, i);
      subtotal += ptTotal;
      totalPrice += markupFees ? ptTotal * (1 + margin / 100) : ptTotal;
    });

    const lineItemsTotal = (quote.pricing.lineItems || [])
      .reduce((s, li) => s + (Number(li.total) || 0), 0);
    // Line items are already client-priced — add to total directly.
    totalPrice += lineItemsTotal;
    // For the subtotal display only, reverse the global markup to land
    // back in cost-basis terms. With a 0% margin this is a no-op.
    const reverseMarkup = globalMargin > 0 ? 1 / (1 + globalMargin / 100) : 1;
    subtotal += lineItemsTotal * reverseMarkup;

    const marginAmount = totalPrice - subtotal;
    const totalPax = quote.travelers.adults + quote.travelers.children;
    setQuote(prev => ({
      ...prev,
      pricing: {
        ...prev.pricing,
        subtotal,
        marginAmount,
        totalPrice,
        perPersonPrice: totalPax > 0 ? Math.round(totalPrice / totalPax) : 0,
      },
    }));
  }, [quote.days, quote.pricing.marginPercent, quote.pricing.markupPassThroughFees, quote.pricing.lineItems, quote.travelers]);

  // Safety net: when lineItems is fully empty AND any day is still flagged
  // as itemized, clear the flag so day-cost rollup resumes. Handles the
  // case where the operator removes line items one-by-one via the X button
  // without using the explicit "Reset to day rollup" button.
  useEffect(() => {
    const items = quote.pricing.lineItems || [];
    if (items.length > 0) return;
    if (!(quote.days || []).some(d => d.isItemized)) return;
    setQuote(prev => ({
      ...prev,
      days: prev.days.map(d => (d.isItemized ? { ...d, isItemized: false } : d)),
    }));
  }, [quote.pricing.lineItems, quote.days]);

  // Day helpers
  const addDay = (afterIdx = null) => {
    const days = [...(quote.days || [])];
    const lastDay = days[days.length - 1];
    // Don't auto-inherit the previous day's hotel snapshot. The snapshot is
    // priced for that night's date, season, and stay-tier — copying it onto
    // a new day would carry the wrong rate (and silently inflate the total
    // when updateDay later sums it into dayCost). Operator re-picks per day
    // so each night is priced correctly.
    const newDay = {
      dayNumber: days.length + 1,
      title: '',
      location: lastDay?.location || '',
      isTransitDay: false,
      narrative: '',
      meals: { breakfast: false, lunch: false, dinner: false, notes: '' },
      hotel: null,
      roomType: '',
      activities: [],
      transport: null,
      images: [],
      dayCost: 0,
    };
    if (afterIdx === null || afterIdx >= days.length - 1) {
      days.push(newDay);
    } else {
      days.splice(afterIdx + 1, 0, newDay);
    }
    // Renumber
    days.forEach((d, i) => d.dayNumber = i + 1);
    setQuote({ ...quote, days });
    setExpandedDay(afterIdx === null ? days.length - 1 : afterIdx + 1);
  };

  // updates can be a plain object (replacement / atomic patch) or a function
  // (prevDay => patch). Use the function form when the patch depends on the
  // previous day state — e.g. appending an activity. Reading day.activities
  // outside this functional form is a closure trap: rapid parallel picks both
  // see the pre-await activities array and the second update clobbers the
  // first. Same pattern that bit extendStayFromDay; centralised here.
  const updateDay = (index, updates) => {
    setQuote(prev => {
      const days = [...prev.days];
      const patch = typeof updates === 'function' ? updates(days[index]) : updates;
      days[index] = { ...days[index], ...patch };

      // Auto-calc day cost. Prefer the quote-currency value (converted via FX
      // at pick time) over the raw source-currency value, so a USD quote with
      // KES activities doesn't silently mix currencies in the total.
      const day = days[index];
      const hotelCost = day.hotel?.ratePerNightInQuoteCurrency || day.hotel?.ratePerNight || 0;
      const actCost = day.activities?.reduce((s, a) => s + (a.totalCostInQuoteCurrency ?? a.totalCost ?? 0), 0) || 0;
      const transCost = day.transport?.totalCostInQuoteCurrency ?? day.transport?.totalCost ?? 0;
      days[index].dayCost = hotelCost + actCost + transCost;

      return { ...prev, days };
    });
  };

  const removeDay = (index) => {
    const days = quote.days.filter((_, i) => i !== index);
    days.forEach((d, i) => d.dayNumber = i + 1);
    setQuote({ ...quote, days });
    if (expandedDay >= days.length) setExpandedDay(Math.max(0, days.length - 1));
  };

  const moveDay = (index, direction) => {
    const newIdx = index + direction;
    if (newIdx < 0 || newIdx >= quote.days.length) return;
    const days = [...quote.days];
    [days[index], days[newIdx]] = [days[newIdx], days[index]];
    days.forEach((d, i) => d.dayNumber = i + 1);
    setQuote({ ...quote, days });
    setExpandedDay(newIdx);
  };

  // Duplicate a day's content (narrative, meals, images, hotel/activity
  // *picks*) but reset all pricing — the duplicated day is for a different
  // date, so the original rates and FX may not apply. Operator re-confirms
  // the picks on the new day to re-trigger pricing.
  const duplicateDay = (index) => {
    const days = [...quote.days];
    const copy = JSON.parse(JSON.stringify(days[index]));
    copy._id = undefined;
    if (copy.hotel) {
      // Keep display fields (the partner doc didn't change), drop pricing.
      copy.hotel = {
        hotelId: copy.hotel.hotelId,
        name: copy.hotel.name,
        description: copy.hotel.description,
        images: copy.hotel.images || [],
        location: copy.hotel.location || '',
        type: copy.hotel.type || '',
        stars: copy.hotel.stars || null,
        amenities: copy.hotel.amenities || [],
        coordinates: copy.hotel.coordinates || null,
        contactEmail: copy.hotel.contactEmail || '',
        contactPhone: copy.hotel.contactPhone || '',
        tags: copy.hotel.tags || [],
        // pricing fields cleared: ratePerNight, ratePerNightInQuoteCurrency,
        // supplements, passThroughFees, addOns, seasonLabel, fxRate, etc.
      };
      copy.roomType = '';
    }
    if (Array.isArray(copy.activities)) {
      copy.activities = copy.activities.map(a => ({
        ...a,
        totalCost: 0,
        totalCostInQuoteCurrency: 0,
        sourceCurrency: undefined,
        fxRate: undefined,
      }));
    }
    if (copy.transport) {
      copy.transport = {
        ...copy.transport,
        totalCost: 0,
        totalCostInQuoteCurrency: 0,
      };
    }
    copy.dayCost = 0;
    days.splice(index + 1, 0, copy);
    days.forEach((d, i) => d.dayNumber = i + 1);
    setQuote({ ...quote, days });
    setExpandedDay(index + 1);
    toast('Day duplicated — pricing was cleared. Re-confirm the hotel/activities to re-price for the new date.', { icon: 'ℹ️', duration: 5000 });
  };

  // Pure price + snapshot construction — no state mutation. Returns
  // { snapshot, roomType, error, warnings } so callers can either commit it
  // via updateDay (single hotel pick) or fold it into a multi-field state
  // update (extend-stay, where we also insert a new day in the same beat).
  const priceHotelForCheckIn = async (hotel, checkIn, opts = {}) => {
    const checkOut = new Date(checkIn);
    checkOut.setDate(checkOut.getDate() + 1);

    // Snapshot the pricing inputs so the staleness banner can detect when the
    // operator has shifted the quote header (dates / pax / clientType / etc.)
    // since this hotel was priced.
    const stayNights = Number.isFinite(opts.stayNights) && opts.stayNights >= 1
      ? Math.floor(opts.stayNights)
      : 1;
    // Explicit room split (or null = let the resolver infer). Sent to the
    // API only when set, and recorded in the staleness fingerprint so
    // editing the split flags affected hotels for re-pricing.
    const roomsConfig = normalizeRooms(quote.travelers?.rooms);
    const pricingInputs = {
      checkIn: checkIn.toISOString().slice(0, 10),
      adults: quote.travelers.adults,
      childAges: [...(quote.travelers.childAges || [])],
      clientType: quote.clientType,
      nationality: quote.nationality,
      quoteCurrency: quote.pricing.currency,
      // Recorded so the staleness check (hotelPricingInputs) flags this
      // snapshot when the stay grows/shrinks and the LoS tier may change.
      stayNights,
      rooms: roomsConfig,
    };

    const baseSnapshot = {
      hotelId: hotel._id,
      name: hotel.name,
      images: hotel.images || [],
      description: hotel.description || '',
      location: hotel.location || '',
      type: hotel.type || '',
      stars: hotel.stars || null,
      amenities: hotel.amenities || [],
      coordinates: hotel.coordinates || null,
      contactEmail: hotel.contactEmail || '',
      contactPhone: hotel.contactPhone || '',
      tags: hotel.tags || [],
      pricingInputs,
    };

    try {
      const { data } = await api.post(`/partners/hotels/${hotel._id}/price-stay`, {
        checkIn: checkIn.toISOString(),
        checkOut: checkOut.toISOString(),
        adults: quote.travelers.adults,
        childAges: quote.travelers.childAges || [],
        clientType: quote.clientType,
        nationality: quote.nationality,
        preferredMealPlan: opts.preferredMealPlan,
        preferredRoomType: opts.preferredRoomType,
        quoteCurrency: quote.pricing.currency,
        // True stay length so the resolver applies the right LoS tier and
        // evaluates minNights/maxNights conditions even though this call
        // prices a single night's window.
        stayNights,
        // Authoritative room split when the operator set one; omitted
        // (undefined) when blank so the resolver infers the allocation.
        ...(roomsConfig ? { rooms: roomsConfig } : {}),
      });

      if (data.ok) {
        const night = data.nightly?.[0] || {};
        return {
          snapshot: {
            ...baseSnapshot,
            rateListId: data.rateList._id,
            rateListName: data.rateList.name,
            audienceApplied: data.rateList.audience,
            mealPlan: data.rateList.mealPlan,
            mealPlanLabel: data.rateList.mealPlanLabel,
            sourceCurrency: data.sourceCurrency,
            fxRate: data.fxRate,
            roomType: data.roomType,
            seasonLabel: night.season,
            // night.total now includes per-night mandatory add-ons (resort
            // fees, conservancy access, etc.) rolled in by the server.
            ratePerNight: night.total || 0,
            ratePerNightInQuoteCurrency: (night.total || 0) * (data.fxRate || 1),
            supplements: night.supplements || [],
            passThroughFees: data.passThroughFees,
            addOns: data.addOns,
            // Mandatory add-ons surfaced separately for transparency: the
            // renderer can show "*nightly includes $X in mandatory fees*".
            mandatoryAddOnsPerNight: data.mandatoryAddOnsPerNight || [],
            mandatoryAddOnsPerNightTotal: data.mandatoryAddOnsPerNightTotal || 0,
            cancellationTiers: data.cancellationTiers,
            depositPct: data.depositPct,
            bookingTerms: data.bookingTerms || '',
            rateListNotes: data.notes || '',
            inclusions: data.inclusions || [],
            exclusions: data.exclusions || [],
            // Typed callouts the renderer will surface and the operator
            // must acknowledge any blocking ones before sending the quote.
            conditions: data.conditions || [],
            extractionConfidence: data.extractionConfidence || data.rateList?.extractionConfidence || '',
            warnings: data.warnings,
          },
          roomType: data.roomType || '',
          warnings: data.warnings || [],
        };
      }
      return {
        snapshot: { ...baseSnapshot, ratePerNight: 0, ratePerNightInQuoteCurrency: 0, warnings: data.warnings || [data.reason] },
        roomType: '',
        error: data.reason || 'unknown',
        warnings: data.warnings || [],
      };
    } catch (err) {
      return {
        snapshot: { ...baseSnapshot, ratePerNight: 0, ratePerNightInQuoteCurrency: 0 },
        roomType: '',
        error: err.response?.data?.message || 'Pricing failed',
        warnings: [],
      };
    }
  };

  // Recompute a day's cost from its priced snapshots. Mirrors the inline
  // logic in updateDay so the run-pricing path stays in sync with it.
  const recomputeDayCost = (day) => {
    const hotelCost = day.hotel?.ratePerNightInQuoteCurrency || day.hotel?.ratePerNight || 0;
    const actCost = day.activities?.reduce((s, a) => s + (a.totalCostInQuoteCurrency ?? a.totalCost ?? 0), 0) || 0;
    const transCost = day.transport?.totalCostInQuoteCurrency ?? day.transport?.totalCost ?? 0;
    return hotelCost + actCost + transCost;
  };

  // Price every night of the consecutive same-hotel run that contains
  // `anchorIndex` within `baseDays`, passing the run length as stayNights
  // so length-of-stay tiers and minNights/maxNights conditions resolve for
  // the WHOLE stay (the #1.1 fix). Pure: returns the priced snapshots; the
  // caller decides how to commit (in-place vs. with a structural insert).
  // All days in a run share one hotel by definition, so a single partner
  // doc (`hotelDoc`) prices the whole run.
  const priceRun = async (baseDays, anchorIndex, hotelDoc, opts = {}) => {
    const range = stayRangeAt(baseDays, anchorIndex);
    if (!range) return { range: null, results: [] };
    const startDate = quote.startDate ? new Date(quote.startDate) : new Date();
    const results = [];
    for (let idx = range.start; idx <= range.end; idx++) {
      const checkIn = new Date(startDate);
      checkIn.setDate(checkIn.getDate() + idx);
      const r = await priceHotelForCheckIn(hotelDoc, checkIn, { ...opts, stayNights: range.length });
      results.push({ idx, ...r });
    }
    return { range, results };
  };

  // Apply priced-run results onto a (copied) days array in place, refreshing
  // each day's hotel snapshot, roomType, and recomputed dayCost.
  const applyPricedRun = (days, results) => {
    for (const { idx, snapshot, roomType } of results) {
      if (!days[idx]) continue;
      const day = { ...days[idx], hotel: snapshot, roomType };
      day.dayCost = recomputeDayCost(day);
      days[idx] = day;
    }
    return days;
  };

  // Surface the first pricing error + up to two distinct warnings across a
  // run (don't spam one toast per night).
  const reportRun = (results, errPrefix = '') => {
    const firstErr = results.find(r => r.error);
    if (firstErr) {
      toast.error(`${errPrefix}${humanizeRateError(firstErr.error)}`, { duration: 6000 });
    }
    [...new Set(results.flatMap(r => r.warnings || []))]
      .slice(0, 2)
      .forEach(w => toast(w, { icon: '⚠️', duration: 6000 }));
    return !firstErr;
  };

  // Pick a hotel for a day. Reflects the pick in a working copy so the
  // consecutive same-hotel run is detected from the post-pick state, then
  // reprices the WHOLE run with the true stay length — picking the same
  // hotel that an adjacent day already has correctly grows the stay and
  // re-applies its length-of-stay tier to every night.
  const selectHotelForDay = async (dayIndex, hotel, opts = {}) => {
    const baseDays = (quote.days || []).map((d, i) =>
      i === dayIndex
        ? { ...d, hotel: { hotelId: hotel._id, name: hotel.name } }
        : d
    );
    const { range, results } = await priceRun(baseDays, dayIndex, hotel, opts);
    if (!range) return;
    reportRun(results);
    setQuote(prev => {
      const days = [...prev.days];
      applyPricedRun(days, results);
      return { ...prev, days };
    });
  };

  // Extend an existing hotel stay by inserting another night after `dayIndex`
  // and re-pricing the ENTIRE run (not just the new night) so the longer
  // stay's LoS tier applies to every night. Composes the insert + the priced
  // snapshots into one setQuote to dodge the closure-staleness race.
  const extendStayFromDay = async (dayIndex) => {
    const sourceDay = quote.days[dayIndex];
    if (!sourceDay?.hotel?.hotelId) return;
    const sourceHotel = hotels.find(h => h._id === sourceDay.hotel.hotelId);
    if (!sourceHotel) {
      toast.error('Original hotel is no longer in your partners list — pick manually.');
      return;
    }

    const newDayIndex = dayIndex + 1;
    const inserted = {
      dayNumber: newDayIndex + 1,
      title: '',
      location: sourceDay.location || '',
      isTransitDay: false,
      narrative: '',
      meals: {
        breakfast: !!sourceDay.meals?.breakfast,
        lunch: !!sourceDay.meals?.lunch,
        dinner: !!sourceDay.meals?.dinner,
        notes: '',
      },
      // Thin pick so the run now includes this day; priceRun fills it in.
      hotel: { hotelId: sourceHotel._id, name: sourceHotel.name },
      roomType: '',
      activities: [],
      transport: null,
      images: [],
      dayCost: 0,
    };
    const baseDays = [...quote.days];
    baseDays.splice(newDayIndex, 0, inserted);

    const { range, results } = await priceRun(baseDays, newDayIndex, sourceHotel, {
      preferredRoomType: sourceDay.hotel.roomType,
      preferredMealPlan: sourceDay.hotel.mealPlan,
    });
    const ok = reportRun(results, 'Could not re-price for new night — ');

    const days = applyPricedRun([...baseDays], results);
    days.forEach((d, i) => d.dayNumber = i + 1);
    setQuote({ ...quote, days });
    setExpandedDay(newDayIndex);
    if (ok) toast.success(`Added a night — re-priced ${range?.length || 1}-night stay`);
  };

  // Re-price a hotel stay with overridden preferences (#2.1 room type /
  // #3.12 meal plan). A stay is one booking, so the WHOLE consecutive
  // same-hotel run is re-priced; whichever preference isn't being changed
  // is carried over from the current snapshot. Reuses the #1.1 run path
  // so stay length / LoS tiers stay correct.
  const repriceStayWith = async (dayIndex, override = {}) => {
    const day = quote.days?.[dayIndex];
    const hotelDoc = hotels.find(h => h._id === day?.hotel?.hotelId);
    if (!hotelDoc) {
      toast.error('Hotel is no longer in your partners list — re-pick it.');
      return;
    }
    const { range, results } = await priceRun(quote.days, dayIndex, hotelDoc, {
      preferredRoomType: override.preferredRoomType ?? day.hotel.roomType,
      preferredMealPlan: override.preferredMealPlan ?? day.hotel.mealPlan,
    });
    if (!range) return;
    reportRun(results);
    setQuote(prev => {
      const days = [...prev.days];
      applyPricedRun(days, results);
      return { ...prev, days };
    });
  };
  const setRoomTypeForStay = (dayIndex, roomType) => repriceStayWith(dayIndex, { preferredRoomType: roomType });
  const setMealPlanForStay = (dayIndex, mealPlan) => repriceStayWith(dayIndex, { preferredMealPlan: mealPlan });

  // Add an activity to a day. Server prices in the activity's source currency
  // and converts to quote currency using org FX overrides — we snapshot both
  // so dayCost stays correct when activities and hotels are in different
  // currencies. Server also returns constraint warnings (minAge/maxGroupSize)
  // which we surface as toasts.
  const addActivityToDay = async (dayIndex, activity) => {
    const day = quote.days[dayIndex];

    // Display + constraint fields from the partner doc — capture even when
    // pricing fails so the operator still sees rich content on the day card.
    const baseSnapshot = {
      activityId: activity._id,
      name: activity.name,
      description: activity.description,
      costPerPerson: activity.costPerPerson,
      groupRate: activity.groupRate,
      pricingModel: activity.pricingModel || 'per_person',
      images: activity.images || [],
      duration: activity.duration || 0,
      destination: activity.destination || '',
      minimumAge: activity.minimumAge || 0,
      maxGroupSize: activity.maxGroupSize || 0,
      season: activity.season || 'all',
      tags: activity.tags || [],
      commissionRate: activity.commissionRate || 0,
      notes: activity.notes || '',
      isOptional: !!activity.isOptional,
    };

    try {
      const { data } = await api.post(`/partners/activities/${activity._id}/price`, {
        adults: quote.travelers.adults,
        children: quote.travelers.children,
        childAges: quote.travelers.childAges || [],
        quoteCurrency: quote.pricing.currency,
      });

      const newAct = {
        ...baseSnapshot,
        sourceCurrency: data.sourceCurrency,
        fxRate: data.fxRate,
        totalCost: data.totalCost,
        totalCostInQuoteCurrency: data.totalCostInQuoteCurrency,
        warnings: data.warnings || [],
        pricingInputs: paxPricingInputs(quote),
      };
      // Functional form: append against the latest day state so two parallel
      // adds don't clobber each other (the closure-captured `day` is stale
      // after the await).
      updateDay(dayIndex, prev => ({ activities: [...(prev.activities || []), newAct] }));
      if (data.warnings?.length) {
        data.warnings.slice(0, 2).forEach(w => toast(w, { icon: '⚠️' }));
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Activity pricing failed');
      // Fall back to a zero-cost snapshot rather than silently miscalculating.
      const newAct = { ...baseSnapshot, totalCost: 0, totalCostInQuoteCurrency: 0 };
      updateDay(dayIndex, prev => ({ activities: [...(prev.activities || []), newAct] }));
    }
  };

  const removeActivityFromDay = (dayIndex, actIdx) => {
    updateDay(dayIndex, prev => ({ activities: (prev.activities || []).filter((_, i) => i !== actIdx) }));
  };

  // Pick a transport for a day. Server applies the pricingModel + FX. The
  // snapshot mirrors the activity/hotel pattern so render paths and dayCost
  // rollup pick it up automatically. Only one transport per day — picking
  // again replaces.
  const setTransportForDay = async (dayIndex, transport, opts = {}) => {
    const baseSnapshot = {
      transportId: transport._id,
      name: transport.name,
      type: transport.type,
      capacity: transport.capacity,
      pricingModel: transport.pricingModel || 'per_day',
      routeOrZone: transport.routeOrZone || '',
      destinations: transport.destinations || [],
      fuelIncluded: !!transport.fuelIncluded,
      driverIncluded: !!transport.driverIncluded,
      images: transport.images || [],
      notes: transport.notes || '',
      rate: transport.rate,
      // Optional, free-text fields the operator can edit on the day card
      estimatedTime: opts.estimatedTime || '',
      distanceKm: opts.distanceKm || 0,
    };

    try {
      const { data } = await api.post(`/partners/transport/${transport._id}/price`, {
        adults: quote.travelers.adults,
        children: quote.travelers.children,
        days: opts.days || 1,
        distanceKm: opts.distanceKm || 0,
        quoteCurrency: quote.pricing.currency,
      });

      const snapshot = {
        ...baseSnapshot,
        sourceCurrency: data.sourceCurrency,
        fxRate: data.fxRate,
        totalCost: data.totalCost,
        totalCostInQuoteCurrency: data.totalCostInQuoteCurrency,
        days: data.days,
        warnings: data.warnings || [],
        pricingInputs: paxPricingInputs(quote),
      };
      updateDay(dayIndex, { transport: snapshot });
      if (data.warnings?.length) {
        data.warnings.slice(0, 2).forEach(w => toast(w, { icon: '⚠️' }));
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Transport pricing failed');
      updateDay(dayIndex, { transport: { ...baseSnapshot, totalCost: 0, totalCostInQuoteCurrency: 0 } });
    }
  };

  const clearTransportForDay = (dayIndex) => updateDay(dayIndex, { transport: null });

  // In-place edit of free-text fields on the existing transport snapshot
  // (estimatedTime, notes). Doesn't re-call the server.
  const updateDayTransportField = (dayIndex, field, value) => {
    updateDay(dayIndex, prev => prev.transport ? { transport: { ...prev.transport, [field]: value } } : {});
  };

  // Image helpers — flexible gallery for each day
  const addImageToDay = (dayIndex, image) => {
    updateDay(dayIndex, prev => ({ images: [...(prev.images || []), image] }));
  };

  const removeImageFromDay = (dayIndex, imgIdx) => {
    updateDay(dayIndex, prev => ({ images: (prev.images || []).filter((_, i) => i !== imgIdx) }));
  };

  const setHeroImageForDay = (dayIndex, imgIdx) => {
    updateDay(dayIndex, prev => {
      const images = [...(prev.images || [])];
      const [hero] = images.splice(imgIdx, 1);
      return { images: [hero, ...images] };
    });
  };

  // Count items whose stored pricingInputs no longer match the current header.
  // Used to drive the global staleness banner.
  const staleItemCount = (() => {
    let n = 0;
    const days = quote.days || [];
    for (let i = 0; i < days.length; i++) {
      const d = days[i];
      if (isItemStale(d.hotel, hotelPricingInputs(quote, i))) n++;
      const paxIn = paxPricingInputs(quote);
      for (const a of (d.activities || [])) if (isItemStale(a, paxIn)) n++;
      if (isItemStale(d.transport, paxIn)) n++;
    }
    return n;
  })();

  // Unacknowledged blocking conditions across the quote. Server enforces this
  // on transition to status='sent', so the chip near Save & Send mirrors that
  // gate. Operator clicks Acknowledge in the day card to clear each one.
  const unacknowledgedBlockers = (() => {
    const out = [];
    (quote.days || []).forEach((d, i) => {
      (d.hotel?.conditions || []).forEach((c, ci) => {
        if (c.severity === 'blocking' && !c.acknowledged) {
          out.push({ dayIndex: i, conditionIndex: ci, hotel: d.hotel?.name, text: c.text, source: c.source || '' });
        }
      });
    });
    return out;
  })();

  const acknowledgeCondition = (dayIndex, conditionIndex) => {
    updateDay(dayIndex, prev => {
      const conditions = (prev.hotel?.conditions || []).map((c, i) => (
        i === conditionIndex ? { ...c, acknowledged: true } : c
      ));
      return { hotel: { ...prev.hotel, conditions } };
    });
  };

  // Re-run pricing for every hotel / activity / transport on the quote against
  // the current header. Looks up the partner doc by id (snapshots only carry
  // hotelId / activityId / transportId), so anything since deleted from
  // inventory is skipped with a warning.
  const [repricing, setRepricing] = useState(false);
  // Set by the currency picker; consumed by the effect below. Lets us
  // distinguish a user-driven currency switch (must reprice) from initial
  // load / deal-prefill (already priced in the loaded currency).
  const [pendingCurrencyReprice, setPendingCurrencyReprice] = useState(false);
  // Set by the start-date input; consumed by the effect below. Lets us reprice
  // already-priced days for the new season without firing on initial load or
  // deal-prefill (those change startDate without setting this flag).
  const [pendingDateReprice, setPendingDateReprice] = useState(false);
  const repriceAll = async () => {
    setRepricing(true);
    let priced = 0;
    let missing = 0;
    try {
      const days = quote.days || [];
      for (let i = 0; i < days.length; i++) {
        const day = days[i];

        if (day.hotel?.hotelId) {
          const hotel = hotels.find(h => h._id === day.hotel.hotelId);
          if (!hotel) {
            missing++;
          } else {
            // Reprice each consecutive same-hotel run exactly once, at its
            // first day, with the true stay length. Later days of the run
            // are handled by that single priceRun call, so skip them here.
            const range = stayRangeAt(days, i);
            if (range && range.start === i) {
              const { results } = await priceRun(days, i, hotel, {
                preferredRoomType: day.hotel.roomType,
                preferredMealPlan: day.hotel.mealPlan,
              });
              setQuote(prev => {
                const d = [...prev.days];
                applyPricedRun(d, results);
                return { ...prev, days: d };
              });
              priced += results.length;
            }
          }
        }

        if (day.transport?.transportId) {
          const t = transport.find(x => x._id === day.transport.transportId);
          if (t) {
            await setTransportForDay(i, t, {
              days: day.transport.days,
              distanceKm: day.transport.distanceKm,
              estimatedTime: day.transport.estimatedTime,
            });
            priced++;
          } else {
            missing++;
          }
        }

        if (day.activities?.length) {
          const ids = day.activities.map(a => a.activityId).filter(Boolean);
          // Clear, then re-add each — addActivityToDay appends.
          updateDay(i, { activities: [] });
          for (const actId of ids) {
            const act = activities.find(a => a._id === actId);
            if (act) {
              await addActivityToDay(i, act);
              priced++;
            } else {
              missing++;
            }
          }
        }
      }
      const tail = missing ? ` · ${missing} item${missing === 1 ? '' : 's'} no longer in inventory` : '';
      toast.success(`Repriced ${priced} item${priced === 1 ? '' : 's'}${tail}`);
    } catch (err) {
      toast.error(`Reprice failed: ${err.response?.data?.message || err.message}`);
    } finally {
      setRepricing(false);
    }
  };

  // Items snapshot their FX rate at pick-time, so switching the quote's
  // display currency can't be done by relabeling — we re-run each pick
  // against the new currency. We defer to an effect (rather than calling
  // repriceAll from the onChange) so repriceAll's closure captures the
  // committed quote state, not the pre-update one.
  useEffect(() => {
    if (pendingCurrencyReprice && !repricing) {
      setPendingCurrencyReprice(false);
      repriceAll();
    }
  }, [quote.pricing.currency, pendingCurrencyReprice, repricing]);

  // The start date sets every day's check-in, so changing it can land the stay
  // in a different rate-list season. Reprice the existing picks (repriceAll
  // preserves room/meal/transport choices) so prices never silently lag the
  // dates. Only when there's something priced to update; deferred via the flag
  // so prefill / initial load don't trigger it.
  useEffect(() => {
    if (pendingDateReprice && !repricing) {
      setPendingDateReprice(false);
      const hasPriced = (quote.days || []).some(d => d.hotel?.hotelId || d.transport?.transportId || d.activities?.length);
      if (quote.startDate && hasPriced) repriceAll();
    }
  }, [quote.startDate, pendingDateReprice, repricing]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSave = async (status) => {
    if (!quote.title) { toast.error('Please add a title'); return; }
    setSaving(true);
    try {
      // Coerce contact/deal to bare ID strings — defensive in case they ever
      // hold a populated object from a stale code path. Empty → null so the
      // route's normalize step recognizes "unset" and doesn't try to cast ''
      // to ObjectId.
      const idOf = (v) => (v && typeof v === 'object' ? v._id : v) || null;
      const payload = {
        ...quote,
        status: status || quote.status || 'draft',
        contact: idOf(quote.contact),
        deal: idOf(searchParams.get('deal') || quote.deal),
      };
      if (id) {
        await api.put(`/quotes/${id}`, payload);
        toast.success('Quote saved');
      } else {
        const { data } = await api.post('/quotes', payload);
        toast.success('Quote created');
        navigate(`/quotes/${data._id}`);
      }
      // Saved state is now the clean baseline — clear the dirty flag so
      // navigating away no longer prompts.
      savedRef.current = JSON.stringify(quoteRef.current);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  // Skeleton that mirrors the builder layout while an existing quote
  // loads — steadier than a bare spinner and prevents the empty-form flash.
  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in" aria-busy="true">
        <div className="flex items-center justify-between">
          <div className="h-5 w-20 rounded bg-muted animate-pulse" />
          <div className="flex gap-2">
            <div className="h-9 w-24 rounded-lg bg-muted animate-pulse" />
            <div className="h-9 w-28 rounded-lg bg-muted animate-pulse" />
          </div>
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
          <div className="xl:col-span-3 space-y-4">
            <div className="bg-card rounded-xl border border-border p-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="space-y-2">
                    <div className="h-3 w-20 rounded bg-muted animate-pulse" />
                    <div className="h-9 w-full rounded-lg bg-muted animate-pulse" />
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-card rounded-xl border border-border p-5 h-32 animate-pulse" />
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-card rounded-xl border border-border p-5 h-20 animate-pulse" />
            ))}
          </div>
          <div className="space-y-4">
            <div className="bg-card rounded-xl border border-border p-5 h-64 animate-pulse" />
            <div className="bg-card rounded-xl border border-border p-5 h-28 animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in pb-24 xl:pb-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <button
          onClick={() => {
            if (isDirty()) {
              setConfirmDialog({
                title: 'Discard unsaved changes?',
                message: 'You have edits that haven\'t been saved. Leaving now will discard them.',
                confirmLabel: 'Discard & leave',
                tone: 'danger',
                onConfirm: () => { setConfirmDialog(null); navigate('/quotes'); },
              });
              return;
            }
            navigate('/quotes');
          }}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors self-start sm:self-auto"
        >
          <ArrowLeft className="w-4 h-4" /> Quotes
        </button>
        <div className="flex items-center flex-wrap gap-2">
          {id && (
            <>
              <button
                onClick={() => {
                  const url = `${window.location.origin}/quote/${quote.shareToken}`;
                  navigator.clipboard.writeText(url);
                  toast.success('Share link copied!');
                }}
                className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-card border border-border text-sm font-medium text-muted-foreground hover:text-foreground hover:border-muted-foreground/40 transition-colors"
                title="Copy share link"
              >
                <Link2 className="w-4 h-4" /> Share Link
              </button>
              <button
                onClick={async () => {
                  try {
                    const { downloadFile } = await import('../utils/api');
                    await downloadFile(`/pdf/${id}/pdf/download`, `quote-${quote.quoteNumber || id}.pdf`);
                  } catch (err) {
                    toast.error('PDF download failed');
                  }
                }}
                className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-card border border-border text-sm font-medium text-muted-foreground hover:text-foreground hover:border-muted-foreground/40 transition-colors"
              >
                <FileText className="w-4 h-4" /> PDF
              </button>

              {/* Rare actions tucked behind an overflow menu so the action
                  row reads as: secondary · secondary · ⋯ | Preview · Save · Send */}
              <div className="relative">
                <button
                  onClick={() => setOverflowOpen(o => !o)}
                  className="inline-flex items-center justify-center px-2.5 py-2 rounded-lg bg-card border border-border text-muted-foreground hover:text-foreground hover:border-muted-foreground/40 transition-colors"
                  title="More actions"
                  aria-haspopup="menu"
                  aria-expanded={overflowOpen}
                >
                  <MoreHorizontal className="w-4 h-4" />
                </button>
                {overflowOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setOverflowOpen(false)} />
                    <div className="absolute right-0 mt-1 w-52 z-50 rounded-lg border border-border bg-card shadow-xl py-1" role="menu">
                      <button
                        role="menuitem"
                        onClick={() => { setOverflowOpen(false); setTemplateModal(true); }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-muted/50 transition-colors"
                      >
                        <Star className="w-4 h-4 text-muted-foreground" /> Save as Template
                      </button>
                      <button
                        role="menuitem"
                        onClick={() => {
                          setOverflowOpen(false);
                          setConfirmDialog({
                            title: 'Create a new version?',
                            message: 'The current version will be preserved and a new editable copy will open.',
                            confirmLabel: 'Create version',
                            onConfirm: async () => {
                              try {
                                const { data } = await api.post(`/quotes/${id}/version`);
                                toast.success(`Version ${data.version} created`);
                                setConfirmDialog(null);
                                navigate(`/quotes/${data._id}`);
                              } catch {
                                setConfirmDialog(null);
                                toast.error('Version creation failed');
                              }
                            },
                          });
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-muted/50 transition-colors"
                      >
                        <Copy className="w-4 h-4 text-muted-foreground" /> New Version
                      </button>
                    </div>
                  </>
                )}
              </div>

              <div className="w-px h-6 bg-border mx-0.5 hidden sm:block" />
            </>
          )}
          <button
            onClick={() => setShowPreview(!showPreview)}
            className={`inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${showPreview ? 'bg-primary text-white border-primary hover:bg-primary/90' : 'bg-card border-border text-muted-foreground hover:text-foreground hover:border-muted-foreground/40'}`}
            title="Toggle live preview"
          >
            <Eye className="w-4 h-4" /> {showPreview ? 'Hide Preview' : 'Preview'}
          </button>
          <button onClick={() => handleSave('draft')} disabled={saving} className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-card border border-border text-sm font-medium text-foreground hover:border-muted-foreground/40 transition-colors disabled:opacity-50">
            <Save className="w-4 h-4" /> Save Draft
          </button>
          <button
            onClick={() => handleSave('sent')}
            disabled={saving || unacknowledgedBlockers.length > 0}
            title={unacknowledgedBlockers.length > 0
              ? `${unacknowledgedBlockers.length} blocking condition${unacknowledgedBlockers.length === 1 ? '' : 's'} must be acknowledged before sending`
              : ''}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-primary text-white text-sm font-semibold shadow-sm hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="w-4 h-4" />
            Save &amp; Send
            {unacknowledgedBlockers.length > 0 && (
              <span className="ml-1 inline-flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-700 text-white">
                {unacknowledgedBlockers.length}
              </span>
            )}
          </button>
        </div>
      </div>

      <div className={showPreview ? 'grid grid-cols-1 lg:grid-cols-2 gap-4' : 'grid grid-cols-1 xl:grid-cols-4 gap-6'}>
        {showPreview && (
          <div className="lg:order-2 lg:sticky lg:top-4 max-h-[60vh] lg:max-h-[calc(100vh-2rem)] overflow-y-auto rounded-xl border border-border bg-card">
            <div className="sticky top-0 z-10 bg-primary/10 border-b border-amber-100 px-3 py-1.5 text-[10px] font-semibold text-primary uppercase tracking-wide flex items-center gap-1.5">
              <Eye className="w-3 h-3" /> Live Preview
            </div>
            {/* `zoom` scales the layout box (unlike `transform: scale`,
                which leaves the original-size box behind and forced the
                old `-mt-12` crop hack). No offset compensation needed —
                the Live Preview bar above is a normal sticky sibling. */}
            <div style={{ zoom: 0.75 }}>
              <QuoteRenderer quote={quote} previewMode={true} />
            </div>
          </div>
        )}
        <div className={showPreview ? 'lg:order-1 space-y-4' : 'xl:col-span-3 space-y-4'}>
          {/* Trip Info */}
          <div className="bg-card rounded-xl border border-border p-4 sm:p-5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Trip Title <span className="text-destructive">*</span>
                </label>
                <input
                  type="text"
                  value={quote.title}
                  onChange={(e) => setQuote({ ...quote, title: e.target.value })}
                  placeholder="e.g. 13-Day Kenya Safari & Beach Holiday"
                  className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-base font-medium text-foreground focus:outline-none focus:border-primary transition-colors"
                />
              </div>
              <div>
                <div className="flex items-baseline justify-between mb-1">
                  <label className="block text-xs font-medium text-muted-foreground">
                    {linkMode === 'deal' ? 'Deal' : 'Client'}
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      // Switching modes clears the OTHER link so we don't ship
                      // a contact-only save with a stale deal still attached
                      // (or vice versa).
                      if (linkMode === 'deal') {
                        setLinkMode('contact');
                        setQuote(q => ({ ...q, deal: '' }));
                      } else {
                        setLinkMode('deal');
                        setQuote(q => ({ ...q, contact: '' }));
                      }
                    }}
                    className="text-[11px] text-primary hover:underline"
                  >
                    {linkMode === 'deal' ? 'pick a contact instead' : 'pick a deal instead'}
                  </button>
                </div>

                {linkMode === 'deal' ? (
                  <>
                    <select
                      value={quote.deal || ''}
                      onChange={(e) => {
                        const dealId = e.target.value;
                        if (!dealId) { setQuote({ ...quote, deal: '', contact: '' }); return; }
                        // Apply the FULL deal context (dates, pax split, clientType,
                        // nationality, currency) — same as the deal-panel "Create
                        // Quote" path. Switching from another deal (a misclick fix)
                        // overwrites the old deal's values; a first pick only fills
                        // blanks so manual input survives.
                        const switching = !!quote.deal && quote.deal !== dealId;
                        const source = deals.find(d => d._id === dealId);
                        if (source) applyDealToQuote(source, { overwrite: switching });
                      }}
                      className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm text-foreground focus:outline-none focus:border-primary transition-colors"
                    >
                      <option value="">Select deal...</option>
                      {deals.map(d => {
                        const c = d.contact;
                        const who = c ? `${c.firstName || ''} ${c.lastName || ''}`.trim() : '';
                        return (
                          <option key={d._id} value={d._id}>
                            {d.title}{who ? ` — ${who}` : ''}
                          </option>
                        );
                      })}
                    </select>
                    {quote.deal && (() => {
                      const picked = deals.find(d => d._id === quote.deal);
                      const c = picked?.contact;
                      if (!c) return null;
                      const name = `${c.firstName || ''} ${c.lastName || ''}`.trim();
                      return (
                        <p className="text-[11px] text-muted-foreground mt-1 truncate">
                          For: {name}{c.email ? ` · ${c.email}` : ''}
                        </p>
                      );
                    })()}
                  </>
                ) : (
                  <>
                    <select
                      value={quote.contact || ''}
                      onChange={(e) => setQuote({ ...quote, contact: e.target.value || '' })}
                      className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm text-foreground focus:outline-none focus:border-primary transition-colors"
                    >
                      <option value="">Select contact...</option>
                      {contacts.map(c => (
                        <option key={c._id} value={c._id}>{c.firstName} {c.lastName}{c.company ? ` (${c.company})` : ''}</option>
                      ))}
                    </select>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      Contact-only quotes won't appear in pipeline reporting or generate vouchers.
                    </p>
                  </>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Start Date <span className="text-destructive">*</span>
                </label>
                <input
                  type="date"
                  value={quote.startDate}
                  onChange={(e) => { setQuote({ ...quote, startDate: e.target.value }); setPendingDateReprice(true); }}
                  className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm text-foreground focus:outline-none focus:border-primary transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">End Date</label>
                <input
                  type="date"
                  value={quote.endDate || ''}
                  min={quote.startDate || undefined}
                  onChange={(e) => setQuote({ ...quote, endDate: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm text-foreground focus:outline-none focus:border-primary transition-colors"
                />
                {quote.startDate && quote.endDate && quote.endDate < quote.startDate && (
                  <p className="text-[10px] text-amber-600 mt-1">End date is before the start date.</p>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Tour Type</label>
                <select
                  value={quote.tourType}
                  onChange={(e) => setQuote({ ...quote, tourType: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm text-foreground focus:outline-none focus:border-primary transition-colors"
                >
                  <option value="private">Private Tour</option>
                  <option value="group">Group Tour</option>
                  <option value="self-drive">Self-Drive</option>
                  <option value="custom">Custom</option>
                </select>
              </div>
            </div>
          </div>

          {/* Travelers & Rooms — party composition + explicit room split.
              Its own card now: a distinct concern from the identity fields,
              and previously crammed into one cell of the Trip Info grid. */}
          <div className="bg-card rounded-xl border border-border p-4 sm:p-5">
            <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-1.5">
              <UsersIcon className="w-4 h-4" /> Travelers &amp; Rooms
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Adults</label>
                <input
                  type="number"
                  min={1}
                  value={quote.travelers.adults}
                  onChange={(e) => setQuote({ ...quote, travelers: { ...quote.travelers, adults: parseInt(e.target.value) || 1 } })}
                  className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm text-foreground focus:outline-none focus:border-primary transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Children</label>
                <input
                  type="number"
                  min={0}
                  value={quote.travelers.children}
                  onChange={(e) => {
                    const n = Math.max(0, parseInt(e.target.value) || 0);
                    // Keep childAges length in sync — preserve already-entered ages,
                    // pad with the default-8 used elsewhere (matches the search
                    // executor's DEFAULT_CHILD_AGE convention).
                    const existing = quote.travelers.childAges || [];
                    const ages = existing.slice(0, n);
                    while (ages.length < n) ages.push(8);
                    setQuote({ ...quote, travelers: { ...quote.travelers, children: n, childAges: ages } });
                  }}
                  className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm text-foreground focus:outline-none focus:border-primary transition-colors"
                />
              </div>
              {/* Explicit room split (#2.2). Blank → resolver infers
                  (pair adults into doubles, lone adult single, kids
                  shared). Set any field → that split is authoritative
                  for every hotel. Changing this marks priced hotels
                  stale via the "Reprice all" banner. */}
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Rooms <span className="text-muted-foreground/60">(optional — auto if blank)</span>
                </label>
                <div className="flex flex-wrap gap-3">
                  {[
                    { key: 'singles', label: 'Sgl' },
                    { key: 'doubles', label: 'Dbl' },
                    { key: 'triples', label: 'Tpl' },
                    { key: 'quads', label: 'Quad' },
                  ].map(({ key, label }) => (
                    <div key={key} className="flex items-center gap-1.5">
                      <span className="text-[11px] text-muted-foreground/70 w-7 text-right">{label}</span>
                      <input
                        type="number"
                        min={0}
                        value={quote.travelers.rooms?.[key] ?? 0}
                        onChange={(e) => {
                          const v = Math.max(0, parseInt(e.target.value) || 0);
                          setQuote({
                            ...quote,
                            travelers: {
                              ...quote.travelers,
                              rooms: { ...(quote.travelers.rooms || {}), [key]: v },
                            },
                          });
                        }}
                        className="w-14 px-2 py-1.5 rounded-md bg-background border border-border text-sm text-foreground focus:outline-none focus:border-primary"
                        title={`Number of ${key}`}
                      />
                    </div>
                  ))}
                </div>
                {(() => {
                  const r = quote.travelers.rooms || {};
                  const cap = (Number(r.singles) || 0) * 1 + (Number(r.doubles) || 0) * 2
                    + (Number(r.triples) || 0) * 3 + (Number(r.quads) || 0) * 4;
                  const party = (Number(quote.travelers.adults) || 0) + (Number(quote.travelers.children) || 0);
                  if (cap === 0) {
                    return (
                      <p className="text-[11px] text-muted-foreground/60 mt-1.5">
                        Auto — rooms inferred from party size.
                      </p>
                    );
                  }
                  const ok = cap === party;
                  return (
                    <p className={`text-[11px] mt-1.5 ${ok ? 'text-muted-foreground/60' : 'text-amber-600'}`}>
                      {ok ? '✓' : '⚠'} Configured for {cap} guest{cap === 1 ? '' : 's'} · party is {party}
                      {!ok && ' — check the split'}
                    </p>
                  );
                })()}
              </div>
            </div>
            {quote.travelers.children > 0 && (
              <div className="mt-4 flex flex-wrap items-center gap-1.5">
                <span className="text-xs font-medium text-muted-foreground">Child ages:</span>
                {Array.from({ length: quote.travelers.children }).map((_, i) => (
                  <input
                    key={i}
                    type="number"
                    min={0}
                    max={17}
                    value={quote.travelers.childAges?.[i] ?? 8}
                    onChange={(e) => {
                      const v = parseInt(e.target.value);
                      const age = Number.isFinite(v) ? Math.min(17, Math.max(0, v)) : 8;
                      const ages = [...(quote.travelers.childAges || [])];
                      while (ages.length < quote.travelers.children) ages.push(8);
                      ages[i] = age;
                      setQuote({ ...quote, travelers: { ...quote.travelers, childAges: ages } });
                    }}
                    className="w-12 px-2 py-1 rounded-md bg-background border border-border text-xs text-foreground focus:outline-none focus:border-primary"
                    title={`Age of child ${i + 1}`}
                  />
                ))}
                <span className="text-[11px] text-muted-foreground/60 ml-1">
                  Drives child rate brackets and park-fee tiers.
                </span>
                <p className="w-full text-[11px] text-amber-600 mt-1">
                  ⚠ Ages default to 8 — set each child's real age, it changes the price (0–3 often free, 4–11 discounted).
                </p>
              </div>
            )}
          </div>

          {/* Pricing basis & cover */}
          <div className="bg-card rounded-xl border border-border p-4 sm:p-5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Currency</label>
                <select
                  value={quote.pricing.currency}
                  onChange={(e) => {
                    const newCurrency = e.target.value;
                    if (newCurrency === quote.pricing.currency) return;
                    setQuote({ ...quote, pricing: { ...quote.pricing, currency: newCurrency } });
                    const hasPricedItems = (quote.days || []).some(d =>
                      d.hotel?.hotelId || d.transport?.transportId || (d.activities || []).length > 0
                    );
                    if (hasPricedItems) setPendingCurrencyReprice(true);
                  }}
                  className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm text-foreground focus:outline-none focus:border-primary transition-colors"
                >
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="GBP">GBP (£)</option>
                  <option value="KES">KES (KSh)</option>
                  <option value="TZS">TZS</option>
                  <option value="UGX">UGX</option>
                  <option value="RWF">RWF</option>
                  <option value="ZAR">ZAR (R)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Client Type</label>
                <select
                  value={quote.clientType}
                  onChange={(e) => setQuote({ ...quote, clientType: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm text-foreground focus:outline-none focus:border-primary transition-colors"
                >
                  <option value="retail">Retail (public rack)</option>
                  <option value="contract">Contract (DMC / agent / STO)</option>
                  <option value="resident">Resident (EAC / citizen)</option>
                </select>
                <p className="text-[10px] text-muted-foreground mt-0.5">Drives which supplier rate sheet we pull from.</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Nationality (for park fees)</label>
                <select
                  value={quote.nationality}
                  onChange={(e) => setQuote({ ...quote, nationality: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm text-foreground focus:outline-none focus:border-primary transition-colors"
                >
                  <option value="nonResident">International (non-resident)</option>
                  <option value="resident">East African resident</option>
                  <option value="citizen">Citizen</option>
                </select>
                <p className="text-[10px] text-muted-foreground mt-0.5">Applied to tiered park/community fees.</p>
              </div>
            </div>
            <div className="mt-4">
              <label className="block text-xs font-medium text-muted-foreground mb-1">Cover Narrative (shown on quote cover)</label>
              <textarea
                value={quote.coverNarrative || ''}
                onChange={(e) => setQuote({ ...quote, coverNarrative: e.target.value })}
                rows={2}
                placeholder="A brief introduction for your client — AI can generate this for you"
                className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:border-primary transition-colors resize-none"
              />
            </div>
            <CoverImagePicker
              coverImage={quote.coverImage}
              days={quote.days || []}
              onChange={(img) => setQuote({ ...quote, coverImage: img })}
            />
            <div className="mt-4">
              <label className="block text-xs font-medium text-muted-foreground mb-2">Style</label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {[
                  { id: 'editorial', name: 'Editorial', desc: 'Serif headings, classic' },
                  { id: 'modern', name: 'Modern', desc: 'Bold sans, clean' },
                  { id: 'minimal', name: 'Minimal', desc: 'Elegant, airy' },
                ].map(s => {
                  const active = (quote.pdfStyle || 'editorial') === s.id;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setQuote({ ...quote, pdfStyle: s.id })}
                      className={`text-left px-3 py-2 rounded-lg border transition-colors ${
                        active ? 'border-primary bg-primary/5' : 'border-border bg-background hover:border-muted-foreground/40'
                      }`}
                    >
                      <div className={`text-sm font-medium ${active ? 'text-primary' : 'text-foreground'}`}>{s.name}</div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">{s.desc}</div>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="mt-4">
              <label className="block text-xs font-medium text-muted-foreground mb-2">Cover Layout</label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {[
                  { id: 'full_bleed', name: 'Full Bleed', desc: 'Image fills page' },
                  { id: 'split', name: 'Split', desc: 'Image left, text right' },
                  { id: 'band', name: 'Band', desc: 'Image top 40%' },
                ].map(s => {
                  const active = (quote.coverLayout || 'full_bleed') === s.id;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setQuote({ ...quote, coverLayout: s.id })}
                      className={`text-left px-3 py-2 rounded-lg border transition-colors ${
                        active ? 'border-primary bg-primary/5' : 'border-border bg-background hover:border-muted-foreground/40'
                      }`}
                    >
                      <div className={`text-sm font-medium ${active ? 'text-primary' : 'text-foreground'}`}>{s.name}</div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">{s.desc}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Staleness banner — surfaces when header inputs (dates, pax,
              clientType, nationality, currency) have drifted away from what
              picks were priced against. Operator clicks Reprice to refresh
              every hotel / activity / transport against the current header. */}
          {staleItemCount > 0 && (
            <div className="flex items-start gap-3 p-3 rounded-lg border border-amber-300 bg-amber-50 text-amber-900">
              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <div className="flex-1 text-sm">
                <p className="font-medium">
                  {staleItemCount} item{staleItemCount === 1 ? '' : 's'} priced for older trip settings
                </p>
                <p className="text-xs text-amber-800/80 mt-0.5">
                  You changed dates, travelers, client type, nationality, or currency after picking. Reprice to refresh against the current header.
                </p>
              </div>
              <button
                type="button"
                onClick={repriceAll}
                disabled={repricing}
                className="text-xs font-semibold px-3 py-1.5 rounded-md bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {repricing ? 'Repricing…' : 'Reprice all'}
              </button>
            </div>
          )}

          {/* Timeline / Segments */}
          <div className="space-y-3">
            {/* Blocking-conditions summary. The per-day Acknowledge buttons live
                inside each (singly-)expanded day card, so blockers on collapsed
                days are invisible — this banner gathers them all with inline
                Acknowledge + click-to-jump so the operator can clear the Save &
                Send gate without hunting day-by-day. */}
            {unacknowledgedBlockers.length > 0 && (
              <div className="rounded-xl border border-red-300 bg-red-50 p-3">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0" />
                  <p className="text-xs font-semibold text-red-900">
                    {unacknowledgedBlockers.length} blocking condition{unacknowledgedBlockers.length === 1 ? '' : 's'} must be acknowledged before this quote can be sent
                  </p>
                </div>
                <ul className="space-y-1.5">
                  {unacknowledgedBlockers.map((b, i) => {
                    const isFx = b.source === 'system:fx';
                    return (
                      <li key={i} className="flex items-start gap-2 text-[11px] bg-white border border-red-200 rounded-lg p-2">
                        <div className="flex-1 min-w-0">
                          <button
                            type="button"
                            onClick={() => setExpandedDay(b.dayIndex)}
                            className="text-red-700 font-semibold hover:underline"
                          >
                            Day {b.dayIndex + 1}{b.hotel ? ` · ${b.hotel}` : ''}
                          </button>
                          <p className="text-red-900/80 leading-snug mt-0.5">{b.text}</p>
                          {isFx && (
                            <p className="text-[10px] text-red-700/70 mt-0.5">
                              Missing exchange rate — set it in Settings and re-price for an accurate total, or acknowledge to send at an inaccurate 1:1 rate.
                            </p>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => acknowledgeCondition(b.dayIndex, b.conditionIndex)}
                          className="text-[10px] font-semibold px-2 py-1 rounded bg-red-600 text-white hover:bg-red-700 shrink-0"
                        >
                          Acknowledge
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            {/* Start point */}
            <div className="flex items-center gap-3 px-2">
              <div className="w-8 h-8 rounded-full bg-green-500 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">S</div>
              <input
                type="text"
                value={quote.startPoint}
                onChange={(e) => setQuote({ ...quote, startPoint: e.target.value })}
                className="text-sm font-medium text-foreground bg-transparent border-b border-dashed border-border focus:outline-none focus:border-primary pb-0.5"
                placeholder="Start point"
              />
            </div>

            {/* Days */}
            {(quote.days || []).map((day, idx) => (
              <DayCard
                key={day._id || idx}
                day={day}
                index={idx}
                dayPt={dayPassThroughFace(quote.days || [], idx)}
                isExpanded={expandedDay === idx}
                onToggle={() => setExpandedDay(expandedDay === idx ? -1 : idx)}
                onUpdate={(updates) => updateDay(idx, updates)}
                onRemove={() => removeDay(idx)}
                onMoveUp={() => moveDay(idx, -1)}
                onMoveDown={() => moveDay(idx, 1)}
                onDuplicate={() => duplicateDay(idx)}
                onAddAfter={() => addDay(idx)}
                isFirst={idx === 0}
                isLast={idx === quote.days.length - 1}
                hotels={hotels}
                activities={activities}
                transport={transport}
                destinations={destinations}
                currency={quote.pricing.currency}
                marginPercent={quote.pricing.marginPercent}
                checkInDate={addDaysIso(quote.startDate, idx)}
                onSelectHotel={(hotel) => selectHotelForDay(idx, hotel)}
                onExtendStay={() => extendStayFromDay(idx)}
                onChangeRoomType={(rt) => setRoomTypeForStay(idx, rt)}
                onChangeMealPlan={(mp) => setMealPlanForStay(idx, mp)}
                onAddActivity={(activity) => addActivityToDay(idx, activity)}
                onRemoveActivity={(actIdx) => removeActivityFromDay(idx, actIdx)}
                onSelectTransport={(t, opts) => setTransportForDay(idx, t, opts)}
                onClearTransport={() => clearTransportForDay(idx)}
                onUpdateTransportField={(field, value) => updateDayTransportField(idx, field, value)}
                onAddImage={(image) => addImageToDay(idx, image)}
                onRemoveImage={(imgIdx) => removeImageFromDay(idx, imgIdx)}
                onSetHero={(imgIdx) => setHeroImageForDay(idx, imgIdx)}
                onAcknowledgeCondition={acknowledgeCondition}
              />
            ))}

            {/* Add day button */}
            {quote.days?.length > 0 && (
              <div className="flex items-center gap-3 px-2 py-1">
                <div className="w-8 flex justify-center"><div className="w-0.5 h-4 bg-border" /></div>
              </div>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => addDay()}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-border text-sm text-muted-foreground hover:border-primary hover:text-primary transition-colors"
              >
                <Plus className="w-4 h-4" /> Add Day
              </button>
              {packages.length > 0 && (
                <button
                  onClick={() => setShowPackagePicker(true)}
                  className="px-4 py-3 rounded-xl border-2 border-dashed border-border text-sm text-muted-foreground hover:border-primary hover:text-primary transition-colors whitespace-nowrap"
                  title="Apply a pre-built package (replaces itinerary + pricing)"
                >
                  From Package
                </button>
              )}
            </div>

            {showPackagePicker && (
              <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center p-4 pt-[10vh]" onClick={() => setShowPackagePicker(false)}>
                <div onClick={e => e.stopPropagation()} className="bg-card rounded-xl shadow-xl w-full max-w-xl max-h-[80vh] flex flex-col">
                  <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                    <h3 className="text-base font-semibold text-foreground">Apply a Package</h3>
                    <button onClick={() => setShowPackagePicker(false)} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
                  </div>
                  <div className="p-4 overflow-y-auto space-y-2">
                    {packages.map(p => {
                      // Show the cheapest starting tier across all pricing lists,
                      // labeled with the matching list's currency.
                      const allLists = (p.pricingLists || []).filter(l => l.isActive !== false);
                      let startTier = null;
                      let startList = null;
                      for (const l of allLists) {
                        const t = (l.paxTiers || [])[0];
                        if (t && (!startTier || t.pricePerPerson < startTier.pricePerPerson)) {
                          startTier = t;
                          startList = l;
                        }
                      }
                      const audienceTags = Array.from(new Set(allLists.flatMap(l => l.audience || [])));
                      return (
                        <button
                          key={p._id}
                          onClick={() => applyPackage(p)}
                          className="w-full text-left p-3 rounded-lg border border-border hover:border-primary hover:bg-muted/30 transition-colors"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-semibold text-foreground">{p.name}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {p.destination || '—'}
                                {p.durationDays > 0 && ` · ${p.durationDays} days / ${p.durationNights} nights`}
                                {audienceTags.length > 0 && ` · ${audienceTags.join('/')}`}
                              </p>
                            </div>
                            {startTier && (
                              <span className="text-xs font-bold text-foreground whitespace-nowrap">
                                from {formatCurrency(startTier.pricePerPerson, startList?.currency)}/pp
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* End point */}
            <div className="flex items-center gap-3 px-2 pt-2">
              <div className="w-8 h-8 rounded-full bg-red-500 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">E</div>
              <input
                type="text"
                value={quote.endPoint}
                onChange={(e) => setQuote({ ...quote, endPoint: e.target.value })}
                className="text-sm font-medium text-foreground bg-transparent border-b border-dashed border-border focus:outline-none focus:border-primary pb-0.5"
                placeholder="End point"
              />
            </div>
          </div>
        </div>

        {/* Pricing sidebar - 1 col */}
        {!showPreview && (
        <div className="space-y-4">
          <div className="bg-card rounded-xl border border-border p-4 sm:p-5 xl:sticky xl:top-8">
            <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-1.5">
              <DollarSign className="w-4 h-4" /> Pricing
            </h3>

            {/* No-date guard: accommodation seasons resolve off the stay dates,
                so a quote with no start date is silently priced at TODAY's
                season — which can land on the wrong rates. Warn while that's
                the case and there's something priced. */}
            {!quote.startDate && quote.days?.length > 0 && (
              <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-2.5 flex items-start gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-amber-800">
                  No travel dates set — accommodation is priced at <span className="font-semibold">today's season</span> and may not reflect the real travel period. Set a start date to price the correct season.
                </p>
              </div>
            )}

            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal (cost)</span>
                <span className="text-foreground font-medium">{formatCurrency(quote.pricing.subtotal, quote.pricing.currency)}</span>
              </div>

              <div>
                <div className="flex justify-between items-center text-sm mb-1">
                  <span className="text-muted-foreground">Margin</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={quote.pricing.marginPercent}
                      onChange={(e) => {
                        const v = parseInt(e.target.value);
                        const m = Number.isFinite(v) ? Math.min(100, Math.max(0, v)) : 0;
                        setQuote({ ...quote, pricing: { ...quote.pricing, marginPercent: m } });
                      }}
                      className="w-14 px-1.5 py-0.5 rounded-md bg-background border border-border text-sm text-right text-foreground focus:outline-none focus:border-primary"
                    />
                    <span className="text-muted-foreground font-medium">%</span>
                  </div>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={quote.pricing.marginPercent}
                  onChange={(e) => setQuote({
                    ...quote,
                    pricing: { ...quote.pricing, marginPercent: parseInt(e.target.value) },
                  })}
                  className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-[hsl(243_75%_59%)]"
                />
                <div className="flex justify-between text-xs text-muted-foreground/70 mt-0.5">
                  <span>0%</span>
                  <span className="text-primary font-medium">+{formatCurrency(quote.pricing.marginAmount, quote.pricing.currency)}</span>
                  <span>100%</span>
                </div>
              </div>

              <label className="flex items-start gap-2 text-xs text-muted-foreground cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={quote.pricing.markupPassThroughFees !== false}
                  onChange={(e) => setQuote({
                    ...quote,
                    pricing: { ...quote.pricing, markupPassThroughFees: e.target.checked },
                  })}
                  className="mt-0.5 rounded border-border accent-[hsl(243_75%_59%)]"
                />
                <span className="leading-tight">
                  Mark up park &amp; pass-through fees
                  <span className="block text-muted-foreground/60 mt-0.5">
                    Off = client pays park / conservancy fees at face value
                  </span>
                </span>
              </label>

              <div className="border-t border-border pt-3">
                <div className="flex justify-between text-sm">
                  <span className="font-semibold text-foreground">Client Price</span>
                  <span className="text-lg font-bold text-primary">{formatCurrency(quote.pricing.totalPrice, quote.pricing.currency)}</span>
                </div>
                {quote.travelers.adults + quote.travelers.children > 0 && (
                  <p className="text-xs text-muted-foreground/70 text-right mt-0.5">
                    {formatCurrency(quote.pricing.perPersonPrice, quote.pricing.currency)} per person
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Client sees</label>
                <select
                  value={quote.pricing.displayMode}
                  onChange={(e) => setQuote({
                    ...quote,
                    pricing: { ...quote.pricing, displayMode: e.target.value },
                  })}
                  className="w-full px-3 py-2 rounded-lg bg-background border border-border text-xs focus:outline-none focus:border-primary transition-colors"
                >
                  <option value="total_only">Total price only</option>
                  <option value="line_items">Line item breakdown</option>
                </select>
              </div>

              {/* Line Items Editor */}
              {quote.pricing.displayMode === 'line_items' && (
                <LineItemsEditor
                  lineItems={quote.pricing.lineItems || []}
                  onChange={(items) => setQuote({
                    ...quote,
                    pricing: { ...quote.pricing, lineItems: items },
                  })}
                  segments={quote.days || []}
                  marginPercent={quote.pricing.marginPercent}
                  currency={quote.pricing.currency}
                  quoteTotal={quote.pricing.totalPrice}
                  markupFees={quote.pricing.markupPassThroughFees !== false}
                  // Auto-generate: replace only the previously auto-generated
                  // rows, then flag every day as itemized. Manual extras
                  // (insurance, tips) and package totals are preserved so
                  // re-clicking Auto-generate doesn't wipe them. Days are
                  // flagged in the same setQuote as the items write so the
                  // pricing useEffect always sees a consistent state.
                  onAutoGenerate={(newAutoItems) => setQuote(prev => ({
                    ...prev,
                    days: (prev.days || []).map(d => (
                      d.isItemized ? d : { ...d, isItemized: true }
                    )),
                    pricing: {
                      ...prev.pricing,
                      lineItems: [
                        ...(prev.pricing.lineItems || []).filter(li => li.source !== 'auto'),
                        ...newAutoItems,
                      ],
                    },
                  }))}
                  // Reset: drop auto-generated rows, keep manual + package.
                  // Clear isItemized only on days that aren't carrying a
                  // package hotel — package days stay itemized because
                  // their dayCost is 0 and the package line item is the
                  // canonical source for their total.
                  onResetToDayRollup={() => setQuote(prev => ({
                    ...prev,
                    days: (prev.days || []).map(d => (
                      d.hotel?.isPackageNight ? d : (d.isItemized ? { ...d, isItemized: false } : d)
                    )),
                    pricing: {
                      ...prev.pricing,
                      lineItems: (prev.pricing.lineItems || []).filter(li => li.source !== 'auto'),
                    },
                  }))}
                />
              )}
            </div>
          </div>

          {/* Summary */}
          <div className="bg-card rounded-xl border border-border p-4 sm:p-5">
            <h3 className="text-sm font-semibold text-foreground mb-3">Summary</h3>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Days</span>
                <span className="text-foreground">{quote.days?.length || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Locations</span>
                <span className="text-foreground">{new Set((quote.days || []).map(d => d.location).filter(Boolean)).size}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Travelers</span>
                <span className="text-foreground">{quote.travelers.adults} adults{quote.travelers.children > 0 ? `, ${quote.travelers.children} children` : ''}</span>
              </div>
            </div>
          </div>

          {/* AI Tools */}
          <AIPanel quote={quote} setQuote={setQuote} linkedDeal={deals.find(d => d._id === quote.deal) || null} />

          {/* Inclusions & Exclusions — quote-level operator-curated text.
              Per-hotel rate-list inclusions/exclusions can also be folded
              into these lists reactively via the "In trip list" toggle on
              each day card's Accommodation section. */}
          <ListEditor
            title="Included"
            icon="✓"
            items={quote.inclusions || []}
            onChange={(items) => setQuote({ ...quote, inclusions: items })}
            color="green"
          />
          <ListEditor
            title="Excluded"
            icon="—"
            items={quote.exclusions || []}
            onChange={(items) => setQuote({ ...quote, exclusions: items })}
            color="sand"
          />

          {/* Block Toggles — what to show on the share page */}
          <BlockToggles
            blocks={quote.blocks}
            onChange={(blocks) => setQuote({ ...quote, blocks })}
          />

          {/* Payment terms */}
          <div className="bg-card rounded-xl border border-border p-4 sm:p-5">
            <h3 className="text-sm font-semibold text-foreground mb-2">Payment Terms</h3>
            <textarea
              value={quote.paymentTerms || ''}
              onChange={(e) => setQuote({ ...quote, paymentTerms: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 rounded-lg bg-background border border-border text-xs text-foreground focus:outline-none focus:border-primary transition-colors resize-none"
              placeholder="40% deposit, 60% balance due..."
            />
          </div>
        </div>
        )}
      </div>

      {/* Mobile price bar — the pricing sidebar drops below the whole
          itinerary on < xl and isn't sticky there, so the operator would
          have to scroll past everything to see the total. This keeps the
          client price and primary actions in reach. Sits above the app's
          lg:hidden bottom nav (bottom-16) and clears it on lg–xl
          (lg:bottom-0). Hidden at xl where the sidebar is sticky. */}
      <div className="xl:hidden fixed inset-x-0 bottom-16 lg:bottom-0 z-20 border-t border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div className="flex items-center justify-between gap-3 px-4 py-2.5 pb-safe">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground/70 leading-none">Client Price</p>
            <p className="text-base font-bold text-primary leading-tight truncate">
              {formatCurrency(quote.pricing.totalPrice, quote.pricing.currency)}
              {quote.travelers.adults + quote.travelers.children > 0 && (
                <span className="ml-1.5 text-[11px] font-normal text-muted-foreground/70">
                  · {formatCurrency(quote.pricing.perPersonPrice, quote.pricing.currency)} pp
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => handleSave('draft')}
              disabled={saving}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-card border border-border text-sm font-medium text-foreground disabled:opacity-50"
              title="Save draft"
            >
              <Save className="w-4 h-4" />
            </button>
            <button
              onClick={() => handleSave('sent')}
              disabled={saving || unacknowledgedBlockers.length > 0}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-primary text-white text-sm font-semibold shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send className="w-4 h-4" />
              Send
              {unacknowledgedBlockers.length > 0 && (
                <span className="inline-flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-700 text-white">
                  {unacknowledgedBlockers.length}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      <ConfirmModal
        open={!!confirmDialog}
        title={confirmDialog?.title}
        message={confirmDialog?.message}
        confirmLabel={confirmDialog?.confirmLabel}
        tone={confirmDialog?.tone}
        onConfirm={confirmDialog?.onConfirm}
        onCancel={() => setConfirmDialog(null)}
      />
      <TemplateModal
        open={!!templateModal}
        defaultName={quote.title}
        onCancel={() => setTemplateModal(null)}
        onSubmit={async ({ name, description }) => {
          try {
            await api.post(`/quotes/${id}/save-as-template`, { templateName: name, templateDescription: description });
            toast.success('Saved as template');
            setTemplateModal(null);
          } catch {
            toast.error('Failed to save template');
          }
        }}
      />
    </div>
  );
}

// ─── AI PANEL ───────────────────────────────────

function AIPanel({ quote, setQuote, linkedDeal }) {
  const { organization } = useAuth();
  const aiUsed = organization?.aiCreditsUsed ?? 0;
  const aiLimit = organization?.aiCreditsLimit ?? 0;
  // Heavy AI actions (draft itinerary, generate-all-narratives) cost 10 credits.
  // Block when fewer than 10 remain.
  const HEAVY_COST = 10;
  const aiQuotaExhausted = aiLimit < 1_000_000 && (aiLimit - aiUsed) < HEAVY_COST;
  const quotaTitle = aiQuotaExhausted
    ? `You need ${HEAVY_COST} AI credits for this action — you have ${Math.max(0, aiLimit - aiUsed)} left this month. Upgrade or wait until reset.`
    : undefined;

  const [generatingNarratives, setGeneratingNarratives] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState(null);

  const generateNarratives = async () => {
    if (!quote.days?.length) { toast.error('Add days first'); return; }
    setGeneratingNarratives(true);
    try {
      // Send days as segment-like structure for backwards compat with AI endpoint
      const segmentsForAI = quote.days.map((d, i) => ({
        order: i,
        destination: d.location,
        nights: 1,
        hotel: d.hotel,
        activities: d.activities,
      }));

      const { data } = await api.post('/ai/generate-all-narratives', {
        segments: segmentsForAI,
        tripTitle: quote.title,
        travelers: quote.travelers.adults + quote.travelers.children,
      });

      const updatedDays = quote.days.map((day, i) => {
        const match = data.segments?.find(s => s.index === i);
        return match ? { ...day, narrative: match.narrative } : day;
      });

      setQuote({
        ...quote,
        days: updatedDays,
        coverNarrative: data.coverNarrative || quote.coverNarrative,
        closingNote: data.closingNote || quote.closingNote,
        highlights: data.highlights || quote.highlights,
      });

      toast.success('Narratives generated!');
    } catch (err) {
      toast.error(err.response?.data?.message || 'AI generation failed.');
    } finally {
      setGeneratingNarratives(false);
    }
  };

  // ─── Draft from prompt ───
  const [showPromptDraft, setShowPromptDraft] = useState(false);
  const [draftPrompt, setDraftPrompt] = useState('');
  const [draftBudget, setDraftBudget] = useState('mid-range');
  const [showBudget, setShowBudget] = useState(false); // budget tier is an optional override now
  const [drafting, setDrafting] = useState(false);

  // Trip length is no longer a manual field. It comes from the quote's travel
  // dates when set; otherwise the model infers it from the prompt prose
  // ("7-day safari", "12th–20th"). This stops a stale field from silently
  // overriding what the operator typed.
  const dateSpanDays = (quote.startDate && quote.endDate)
    ? Math.max(0, Math.ceil((new Date(quote.endDate) - new Date(quote.startDate)) / 86400000))
    : 0;

  // Seed the draft prompt from the linked deal so the operator doesn't re-type
  // a trip they already described on the lead/deal. Mirrors the misclick logic:
  // a FIRST deal only seeds a blank prompt (never clobbers manual typing / an
  // existing edited quote); SWITCHING to a different deal re-seeds with the new
  // deal's description, since the previous text was the old (wrong) deal's.
  // `seededDealIdRef` tracks which deal the current prompt came from.
  const seededDealIdRef = useRef(null);
  useEffect(() => {
    if (!linkedDeal) return;
    const prevDealId = seededDealIdRef.current;
    if (prevDealId === linkedDeal._id) return;     // already handled this deal
    const isSwitch = prevDealId !== null;          // a different deal was linked before
    seededDealIdRef.current = linkedDeal._id;

    const parts = [];
    if (linkedDeal.tripType) parts.push(`${linkedDeal.tripType} trip`);
    if (linkedDeal.destination) parts.push(`Destinations: ${linkedDeal.destination}`);
    if (linkedDeal.budget > 0) {
      // Whole-trip total (not per-person) — the system prompt treats it as
      // overall context, not an accommodation+activities target.
      const cur = linkedDeal.budgetCurrency || linkedDeal.currency || 'USD';
      parts.push(`Total trip budget: ~${cur} ${linkedDeal.budget.toLocaleString()} for the group${linkedDeal.groupSize ? ` (${linkedDeal.groupSize} pax)` : ''}.`);
    }
    if (linkedDeal.specialRequests) parts.push(linkedDeal.specialRequests);
    const seed = parts.join('\n\n').trim();
    if (!seed) return;

    // First pick: only seed a blank prompt on a fresh quote. Switch: the new
    // deal's description wins (overwrites the old deal's seed).
    if (!isSwitch && (draftPrompt || quote.days?.length)) return;
    setDraftPrompt(seed);
    setShowPromptDraft(true);
  }, [linkedDeal?._id]); // eslint-disable-line react-hooks/exhaustive-deps

  const draftFromPrompt = () => {
    if (!draftPrompt.trim()) { toast.error('Describe the trip first'); return; }
    if (quote.days?.length > 0) {
      setConfirmDialog({
        title: 'Replace itinerary?',
        message: 'Drafting from this prompt will replace your current itinerary. This can\'t be undone.',
        confirmLabel: 'Replace',
        tone: 'danger',
        onConfirm: () => { setConfirmDialog(null); doDraftFromPrompt(); },
      });
      return;
    }
    doDraftFromPrompt();
  };

  const doDraftFromPrompt = async () => {
    setDrafting(true);
    try {
      const { data } = await api.post('/ai/draft-itinerary', {
        prompt: draftPrompt,
        // Length: travel dates win; otherwise omit and let the model read it
        // from the prompt prose.
        tripLength: dateSpanDays || undefined,
        travelers: quote.travelers.adults + quote.travelers.children,
        // Budget tier only sent when the operator explicitly set the optional
        // override; otherwise the model infers from the prompt (which already
        // carries the deal's budget figure and experience level).
        budget: showBudget ? draftBudget : undefined,
        startDate: quote.startDate || undefined,
        adults: quote.travelers.adults,
        childAges: quote.travelers.childAges || [],
        clientType: quote.clientType,
        nationality: quote.nationality,
        quoteCurrency: quote.pricing.currency,
      });

      // Fields the prompt explicitly stated (already used to price the draft on
      // the server) — sync the top form to match so form, prices, and itinerary
      // agree. Only fields the operator stated are present; the rest are absent.
      const applied = data.applied || {};
      setQuote(q => {
        const next = {
          ...q,
          title: data.title || q.title,
          coverNarrative: data.coverNarrative || q.coverNarrative,
          highlights: data.highlights?.length ? data.highlights : q.highlights,
          days: data.days || [],
        };
        if (applied.startDate) next.startDate = applied.startDate;
        const baseStart = applied.startDate || q.startDate;
        if (applied.nights && baseStart) {
          const end = new Date(baseStart);
          end.setDate(end.getDate() + applied.nights);
          next.endDate = end.toISOString().slice(0, 10);
        }
        if (applied.adults != null || applied.children != null || applied.childAges) {
          next.travelers = {
            ...q.travelers,
            adults: applied.adults ?? q.travelers.adults,
            children: applied.children ?? (applied.childAges ? applied.childAges.length : q.travelers.children),
            childAges: applied.childAges ?? q.travelers.childAges,
          };
        }
        if (applied.clientType) next.clientType = applied.clientType;
        if (applied.nationality) next.nationality = applied.nationality;
        // Currency set directly (no reprice flag) — the draft already priced in
        // this currency server-side.
        if (applied.currency) next.pricing = { ...q.pricing, currency: applied.currency };
        return next;
      });

      // Tell the operator exactly what the prompt set, so an AI misread is
      // visible and correctable rather than silent.
      const bits = [];
      if (applied.startDate) bits.push(`start ${applied.startDate}`);
      if (applied.nights) bits.push(`${applied.nights} nights`);
      if (applied.adults != null || applied.children != null || applied.childAges) {
        const a = applied.adults ?? quote.travelers.adults;
        const k = applied.children ?? (applied.childAges ? applied.childAges.length : quote.travelers.children);
        bits.push(`${a} adult${a === 1 ? '' : 's'}${k ? ` + ${k} child${k === 1 ? '' : 'ren'}` : ''}`);
      }
      if (applied.nationality) bits.push(applied.nationality);
      if (applied.clientType) bits.push(`${applied.clientType} rate`);
      if (applied.currency) bits.push(applied.currency);
      if (bits.length) {
        toast(`Set from your prompt: ${bits.join(', ')}`, { icon: '✨', duration: 6000 });
      }

      // Catalog-match feedback — tells the operator which destinations we matched from
      // their inventory, or warns when we found nothing and they need to add partners.
      const cat = data.catalog;
      if (cat?.emptyCatalog) {
        toast(`Drafted itinerary, but we couldn't match any destinations from your catalog. Add hotels or activities to include them in future drafts.`, {
          icon: '⚠️', duration: 7000,
        });
      } else if (cat?.matchedDestinations?.length) {
        toast.success(
          `Drafted ${data.days?.length || 0}-day itinerary using ${cat.hotelsUsed} hotels and ${cat.activitiesUsed} activities from: ${cat.matchedDestinations.join(', ')}`,
          { duration: 6000 }
        );
      } else {
        toast.success(`Drafted ${data.days?.length || 0}-day itinerary!`);
      }
      setShowPromptDraft(false);
      setDraftPrompt('');
    } catch (err) {
      toast.error(err.response?.data?.message || 'AI drafting failed');
    } finally {
      setDrafting(false);
    }
  };

  return (
    <div className="bg-card rounded-xl border border-border p-4 sm:p-5">
      <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-1.5">
        <Sparkles className="w-4 h-4 text-primary" /> AI Assistant
      </h3>

      <div className="space-y-2">
        {/* Draft from prompt — the headline feature */}
        <div className="p-3 rounded-lg bg-gradient-to-br from-purple-50 to-amber-50 border border-purple-200">
          <p className="text-xs font-semibold text-foreground mb-1">✨ Draft from Prompt</p>
          <p className="text-[10px] text-muted-foreground mb-2">Describe a trip and AI will draft the full itinerary using your hotels and activities</p>

          {!showPromptDraft ? (
            <button
              onClick={() => setShowPromptDraft(true)}
              disabled={aiQuotaExhausted}
              title={quotaTitle}
              className="w-full px-3 py-1.5 rounded-md bg-purple-600 text-white text-xs font-medium hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {aiQuotaExhausted ? 'Monthly AI limit reached' : 'Start Drafting'}
            </button>
          ) : (
            <div className="space-y-2">
              <textarea
                value={draftPrompt}
                onChange={(e) => setDraftPrompt(e.target.value)}
                rows={3}
                className="w-full px-2 py-1.5 rounded-md bg-card border border-purple-200 text-xs focus:outline-none focus:border-purple-400 resize-none"
                placeholder="e.g. 8-day Kenya honeymoon, focus on wildlife in Mara and beach in Diani, mid-range budget"
              />
              {/* Length comes from travel dates or the prompt text itself — no
                  manual Days field. Budget tier is an optional override. */}
              {dateSpanDays > 0 && (
                <p className="text-[10px] text-muted-foreground">Length: {dateSpanDays} days (from travel dates). Otherwise just say it in the prompt.</p>
              )}
              {!showBudget ? (
                <button type="button" onClick={() => setShowBudget(true)}
                  className="text-[10px] text-purple-600 hover:text-purple-700 underline">
                  + Set budget tier (optional)
                </button>
              ) : (
                <div>
                  <label className="block text-[9px] text-muted-foreground mb-0.5">Budget tier</label>
                  <select value={draftBudget} onChange={(e) => setDraftBudget(e.target.value)}
                    className="w-full px-2 py-1 rounded-md bg-card border border-purple-200 text-xs focus:outline-none focus:border-purple-400">
                    <option value="budget">Budget</option>
                    <option value="mid-range">Mid-range</option>
                    <option value="luxury">Luxury</option>
                  </select>
                </div>
              )}
              <div className="flex gap-1.5">
                <button onClick={draftFromPrompt} disabled={drafting || !draftPrompt.trim() || aiQuotaExhausted}
                  title={quotaTitle}
                  className="flex-1 px-3 py-1.5 rounded-md bg-purple-600 text-white text-xs font-medium hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                  {drafting ? 'Drafting...' : 'Generate Itinerary'}
                </button>
                <button onClick={() => setShowPromptDraft(false)} className="px-2 py-1.5 rounded-md text-xs text-muted-foreground hover:bg-muted">
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Generate narratives */}
        <button
          onClick={generateNarratives}
          disabled={generatingNarratives || !quote.days?.length || aiQuotaExhausted}
          title={quotaTitle}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-gradient-to-r from-amber-50 to-orange-50 border border-primary/30 text-sm text-primary font-medium hover:from-amber-100 hover:to-orange-100 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Sparkles className="w-4 h-4" />
          {generatingNarratives ? 'Generating...' : aiQuotaExhausted ? 'Monthly AI limit reached' : 'Generate Narratives'}
        </button>

        {aiQuotaExhausted && (
          <p className="text-[10px] text-muted-foreground text-center pt-1">
            <a href="/settings/billing" className="text-primary underline">Upgrade your plan</a> for more AI generations
          </p>
        )}

      </div>

      <ConfirmModal
        open={!!confirmDialog}
        title={confirmDialog?.title}
        message={confirmDialog?.message}
        confirmLabel={confirmDialog?.confirmLabel}
        tone={confirmDialog?.tone}
        onConfirm={confirmDialog?.onConfirm}
        onCancel={() => setConfirmDialog(null)}
      />
    </div>
  );
}
function ListEditor({ title, icon, items, onChange, color, extraAction }) {
  const [newItem, setNewItem] = useState('');

  const addItem = () => {
    if (!newItem.trim()) return;
    onChange([...items, newItem.trim()]);
    setNewItem('');
  };

  const removeItem = (idx) => {
    onChange(items.filter((_, i) => i !== idx));
  };

  const borderColor = color === 'green' ? 'border-green-200' : 'border-border';
  const iconColor = color === 'green' ? 'text-green-500' : 'text-muted-foreground/70';

  return (
    <div className={`bg-card rounded-xl border ${borderColor} p-4 sm:p-5`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-foreground">{icon} {title}</h3>
        {extraAction}
      </div>
      <div className="space-y-1.5 mb-3">
        {items.map((item, i) => (
          <div key={i} className="flex items-center justify-between group">
            <span className={`text-xs ${iconColor}`}>{icon}</span>
            <span className="text-xs text-muted-foreground flex-1 mx-2">{item}</span>
            <button
              onClick={() => removeItem(i)}
              className="text-muted-foreground/40 hover:text-red-400 sm:opacity-0 sm:group-hover:opacity-100 transition-all"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>
      <div className="flex gap-1.5">
        <input
          type="text"
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addItem())}
          placeholder={`Add ${title.toLowerCase()} item...`}
          className="flex-1 px-2 py-1.5 rounded-md bg-background border border-border text-xs focus:outline-none focus:border-primary transition-colors"
        />
        <button onClick={addItem} className="px-2 py-1.5 rounded-md bg-muted text-muted-foreground text-xs hover:bg-muted transition-colors">
          <Plus className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}

function CoverImagePicker({ coverImage, days, onChange }) {
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef();

  // Collect all candidate images from the itinerary
  const candidates = [];
  const seen = new Set();
  for (const d of days) {
    for (const img of (d.images || [])) {
      if (img?.url && !seen.has(img.url)) { seen.add(img.url); candidates.push({ ...img, source: `Day ${d.dayNumber || '?'} · ${d.location || ''}` }); }
    }
    for (const img of (d.hotel?.images || [])) {
      if (img?.url && !seen.has(img.url)) { seen.add(img.url); candidates.push({ ...img, source: d.hotel?.name || 'Hotel' }); }
    }
  }

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const { data } = await api.post('/uploads/user-asset', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      onChange({ url: data.url });
      setOpen(false);
      toast.success('Cover image updated');
    } catch {
      toast.error('Upload failed');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div className="mt-4">
      <label className="block text-xs font-medium text-muted-foreground mb-2">Cover Image</label>
      <div className="flex items-center gap-3 flex-wrap">
        {coverImage?.url ? (
          <img src={coverImage.url} alt="" className="w-24 h-16 object-cover rounded-lg border border-border shrink-0" />
        ) : (
          <div className="w-24 h-16 rounded-lg bg-muted border border-dashed border-border flex items-center justify-center text-[10px] text-muted-foreground text-center px-1 shrink-0">
            Auto from itinerary
          </div>
        )}
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="px-3 py-1.5 rounded-lg bg-background border border-border text-xs font-medium hover:border-primary transition-colors"
        >
          {coverImage?.url ? 'Change' : 'Choose'}
        </button>
        {coverImage?.url && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Clear
          </button>
        )}
      </div>
      <p className="text-[10px] text-muted-foreground/70 mt-1">
        {coverImage?.url ? 'Using selected image.' : 'Defaults to the first day or hotel image.'}
      </p>

      {open && (
        <div
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-card rounded-xl border border-border shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col"
          >
            <div className="flex items-center justify-between px-5 py-3 border-b border-border">
              <h3 className="text-sm font-semibold text-foreground">Choose Cover Image</h3>
              <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground text-lg">✕</button>
            </div>

            <div className="px-5 py-4 border-b border-border">
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="w-full py-2.5 rounded-lg border border-dashed border-border text-xs text-muted-foreground hover:border-primary hover:text-primary transition-colors disabled:opacity-50"
              >
                {uploading ? 'Uploading...' : '↑ Upload a new image'}
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              {candidates.length > 0 ? (
                <>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground/70 mb-3">From your itinerary</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {candidates.map((img, i) => {
                      const active = coverImage?.url === img.url;
                      return (
                        <button
                          key={i}
                          type="button"
                          onClick={() => { onChange({ url: img.url }); setOpen(false); }}
                          className={`relative aspect-[4/3] rounded-lg overflow-hidden border-2 transition-all ${
                            active ? 'border-primary ring-2 ring-primary/30' : 'border-transparent hover:border-border'
                          }`}
                        >
                          <img src={img.url} alt="" className="w-full h-full object-cover" />
                          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-2 py-1.5">
                            <p className="text-[10px] text-white truncate">{img.source}</p>
                          </div>
                          {active && (
                            <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                              <CheckCircle className="w-3.5 h-3.5 text-white" />
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </>
              ) : (
                <p className="text-xs text-muted-foreground text-center py-8">
                  No images in the itinerary yet. Upload one above, or add images to days/hotels first.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Group `days` into stay-segments for line-item generation: consecutive days
// with the same hotel + location collapse into one segment with a `nights`
// count and the stay's activities/transport listed under it. Days with no
// hotel become single-day segments so their activities/transport still land.
// Three-state pill row for "where should this hotel's inclusions/exclusions
// show on the quote?" — on the day card, merged into the trip-level list,
// or hidden. Operator picks per hotel-day; renderer respects the choice.
function DisplayPrefRow({ label, count, value, onChange }) {
  const opts = [
    { v: 'day', t: 'On day card' },
    { v: 'merged', t: 'In trip list' },
    { v: 'hidden', t: 'Hide' },
  ];
  return (
    <div className="flex items-center justify-between gap-2 flex-wrap">
      <span className="text-[11px] text-muted-foreground">
        {label} <span className="text-muted-foreground/60">({count})</span>
      </span>
      <div className="flex gap-0.5">
        {opts.map(o => (
          <button
            key={o.v}
            onClick={() => onChange(o.v)}
            className={`text-[10px] px-2 py-0.5 rounded transition-colors ${
              value === o.v
                ? 'bg-primary text-white'
                : 'bg-muted text-muted-foreground hover:bg-muted/70'
            }`}
          >
            {o.t}
          </button>
        ))}
      </div>
    </div>
  );
}

function aggregateDaysIntoSegments(days) {
  const segments = [];
  let current = null;
  const keyOf = (d) => {
    if (!d.hotel) return null;
    return `${d.hotel.hotelId || d.hotel.name || ''}|${d.location || ''}`;
  };
  for (const day of (days || [])) {
    const key = keyOf(day);
    if (current && key !== null && key === current.key) {
      current.nights++;
      current.activities.push(...(day.activities || []));
      // Keep the first day's transport; if this day adds one, append it too.
      if (day.transport?.name) current.extraTransport.push(day.transport);
    } else {
      if (current) segments.push(current);
      current = {
        key,
        location: day.location,
        destination: day.location,
        hotel: day.hotel || null,
        nights: day.hotel ? 1 : 0,
        activities: [...(day.activities || [])],
        transport: day.transport || null,
        extraTransport: [],
      };
    }
  }
  if (current) segments.push(current);
  return segments;
}

function LineItemsEditor({ lineItems, onChange, segments, marginPercent, currency, onAutoGenerate, onResetToDayRollup, quoteTotal = 0, markupFees = true }) {
  const [editIdx, setEditIdx] = useState(null);
  const [collapsed, setCollapsed] = useState(lineItems.length > 0);

  // `segments` here is actually `quote.days` (one entry per night). Aggregate
  // them first so a 5-night Mara stay generates ONE line item with quantity 5
  // instead of five single-night items.
  //
  // Items are stored at CLIENT-FACING (post-markup) prices — matches the
  // schema doc, the renderer, the PDF template, and invoiceBuilder, which
  // all assume the values they display are already marked up. The pricing
  // useEffect sums these into totalPrice directly, with no further markup.
  //
  // Auto-generate ALSO marks each day as `isItemized: true` (via
  // onAutoGenerate) so the day-cost rollup skips those days. Without
  // this guard the same costs would be counted twice — once via dayCost
  // * margin and once via the line items.
  //
  // Pass-through fees are intentionally excluded — the renderer already
  // surfaces them as a separate "Park & Government Fees" section, and the
  // pricing useEffect's PT branch applies them to the total. Including
  // them as line items would double-count.
  //
  // Margin caveat: line items are frozen at the markup in effect when
  // generated. Sliding the margin afterwards does not retroactively
  // update them — operators see a banner urging Re-generate.
  const autoGenerate = () => {
    const items = [];
    const markup = 1 + (marginPercent / 100);
    const stays = aggregateDaysIntoSegments(segments);

    for (const seg of stays) {
      // Hotel — one consolidated row for the whole stay
      const nightly = seg.hotel?.ratePerNightInQuoteCurrency || seg.hotel?.ratePerNight || 0;
      if (seg.hotel?.name && nightly > 0 && seg.nights > 0) {
        items.push({
          description: `${seg.hotel.name} — ${seg.hotel.roomType || 'Standard'} (${seg.nights} night${seg.nights !== 1 ? 's' : ''})`,
          quantity: seg.nights,
          unitPrice: Math.round(nightly * markup),
          total: Math.round(nightly * seg.nights * markup),
          source: 'auto',
        });
      }

      // Activities — one line per activity instance (per day they're added).
      // Use the FX-converted total when present.
      for (const act of (seg.activities || [])) {
        const cost = act.totalCostInQuoteCurrency ?? act.totalCost ?? 0;
        if (cost > 0) {
          items.push({
            description: `${act.name}${seg.destination ? ' — ' + seg.destination : ''}`,
            quantity: 1,
            unitPrice: Math.round(cost * markup),
            total: Math.round(cost * markup),
            source: 'auto',
          });
        }
      }

      // Transport — first day's transport for the segment, plus any extras
      // tagged on later days within the same stay.
      const transports = [seg.transport, ...seg.extraTransport].filter(t => t?.name);
      for (const t of transports) {
        const cost = t.totalCostInQuoteCurrency ?? t.totalCost ?? 0;
        if (cost > 0) {
          items.push({
            description: `${t.name}${t.type ? ' (' + t.type + ')' : ''}`,
            quantity: 1,
            unitPrice: Math.round(cost * markup),
            total: Math.round(cost * markup),
            source: 'auto',
          });
        }
      }
    }

    // Hand off to parent — parent writes lineItems AND flips isItemized
    // on every day in a single setQuote call to avoid a transient state
    // where line items exist but flags haven't been set yet.
    if (onAutoGenerate) {
      onAutoGenerate(items);
    } else {
      onChange(items);
    }
    toast.success(`Generated ${items.length} line item${items.length === 1 ? '' : 's'} from your days`);
  };

  const addItem = () => {
    onChange([...lineItems, { description: '', quantity: 1, unitPrice: 0, total: 0, source: 'manual' }]);
    setEditIdx(lineItems.length);
    setCollapsed(false);
  };

  const updateItem = (idx, field, value) => {
    const items = [...lineItems];
    items[idx] = { ...items[idx], [field]: value };
    // Recalc total
    if (field === 'quantity' || field === 'unitPrice') {
      items[idx].total = (parseInt(items[idx].quantity) || 0) * (parseFloat(items[idx].unitPrice) || 0);
    }
    onChange(items);
  };

  const removeItem = (idx) => {
    onChange(lineItems.filter((_, i) => i !== idx));
    if (editIdx === idx) setEditIdx(null);
  };

  const itemsTotal = lineItems.reduce((s, li) => s + (li.total || 0), 0);
  // True when any day has been flagged as itemized (auto-generate or
  // applyPackage). Drives the "Reset to day rollup" affordance.
  const anyItemized = (segments || []).some(d => d.isItemized);
  // True only when there's actually something for Re-generate to refresh
  // — i.e., previously-auto-generated rows. Package-only quotes have
  // isItemized days but no auto rows; the banner shouldn't nag them.
  const hasAutoItems = lineItems.some(li => li.source === 'auto');

  // ── Reconciliation (#3.9) ────────────────────────────────────────────
  // In line_items mode the client sees the line-item TABLE and the Total.
  // The table sums to `itemsTotal`; the Total also includes the day-cost
  // rollup for any NON-itemised days and the marked-up pass-through fees.
  // Pass-through fees are explained to the client separately ("Included in
  // total", #1.5), so the only genuinely unexplained gap is the cost of
  // days the operator built but did not itemise. Compute it with the SAME
  // per-day PT + margin logic as the pricing useEffect so there are no
  // false positives.
  const ptInTotal = (segments || []).reduce((sum, d, i) => {
    const m = d.marginOverride != null ? d.marginOverride : marginPercent;
    const pt = dayPassThroughFace(segments || [], i);
    return sum + (markupFees ? pt * (1 + m / 100) : pt);
  }, 0);
  // totalPrice = Σ nonItemised(dayCost×m) + ptInTotal + itemsTotal, so this
  // residual is exactly the marked-up cost of non-itemised days — what the
  // client's breakdown would be missing.
  const reconGap = Math.round((Number(quoteTotal) || 0) - itemsTotal - ptInTotal);
  const unitemizedDays = (segments || []).filter(d => !d.isItemized && (d.dayCost || 0) > 0).length;
  const showReconWarning = lineItems.length > 0 && reconGap > 1 && unitemizedDays > 0;

  return (
    <div className="border-t border-border pt-3 mt-1">
      <div className="flex items-center justify-between mb-2 gap-2">
        <button
          type="button"
          onClick={() => setCollapsed(c => !c)}
          className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors min-w-0"
        >
          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${collapsed ? '-rotate-90' : ''}`} />
          Line Items
          {lineItems.length > 0 && (
            <span className="text-[10px] text-muted-foreground/70 font-normal truncate">
              · {lineItems.length} item{lineItems.length !== 1 ? 's' : ''} · {formatCurrency(itemsTotal, currency)}
            </span>
          )}
        </button>
        {!collapsed && (
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={autoGenerate}
              title="Build line items from your day picks. Days become itemized — their costs feed the total via these line items instead of the day rollup."
              className="text-[10px] text-primary hover:underline flex items-center gap-0.5"
            >
              <Sparkles className="w-3 h-3" /> Auto-generate
            </button>
            {anyItemized && onResetToDayRollup && (
              <button
                onClick={onResetToDayRollup}
                title="Clear line items and resume using day-by-day cost rollup."
                className="text-[10px] text-muted-foreground hover:text-foreground hover:underline"
              >
                Reset to day rollup
              </button>
            )}
          </div>
        )}
      </div>

      {!collapsed && hasAutoItems && (
        <p className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1 mb-2 leading-snug">
          Total is driven by line items. Change day picks or margin?{' '}
          <button
            type="button"
            onClick={autoGenerate}
            className="font-semibold underline hover:text-amber-900"
          >
            Re-generate
          </button>{' '}
          to refresh.
        </p>
      )}

      {!collapsed && lineItems.length > 0 && (
        <div className="space-y-1 mb-2 max-h-48 overflow-y-auto">
          {lineItems.map((item, i) => (
            <div key={i} className="group">
              {editIdx === i ? (
                <div className="p-2 rounded-md bg-background border border-border space-y-1.5">
                  <input
                    type="text"
                    value={item.description}
                    onChange={(e) => updateItem(i, 'description', e.target.value)}
                    placeholder="Description"
                    className="w-full px-2 py-1 rounded border border-border text-[11px] bg-card focus:outline-none focus:border-primary"
                  />
                  <div className="flex gap-1.5 items-center">
                    <input
                      type="number"
                      value={item.quantity}
                      onChange={(e) => updateItem(i, 'quantity', parseInt(e.target.value) || 0)}
                      className="w-12 px-1.5 py-1 rounded border border-border text-[11px] bg-card text-center focus:outline-none focus:border-primary"
                      placeholder="Qty"
                    />
                    <span className="text-[10px] text-muted-foreground/70">×</span>
                    <input
                      type="number"
                      value={item.unitPrice}
                      onChange={(e) => updateItem(i, 'unitPrice', parseFloat(e.target.value) || 0)}
                      className="w-24 px-1.5 py-1 rounded border border-border text-[11px] bg-card focus:outline-none focus:border-primary"
                      placeholder="Client price"
                      title="Client-facing price per unit — margin is NOT applied to line items, enter the amount the client should see"
                    />
                    <span className="text-[10px] text-muted-foreground/70">=</span>
                    <span className="text-[11px] font-semibold text-foreground">{formatCurrency(item.total, currency)}</span>
                    <button onClick={() => setEditIdx(null)} className="ml-auto text-[10px] text-primary">Done</button>
                  </div>
                  <p className="text-[9px] text-muted-foreground/70 leading-snug">
                    Enter the <strong>client-facing price</strong> — margin is <strong>not</strong> re-applied to line items. (Auto-generated and package rows already include your margin.)
                  </p>
                </div>
              ) : (
                <div
                  className="flex items-center justify-between py-1.5 px-1 rounded hover:bg-background cursor-pointer"
                  onClick={() => setEditIdx(i)}
                >
                  <span className="text-[11px] text-muted-foreground truncate flex-1">{item.description || 'Untitled'}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-medium text-foreground">{formatCurrency(item.total, currency)}</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); removeItem(i); }}
                      className="text-muted-foreground/40 hover:text-red-400 sm:opacity-0 sm:group-hover:opacity-100"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {!collapsed && (
        <button onClick={addItem} className="w-full py-1.5 rounded-md border border-dashed border-border text-[10px] text-muted-foreground hover:border-primary hover:text-primary transition-colors">
          + Add line item
        </button>
      )}

      {!collapsed && lineItems.length > 0 && (
        <div className="mt-2 pt-2 border-t border-border space-y-1">
          <div className="flex justify-between">
            <span className="text-xs text-muted-foreground">Line items total</span>
            <span className="text-xs font-bold text-foreground">
              {formatCurrency(itemsTotal, currency)}
            </span>
          </div>
          {/* Reconciliation against the quote total the client also sees.
              Pass-through fees legitimately make the total exceed the table
              (shown to the client as "Included in total"), so surface that
              separately rather than as a discrepancy. */}
          <div className="flex justify-between">
            <span className="text-[10px] text-muted-foreground/70">Quote total (client sees)</span>
            <span className="text-[10px] text-muted-foreground/70">
              {formatCurrency(Math.round(Number(quoteTotal) || 0), currency)}
            </span>
          </div>
          {ptInTotal > 1 && !showReconWarning && (
            <p className="text-[10px] text-muted-foreground/60 leading-snug">
              Difference is {formatCurrency(Math.round(ptInTotal), currency)} park &amp; fees — shown to the client as “included in total”, not a discrepancy.
            </p>
          )}
          {showReconWarning && (
            <div className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1 leading-snug">
              <p className="font-semibold">⚠ Breakdown won’t add up for the client</p>
              <p className="mt-0.5">
                {formatCurrency(reconGap, currency)} from {unitemizedDays} day{unitemizedDays === 1 ? '' : 's'} isn’t in these line items, so the table won’t match the {formatCurrency(Math.round(Number(quoteTotal) || 0), currency)} total.{' '}
                <button
                  type="button"
                  onClick={autoGenerate}
                  className="font-semibold underline hover:text-amber-900"
                >
                  Re-generate
                </button>{' '}
                to itemise every day, or switch “Client sees” to Total only.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Day Card Component ──────────────────────────

function DayCard({
  day, index, dayPt = 0, isExpanded, onToggle, onUpdate, onRemove, onMoveUp, onMoveDown,
  onDuplicate, onAddAfter, isFirst, isLast,
  hotels, activities, transport, destinations, currency, marginPercent, checkInDate,
  onSelectHotel, onExtendStay, onChangeRoomType, onChangeMealPlan, onAddActivity, onRemoveActivity,
  onSelectTransport, onClearTransport, onUpdateTransportField,
  onAddImage, onRemoveImage, onSetHero, onAcknowledgeCondition,
}) {
  const [showHotelPicker, setShowHotelPicker] = useState(false);
  const [hotelQuery, setHotelQuery] = useState('');
  const [hotelSort, setHotelSort] = useState('name'); // 'name' | 'price' | 'stars'
  const [openRatesFor, setOpenRatesFor] = useState(null); // hotel id whose rate panel is expanded in the picker
  const [showActivityPicker, setShowActivityPicker] = useState(false);
  const [showTransportPicker, setShowTransportPicker] = useState(false);
  // Per-km vehicles need a distance before they can be priced; this captures
  // the operator's input per-row in the picker without lifting state higher.
  const [transportKmInputs, setTransportKmInputs] = useState({});
  const [showImagePicker, setShowImagePicker] = useState(false);

  // When a day expands, any other expanded day collapses above it — which
  // shifts this card upward in the document and leaves the scroll position
  // showing the middle/bottom of the new content. Scroll the card back into
  // view so the header lands near the top. Skip on initial mount so users
  // aren't jumped to day 0 when the page first loads.
  const cardRef = useRef(null);
  const didMountRef = useRef(false);
  useEffect(() => {
    if (!didMountRef.current) { didMountRef.current = true; return; }
    if (isExpanded && cardRef.current) {
      requestAnimationFrame(() => {
        cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
  }, [isExpanded]);

  const matchedHotels = hotels.filter(h => !day.location || destMatch(h.destination, day.location));
  const matchedActivities = activities.filter(a => !day.location || destMatch(a.destination, day.location));
  // Transport: filter by matching destination if any are tagged on the
  // partner doc, otherwise show all (vehicles are often used trip-wide).
  const matchedTransport = (transport || []).filter(t => {
    if (!day.location) return true;
    const dests = t.destinations || [];
    if (!dests.length) return true;
    return dests.some(d => destMatch(d, day.location));
  });

  const heroImage = day.images?.[0];

  return (
    <div>
      {/* Connector */}
      {!isFirst && (
        <div className="flex items-center gap-3 px-2 py-1">
          <div className="w-8 flex justify-center"><div className="w-0.5 h-4 bg-border" /></div>
        </div>
      )}

      <div ref={cardRef} className={`bg-card rounded-xl border scroll-mt-20 transition-all ${isExpanded ? 'border-primary/40 shadow-sm' : 'border-border hover:border-border'} ${day.isTransitDay ? 'border-dashed' : ''}`}>
        {/* Day header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 sm:p-4 cursor-pointer" onClick={onToggle}>
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className={`w-9 h-9 rounded-full text-white flex items-center justify-center text-xs font-bold flex-shrink-0 ${day.isTransitDay ? 'bg-muted-foreground/40' : 'bg-primary'}`}>
              {day.dayNumber}
            </div>
            {heroImage && (
              <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0">
                <img src={heroImage.url} alt="" className="w-full h-full object-cover" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground truncate">
                {day.title || day.location || `Day ${day.dayNumber}`}
                {day.isTransitDay && <span className="text-[10px] ml-2 text-muted-foreground/70">Transit</span>}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {day.location && <span>{day.location}</span>}
                {day.hotel?.name && <span> · {day.hotel.name}</span>}
                {day.activities?.length > 0 && <span> · {day.activities.length} activities</span>}
              </p>
            </div>
          </div>
          <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0">
            <div className="text-left sm:text-right">
              <div className="text-[10px] text-muted-foreground/70 uppercase tracking-wide flex items-center sm:justify-end gap-1">
                {day.isItemized ? 'In Line Items' : 'Cost / Price'}
                {!day.isItemized && day.marginOverride != null && (
                  <span className="text-[8px] bg-primary/15 text-primary px-1 rounded font-semibold">{day.marginOverride}%</span>
                )}
              </div>
              {day.isItemized ? (
                <div
                  className="text-xs text-muted-foreground/70 italic"
                  title="This day's costs feed the total via Line Items, not the day rollup."
                >
                  itemized
                </div>
              ) : (
                <div className="text-xs">
                  <span className="text-muted-foreground">{formatCurrency(day.dayCost, currency)}</span>
                  <span className="text-muted-foreground/40 mx-1">→</span>
                  <span className="text-foreground font-semibold">
                    {formatCurrency(Math.round(day.dayCost * (1 + ((day.marginOverride != null ? day.marginOverride : marginPercent) || 0) / 100)), currency)}
                  </span>
                </div>
              )}
              {/* Mandatory park / conservancy / govt fees charged on this
                  day (stay-aware: one-shot fees only on the stay's first
                  night). Shown so the per-day chips reconcile with the
                  sidebar total — they're in the trip total, not extra. */}
              {dayPt > 0 && (
                <div
                  className="text-[10px] text-muted-foreground/70 sm:text-right"
                  title="Mandatory park / conservancy / government fees for this day — already included in the trip total."
                >
                  + {formatCurrency(dayPt, currency)} park &amp; fees
                </div>
              )}
            </div>
            <div className="flex gap-0.5">
              <button onClick={(e) => { e.stopPropagation(); onMoveUp(); }} className="p-1 rounded hover:bg-muted text-muted-foreground/70 disabled:opacity-30" disabled={isFirst}>
                <ChevronUp className="w-3.5 h-3.5" />
              </button>
              <button onClick={(e) => { e.stopPropagation(); onMoveDown(); }} className="p-1 rounded hover:bg-muted text-muted-foreground/70 disabled:opacity-30" disabled={isLast}>
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
              <button onClick={(e) => { e.stopPropagation(); onDuplicate(); }} className="p-1 rounded hover:bg-muted text-muted-foreground/70" title="Duplicate day">
                <Copy className="w-3.5 h-3.5" />
              </button>
              <button onClick={(e) => { e.stopPropagation(); onRemove(); }} className="p-1 rounded hover:bg-red-50 text-muted-foreground/70 hover:text-red-500">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
            <ChevronDown className={`w-4 h-4 text-muted-foreground/70 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
          </div>
        </div>

        {/* Expanded content */}
        {isExpanded && (
          <div className="border-t border-border p-3 sm:p-4 space-y-4">
            {/* Title + Location + Transit toggle */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Day Title</label>
                <input
                  type="text"
                  value={day.title || ''}
                  onChange={e => onUpdate({ title: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm focus:outline-none focus:border-primary"
                  placeholder="e.g. Game drive in Mara"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Location</label>
                <input
                  type="text"
                  value={day.location || ''}
                  onChange={e => onUpdate({ location: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm focus:outline-none focus:border-primary"
                  placeholder="e.g. Maasai Mara"
                  list={`destinations-${index}`}
                />
                <datalist id={`destinations-${index}`}>
                  {destinations?.map(d => <option key={d._id} value={d.name} />)}
                </datalist>
              </div>
            </div>

            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input type="checkbox" checked={day.isTransitDay || false} onChange={e => onUpdate({ isTransitDay: e.target.checked })} className="rounded accent-[hsl(243_75%_59%)]" />
              Mark as transit/driving day
            </label>

            {/* Narrative */}
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Description</label>
              <textarea
                rows={3}
                value={day.narrative || ''}
                onChange={e => onUpdate({ narrative: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm focus:outline-none focus:border-primary resize-none"
                placeholder="What happens on this day..."
              />
            </div>

            {/* Meals */}
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Meals Included</label>
              <div className="flex gap-2 flex-wrap">
                {[
                  { key: 'breakfast', label: 'Breakfast', icon: Coffee },
                  { key: 'lunch', label: 'Lunch', icon: Sun },
                  { key: 'dinner', label: 'Dinner', icon: Sunset },
                ].map(({ key, label, icon: Icon }) => {
                  const active = day.meals?.[key];
                  return (
                    <button key={key} onClick={() => onUpdate({ meals: { ...day.meals, [key]: !active } })}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${active ? 'bg-primary text-white border-primary' : 'bg-card text-muted-foreground border-border hover:border-border'}`}>
                      <Icon className="w-3 h-3" /> {label}
                    </button>
                  );
                })}
              </div>
              <input
                type="text"
                value={day.meals?.notes || ''}
                onChange={e => onUpdate({ meals: { ...day.meals, notes: e.target.value } })}
                className="w-full mt-2 px-3 py-1.5 rounded-lg bg-background border border-border text-xs focus:outline-none focus:border-primary"
                placeholder="Notes (optional, e.g. 'packed lunch', 'dinner at boma')"
              />
            </div>

            {/* Hotel */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-medium text-muted-foreground">Accommodation</label>
                {day.hotel && <button onClick={() => onUpdate({ hotel: null, roomType: '' })} className="text-[10px] text-red-400 hover:underline">Clear</button>}
              </div>
              {day.hotel?.name ? (
                <>
                  <div className="flex items-center gap-3 p-2.5 rounded-lg bg-background border border-border">
                    {day.hotel.images?.[0]?.url && <img src={day.hotel.images[0].url} alt="" className="w-12 h-12 rounded-md object-cover" />}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate flex items-center gap-1.5">
                        <span className="truncate">{day.hotel.name}</span>
                        {day.hotel.warnings?.length > 0 && (
                          <span title={day.hotel.warnings.join('\n')} className="flex-shrink-0">
                            <AlertTriangle className="w-3 h-3 text-amber-500" />
                          </span>
                        )}
                      </p>
                      <p className="text-[10px] text-muted-foreground truncate">
                        {day.hotel.roomType || '—'}
                        {day.hotel.mealPlan && ` · ${day.hotel.mealPlan}`}
                        {day.hotel.seasonLabel && ` · ${day.hotel.seasonLabel}`}
                        {` · ${formatCurrency(day.hotel.ratePerNightInQuoteCurrency || day.hotel.ratePerNight, currency)}/night`}
                      </p>
                      {day.hotel.rateListName && (
                        <p className="text-[10px] text-muted-foreground/70 truncate">
                          {day.hotel.rateListName} ({(day.hotel.audienceApplied || []).join(', ')})
                        </p>
                      )}
                      {/* Surface low/medium PDF-extraction confidence so the
                          operator reviews the rate before it reaches a
                          client. 'high'/'' are silent. */}
                      {['low', 'medium'].includes(day.hotel.extractionConfidence) && (
                        <p
                          className={`text-[10px] mt-0.5 inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-semibold ${
                            day.hotel.extractionConfidence === 'low'
                              ? 'bg-red-50 text-red-700 border border-red-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}
                          title="This rate sheet was transcribed from a PDF with this confidence level. Verify the numbers against the source before sending."
                        >
                          <AlertTriangle className="w-2.5 h-2.5" />
                          {day.hotel.extractionConfidence === 'low' ? 'Low' : 'Medium'}-confidence rate — verify
                        </p>
                      )}
                      {day.hotel.mandatoryAddOnsPerNightTotal > 0 && (
                        <p className="text-[10px] text-muted-foreground/70 truncate" title={(day.hotel.mandatoryAddOnsPerNight || []).map(m => m.name).join(', ')}>
                          Includes mandatory: {formatCurrency((day.hotel.mandatoryAddOnsPerNightTotal || 0) * (day.hotel.fxRate || 1), currency)}/night
                          {day.hotel.mandatoryAddOnsPerNight?.length ? ` (${day.hotel.mandatoryAddOnsPerNight.map(m => m.name).join(', ')})` : ''}
                        </p>
                      )}
                    </div>
                    <button onClick={() => setShowHotelPicker(true)} className="text-[10px] text-primary hover:underline">Change</button>
                  </div>

                  {/* Room-type picker (#2.1). Lists the partner hotel's
                      available room types; changing it reprices the whole
                      stay with that preferredRoomType. Without this the
                      resolver silently defaults to the cheapest room. Only
                      shown when the hotel offers more than one type. */}
                  {(() => {
                    const hotelDoc = hotels.find(h => h._id === day.hotel.hotelId);
                    const roomTypes = roomTypesForHotel(hotelDoc);
                    const current = day.hotel.roomType || '';
                    // Always include the priced room type as an option so the
                    // select isn't blank if the partner doc drifted.
                    const options = current && !roomTypes.includes(current)
                      ? [current, ...roomTypes]
                      : roomTypes;
                    if (options.length < 2) return null;
                    return (
                      <div className="mt-1.5 flex items-center gap-2">
                        <label className="text-[10px] text-muted-foreground whitespace-nowrap">Room type</label>
                        <select
                          value={current}
                          onChange={(e) => onChangeRoomType?.(e.target.value)}
                          className="flex-1 px-2 py-1 rounded-md bg-background border border-border text-[11px] text-foreground focus:outline-none focus:border-primary"
                        >
                          {!current && <option value="">Cheapest (auto)</option>}
                          {options.map(rt => <option key={rt} value={rt}>{rt}</option>)}
                        </select>
                      </div>
                    );
                  })()}

                  {/* Meal-plan picker (#3.12). Changing it reprices the
                      whole stay against the rate list with that meal plan.
                      Only shown when the hotel offers more than one. */}
                  {(() => {
                    const hotelDoc = hotels.find(h => h._id === day.hotel.hotelId);
                    const plans = mealPlansForHotel(hotelDoc);
                    const current = day.hotel.mealPlan || '';
                    const options = current && !plans.includes(current)
                      ? [current, ...plans]
                      : plans;
                    if (options.length < 2) return null;
                    return (
                      <div className="mt-1.5 flex items-center gap-2">
                        <label className="text-[10px] text-muted-foreground whitespace-nowrap">Meal plan</label>
                        <select
                          value={current}
                          onChange={(e) => onChangeMealPlan?.(e.target.value)}
                          className="flex-1 px-2 py-1 rounded-md bg-background border border-border text-[11px] text-foreground focus:outline-none focus:border-primary"
                        >
                          {options.map(mp => <option key={mp} value={mp}>{mp}</option>)}
                        </select>
                      </div>
                    );
                  })()}

                  {/* Conditions surfaced by the rate resolver — visa rules,
                      blackout dates, group-size pricing, etc. Blocking ones
                      must be acknowledged before the quote can be sent;
                      warning / info levels are read-only callouts. */}
                  {(day.hotel.conditions || []).length > 0 && (
                    <div className="mt-2 space-y-1.5">
                      {(day.hotel.conditions || []).map((c, ci) => {
                        const sev = c.severity || 'info';
                        const palette = sev === 'blocking'
                          ? 'border-red-300 bg-red-50 text-red-900'
                          : sev === 'warning'
                          ? 'border-amber-300 bg-amber-50 text-amber-900'
                          : 'border-stone-200 bg-stone-50 text-stone-800';
                        return (
                          <div key={ci} className={`flex items-start gap-2 p-2 rounded-md border text-[11px] ${palette}`}>
                            <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="font-medium uppercase text-[9px] tracking-wide opacity-75">{sev}</p>
                              <p className="leading-snug">{c.text || c.label || 'Condition applies'}</p>
                            </div>
                            {sev === 'blocking' && (
                              c.acknowledged ? (
                                <span className="text-[10px] font-semibold inline-flex items-center gap-0.5">
                                  <CheckCircle className="w-3 h-3" /> Acked
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => onAcknowledgeCondition?.(index, ci)}
                                  className="text-[10px] font-semibold px-2 py-0.5 rounded bg-red-600 text-white hover:bg-red-700"
                                >
                                  Acknowledge
                                </button>
                              )
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Convenience: another night at the same hotel. Re-prices for the
                      next date so seasonal/stay-tier shifts are honoured (we don't
                      copy this snapshot's rate forward — that would be silently wrong). */}
                  <button
                    onClick={onExtendStay}
                    className="mt-1.5 w-full p-1.5 rounded-md border border-dashed border-border text-[10px] text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                    title="Insert a new day after this one with the same hotel, re-priced for that night's date"
                  >
                    <Plus className="w-3 h-3 inline mr-0.5" /> Add another night here
                  </button>
                </>
              ) : (
                <button onClick={() => setShowHotelPicker(true)} className="w-full p-2.5 rounded-lg border border-dashed border-border text-xs text-muted-foreground hover:border-primary hover:text-primary">
                  <Hotel className="w-3.5 h-3.5 inline mr-1" /> Select hotel
                </button>
              )}

              {showHotelPicker && (
                <div className="mt-2 p-3 rounded-lg bg-background border border-border max-h-72 overflow-y-auto space-y-1.5">
                  {/* Search + sort (#2.4) — painless triage when an org has
                      many lodges in a region. Pure client-side over the
                      already location-matched list. */}
                  <div className="flex items-center gap-1.5 sticky top-0 bg-background pb-1.5">
                    <input
                      type="text"
                      value={hotelQuery}
                      onChange={(e) => setHotelQuery(e.target.value)}
                      placeholder="Search hotels…"
                      className="flex-1 px-2 py-1 rounded-md bg-card border border-border text-[11px] focus:outline-none focus:border-primary"
                    />
                    <select
                      value={hotelSort}
                      onChange={(e) => setHotelSort(e.target.value)}
                      className="px-1.5 py-1 rounded-md bg-card border border-border text-[10px] focus:outline-none focus:border-primary"
                      title="Sort hotels"
                    >
                      <option value="name">Name</option>
                      <option value="price">$ low→hi</option>
                      <option value="stars">★ high→lo</option>
                    </select>
                  </div>
                  {(() => {
                    const q = hotelQuery.trim().toLowerCase();
                    const list = matchedHotels
                      .filter(h => !q || `${h.name} ${h.destination || ''} ${h.location || ''}`.toLowerCase().includes(q))
                      .slice()
                      .sort((a, b) => {
                        if (hotelSort === 'price') return cheapestPerPersonOf(a) - cheapestPerPersonOf(b);
                        if (hotelSort === 'stars') return (b.stars || 0) - (a.stars || 0);
                        return String(a.name || '').localeCompare(String(b.name || ''));
                      });
                    return list.length === 0 ? (
                    <p className="text-xs text-muted-foreground/70 text-center py-2">
                      {matchedHotels.length === 0 ? 'No hotels for this location. Add some in Partners.' : `No hotels match “${hotelQuery}”.`}
                    </p>
                  ) : list.map(h => {
                    // Preview: show every active rate list's label so operator
                    // can see audience/meal plan options before clicking.
                    const activeLists = (h.rateLists || []).filter(l => l.isActive !== false);
                    return (
                      <div key={h._id} className="bg-card rounded p-2 border border-border">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-medium text-foreground truncate">
                            {h.name}
                            {h.stars ? <span className="ml-1 text-[10px] text-amber-500">{'★'.repeat(h.stars)}</span> : null}
                          </p>
                          <button
                            onClick={() => { onSelectHotel(h); setShowHotelPicker(false); }}
                            className="text-[10px] px-2 py-0.5 rounded bg-primary text-white hover:opacity-90 shrink-0"
                          >
                            Select
                          </button>
                        </div>
                        {activeLists.length > 0 ? (
                          <>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {activeLists.map((l, li) => (
                                <span key={li} className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                                  {l.name} · {(l.audience || []).join('/')} · {l.currency} · {l.mealPlan}
                                </span>
                              ))}
                            </div>
                            <button
                              onClick={() => setOpenRatesFor(openRatesFor === h._id ? null : h._id)}
                              className="mt-1 text-[10px] text-primary hover:underline"
                            >
                              {openRatesFor === h._id ? 'Hide rates' : 'View rates'}
                            </button>
                            {openRatesFor === h._id && (
                              <div className="mt-1.5 space-y-1.5">
                                {activeLists.map((l, li) => {
                                  const season = seasonForDate(l, checkInDate);
                                  const rooms = season?.rooms || [];
                                  return (
                                    <div key={li} className="rounded border border-border p-1.5">
                                      <p className="text-[10px] font-medium text-foreground">
                                        {l.name} · {(l.audience || []).join('/')} · {l.mealPlan} · {l.currency}
                                        {season?.name ? <span className="text-muted-foreground"> · {season.name}</span> : null}
                                      </p>
                                      {rooms.length ? rooms.map((r, ri) => (
                                        <div key={ri} className="mt-1 text-[10px]">
                                          <div className="flex justify-between gap-2">
                                            <span className="font-medium text-foreground truncate">{r.roomType}</span>
                                            <span className="text-muted-foreground shrink-0">
                                              single {r.singleOccupancy || '—'} · sharing {r.perPersonSharing || '—'}{r.pricingMode === 'per_room_total' ? '/rm' : 'pp'}{r.triplePerPerson ? ` · triple ${r.triplePerPerson}` : ''}
                                            </span>
                                          </div>
                                          {(r.childBrackets || []).length > 0 && (
                                            <div className="text-muted-foreground/70">child — {r.childBrackets.map(childBracketLabel).join('; ')}</div>
                                          )}
                                        </div>
                                      )) : (
                                        <p className="text-[10px] text-muted-foreground/70 mt-1">No room pricing for this season.</p>
                                      )}
                                    </div>
                                  );
                                })}
                                <p className="text-[9px] text-muted-foreground/60">
                                  {checkInDate
                                    ? `Rates for the season covering ${checkInDate}, in each list's currency. Final price depends on room split & pax.`
                                    : "Set travel dates to show the exact season. Amounts in each list's currency."}
                                </p>
                              </div>
                            )}
                          </>
                        ) : (
                          <p className="text-[10px] text-muted-foreground/70 mt-1">No rate lists configured</p>
                        )}
                      </div>
                    );
                  });
                  })()}
                  <button onClick={() => setShowHotelPicker(false)} className="text-[10px] text-muted-foreground/70 hover:underline w-full text-right pt-1">Close</button>
                </div>
              )}

              {/* Per-hotel preference for where the rate-list inclusions and
                  exclusions appear on the quote: on this day's card, merged
                  into the trip-level Included/Excluded list, or hidden. */}
              {day.hotel?.name && ((day.hotel.inclusions?.length || 0) > 0 || (day.hotel.exclusions?.length || 0) > 0) && (
                <div className="mt-2 p-2.5 rounded-lg bg-background border border-border space-y-2">
                  {(day.hotel.inclusions?.length || 0) > 0 && (
                    <DisplayPrefRow
                      label="Inclusions"
                      count={day.hotel.inclusions.length}
                      value={day.hotel.inclusionsDisplay || 'day'}
                      onChange={(v) => onUpdate({ hotel: { ...day.hotel, inclusionsDisplay: v } })}
                    />
                  )}
                  {(day.hotel.exclusions?.length || 0) > 0 && (
                    <DisplayPrefRow
                      label="Exclusions"
                      count={day.hotel.exclusions.length}
                      value={day.hotel.exclusionsDisplay || 'day'}
                      onChange={(v) => onUpdate({ hotel: { ...day.hotel, exclusionsDisplay: v } })}
                    />
                  )}
                </div>
              )}
            </div>

            {/* Activities */}
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Activities</label>
              {day.activities?.length > 0 && (
                <div className="space-y-1 mb-2">
                  {day.activities.map((a, i) => {
                    const dur = formatDuration(a.duration);
                    const hasWarning = a.warnings?.length > 0;
                    const totalDisplay = a.totalCostInQuoteCurrency ?? a.totalCost ?? 0;
                    return (
                      <div key={i} className="flex items-center justify-between p-2 rounded bg-background border border-border">
                        <div className="flex items-center gap-2 min-w-0">
                          {a.images?.[0]?.url ? (
                            <img src={cldThumb(a.images[0].url, 60)} alt="" className="w-6 h-6 rounded object-cover flex-shrink-0" />
                          ) : (
                            <Ticket className="w-3 h-3 text-muted-foreground/70 flex-shrink-0" />
                          )}
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs text-foreground truncate">{a.name}</span>
                              {hasWarning && (
                                <span title={a.warnings.join('\n')}>
                                  <AlertTriangle className="w-3 h-3 text-amber-500 flex-shrink-0" />
                                </span>
                              )}
                            </div>
                            {dur && (
                              <p className="text-[10px] text-muted-foreground/70 flex items-center gap-0.5">
                                <Clock className="w-2.5 h-2.5" /> {dur}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="text-[10px] text-muted-foreground">{formatCurrency(totalDisplay, currency)}</span>
                          <button onClick={() => onRemoveActivity(i)} className="text-muted-foreground/70 hover:text-red-500">
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              <button onClick={() => setShowActivityPicker(!showActivityPicker)} className="w-full p-2 rounded-lg border border-dashed border-border text-xs text-muted-foreground hover:border-primary hover:text-primary">
                <Plus className="w-3 h-3 inline mr-0.5" /> Add activity
              </button>
              {showActivityPicker && (
                <div className="mt-2 p-3 rounded-lg bg-background border border-border max-h-64 overflow-y-auto space-y-1">
                  {matchedActivities.length === 0 ? (
                    <p className="text-xs text-muted-foreground/70 text-center py-2">No activities for this location.</p>
                  ) : matchedActivities.map(a => {
                    const dur = formatDuration(a.duration);
                    return (
                      <button key={a._id} onClick={() => { onAddActivity(a); }}
                        className="w-full text-left p-2 rounded bg-card hover:bg-primary/10 border border-border transition-colors">
                        <div className="flex items-start gap-2">
                          {a.images?.[0]?.url && (
                            <img src={cldThumb(a.images[0].url, 80)} alt="" className="w-8 h-8 rounded object-cover flex-shrink-0 mt-0.5" />
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-medium text-foreground truncate">{a.name}</p>
                            <p className="text-[10px] text-muted-foreground">
                              {formatCurrency(a.costPerPerson || a.groupRate || 0, currency)} {a.pricingModel === 'per_person' ? '/person' : '/group'}
                              {dur && <> · <Clock className="w-2.5 h-2.5 inline mb-0.5" /> {dur}</>}
                              {a.minimumAge > 0 && <> · {a.minimumAge}+ yrs</>}
                              {a.maxGroupSize > 0 && <> · max {a.maxGroupSize}</>}
                            </p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                  <button onClick={() => setShowActivityPicker(false)} className="text-[10px] text-muted-foreground/70 hover:underline w-full text-right pt-1">Close</button>
                </div>
              )}
            </div>

            {/* Transport */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-medium text-muted-foreground">Transport</label>
                {day.transport && <button onClick={onClearTransport} className="text-[10px] text-red-400 hover:underline">Clear</button>}
              </div>
              {day.transport?.name ? (
                <div className="p-2.5 rounded-lg bg-background border border-border space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground truncate flex items-center gap-1.5">
                        <Truck className="w-3.5 h-3.5 text-muted-foreground/70 flex-shrink-0" />
                        {day.transport.name}
                        {day.transport.warnings?.length > 0 && (
                          <span title={day.transport.warnings.join('\n')}>
                            <AlertTriangle className="w-3 h-3 text-amber-500" />
                          </span>
                        )}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {day.transport.type && <span className="capitalize">{String(day.transport.type).replace(/_/g, ' ')}</span>}
                        {day.transport.capacity > 0 && <> · cap {day.transport.capacity}</>}
                        {day.transport.routeOrZone && <> · {day.transport.routeOrZone}</>}
                      </p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {day.transport.fuelIncluded && <span className="text-[9px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">Fuel</span>}
                        {day.transport.driverIncluded && <span className="text-[9px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">Driver</span>}
                        {day.transport.distanceKm > 0 && <span className="text-[9px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{day.transport.distanceKm} km</span>}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs font-semibold text-foreground">
                        {formatCurrency(day.transport.totalCostInQuoteCurrency ?? day.transport.totalCost ?? 0, currency)}
                      </p>
                      <p className="text-[9px] text-muted-foreground/70">{String(day.transport.pricingModel || '').replace(/_/g, ' ')}</p>
                    </div>
                  </div>
                  <input
                    type="text"
                    value={day.transport.estimatedTime || ''}
                    onChange={e => onUpdateTransportField('estimatedTime', e.target.value)}
                    placeholder="Transfer time (optional, e.g. '4 hrs', '1 hr 30 min')"
                    className="w-full px-2 py-1 rounded bg-card border border-border text-[11px] focus:outline-none focus:border-primary"
                  />
                </div>
              ) : (
                <button onClick={() => setShowTransportPicker(!showTransportPicker)} className="w-full p-2 rounded-lg border border-dashed border-border text-xs text-muted-foreground hover:border-primary hover:text-primary">
                  <Truck className="w-3 h-3 inline mr-1" /> Add transport
                </button>
              )}
              {showTransportPicker && !day.transport && (
                <div className="mt-2 p-3 rounded-lg bg-background border border-border max-h-72 overflow-y-auto space-y-1.5">
                  {matchedTransport.length === 0 ? (
                    <p className="text-xs text-muted-foreground/70 text-center py-2">No transport for this location. Add some in Partners.</p>
                  ) : matchedTransport.map(t => {
                    const isPerKm = t.pricingModel === 'per_km';
                    const km = transportKmInputs[t._id] || '';
                    return (
                      <div key={t._id} className="bg-card rounded p-2 border border-border">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-medium text-foreground truncate">{t.name}</p>
                            <p className="text-[10px] text-muted-foreground">
                              <span className="capitalize">{String(t.type || '').replace(/_/g, ' ')}</span>
                              {t.capacity > 0 && ` · cap ${t.capacity}`}
                              {' · '}
                              {formatCurrency(t.rate || 0, currency)} {String(t.pricingModel || '').replace(/_/g, ' ')}
                            </p>
                            {t.routeOrZone && (
                              <p className="text-[10px] text-muted-foreground/70 mt-0.5">{t.routeOrZone}</p>
                            )}
                          </div>
                          {isPerKm ? (
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <input
                                type="number"
                                min="0"
                                value={km}
                                onChange={e => setTransportKmInputs({ ...transportKmInputs, [t._id]: e.target.value })}
                                placeholder="km"
                                className="w-14 px-1.5 py-0.5 rounded bg-background border border-border text-[10px] focus:outline-none focus:border-primary"
                              />
                              <button
                                onClick={() => {
                                  const distanceKm = parseFloat(km);
                                  if (!distanceKm || distanceKm <= 0) {
                                    toast.error('Enter distance in km');
                                    return;
                                  }
                                  onSelectTransport(t, { distanceKm });
                                  setShowTransportPicker(false);
                                }}
                                className="text-[10px] px-2 py-0.5 rounded bg-primary text-white hover:opacity-90"
                              >
                                Add
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => { onSelectTransport(t); setShowTransportPicker(false); }}
                              className="text-[10px] px-2 py-0.5 rounded bg-primary text-white hover:opacity-90 flex-shrink-0"
                            >
                              Select
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  <button onClick={() => setShowTransportPicker(false)} className="text-[10px] text-muted-foreground/70 hover:underline w-full text-right pt-1">Close</button>
                </div>
              )}
            </div>

            {/* Images */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-medium text-muted-foreground">Day Gallery</label>
                <button onClick={() => setShowImagePicker(true)} className="text-[10px] text-primary hover:underline flex items-center gap-0.5">
                  <Plus className="w-2.5 h-2.5" /> Add image
                </button>
              </div>
              {day.images?.length > 0 ? (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {day.images.map((img, i) => (
                    <div key={i} className="relative group aspect-square rounded-lg overflow-hidden border border-border">
                      <img src={img.url} alt="" className="w-full h-full object-cover" />
                      {i === 0 && (
                        <div className="absolute top-1 left-1 bg-primary text-white text-[8px] px-1 py-0.5 rounded font-bold flex items-center gap-0.5">
                          <Star className="w-2 h-2" /> HERO
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center gap-1 sm:opacity-0 sm:group-hover:opacity-100">
                        {i !== 0 && (
                          <button onClick={() => onSetHero(i)} className="text-white text-[10px] bg-card/20 hover:bg-card/30 px-1.5 py-0.5 rounded">Set hero</button>
                        )}
                        <button onClick={() => onRemoveImage(i)} className="text-white text-[10px] bg-red-500/80 hover:bg-red-500 px-1.5 py-0.5 rounded">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4 rounded-lg border border-dashed border-border">
                  <ImageIcon className="w-5 h-5 text-muted-foreground/40 mx-auto mb-1" />
                  <p className="text-[10px] text-muted-foreground/70">No images yet</p>
                </div>
              )}

              {showImagePicker && (
                <DayImagePicker
                  hotels={hotels}
                  destinations={destinations}
                  currentLocation={day.location}
                  currentHotel={day.hotel}
                  onPick={(image) => { onAddImage(image); setShowImagePicker(false); }}
                  onClose={() => setShowImagePicker(false)}
                />
              )}
            </div>

            {/* Margin override (operator-only) */}
            <div className="pt-3 border-t border-border">
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-medium text-muted-foreground">Margin Override</label>
                {day.marginOverride != null && (
                  <button onClick={() => onUpdate({ marginOverride: null })} className="text-[10px] text-red-400 hover:underline">
                    Use global ({marginPercent}%)
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={day.marginOverride != null ? day.marginOverride : ''}
                  onChange={(e) => {
                    const v = e.target.value;
                    onUpdate({ marginOverride: v === '' ? null : parseInt(v) });
                  }}
                  className="flex-1 px-3 py-1.5 rounded-lg bg-background border border-border text-xs focus:outline-none focus:border-primary"
                  placeholder={`Default: ${marginPercent}%`}
                />
                <span className="text-xs text-muted-foreground/70">%</span>
              </div>
              <p className="text-[10px] text-muted-foreground/70 mt-1">
                Override the global margin for this day only. Useful for high-margin add-ons or discounted days.
              </p>
            </div>

            {/* Add day after this */}
            <button onClick={onAddAfter} className="w-full text-[10px] text-muted-foreground/70 hover:text-primary hover:underline pt-1">
              + Insert day after this one
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Image Picker Modal ─────────────────────────

function DayImagePicker({ hotels, destinations, currentLocation, currentHotel, onPick, onClose }) {
  const [tab, setTab] = useState('upload');
  const [url, setUrl] = useState('');
  const [uploading, setUploading] = useState(false);

  const [libraryQuery, setLibraryQuery] = useState(currentLocation || '');
  const [libraryItems, setLibraryItems] = useState([]);
  const [libraryLoading, setLibraryLoading] = useState(false);

  const [stockQuery, setStockQuery] = useState(currentLocation || '');
  const [stockItems, setStockItems] = useState([]);
  const [stockLoading, setStockLoading] = useState(false);
  const [stockError, setStockError] = useState('');

  // Resolve the day's destination early so we can pass its type as a library fallback filter.
  const matchedDest = destinations?.find(d => currentLocation && d.name.toLowerCase().includes(currentLocation.toLowerCase()));
  const destType = matchedDest?.type;

  const fetchLibrary = async (q) => {
    setLibraryLoading(true);
    try {
      const params = { q, limit: 60 };
      if (destType) params.type = destType;
      const { data } = await api.get('/library/search', { params });
      setLibraryItems(data);
    } catch { setLibraryItems([]); }
    finally { setLibraryLoading(false); }
  };

  useEffect(() => {
    if (tab === 'library' && libraryItems.length === 0) fetchLibrary(libraryQuery);
    if (tab === 'stock' && stockItems.length === 0 && stockQuery.trim()) fetchStock(stockQuery);
  }, [tab]);

  const pickLibrary = (img) => {
    api.post(`/library/${img._id}/used`).catch(() => {});
    onPick({ url: img.url, source: 'library', caption: img.caption, credit: img.credit, creditUrl: img.sourceUrl });
  };

  const fetchStock = async (q) => {
    if (!q.trim()) { setStockItems([]); return; }
    setStockLoading(true);
    setStockError('');
    try {
      const { data } = await api.get('/library/stock/search', { params: { q, perPage: 50 } });
      setStockItems(data.items || []);
      if ((data.items || []).length === 0) setStockError(`No stock photos found for "${q}".`);
    } catch (err) {
      setStockItems([]);
      setStockError(err?.response?.data?.message || 'Stock photo search failed.');
    } finally { setStockLoading(false); }
  };

  const pickStock = (img) => {
    onPick({ url: img.url, source: 'pexels', caption: img.caption, credit: img.credit ? `Photo by ${img.credit} on Pexels` : 'Pexels', creditUrl: img.creditUrl });
  };

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('image', file);
      const { data } = await api.post('/uploads/image', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      onPick({ url: data.url, source: 'uploaded' });
    } catch (err) { toast.error('Upload failed'); }
    finally { setUploading(false); }
  };

  const handleUrlAdd = () => {
    if (!url.trim()) return;
    onPick({ url: url.trim(), source: 'url' });
  };

  // Hotel images for current hotel + nearby hotels
  const hotelImages = [];
  if (currentHotel?.images) currentHotel.images.forEach(img => hotelImages.push({ ...img, hotelName: currentHotel.name }));
  hotels.filter(h => !currentLocation || h.destination?.toLowerCase().includes(currentLocation.toLowerCase()))
    .forEach(h => h.images?.forEach(img => hotelImages.push({ ...img, hotelName: h.name })));

  // Destination images (matchedDest resolved above)
  const destImages = matchedDest?.images || [];

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="bg-card rounded-xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col animate-scale-in">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between flex-shrink-0">
          <h3 className="text-base font-semibold text-foreground">Add Image</h3>
          <button onClick={onClose} className="text-muted-foreground/70 hover:text-muted-foreground"><X className="w-4 h-4" /></button>
        </div>

        <div className="flex gap-1 px-5 pt-3 border-b border-border overflow-x-auto flex-shrink-0">
          {[
            { id: 'upload', label: 'Upload' },
            { id: 'destination', label: `Destination${destImages.length ? ` (${destImages.length})` : ''}` },
            { id: 'hotels', label: `Hotels${hotelImages.length ? ` (${hotelImages.length})` : ''}` },
            { id: 'library', label: 'Library' },
            { id: 'stock', label: 'Stock' },
            { id: 'url', label: 'URL' },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`px-3 py-2 text-xs font-medium transition-colors relative whitespace-nowrap ${tab === t.id ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}>
              {t.label}
              {tab === t.id && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {tab === 'upload' && (
            <div className="text-center py-8">
              <input type="file" accept="image/*" onChange={handleUpload} className="hidden" id="day-img-upload" />
              <label htmlFor="day-img-upload" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary cursor-pointer">
                <ImageIcon className="w-4 h-4" /> {uploading ? 'Uploading...' : 'Choose Image'}
              </label>
              <p className="text-xs text-muted-foreground/70 mt-3">JPG, PNG, or WebP up to 5MB</p>
            </div>
          )}

          {tab === 'destination' && (
            destImages.length === 0 ? (
              <div className="text-center py-8 text-sm text-muted-foreground/70">
                No images saved for {currentLocation || 'this location'}. <br />
                <span className="text-xs">Add images to the destination in the Destinations page.</span>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {destImages.map((img, i) => (
                  <button key={i} onClick={() => onPick({ url: img.url, source: 'destination' })}
                    className="aspect-square rounded-lg overflow-hidden border border-border hover:border-primary transition-colors">
                    <img src={img.url} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )
          )}

          {tab === 'hotels' && (
            hotelImages.length === 0 ? (
              <div className="text-center py-8 text-sm text-muted-foreground/70">No hotel images for this location.</div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {hotelImages.map((img, i) => (
                  <button key={i} onClick={() => onPick({ url: img.url, source: 'hotel' })}
                    className="aspect-square rounded-lg overflow-hidden border border-border hover:border-primary transition-colors relative group">
                    <img src={img.url} alt="" className="w-full h-full object-cover" />
                    <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[8px] px-1 py-0.5 truncate opacity-0 group-hover:opacity-100">
                      {img.hotelName}
                    </div>
                  </button>
                ))}
              </div>
            )
          )}

          {tab === 'library' && (
            <div className="space-y-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={libraryQuery}
                  onChange={e => setLibraryQuery(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && fetchLibrary(libraryQuery)}
                  placeholder="Search by tag (e.g. nairobi, beach, safari)"
                  className="flex-1 px-3 py-2 rounded-lg bg-background border border-border text-sm focus:outline-none focus:border-primary"
                />
                <button onClick={() => fetchLibrary(libraryQuery)} className="px-3 py-2 rounded-lg bg-primary text-white text-xs font-medium">
                  Search
                </button>
              </div>
              {libraryLoading ? (
                <div className="flex justify-center py-8"><div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
              ) : libraryItems.length === 0 ? (
                <div className="text-center py-8 text-sm text-muted-foreground/70">
                  No library images found{libraryQuery ? ` for "${libraryQuery}"` : ''}.
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {libraryItems.map(img => (
                    <button key={img._id} onClick={() => pickLibrary(img)} title={img.credit || img.caption || ''}
                      className="aspect-square rounded-lg overflow-hidden border border-border hover:border-primary transition-colors relative group">
                      <img src={cldThumb(img.url, 300)} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" />
                      {img.credit && (
                        <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[8px] px-1 py-0.5 truncate opacity-0 group-hover:opacity-100">
                          {img.credit}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === 'stock' && (
            <div className="space-y-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={stockQuery}
                  onChange={e => setStockQuery(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && fetchStock(stockQuery)}
                  placeholder="Search stock photos (e.g. masai mara, diani beach, elephant)"
                  className="flex-1 px-3 py-2 rounded-lg bg-background border border-border text-sm focus:outline-none focus:border-primary"
                />
                <button onClick={() => fetchStock(stockQuery)} className="px-3 py-2 rounded-lg bg-primary text-white text-xs font-medium">
                  Search
                </button>
              </div>
              {stockLoading ? (
                <div className="flex justify-center py-8"><div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
              ) : stockError ? (
                <div className="text-center py-8 text-sm text-muted-foreground/70">{stockError}</div>
              ) : stockItems.length === 0 ? (
                <div className="text-center py-8 text-sm text-muted-foreground/70">
                  Search for destination, activity, or wildlife photos.
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {stockItems.map(img => (
                      <button key={img.id} onClick={() => pickStock(img)} title={img.credit ? `Photo by ${img.credit}` : ''}
                        className="aspect-square rounded-lg overflow-hidden border border-border hover:border-primary transition-colors relative group">
                        <img src={img.thumbnail} alt={img.caption || ''} loading="lazy" decoding="async" className="w-full h-full object-cover" />
                        {img.credit && (
                          <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[8px] px-1 py-0.5 truncate opacity-0 group-hover:opacity-100">
                            {img.credit}
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] text-muted-foreground/60 text-center pt-1">
                    Photos provided by <a href="https://www.pexels.com" target="_blank" rel="noreferrer" className="underline">Pexels</a>
                  </p>
                </>
              )}
            </div>
          )}

          {tab === 'url' && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Image URL</label>
                <input
                  type="url"
                  value={url}
                  onChange={e => setUrl(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm focus:outline-none focus:border-primary"
                  placeholder="https://..."
                  autoFocus
                />
              </div>
              {url && (
                <div className="aspect-video rounded-lg overflow-hidden border border-border bg-background">
                  <img src={url} alt="" className="w-full h-full object-cover" onError={(e) => e.target.style.display = 'none'} />
                </div>
              )}
              <button onClick={handleUrlAdd} disabled={!url.trim()} className="w-full py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary disabled:opacity-50">
                Add Image
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Block Toggles Component ─────────────────────

const BLOCK_INFO = {
  cover: { label: 'Cover', description: 'Hero with title and trip summary' },
  highlights: { label: 'Itinerary at a Glance', description: 'Location overview with highlights' },
  day_by_day: { label: 'Day by Day', description: 'Detailed day-by-day breakdown' },
  map: { label: 'Route Map', description: 'Interactive map of the route' },
  accommodations: { label: 'Accommodations', description: 'Hotel cards with photos' },
  optional_extras: { label: 'Optional Extras', description: 'Add-ons available at the lodges' },
  pricing: { label: 'Pricing', description: 'Total price and per-person breakdown' },
  inclusions: { label: 'Inclusions', description: "What's included in the price" },
  exclusions: { label: 'Exclusions', description: "What's not included" },
  payment_terms: { label: 'Payment & Booking Terms', description: 'Deposit, cancellation, payment schedule' },
  about_us: { label: 'About Us', description: 'Your company story (off by default)' },
  terms: { label: 'Terms & Conditions', description: 'Legal terms (off by default)' },
};

// Defaults for any block IDs that newer schemas added but an existing quote
// doesn't yet have in its persisted blocks array. Keeps the toggle UI in sync
// with the renderer (which defaults missing IDs to enabled=true).
const BLOCK_DEFAULTS = {
  optional_extras: { enabled: true, order: 5 },
};

function BlockToggles({ blocks = [], onChange }) {
  // Backfill any block IDs the schema knows about but that aren't in this
  // quote's saved array (older quotes saved before the ID existed).
  const present = new Set(blocks.map(b => b.id));
  const knownIds = Object.keys(BLOCK_INFO);
  const missing = knownIds
    .filter(id => !present.has(id) && BLOCK_DEFAULTS[id])
    .map(id => ({ id, ...BLOCK_DEFAULTS[id] }));
  const fullList = [...blocks, ...missing];
  const sorted = [...fullList].sort((a, b) => a.order - b.order);

  // Operate on the backfilled list so newly-added schema blocks behave like
  // any other toggle. Persists the (possibly) larger array back via onChange.
  const toggle = (id) => {
    onChange(fullList.map(b => b.id === id ? { ...b, enabled: !b.enabled } : b));
  };

  const move = (idx, dir) => {
    const reordered = [...sorted];
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= reordered.length) return;
    [reordered[idx], reordered[newIdx]] = [reordered[newIdx], reordered[idx]];
    reordered.forEach((b, i) => b.order = i);
    onChange(reordered);
  };

  return (
    <div className="bg-card rounded-xl border border-border p-4 sm:p-5">
      <h3 className="text-sm font-semibold text-foreground mb-1">Quote Sections</h3>
      <p className="text-[10px] text-muted-foreground mb-3">Toggle and reorder what shows on the client page</p>
      <div className="space-y-1">
        {sorted.map((block, idx) => {
          const info = BLOCK_INFO[block.id] || { label: block.id, description: '' };
          return (
            <div key={block.id} className={`flex items-center gap-2 p-2 rounded-lg border transition-colors ${block.enabled ? 'bg-background border-border' : 'bg-card border-border opacity-60'}`}>
              <button onClick={() => toggle(block.id)} className="flex-shrink-0">
                {block.enabled ? <Eye className="w-3.5 h-3.5 text-primary" /> : <EyeOff className="w-3.5 h-3.5 text-muted-foreground/70" />}
              </button>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-foreground truncate">{info.label}</p>
                <p className="text-[9px] text-muted-foreground/70 truncate">{info.description}</p>
              </div>
              <div className="flex flex-col">
                <button onClick={() => move(idx, -1)} disabled={idx === 0} className="text-muted-foreground/40 hover:text-muted-foreground disabled:opacity-20">
                  <ChevronUp className="w-3 h-3" />
                </button>
                <button onClick={() => move(idx, 1)} disabled={idx === sorted.length - 1} className="text-muted-foreground/40 hover:text-muted-foreground disabled:opacity-20">
                  <ChevronDown className="w-3 h-3" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── MODALS ─────────────────────────────────────
// Styled replacements for native confirm()/prompt(). Both mirror the
// package-picker overlay so the builder keeps one dialog language.

function ConfirmModal({ open, title, message, confirmLabel = 'Confirm', tone = 'default', busy = false, onConfirm, onCancel }) {
  if (!open) return null;
  const confirmClasses = tone === 'danger'
    ? 'bg-red-600 text-white hover:bg-red-700'
    : 'bg-primary text-white hover:bg-primary/90';
  return (
    <div
      className="fixed inset-0 bg-black/40 z-[60] flex items-start justify-center p-4 pt-[20vh]"
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div onClick={e => e.stopPropagation()} className="bg-card rounded-xl shadow-xl w-full max-w-md">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <h3 className="text-base font-semibold text-foreground">{title}</h3>
          <button onClick={onCancel} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-4">
          <p className="text-sm text-muted-foreground">{message}</p>
        </div>
        <div className="px-4 py-3 border-t border-border flex justify-end gap-2">
          <button
            onClick={onCancel}
            disabled={busy}
            className="px-3 py-2 rounded-lg bg-card border border-border text-sm font-medium text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${confirmClasses}`}
          >
            {busy ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function TemplateModal({ open, defaultName = '', onSubmit, onCancel }) {
  const [name, setName] = useState(defaultName);
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  // Reset fields each time the modal is (re)opened so a prior entry
  // doesn't leak into the next save.
  useEffect(() => {
    if (open) { setName(defaultName); setDescription(''); setBusy(false); }
  }, [open, defaultName]);
  if (!open) return null;
  const submit = async () => {
    if (!name.trim()) return;
    setBusy(true);
    try { await onSubmit({ name: name.trim(), description: description.trim() }); }
    finally { setBusy(false); }
  };
  return (
    <div
      className="fixed inset-0 bg-black/40 z-[60] flex items-start justify-center p-4 pt-[15vh]"
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-label="Save as template"
    >
      <div onClick={e => e.stopPropagation()} className="bg-card rounded-xl shadow-xl w-full max-w-md">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <h3 className="text-base font-semibold text-foreground">Save as Template</h3>
          <button onClick={onCancel} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Template name</label>
            <input
              type="text"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
              placeholder="e.g. 7-Day Classic Safari"
              className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm text-foreground focus:outline-none focus:border-primary transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Description <span className="text-muted-foreground/60">(optional)</span></label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="When to reach for this template"
              className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm text-foreground focus:outline-none focus:border-primary transition-colors resize-none"
            />
          </div>
        </div>
        <div className="px-4 py-3 border-t border-border flex justify-end gap-2">
          <button
            onClick={onCancel}
            disabled={busy}
            className="px-3 py-2 rounded-lg bg-card border border-border text-sm font-medium text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={busy || !name.trim()}
            className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {busy ? 'Saving…' : 'Save Template'}
          </button>
        </div>
      </div>
    </div>
  );
}
