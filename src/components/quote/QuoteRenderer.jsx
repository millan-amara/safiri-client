import { useState, useEffect, useRef } from 'react';
import { mealPlanLabels } from '../../utils/helpers';

const HOTEL_TYPE_LABELS = {
  hotel: 'Hotel',
  lodge: 'Lodge',
  tented_camp: 'Tented Camp',
  resort: 'Resort',
  villa: 'Villa',
  apartment: 'Apartment',
  guesthouse: 'Guesthouse',
  conservancy_camp: 'Conservancy Camp',
};
const formatHotelType = (t) => HOTEL_TYPE_LABELS[t] || (t ? t.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : '');

// Render N filled + (5-N) empty stars in the brand color. Returns null if no
// rating set so callers can short-circuit.
function StarRating({ stars, color, size = 12 }) {
  if (!stars) return null;
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          size={size}
          fill={i < stars ? color : 'transparent'}
          style={{ color: i < stars ? color : '#d6d3d1' }}
        />
      ))}
    </div>
  );
}

const COUNTRY_LOCALE = {
  'Kenya': 'en-KE', 'Tanzania': 'en-TZ', 'Uganda': 'en-UG',
  'United Kingdom': 'en-GB', 'UK': 'en-GB', 'Ireland': 'en-IE',
  'United States': 'en-US', 'USA': 'en-US', 'Canada': 'en-CA',
  'Australia': 'en-AU', 'New Zealand': 'en-NZ',
  'Germany': 'de-DE', 'France': 'fr-FR', 'Spain': 'es-ES', 'Italy': 'it-IT',
  'Netherlands': 'nl-NL', 'Belgium': 'nl-BE', 'Portugal': 'pt-PT',
  'Brazil': 'pt-BR', 'Mexico': 'es-MX',
  'Japan': 'ja-JP', 'China': 'zh-CN', 'India': 'en-IN', 'UAE': 'en-AE',
  'South Africa': 'en-ZA',
};

const makeFormatters = (locale) => ({
  formatDate: (d, opts = { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) =>
    d ? new Date(d).toLocaleDateString(locale, opts) : '',
  formatCurrency: (amt, cur = 'USD') =>
    new Intl.NumberFormat(locale, { style: 'currency', currency: cur, currencyDisplay: 'narrowSymbol', minimumFractionDigits: 0 }).format(amt || 0),
});
import {
  MapPin, Calendar, Users as UsersIcon, Clock, ChevronDown,
  Sun, Sunrise, Sunset, Moon, Coffee, Star, Phone, Mail,
  Globe, CheckCircle, XCircle, ExternalLink, Timer,
} from 'lucide-react';

// Format an activity duration (hours, possibly fractional) into a short label.
const formatDuration = (h) => {
  const n = Number(h) || 0;
  if (n <= 0) return '';
  if (n < 1) return `${Math.round(n * 60)} min`;
  if (n === 1) return '1 hr';
  if (n < 24) return `${n % 1 === 0 ? n : n.toFixed(1)} hrs`;
  const d = n / 24;
  return `${d % 1 === 0 ? d : d.toFixed(1)} day${d >= 2 ? 's' : ''}`;
};

const timeIcons = {
  early_morning: Sunrise,
  morning: Sun,
  afternoon: Sun,
  evening: Sunset,
  all_day: Sun,
  night: Moon,
};

const patternDot = (color) => `url("data:image/svg+xml;utf8,${encodeURIComponent(
  `<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24'><circle cx='2' cy='2' r='1' fill='${color}' opacity='0.25'/></svg>`
)}")`;
const patternGrid = (color) => `url("data:image/svg+xml;utf8,${encodeURIComponent(
  `<svg xmlns='http://www.w3.org/2000/svg' width='32' height='32'><path d='M0 16 L32 16 M16 0 L16 32' stroke='${color}' stroke-width='0.5' opacity='0.2'/></svg>`
)}")`;
const patternLines = (color) => `url("data:image/svg+xml;utf8,${encodeURIComponent(
  `<svg xmlns='http://www.w3.org/2000/svg' width='60' height='12'><path d='M0 6 L60 6' stroke='${color}' stroke-width='0.5' opacity='0.18'/></svg>`
)}")`;

const STYLE_PRESETS = {
  editorial: {
    fontLink: 'https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=Playfair+Display:wght@500;600;700;800&family=Caveat:wght@500;700&display=swap',
    body: "'DM Sans', system-ui, sans-serif",
    heading: "'Playfair Display', serif",
    headingWeight: 700,
    coverH1: 'clamp(2.5rem, 6vw, 4rem)',
    pattern: patternDot,
    photoRadius: '0.75rem',
    photoFrame: null,
  },
  modern: {
    fontLink: 'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Caveat:wght@500;700&display=swap',
    body: "'Inter', system-ui, sans-serif",
    heading: "'Inter', system-ui, sans-serif",
    headingWeight: 800,
    coverH1: 'clamp(2.75rem, 6.5vw, 4.5rem)',
    pattern: patternGrid,
    photoRadius: '0',
    photoFrame: null,
  },
  minimal: {
    fontLink: 'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600;700&family=Nunito+Sans:wght@300;400;600;700&family=Caveat:wght@500;700&display=swap',
    body: "'Nunito Sans', system-ui, sans-serif",
    heading: "'Cormorant Garamond', serif",
    headingWeight: 500,
    coverH1: 'clamp(3rem, 7vw, 5rem)',
    pattern: patternLines,
    photoRadius: '2px',
    photoFrame: { padding: '8px', background: '#fff', border: '1px solid #e7e5e4' },
  },
};

// Walk consecutive same-hotel days and emit one record per stay so we can
// scale per-night fees correctly without N+1ing on snapshot duplicates.
function eachStaySegment(days) {
  const out = [];
  let cur = null;
  const keyOf = (d) => d.hotel ? `${d.hotel.hotelId || d.hotel.name}` : null;
  for (const d of (days || [])) {
    const k = keyOf(d);
    if (cur && k !== null && k === cur.key) cur.nights++;
    else {
      if (cur) out.push(cur);
      cur = { key: k, hotel: d.hotel || null, nights: d.hotel ? 1 : 0 };
    }
  }
  if (cur) out.push(cur);
  return out.filter(s => s.hotel?.name && s.nights > 0);
}

// Aggregate pass-through fees across the trip into one row per (hotel, fee
// name). Fees with per-night units are scaled by the stay's night count;
// one-shot units (per_entry, flat) are taken as-is. Returns rows in quote
// currency, suitable for direct rendering.
function collectFees(days) {
  const rows = [];
  for (const seg of eachStaySegment(days)) {
    for (const fee of (seg.hotel.passThroughFees || [])) {
      if (!(fee.amountInQuoteCurrency > 0)) continue;
      const perNight = ['per_person_per_day', 'per_person_per_night', 'per_room_per_night'].includes(fee.unit);
      const amount = perNight ? fee.amountInQuoteCurrency * seg.nights : fee.amountInQuoteCurrency;
      rows.push({
        name: fee.name,
        source: seg.hotel.name,
        unit: fee.unit,
        nights: seg.nights,
        amount,
        mandatory: fee.mandatory !== false,
        notes: fee.notes || '',
      });
    }
  }
  return rows;
}

// Pull deposit + cancellation tiers + booking terms from the package (when
// the quote was built from one) and from each unique hotel snapshot. Deposit
// returns the highest % across sources (worst case for the client). Tiers
// dedupe by (daysBefore, penaltyPct). Booking terms collected per source.
function collectPolicy(quote) {
  let depositPct = 0;
  const tierMap = new Map();
  const bookingTerms = [];

  const ingest = (source, name) => {
    if (!source) return;
    if ((source.depositPct || 0) > depositPct) depositPct = source.depositPct;
    for (const t of (source.cancellationTiers || [])) {
      const key = `${t.daysBefore}|${t.penaltyPct}`;
      if (!tierMap.has(key)) tierMap.set(key, { ...t, sources: [name] });
      else if (!tierMap.get(key).sources.includes(name)) tierMap.get(key).sources.push(name);
    }
    if (source.bookingTerms) bookingTerms.push({ text: source.bookingTerms, source: name });
  };

  if (quote.packageSnapshot) ingest(quote.packageSnapshot, quote.packageSnapshot.name || 'Package');

  const seenHotels = new Set();
  for (const d of (quote.days || [])) {
    const h = d.hotel;
    if (!h?.name || seenHotels.has(h.name)) continue;
    seenHotels.add(h.name);
    ingest(h, h.name);
  }

  // Sort tiers by daysBefore descending — least restrictive first.
  const cancellationTiers = Array.from(tierMap.values()).sort((a, b) => (b.daysBefore || 0) - (a.daysBefore || 0));
  return { depositPct, cancellationTiers, bookingTerms };
}

// Format an add-on unit code into a human label.
const ADDON_UNIT_LABELS = {
  per_person_per_day: '/ person / day',
  per_day: '/ day',
  per_trip: '/ trip',
  per_person: '/ person',
  per_room_per_day: '/ room / day',
  per_vehicle: '/ vehicle',
};
const formatAddOnUnit = (u) => ADDON_UNIT_LABELS[u] || (u ? `/ ${String(u).replace(/_/g, ' ')}` : '');

// Walk every unique hotel stay and collect optional add-ons (drinks, massages,
// balloon rides, etc.). Grouped by hotel so the share-page renderer can show
// "available at this lodge" sub-sections rather than a flat soup. Mandatory
// add-ons are excluded — those belong in line items, not the showcase.
function collectAddOns(days) {
  const byHotel = new Map();
  const seenStays = new Set();
  for (const d of (days || [])) {
    const h = d.hotel;
    if (!h?.name) continue;
    const stayKey = `${h.hotelId || h.name}`;
    if (seenStays.has(stayKey)) continue;
    seenStays.add(stayKey);
    const optional = (h.addOns || []).filter(a => a.optional !== false);
    if (!optional.length) continue;
    byHotel.set(h.name, optional);
  }
  return Array.from(byHotel.entries()).map(([hotelName, addOns]) => ({ hotelName, addOns }));
}

// Format a supplement entry (rate-list source currency) into a quote-currency
// label, e.g. "Christmas surcharge: +$40 per person". Returns '' when the
// supplement carries no payable amount.
function formatSupplement(s, hotel, formatCurrency, quoteCurrency) {
  const fx = hotel?.fxRate || 1;
  const native = Number(s.nativeAmount) || 0;
  const inQuote = (Number(s.amount) || 0) * fx;
  if (inQuote <= 0 && native <= 0) return '';
  const amt = inQuote > 0 ? formatCurrency(inQuote, quoteCurrency) : formatCurrency(native, s.nativeCurrency || quoteCurrency);
  return `${s.name}: +${amt}`;
}

export default function QuoteRenderer({ quote, token, previewMode = false }) {
  const [activeDay, setActiveDay] = useState(0);

  // Toggling a day collapses any other expanded day simultaneously; that
  // shifts the clicked card upward in the document, leaving the user scrolled
  // past its header. Scroll the newly-opened card into view. Skip the initial
  // mount so visitors aren't yanked past the cover to day 0 on page load.
  const dayRefs = useRef({});
  const didMountDayScroll = useRef(false);
  useEffect(() => {
    if (!didMountDayScroll.current) { didMountDayScroll.current = true; return; }
    if (activeDay >= 0 && dayRefs.current[activeDay]) {
      requestAnimationFrame(() => {
        dayRefs.current[activeDay]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
  }, [activeDay]);
  const [lightbox, setLightbox] = useState(null); // { images, index }
  const heroRef = useRef(null);

  const openLightbox = (images, index) => setLightbox({ images, index });
  const closeLightbox = () => setLightbox(null);
  const nextLightbox = () => setLightbox(l => l && { ...l, index: (l.index + 1) % l.images.length });
  const prevLightbox = () => setLightbox(l => l && { ...l, index: (l.index - 1 + l.images.length) % l.images.length });

  useEffect(() => {
    if (!lightbox) return;
    const onKey = (e) => {
      if (e.key === 'Escape') closeLightbox();
      else if (e.key === 'ArrowRight') nextLightbox();
      else if (e.key === 'ArrowLeft') prevLightbox();
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [lightbox]);

  const brand = quote.brandingSnapshot || {};
  const primaryColor = brand.primaryColor || '#B45309';
  const secondaryColor = brand.secondaryColor || primaryColor;
  const locale = COUNTRY_LOCALE[quote.contact?.country] || 'en-US';
  const { formatDate, formatCurrency } = makeFormatters(locale);
  const isDraft = quote.status === 'draft';
  const style = STYLE_PRESETS[quote.pdfStyle] || STYLE_PRESETS.editorial;
  const coverLayout = quote.coverLayout || 'full_bleed';
  const coverImg = quote.coverImage?.url || quote.days?.find(d => d.images?.[0]?.url)?.images?.[0]?.url || quote.days?.find(d => d.hotel?.images?.[0]?.url)?.hotel?.images?.[0]?.url || '';

  // Inject the chosen font stylesheet once on mount
  useEffect(() => {
    const id = 'quote-style-font';
    let link = document.getElementById(id);
    if (!link) {
      link = document.createElement('link');
      link.id = id;
      link.rel = 'stylesheet';
      document.head.appendChild(link);
    }
    link.href = style.fontLink;
  }, [style.fontLink]);

  const headingStyle = { fontFamily: style.heading, fontWeight: style.headingWeight };
  const accentBarStyle = { background: `linear-gradient(90deg, ${primaryColor} 0%, ${secondaryColor} 100%)` };
  const patternUrl = style.pattern(primaryColor);
  const photoWrap = { borderRadius: style.photoRadius, overflow: 'hidden', ...(style.photoFrame || {}) };
  const totalDays = quote.days?.length || 0;
  const totalNights = Math.max(0, totalDays - 1);
  const totalPax = (quote.travelers?.adults || 0) + (quote.travelers?.children || 0);

  // Build day display from quote.days
  let currentDate = quote.startDate ? new Date(quote.startDate) : null;
  const days = (quote.days || []).map((d, i) => {
    const date = currentDate ? new Date(currentDate) : null;
    if (currentDate) currentDate.setDate(currentDate.getDate() + 1);
    return {
      dayNumber: d.dayNumber || i + 1,
      date,
      title: d.title,
      destination: d.location,
      hotel: d.hotel,
      activities: (d.activities || []).map(a => ({
        timeOfDay: a.timeOfDay || 'morning',
        name: a.name,
        description: a.description || '',
        duration: a.duration || 0,
        image: a.images?.[0] || null,
      })),
      mealPlan: d.hotel?.mealPlan,
      meals: d.meals,
      narrative: d.narrative,
      heroImage: d.images?.[0],
      images: d.images || [],
      isTransitDay: d.isTransitDay,
      isFirstInLocation: i === 0 || d.location !== quote.days[i - 1]?.location,
      transport: d.transport,
    };
  });

  // Group days by location for the "at a glance" view
  const locations = [];
  let lastLoc = null;
  let dayCounter = 1;
  for (const d of (quote.days || [])) {
    if (d.location && d.location !== lastLoc) {
      locations.push({
        name: d.location,
        startDay: dayCounter,
        nights: 1,
        hotel: d.hotel,
        transport: d.transport,
      });
      lastLoc = d.location;
    } else if (d.location === lastLoc) {
      locations[locations.length - 1].nights++;
    }
    dayCounter++;
  }

  // Block visibility helper
  const blockEnabled = (id) => {
    const block = quote.blocks?.find(b => b.id === id);
    return block ? block.enabled : true;
  };

  // Get unique hotels from days for accommodations block
  const uniqueHotels = [];
  const seenHotels = new Set();
  for (const d of (quote.days || [])) {
    if (d.hotel?.name && !seenHotels.has(d.hotel.name)) {
      seenHotels.add(d.hotel.name);
      uniqueHotels.push(d.hotel);
    }
  }

  // Merge per-hotel rate-list inclusions/exclusions into the trip-level lists
  // when the operator chose "In trip list" on that day card. Items carry the
  // hotel name as attribution so the client knows which stay each line refers
  // to. Dedupe keeps quote-level items (operator-curated) at the top and
  // suppresses an exact duplicate from a hotel.
  const buildMergedList = (kind /* 'inclusions' | 'exclusions' */, prefKey /* 'inclusionsDisplay' | 'exclusionsDisplay' */) => {
    const baseList = (quote[kind] || []).map(text => ({ text, source: null }));
    const baseSet = new Set(baseList.map(b => b.text));
    const merged = [];
    const mergedSeen = new Set();
    const seenStays = new Set();
    for (const d of (quote.days || [])) {
      const h = d.hotel;
      if (!h?.name) continue;
      // Render each hotel's items only once per stay-key, so a 5-night Mara
      // run doesn't repeat the same lines five times.
      const stayKey = `${h.hotelId || h.name}`;
      if (seenStays.has(stayKey)) continue;
      seenStays.add(stayKey);
      const pref = h[prefKey] || 'day';
      if (pref !== 'merged') continue;
      for (const item of (h[kind] || [])) {
        const key = `${item}::${h.name}`;
        if (baseSet.has(item) || mergedSeen.has(key)) continue;
        mergedSeen.add(key);
        merged.push({ text: item, source: h.name });
      }
    }
    return [...baseList, ...merged];
  };
  const mergedInclusions = buildMergedList('inclusions', 'inclusionsDisplay');
  const mergedExclusions = buildMergedList('exclusions', 'exclusionsDisplay');

  // Trip-level pass-through fees (park, community, government levies) and
  // booking policy (deposit/cancellation/terms) — both aggregated from per-day
  // hotel snapshots and the package snapshot when present.
  const tripFees = collectFees(quote.days);
  const tripPolicy = collectPolicy(quote);
  const tripAddOns = collectAddOns(quote.days);

  const quickFacts = [
    { icon: Calendar, label: 'Duration', value: `${totalDays} Days / ${totalNights} Nights` },
    { icon: UsersIcon, label: 'Travelers', value: `${totalPax} Traveler${totalPax !== 1 ? 's' : ''}` },
    { icon: MapPin, label: 'Start', value: quote.startPoint },
    { icon: Calendar, label: 'Date', value: quote.startDate ? formatDate(quote.startDate) : 'TBD' },
  ];

  const FactCard = ({ icon: Icon, label, value, dark = false }) => (
    <div className={`rounded-xl p-3 border ${dark ? 'bg-white/10 backdrop-blur-sm border-white/20 text-white' : 'bg-white/70 backdrop-blur-sm border-stone-200/60'}`}>
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className="w-3.5 h-3.5" style={{ color: dark ? '#fff' : primaryColor }} />
        <span className={`text-[10px] uppercase tracking-wide font-semibold ${dark ? 'text-white/70' : 'text-stone-400'}`}>{label}</span>
      </div>
      <p className={`text-sm font-semibold ${dark ? 'text-white' : 'text-stone-800'}`}>{value}</p>
    </div>
  );

  return (
    <div
      className="min-h-screen bg-stone-50 relative"
      style={{
        '--brand': primaryColor,
        fontFamily: style.body,
        backgroundImage: patternUrl,
        backgroundAttachment: 'fixed',
      }}
    >
      {isDraft && (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center overflow-hidden">
          <div
            style={{
              fontFamily: style.heading,
              fontWeight: 800,
              fontSize: 'clamp(6rem, 18vw, 14rem)',
              letterSpacing: '0.3em',
              color: 'rgba(220, 38, 38, 0.09)',
              border: '8px solid rgba(220, 38, 38, 0.14)',
              padding: '0.5rem 2.5rem',
              borderRadius: '14px',
              transform: 'rotate(-24deg)',
              whiteSpace: 'nowrap',
            }}
          >
            DRAFT
          </div>
        </div>
      )}
      {/* ─── HERO COVER ─────────────────────────────── */}
      {coverLayout === 'split' ? (
        <header ref={heroRef} className="grid md:grid-cols-[45%_55%] min-h-[85vh]">
          <div className="relative min-h-[320px] overflow-hidden" style={{ background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})` }}>
            {coverImg && <img src={coverImg} alt="" className="w-full h-full object-cover" />}
          </div>
          <div className="p-8 sm:p-12 lg:p-16 flex flex-col justify-center bg-white">
            {brand.logo
              ? <img src={brand.logo} alt={brand.companyName} className="h-10 mb-8 object-contain" />
              : brand.companyName && <p className="text-sm font-semibold uppercase tracking-widest mb-6" style={{ color: primaryColor }}>{brand.companyName}</p>}
            <p className="text-xs uppercase tracking-[0.25em] font-semibold mb-4" style={{ color: primaryColor }}>Travel Proposal</p>
            <p className="text-sm text-stone-500 mb-2">Proposal for {quote.contact?.firstName} {quote.contact?.lastName}</p>
            <h1 className="text-stone-900 leading-[1.05] mb-6" style={{ ...headingStyle, fontSize: style.coverH1 }}>{quote.title}</h1>
            {quote.coverNarrative && <p className="text-base text-stone-600 leading-relaxed mb-8">{quote.coverNarrative}</p>}
            <div className="grid grid-cols-2 gap-3 max-w-md">
              {quickFacts.map(f => <FactCard key={f.label} {...f} />)}
            </div>
          </div>
        </header>
      ) : coverLayout === 'band' ? (
        <header ref={heroRef} className="flex flex-col min-h-[85vh]">
          <div className="relative h-[40vh] min-h-[260px] overflow-hidden" style={{ background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})` }}>
            {coverImg && <img src={coverImg} alt="" className="w-full h-full object-cover" />}
          </div>
          <div className="h-1" style={{ background: `linear-gradient(90deg, ${primaryColor}, ${secondaryColor})` }} />
          <div className="flex-1 max-w-5xl w-full mx-auto px-6 py-12 sm:py-16 bg-white">
            <div className="flex items-center justify-between mb-8">
              {brand.logo
                ? <img src={brand.logo} alt={brand.companyName} className="h-10 object-contain" />
                : <p className="text-sm font-semibold uppercase tracking-widest" style={{ color: primaryColor }}>{brand.companyName}</p>}
              <p className="text-xs uppercase tracking-[0.25em] font-semibold" style={{ color: primaryColor }}>Travel Proposal</p>
            </div>
            <p className="text-sm text-stone-500 mb-2">Proposal for {quote.contact?.firstName} {quote.contact?.lastName}</p>
            <h1 className="text-stone-900 leading-[1.05] mb-6" style={{ ...headingStyle, fontSize: style.coverH1 }}>{quote.title}</h1>
            {quote.coverNarrative && <p className="text-base text-stone-600 max-w-2xl leading-relaxed mb-8">{quote.coverNarrative}</p>}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-2xl">
              {quickFacts.map(f => <FactCard key={f.label} {...f} />)}
            </div>
          </div>
        </header>
      ) : (
        <header
          ref={heroRef}
          className="relative min-h-[85vh] flex items-end overflow-hidden"
          style={{ background: coverImg ? '#000' : `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})` }}
        >
          {coverImg && <img src={coverImg} alt="" className="absolute inset-0 w-full h-full object-cover" />}
          <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.15) 40%, rgba(0,0,0,0.85) 100%)' }} />
          <div className="relative z-10 w-full max-w-5xl mx-auto px-6 pb-16 pt-24 text-white">
            {brand.logo
              ? <img src={brand.logo} alt={brand.companyName} className="h-12 mb-8 object-contain" />
              : brand.companyName && <p className="text-sm font-semibold uppercase tracking-widest mb-6 text-white">{brand.companyName}</p>}
            <p className="text-xs uppercase tracking-[0.25em] font-semibold mb-4 text-white/80">Travel Proposal</p>
            <p className="text-sm text-white/80 mb-2">Proposal for {quote.contact?.firstName} {quote.contact?.lastName}</p>
            <h1 className="text-white leading-[1.05] mb-8" style={{ ...headingStyle, fontSize: style.coverH1 }}>{quote.title}</h1>
            {quote.coverNarrative && <p className="text-base text-white/90 max-w-2xl leading-relaxed mb-10">{quote.coverNarrative}</p>}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-2xl">
              {quickFacts.map(f => <FactCard key={f.label} {...f} dark />)}
            </div>
          </div>
        </header>
      )}

      {/* ─── HIGHLIGHTS BLOCK ───────────────────────── */}
      {blockEnabled('highlights') && (
        <section className="max-w-5xl mx-auto px-6 py-16">
          <h2 className="text-2xl font-bold text-stone-900 mb-6" style={headingStyle}>
            Your Itinerary at a Glance
          </h2>

          <div className="space-y-0">
            {locations.map((loc, i) => {
              const endDay = loc.startDay + loc.nights - 1;
              return (
                <div key={i} className="flex gap-4 group">
                  <div className="flex flex-col items-center w-12 flex-shrink-0">
                    <div className="w-8 h-8 rounded-full text-white flex items-center justify-center text-xs font-bold z-10" style={{ backgroundColor: primaryColor }}>
                      {loc.startDay}
                    </div>
                    {i < locations.length - 1 && <div className="w-0.5 flex-1 bg-stone-200 -mt-0.5" />}
                  </div>
                  <div className="pb-8 flex-1">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <h3 className="text-base font-bold text-stone-900">{loc.name}</h3>
                      <span className="text-xs text-stone-400">
                        Day {loc.startDay}{endDay !== loc.startDay ? `–${endDay}` : ''} · {loc.nights} night{loc.nights !== 1 ? 's' : ''}
                      </span>
                    </div>
                    {loc.hotel?.name && (
                      <p className="text-sm text-stone-500 mt-0.5">
                        <span className="font-medium text-stone-700">{loc.hotel.name}</span>
                        {loc.hotel.mealPlan && ` · ${mealPlanLabels[loc.hotel.mealPlan] || loc.hotel.mealPlan}`}
                      </p>
                    )}
                    {loc.transport?.name && (
                      <p className="text-xs text-stone-400 mt-1 flex items-center gap-1">
                        → {loc.transport.name} {loc.transport.estimatedTime && `(${loc.transport.estimatedTime})`}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {quote.highlights?.length > 0 && (
            <div className="mt-8 p-5 rounded-xl border border-stone-200 bg-white">
              <h3 className="text-sm font-bold text-stone-800 mb-3">Trip Highlights</h3>
              <div className="flex flex-wrap gap-2">
                {quote.highlights.map((h, i) => (
                  <span key={i} className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-stone-100 text-stone-700">
                    <Star className="w-3 h-3" style={{ color: primaryColor }} /> {h}
                  </span>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* ─── ROUTE MAP BLOCK ────────────────────────── */}
      {blockEnabled('map') && (
        <RouteMap days={quote.days || []} startPoint={quote.startPoint} endPoint={quote.endPoint} primaryColor={primaryColor} headingStyle={headingStyle} />
      )}

      {/* ─── DAY BY DAY BLOCK ───────────────────────── */}
      {blockEnabled('day_by_day') && (
        <section className="max-w-5xl mx-auto px-6 pb-16">
          <h2 className="text-2xl font-bold text-stone-900 mb-8" style={headingStyle}>
            Day by Day
          </h2>

        <div className="space-y-6">
          {days.map((day, i) => (
            <div
              key={i}
              ref={el => { dayRefs.current[i] = el; }}
              className={`rounded-2xl overflow-hidden border scroll-mt-6 transition-all ${
                activeDay === i ? 'border-stone-300 shadow-md' : 'border-stone-200'
              }`}
            >
              {/* Day header */}
              <button
                onClick={() => setActiveDay(activeDay === i ? -1 : i)}
                className="w-full flex items-center gap-4 p-5 bg-white hover:bg-stone-50 transition-colors text-left"
              >
                <div className="w-14 h-14 rounded-xl flex flex-col items-center justify-center flex-shrink-0 text-white" style={{ backgroundColor: primaryColor }}>
                  <span className="text-[9px] uppercase tracking-wider font-semibold opacity-80">Day</span>
                  <span className="text-xl font-bold -mt-0.5">{day.dayNumber}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-stone-900">{day.destination}</h3>
                    {day.date && (
                      <span className="text-xs text-stone-400">
                        {day.date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                      </span>
                    )}
                  </div>
                  {day.hotel?.name && (
                    <p className="text-sm text-stone-500 truncate">{day.hotel.name}</p>
                  )}
                </div>
                <ChevronDown className={`w-5 h-5 text-stone-400 transition-transform flex-shrink-0 ${activeDay === i ? 'rotate-180' : ''}`} />
              </button>

              {/* Day content */}
              <div
                className={`grid transition-all duration-500 ease-out ${
                  activeDay === i ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
                }`}
              >
                <div className="overflow-hidden">
                <div className="border-t border-stone-100 bg-stone-50/50">
                  <div className="grid grid-cols-1 lg:grid-cols-5 gap-0">
                    {/* Left — narrative + images */}
                    <div className="lg:col-span-3 p-6">
                      {day.narrative && (
                        <p className="text-sm text-stone-600 leading-relaxed mb-5">{day.narrative}</p>
                      )}

                      {day.heroImage?.url && (
                        <>
                          <button
                            type="button"
                            onClick={() => openLightbox(day.images, 0)}
                            className="mb-3 block w-full group"
                            style={photoWrap}
                          >
                            <img src={day.heroImage.url} alt={day.destination} className="w-full h-48 object-cover block transition-transform duration-500 group-hover:scale-[1.02]" />
                          </button>
                          {day.heroImage.credit && (
                            <p className="text-[10px] text-stone-400 italic mb-3 -mt-2">
                              {day.heroImage.creditUrl ? (
                                <a href={day.heroImage.creditUrl} target="_blank" rel="noopener noreferrer" className="hover:underline">{day.heroImage.credit}</a>
                              ) : day.heroImage.credit}
                            </p>
                          )}
                          {day.images.length > 1 && (
                            <div className="grid grid-cols-6 gap-1.5 mb-5">
                              {day.images.slice(1, 7).map((img, gi) => (
                                <button
                                  key={gi}
                                  type="button"
                                  onClick={() => openLightbox(day.images, gi + 1)}
                                  className="aspect-square overflow-hidden bg-stone-100 hover:opacity-80 transition-opacity"
                                  style={{ borderRadius: style.photoRadius }}
                                >
                                  <img src={img.url} alt="" className="w-full h-full object-cover" />
                                </button>
                              ))}
                            </div>
                          )}
                        </>
                      )}

                      {day.transport && (
                        <div className="flex items-center gap-2 mb-4 p-3 rounded-lg bg-white border border-stone-200">
                          <div className="w-7 h-7 rounded-md flex items-center justify-center text-white text-xs" style={{ backgroundColor: primaryColor }}>→</div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-semibold text-stone-700">{day.transport.name}</p>
                            {(day.transport.type || day.transport.estimatedTime || day.transport.distanceKm > 0) && (
                              <p className="text-[11px] text-stone-400">
                                {day.transport.type && <span className="capitalize">{String(day.transport.type).replace(/_/g, ' ')}</span>}
                                {day.transport.estimatedTime && <>{day.transport.type ? ' · ' : ''}{day.transport.estimatedTime}</>}
                                {day.transport.distanceKm > 0 && <>{(day.transport.type || day.transport.estimatedTime) ? ' · ' : ''}{day.transport.distanceKm} km</>}
                              </p>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Activities */}
                      {day.activities?.length > 0 && (
                        <div className="space-y-2.5">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-stone-400">Activities</h4>
                          {day.activities.map((act, ai) => {
                            const TimeIcon = timeIcons[act.timeOfDay] || Sun;
                            const dur = formatDuration(act.duration);
                            return (
                              <div key={ai} className="flex items-start gap-2.5">
                                {act.image?.url ? (
                                  <img src={act.image.url} alt="" className="w-10 h-10 rounded-md object-cover flex-shrink-0 mt-0.5" />
                                ) : (
                                  <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-1" style={{ backgroundColor: primaryColor + '15' }}>
                                    <TimeIcon className="w-3 h-3" style={{ color: primaryColor }} />
                                  </div>
                                )}
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-baseline gap-2 flex-wrap">
                                    <p className="text-sm font-medium text-stone-700">{act.name}</p>
                                    {dur && (
                                      <span className="text-[11px] text-stone-400 inline-flex items-center gap-0.5">
                                        <Timer className="w-3 h-3" /> {dur}
                                      </span>
                                    )}
                                  </div>
                                  {act.description && act.description !== act.name && (
                                    <p className="text-xs text-stone-500 mt-0.5 leading-relaxed">{act.description}</p>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Right — accommodation card */}
                    <div className="lg:col-span-2 p-6 lg:border-l border-stone-200">
                      {day.hotel?.name && (
                        <div className="bg-white rounded-xl border border-stone-200 p-4">
                          <p className="text-[10px] uppercase tracking-wider text-stone-400 font-semibold mb-1.5">Accommodation · Day {day.dayNumber}</p>
                          <h4 className="text-sm font-bold text-stone-900">{day.hotel.name}</h4>
                          {day.hotel.stars > 0 && (
                            <div className="mt-1"><StarRating stars={day.hotel.stars} color={primaryColor} size={11} /></div>
                          )}
                          {(day.hotel.type || day.hotel.location) && (
                            <p className="text-[11px] text-stone-400 mt-1">
                              {day.hotel.type && formatHotelType(day.hotel.type)}
                              {day.hotel.type && day.hotel.location && ' · '}
                              {day.hotel.location}
                            </p>
                          )}
                          {day.hotel.roomType && <p className="text-xs text-stone-500 mt-1">{day.hotel.roomType}</p>}
                          {day.hotel.description && (
                            <p className="text-xs text-stone-500 mt-2 leading-relaxed line-clamp-4">{day.hotel.description}</p>
                          )}
                          {day.hotel.images?.[0]?.url && (
                            <div className="mt-3" style={photoWrap}>
                              <img src={day.hotel.images[0].url} alt={day.hotel.name} className="w-full h-28 object-cover block" />
                            </div>
                          )}
                          {(day.hotel.inclusions?.length > 0) && (day.hotel.inclusionsDisplay || 'day') === 'day' && (
                            <div className="mt-3 pt-3 border-t border-stone-100">
                              <p className="text-[10px] uppercase tracking-wider text-stone-400 font-semibold mb-1.5">Included at this stay</p>
                              <ul className="space-y-0.5">
                                {day.hotel.inclusions.map((item, i) => (
                                  <li key={i} className="text-[11px] text-stone-600 leading-snug flex gap-1.5">
                                    <span className="text-green-600">✓</span><span>{item}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {(day.hotel.exclusions?.length > 0) && (day.hotel.exclusionsDisplay || 'day') === 'day' && (
                            <div className="mt-3 pt-3 border-t border-stone-100">
                              <p className="text-[10px] uppercase tracking-wider text-stone-400 font-semibold mb-1.5">Not included at this stay</p>
                              <ul className="space-y-0.5">
                                {day.hotel.exclusions.map((item, i) => (
                                  <li key={i} className="text-[11px] text-stone-500 leading-snug flex gap-1.5">
                                    <span className="text-stone-400">✕</span><span>{item}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {(day.hotel.supplements?.length > 0) && (
                            <div className="mt-3 pt-3 border-t border-stone-100">
                              <p className="text-[10px] uppercase tracking-wider text-stone-400 font-semibold mb-1.5">Date-specific surcharges</p>
                              <ul className="space-y-0.5">
                                {day.hotel.supplements.map((s, i) => {
                                  const label = formatSupplement(s, day.hotel, formatCurrency, quote.pricing?.currency);
                                  if (!label) return null;
                                  return (
                                    <li key={i} className="text-[11px] text-amber-700 leading-snug flex gap-1.5">
                                      <span className="text-amber-500">⚠</span><span>{label}{s.notes ? ` — ${s.notes}` : ''}</span>
                                    </li>
                                  );
                                })}
                              </ul>
                            </div>
                          )}
                        </div>
                      )}

                      {day.mealPlan && (
                        <div className="mt-3 p-3 rounded-lg bg-white border border-stone-200">
                          <p className="text-[10px] uppercase tracking-wider text-stone-400 font-semibold mb-1">Meal Plan</p>
                          <p className="text-sm text-stone-700 flex items-center gap-1.5">
                            <Coffee className="w-3.5 h-3.5" style={{ color: primaryColor }} />
                            {mealPlanLabels[day.mealPlan] || day.mealPlan}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
      )}

      {/* ─── ACCOMMODATIONS BLOCK ───────────────────── */}
      {blockEnabled('accommodations') && uniqueHotels.length > 0 && (
        <section className="max-w-5xl mx-auto px-6 pb-16">
          <h2 className="text-2xl font-bold text-stone-900 mb-6" style={headingStyle}>
            Where You'll Stay
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {uniqueHotels.map((hotel, i) => (
              <div key={i} className="border border-stone-200 bg-white" style={photoWrap}>
                {hotel.images?.[0]?.url && (
                  <div className="h-48 bg-stone-100 overflow-hidden">
                    <img src={hotel.images[0].url} alt={hotel.name} className="w-full h-full object-cover" />
                  </div>
                )}
                <div className="p-5">
                  <h3 className="text-base font-bold text-stone-900">{hotel.name}</h3>
                  {hotel.stars > 0 && (
                    <div className="mt-1.5"><StarRating stars={hotel.stars} color={primaryColor} size={13} /></div>
                  )}
                  {(hotel.type || hotel.location) && (
                    <p className="text-[11px] text-stone-400 mt-1.5 flex items-center gap-1">
                      {hotel.location && <MapPin className="w-3 h-3" />}
                      {hotel.type && formatHotelType(hotel.type)}
                      {hotel.type && hotel.location && ' · '}
                      {hotel.location}
                    </p>
                  )}
                  {hotel.roomType && <p className="text-xs text-stone-500 mt-2">{hotel.roomType}</p>}
                  {hotel.mealPlan && (
                    <p className="text-xs text-stone-500 mt-1">{mealPlanLabels[hotel.mealPlan] || hotel.mealPlan}</p>
                  )}
                  {hotel.description && (
                    <p className="text-sm text-stone-600 mt-3 leading-relaxed line-clamp-3">{hotel.description}</p>
                  )}
                  {(hotel.amenities?.length > 0) && (
                    <div className="mt-3 pt-3 border-t border-stone-100">
                      <div className="flex flex-wrap gap-1">
                        {hotel.amenities.slice(0, 8).map((a, ai) => (
                          <span key={ai} className="text-[10px] px-2 py-0.5 rounded-full bg-stone-100 text-stone-600">
                            {a}
                          </span>
                        ))}
                        {hotel.amenities.length > 8 && (
                          <span className="text-[10px] px-2 py-0.5 text-stone-400">
                            +{hotel.amenities.length - 8}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ─── OPTIONAL EXTRAS BLOCK ──────────────────── */}
      {blockEnabled('optional_extras') && tripAddOns.length > 0 && (
        <section className="max-w-5xl mx-auto px-6 pb-16">
          <h2 className="text-2xl font-bold text-stone-900 mb-2" style={headingStyle}>
            Optional Extras
          </h2>
          <p className="text-sm text-stone-500 mb-6">
            Available at your accommodations — speak to your travel designer to add any of these to your itinerary.
          </p>
          <div className="space-y-5">
            {tripAddOns.map((group, gi) => (
              <div key={gi} className="rounded-2xl border border-stone-200 bg-white p-5">
                <p className="text-[11px] uppercase tracking-wider text-stone-400 font-semibold mb-3">{group.hotelName}</p>
                <div className="divide-y divide-stone-100">
                  {group.addOns.map((a, ai) => (
                    <div key={ai} className="py-3 first:pt-0 last:pb-0 flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-stone-700">{a.name}</p>
                        {a.description && (
                          <p className="text-xs text-stone-500 mt-0.5 leading-relaxed">{a.description}</p>
                        )}
                      </div>
                      <div className="text-right whitespace-nowrap">
                        <div className="text-sm font-semibold text-stone-800">
                          {formatCurrency(a.amountInQuoteCurrency || 0, quote.pricing?.currency)}
                        </div>
                        <div className="text-[10px] text-stone-400">{formatAddOnUnit(a.unit)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ─── PRICING BLOCK ─────────────────────────── */}
      {blockEnabled('pricing') && (
      <section className="max-w-5xl mx-auto px-6 pb-16">
        <div className="rounded-2xl overflow-hidden border border-stone-200 bg-white">
          <div className="p-8 text-center" style={{ background: `linear-gradient(135deg, ${primaryColor}08, ${primaryColor}15)` }}>
            <h2 className="text-2xl font-bold text-stone-900 mb-2" style={headingStyle}>
              Pricing
            </h2>
            <p className="text-sm text-stone-500">
              {quote.tourType === 'private' ? 'Private Tour' : quote.tourType} · {totalDays} Days / {totalNights} Nights · {totalPax} Travelers
            </p>
          </div>

          <div className="p-8">
            {/* Line items (if operator chose to show) */}
            {quote.pricing?.displayMode === 'line_items' && quote.pricing?.lineItems?.length > 0 && (
              <div className="mb-8">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-stone-200">
                      <th className="text-left py-2 text-xs font-semibold text-stone-400 uppercase tracking-wider">Description</th>
                      <th className="text-center py-2 text-xs font-semibold text-stone-400 uppercase tracking-wider">Qty</th>
                      <th className="text-right py-2 text-xs font-semibold text-stone-400 uppercase tracking-wider">Unit Price</th>
                      <th className="text-right py-2 text-xs font-semibold text-stone-400 uppercase tracking-wider">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {quote.pricing.lineItems.map((item, i) => (
                      <tr key={i} className="border-b border-stone-100">
                        <td className="py-3 text-stone-700">{item.description}</td>
                        <td className="py-3 text-center text-stone-500">{item.quantity}</td>
                        <td className="py-3 text-right text-stone-500">{formatCurrency(item.unitPrice, quote.pricing.currency)}</td>
                        <td className="py-3 text-right font-semibold text-stone-800">{formatCurrency(item.total, quote.pricing.currency)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Total */}
            <div className="flex items-center justify-between py-4 border-t-2 border-stone-900">
              <span className="text-lg font-bold text-stone-900">Total</span>
              <span className="text-3xl font-bold" style={{ color: primaryColor }}>
                {formatCurrency(quote.pricing?.totalPrice || 0, quote.pricing?.currency)}
              </span>
            </div>
            {totalPax > 0 && (
              <p className="text-sm text-stone-400 text-right">
                {formatCurrency(quote.pricing?.perPersonPrice || 0, quote.pricing?.currency)} per person
              </p>
            )}

            {/* Pass-through fees — park, community, government levies. These
                are not auto-added to the nightly cost; they're surfaced here
                so the client knows exactly what they're paying for. */}
            {tripFees.length > 0 && (
              <div className="mt-6 pt-5 border-t border-stone-200">
                <p className="text-xs font-bold uppercase tracking-wider text-stone-400 mb-2">
                  Park & Government Fees
                </p>
                <div className="space-y-1.5">
                  {tripFees.map((fee, i) => (
                    <div key={i} className="flex items-center justify-between text-sm gap-3">
                      <div className="text-stone-600 min-w-0 truncate">
                        {fee.name}
                        {fee.source && <span className="text-stone-400 italic"> — {fee.source}</span>}
                      </div>
                      <div className="text-stone-700 font-medium whitespace-nowrap">
                        {formatCurrency(fee.amount, quote.pricing?.currency)}
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-[11px] text-stone-400 mt-2 italic">
                  Pass-through fees collected by the property and remitted to the issuing authority.
                </p>
              </div>
            )}
          </div>
        </div>
      </section>
      )}

      {/* ─── INCLUSIONS / EXCLUSIONS BLOCKS ─────────── */}
      {(blockEnabled('inclusions') || blockEnabled('exclusions')) && (mergedInclusions.length > 0 || mergedExclusions.length > 0) && (
        <section className="max-w-5xl mx-auto px-6 pb-16">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 p-6 rounded-2xl border border-stone-200 bg-white">
            {blockEnabled('inclusions') && mergedInclusions.length > 0 && (
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-stone-400 mb-3 flex items-center gap-1">
                  <CheckCircle className="w-3.5 h-3.5 text-green-500" /> Included
                </h4>
                <div className="space-y-1.5">
                  {mergedInclusions.map((row, i) => (
                    <p key={i} className="text-sm text-stone-600 flex items-start gap-2">
                      <span className="text-green-500 mt-0.5">→</span>
                      <span>
                        {row.text}
                        {row.source && (
                          <span className="text-stone-400 italic"> — {row.source}</span>
                        )}
                      </span>
                    </p>
                  ))}
                </div>
              </div>
            )}
            {blockEnabled('exclusions') && mergedExclusions.length > 0 && (
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-stone-400 mb-3 flex items-center gap-1">
                  <XCircle className="w-3.5 h-3.5 text-stone-400" /> Excluded
                </h4>
                <div className="space-y-1.5">
                  {mergedExclusions.map((row, i) => (
                    <p key={i} className="text-sm text-stone-500 flex items-start gap-2">
                      <span className="text-stone-400 mt-0.5">→</span>
                      <span>
                        {row.text}
                        {row.source && (
                          <span className="text-stone-400 italic"> — {row.source}</span>
                        )}
                      </span>
                    </p>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ─── PAYMENT TERMS BLOCK ───────────────────── */}
      {blockEnabled('payment_terms') && (quote.paymentTerms || tripPolicy.depositPct > 0 || tripPolicy.cancellationTiers.length > 0 || tripPolicy.bookingTerms.length > 0) && (
        <section className="max-w-5xl mx-auto px-6 pb-16">
          <div className="p-6 rounded-2xl bg-stone-50 border border-stone-200 space-y-5">
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-stone-400 mb-2">Payment & Booking Terms</h4>
              {quote.paymentTerms && (
                <p className="text-sm text-stone-600 whitespace-pre-line">{quote.paymentTerms}</p>
              )}
            </div>

            {tripPolicy.depositPct > 0 && (
              <div className="flex items-center gap-3">
                <div className="text-2xl font-bold" style={{ color: primaryColor }}>
                  {tripPolicy.depositPct}%
                </div>
                <div className="text-sm text-stone-600">
                  Deposit due at booking
                  <p className="text-xs text-stone-400">
                    Balance due before travel commences.
                  </p>
                </div>
              </div>
            )}

            {tripPolicy.cancellationTiers.length > 0 && (
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-stone-400 mb-2">
                  Cancellation Policy
                </p>
                <div className="overflow-hidden rounded-lg border border-stone-200 bg-white">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-stone-200 bg-stone-50">
                        <th className="text-left py-2 px-3 text-[11px] font-semibold text-stone-400 uppercase tracking-wider">Days Before Travel</th>
                        <th className="text-right py-2 px-3 text-[11px] font-semibold text-stone-400 uppercase tracking-wider">Penalty</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tripPolicy.cancellationTiers.map((t, i) => (
                        <tr key={i} className="border-b border-stone-100 last:border-0">
                          <td className="py-2 px-3 text-stone-600">
                            {t.daysBefore}+ days
                            {t.sources && t.sources.length > 0 && (
                              <span className="text-[10px] text-stone-400 italic ml-2">
                                ({t.sources.join(', ')})
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-right text-stone-700 font-semibold">{t.penaltyPct}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {tripPolicy.bookingTerms.length > 0 && (
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-stone-400 mb-2">
                  Booking Terms
                </p>
                <div className="space-y-3">
                  {tripPolicy.bookingTerms.map((bt, i) => (
                    <div key={i}>
                      <p className="text-[11px] text-stone-400 italic mb-0.5">{bt.source}</p>
                      <p className="text-sm text-stone-600 whitespace-pre-line">{bt.text}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ─── CLIENT RESPONSE ─────────────────────────── */}
      {!previewMode && quote.status !== 'accepted' && (
        <ClientResponseSection token={token} quoteStatus={quote.status} primaryColor={primaryColor} headingStyle={headingStyle} />
      )}
      {!previewMode && quote.status === 'accepted' && (
        <section className="max-w-5xl mx-auto px-6 pb-16">
          <div className="rounded-2xl bg-green-50 border border-green-200 p-8 text-center">
            <div className="w-14 h-14 rounded-full bg-green-500 text-white flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-7 h-7" />
            </div>
            <h3 className="text-xl font-bold text-green-800 mb-2" style={headingStyle}>
              Quote Accepted
            </h3>
            <p className="text-sm text-green-600">Thank you! The team will be in touch shortly to finalize your booking.</p>
          </div>
        </section>
      )}

      {/* ─── ABOUT / FOOTER ─────────────────────────── */}
      <footer className="border-t border-stone-200" style={{ background: `linear-gradient(to bottom, white, ${primaryColor}06)` }}>
        <div className="max-w-5xl mx-auto px-6 py-16">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-10">
            <div>
              <h3 className="text-lg font-bold text-stone-900 mb-3" style={headingStyle}>
                About {brand.companyName || 'Us'}
              </h3>
              <p className="text-sm text-stone-500 leading-relaxed whitespace-pre-line">
                {brand.aboutUs || `We look forward to making your trip unforgettable. Don't hesitate to reach out with any questions.`}
              </p>
            </div>
            <div>
              <h3 className="text-lg font-bold text-stone-900 mb-3" style={headingStyle}>Contact</h3>
              <div className="space-y-2">
                {brand.companyEmail && (
                  <a href={`mailto:${brand.companyEmail}`} className="flex items-center gap-2 text-sm text-stone-600 hover:text-stone-900 transition-colors">
                    <Mail className="w-4 h-4" style={{ color: primaryColor }} /> {brand.companyEmail}
                  </a>
                )}
                {brand.companyPhone && (
                  <a href={`tel:${brand.companyPhone}`} className="flex items-center gap-2 text-sm text-stone-600 hover:text-stone-900 transition-colors">
                    <Phone className="w-4 h-4" style={{ color: primaryColor }} /> {brand.companyPhone}
                  </a>
                )}
                {brand.companyAddress && (
                  <p className="flex items-start gap-2 text-sm text-stone-600">
                    <MapPin className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: primaryColor }} /> {brand.companyAddress}
                  </p>
                )}
              </div>
            </div>
          </div>

          {quote.createdBy?.name && (
            <div className="mt-10 flex justify-center">
              <div className="max-w-xl w-full bg-white border border-stone-200 rounded-2xl p-6 sm:p-8 text-center" style={{ borderRadius: style.photoRadius }}>
                <p className="text-sm text-stone-600 italic leading-relaxed mb-5">
                  {quote.signatureNote || quote.closingNote || `It would be a privilege to bring this journey to life for you. I'm here to answer any questions and tailor anything you'd like to adjust.`}
                </p>
                {quote.createdBy.signature ? (
                  <img src={quote.createdBy.signature} alt="signature" className="h-12 object-contain mx-auto mb-3" />
                ) : (
                  <div className="mb-3" style={{ fontFamily: "'Caveat', 'Brush Script MT', cursive", fontSize: '32px', color: primaryColor, lineHeight: 1 }}>
                    {quote.createdBy.name.split(' ')[0]}
                  </div>
                )}
                <div className="flex items-center justify-center gap-3 mt-3">
                  {quote.createdBy.avatar && (
                    <img src={quote.createdBy.avatar} alt="" className="w-10 h-10 rounded-full object-cover ring-2 ring-white shadow-sm" />
                  )}
                  <div className="text-left">
                    <div className="text-sm font-bold text-stone-900">{quote.createdBy.name}</div>
                    <div className="text-xs text-stone-500">
                      {quote.createdBy.jobTitle || 'Travel Designer'}
                      {brand.companyName && ` · ${brand.companyName}`}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {(brand.coverQuote || true) && (() => {
            const q = brand.coverQuote || "One's destination is never a place, but a new way of seeing things.";
            const author = brand.coverQuote ? (brand.coverQuoteAuthor || '') : 'Henry Miller';
            return (
              <div className="mt-12 text-center">
                <p className="text-base sm:text-lg text-stone-400 italic leading-relaxed" style={{ fontFamily: style.heading }}>
                  "{q}"
                </p>
                {author && (
                  <p className="text-[10px] tracking-[0.25em] uppercase text-stone-300 mt-3">— {author}</p>
                )}
              </div>
            );
          })()}

          <div className="mt-12 pt-6 border-t border-stone-200 flex items-center justify-between">
            <p className="text-xs text-stone-400">
              Quote #{quote.quoteNumber} · Version {quote.version || 1}
            </p>
            <p className="text-xs text-stone-400">
              Powered by Safari CRM
            </p>
          </div>
        </div>
      </footer>

      {lightbox && (
        <div
          onClick={closeLightbox}
          className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4 sm:p-10"
        >
          <button
            onClick={(e) => { e.stopPropagation(); closeLightbox(); }}
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center text-xl"
            aria-label="Close"
          >
            ✕
          </button>
          {lightbox.images.length > 1 && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); prevLightbox(); }}
                className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center text-2xl"
                aria-label="Previous"
              >
                ‹
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); nextLightbox(); }}
                className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center text-2xl"
                aria-label="Next"
              >
                ›
              </button>
            </>
          )}
          <div onClick={(e) => e.stopPropagation()} className="max-w-5xl max-h-full flex flex-col items-center">
            <img
              src={lightbox.images[lightbox.index]?.url}
              alt=""
              className="max-w-full max-h-[80vh] object-contain rounded-lg"
            />
            {lightbox.images[lightbox.index]?.caption && (
              <p className="mt-4 text-sm text-white/80 text-center max-w-2xl">{lightbox.images[lightbox.index].caption}</p>
            )}
            {lightbox.images[lightbox.index]?.credit && (
              <p className="mt-1 text-[11px] text-white/50 italic text-center">
                {lightbox.images[lightbox.index].creditUrl ? (
                  <a href={lightbox.images[lightbox.index].creditUrl} target="_blank" rel="noopener noreferrer" className="hover:text-white/80 underline">{lightbox.images[lightbox.index].credit}</a>
                ) : lightbox.images[lightbox.index].credit}
              </p>
            )}
            <p className="mt-2 text-xs text-white/50">{lightbox.index + 1} / {lightbox.images.length}</p>
          </div>
        </div>
      )}
    </div>
  );
}

// Kenya destination coordinates
const DEST_COORDS = {
  'nairobi': [-1.29, 36.82], 'maasai mara': [-1.5, 35.0], 'masai mara': [-1.5, 35.0],
  'amboseli': [-2.65, 37.25], 'tsavo east': [-2.9, 38.7], 'tsavo west': [-3.0, 38.2],
  'diani': [-4.32, 39.58], 'diani beach': [-4.32, 39.58], 'mombasa': [-4.04, 39.67],
  'naivasha': [-0.72, 36.36], 'lake naivasha': [-0.72, 36.36], 'nakuru': [-0.37, 36.08],
  'lake nakuru': [-0.37, 36.08], 'samburu': [0.6, 37.5], 'nanyuki': [0.0, 37.07],
  'mount kenya': [-0.15, 37.3], 'lamu': [-2.27, 40.9], 'malindi': [-3.22, 40.12],
  'watamu': [-3.35, 40.02],
};

function getCoords(name) {
  if (!name) return null;
  const key = name.toLowerCase().trim();
  for (const [k, v] of Object.entries(DEST_COORDS)) {
    if (key.includes(k) || k.includes(key)) return v;
  }
  return null;
}

function RouteMap({ days, startPoint, endPoint, primaryColor, headingStyle = {} }) {
  const mapRef = useRef(null);
  const [mapReady, setMapReady] = useState(false);

  // Build route points — dedupe consecutive same-location days
  const points = [];
  const startCoords = getCoords(startPoint);
  if (startCoords) points.push({ name: startPoint, coords: startCoords, type: 'start' });

  // Group days by location
  const locations = [];
  let lastLoc = null;
  for (const d of days) {
    if (d.location && d.location !== lastLoc) {
      locations.push({ name: d.location, nights: 1, hotel: d.hotel?.name });
      lastLoc = d.location;
    } else if (d.location === lastLoc) {
      locations[locations.length - 1].nights++;
    }
  }

  for (const loc of locations) {
    const coords = getCoords(loc.name);
    if (coords) points.push({ name: loc.name, coords, nights: loc.nights, hotel: loc.hotel });
  }

  const endCoords = getCoords(endPoint);
  if (endCoords && endPoint !== locations[locations.length - 1]?.name) {
    points.push({ name: endPoint, coords: endCoords, type: 'end' });
  }

  if (points.length < 2) return null;

  useEffect(() => {
    // Load Leaflet from CDN
    if (window.L) { setMapReady(true); return; }

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(link);

    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.onload = () => setMapReady(true);
    document.head.appendChild(script);

    return () => { document.head.removeChild(link); document.head.removeChild(script); };
  }, []);

  useEffect(() => {
    if (!mapReady || !mapRef.current || !window.L) return;

    // Clean up previous
    if (mapRef.current._leafletMap) {
      mapRef.current._leafletMap.remove();
    }

    const L = window.L;
    const map = L.map(mapRef.current, { scrollWheelZoom: false, zoomControl: false });
    mapRef.current._leafletMap = map;

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap &copy; CARTO',
      maxZoom: 19,
    }).addTo(map);

    // Add markers
    const markers = [];
    points.forEach((pt, i) => {
      const isStart = i === 0;
      const isEnd = i === points.length - 1;
      const icon = L.divIcon({
        className: 'custom-marker',
        html: `<div style="
          width:${isStart || isEnd ? 28 : 24}px;
          height:${isStart || isEnd ? 28 : 24}px;
          border-radius:50%;
          background:${isStart ? '#22c55e' : isEnd ? '#ef4444' : primaryColor};
          color:white;
          display:flex;
          align-items:center;
          justify-content:center;
          font-size:${isStart || isEnd ? 10 : 9}px;
          font-weight:700;
          font-family:system-ui;
          border:2px solid white;
          box-shadow:0 2px 6px rgba(0,0,0,0.3);
        ">${isStart ? 'S' : isEnd ? 'E' : i}</div>`,
        iconSize: [isStart || isEnd ? 28 : 24, isStart || isEnd ? 28 : 24],
        iconAnchor: [(isStart || isEnd ? 28 : 24) / 2, (isStart || isEnd ? 28 : 24) / 2],
      });

      const marker = L.marker(pt.coords, { icon }).addTo(map);
      const popup = `<div style="font-family:system-ui;font-size:12px;">
        <strong>${pt.name}</strong>
        ${pt.nights ? `<br><span style="color:#666;">${pt.nights} night${pt.nights !== 1 ? 's' : ''}</span>` : ''}
        ${pt.hotel ? `<br><span style="color:#888;font-size:11px;">${pt.hotel}</span>` : ''}
      </div>`;
      marker.bindPopup(popup);
      markers.push(marker);
    });

    // Draw route line
    const routeCoords = points.map(p => p.coords);
    L.polyline(routeCoords, {
      color: primaryColor,
      weight: 2.5,
      opacity: 0.7,
      dashArray: '8, 6',
    }).addTo(map);

    // Fit bounds
    const group = L.featureGroup(markers);
    map.fitBounds(group.getBounds().pad(0.15));

  }, [mapReady, points.length]);

  return (
    <section className="max-w-5xl mx-auto px-6 pb-16">
      <h2 className="text-2xl font-bold text-stone-900 mb-6" style={headingStyle}>
        Your Route
      </h2>
      <div className="rounded-2xl overflow-hidden border border-stone-200 bg-white">
        <div ref={mapRef} style={{ height: 400, width: '100%' }} />
        <div className="p-4 border-t border-stone-100">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-4 rounded-full bg-green-500 border-2 border-white shadow-sm" />
              <span className="text-xs text-stone-500">Start: {startPoint}</span>
            </div>
            {points.filter(p => !p.type).map((pt, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full border-2 border-white shadow-sm" style={{ backgroundColor: primaryColor }} />
                <span className="text-xs text-stone-500">{pt.name}</span>
              </div>
            ))}
            {points[points.length - 1]?.type === 'end' && (
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-4 rounded-full bg-red-500 border-2 border-white shadow-sm" />
                <span className="text-xs text-stone-500">End: {endPoint}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function ClientResponseSection({ token, quoteStatus, primaryColor, headingStyle = {} }) {
  const [mode, setMode] = useState(null); // null | 'accept' | 'changes'
  const [message, setMessage] = useState('');
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const apiBase = import.meta.env.VITE_API_URL || '/api';

  const handleAccept = async () => {
    setSubmitting(true);
    try {
      await fetch(`${apiBase}/quotes/share/${token}/accept`, { method: 'POST' });
      setSubmitted(true);
      setMode('accepted');
    } catch {
      alert('Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRequestChanges = async (e) => {
    e.preventDefault();
    if (!message.trim()) return;
    setSubmitting(true);
    try {
      await fetch(`${apiBase}/quotes/share/${token}/request-changes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, clientName, clientEmail }),
      });
      setSubmitted(true);
      setMode('changes_sent');
    } catch {
      alert('Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <section className="max-w-5xl mx-auto px-6 pb-16">
        <div className={`rounded-2xl p-8 text-center border ${
          mode === 'accepted' ? 'bg-green-50 border-green-200' : 'bg-blue-50 border-blue-200'
        }`}>
          <div className={`w-14 h-14 rounded-full text-white flex items-center justify-center mx-auto mb-4 ${
            mode === 'accepted' ? 'bg-green-500' : 'bg-blue-500'
          }`}>
            {mode === 'accepted' ? <CheckCircle className="w-7 h-7" /> : <Mail className="w-7 h-7" />}
          </div>
          <h3 className="text-xl font-bold mb-2" style={{ fontFamily: 'Playfair Display, serif', color: mode === 'accepted' ? '#166534' : '#1e3a5f' }}>
            {mode === 'accepted' ? 'Quote Accepted!' : 'Request Sent'}
          </h3>
          <p className="text-sm" style={{ color: mode === 'accepted' ? '#15803d' : '#2563eb' }}>
            {mode === 'accepted'
              ? 'Thank you! The team will be in touch shortly to finalize your booking.'
              : 'Your feedback has been sent. The team will update the quote and get back to you.'}
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="max-w-5xl mx-auto px-6 pb-16">
      <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
        <div className="p-8 text-center" style={{ background: `linear-gradient(135deg, ${primaryColor}06, ${primaryColor}12)` }}>
          <h2 className="text-xl font-bold text-stone-900 mb-2" style={headingStyle}>
            Ready to proceed?
          </h2>
          <p className="text-sm text-stone-500 mb-6">Choose an option below to move forward with this proposal</p>

          {!mode && (
            <div className="flex flex-col sm:flex-row gap-3 justify-center max-w-md mx-auto">
              <button
                onClick={() => setMode('accept')}
                className="flex-1 py-3 px-6 rounded-xl text-white text-sm font-semibold transition-all hover:opacity-90 hover:scale-[1.02]"
                style={{ backgroundColor: primaryColor }}
              >
                Accept Quote
              </button>
              <button
                onClick={() => setMode('changes')}
                className="flex-1 py-3 px-6 rounded-xl border-2 border-stone-300 text-stone-700 text-sm font-semibold hover:border-stone-400 hover:bg-stone-50 transition-all"
              >
                Request Changes
              </button>
            </div>
          )}

          {mode === 'accept' && (
            <div className="max-w-sm mx-auto animate-scale-in">
              <div className="bg-white rounded-xl p-6 border border-stone-200 text-left">
                <p className="text-sm text-stone-600 mb-4">
                  By accepting, you confirm your interest in this proposal. The team will contact you to arrange payment and finalize details.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={handleAccept}
                    disabled={submitting}
                    className="flex-1 py-2.5 rounded-lg text-white text-sm font-semibold disabled:opacity-50 transition-colors"
                    style={{ backgroundColor: primaryColor }}
                  >
                    {submitting ? 'Confirming...' : 'Confirm Acceptance'}
                  </button>
                  <button
                    onClick={() => setMode(null)}
                    className="px-4 py-2.5 rounded-lg border border-stone-200 text-sm text-stone-500 hover:bg-stone-50"
                  >
                    Back
                  </button>
                </div>
              </div>
            </div>
          )}

          {mode === 'changes' && (
            <form onSubmit={handleRequestChanges} className="max-w-md mx-auto animate-scale-in">
              <div className="bg-white rounded-xl p-6 border border-stone-200 text-left space-y-3">
                <p className="text-sm text-stone-600 mb-2">Let the team know what you'd like to change:</p>
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="text"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    placeholder="Your name"
                    className="px-3 py-2 rounded-lg border border-stone-200 text-sm focus:outline-none focus:border-stone-400"
                  />
                  <input
                    type="email"
                    value={clientEmail}
                    onChange={(e) => setClientEmail(e.target.value)}
                    placeholder="Your email"
                    className="px-3 py-2 rounded-lg border border-stone-200 text-sm focus:outline-none focus:border-stone-400"
                  />
                </div>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={4}
                  placeholder="e.g. Can we add 2 more nights in Diani? Also interested in a balloon safari..."
                  className="w-full px-3 py-2 rounded-lg border border-stone-200 text-sm focus:outline-none focus:border-stone-400 resize-none"
                  required
                />
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={submitting || !message.trim()}
                    className="flex-1 py-2.5 rounded-lg text-white text-sm font-semibold disabled:opacity-50 transition-colors"
                    style={{ backgroundColor: primaryColor }}
                  >
                    {submitting ? 'Sending...' : 'Send Request'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode(null)}
                    className="px-4 py-2.5 rounded-lg border border-stone-200 text-sm text-stone-500 hover:bg-stone-50"
                  >
                    Back
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}