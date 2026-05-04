import { useState, useEffect, useRef } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { formatCurrency, cldThumb, formatDuration } from '../utils/helpers';
import toast from 'react-hot-toast';
import QuoteRenderer from '../components/quote/QuoteRenderer';
import {
  ArrowLeft, Plus, GripVertical, Trash2, MapPin, Hotel, Ticket, FileText,
  Truck, DollarSign, Save, Send, Eye, ChevronDown, ChevronUp,
  Sparkles, X, Calendar, Users as UsersIcon, Copy, Image as ImageIcon,
  Coffee, Sun, Sunset, Star, EyeOff, CheckCircle, Clock, AlertTriangle,
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
    travelers: { adults: 2, children: 0, childAges: [] },
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

  // Load partner data
  useEffect(() => {
    Promise.all([
      api.get('/partners/hotels'),
      api.get('/partners/activities'),
      api.get('/partners/transport'),
      api.get('/partners/packages'),
      api.get('/crm/contacts'),
      api.get('/destinations'),
      api.get('/crm/deals'),
    ]).then(([h, a, t, p, c, d, dl]) => {
      setHotels(h.data.hotels);
      setActivities(a.data.activities);
      setTransport(t.data.transport);
      setPackages(p.data.packages || []);
      setContacts(c.data.contacts);
      setDestinations(d.data.destinations);
      setDeals(dl.data.deals || []);
    });
  }, []);

  // Apply a package: populates quote.days from the (server-hydrated) segments
  // and adds a single line item for the package's priced total. Each day's
  // hotel snapshot now carries the linked Hotel doc's display fields
  // (description, images, amenities, etc.) so the share page renders properly.
  // Package-level metadata (tier, cancellation, deposit, booking terms) is
  // stashed on quote.packageSnapshot for the policy blocks to render.
  const applyPackage = async (pkg) => {
    if (quote.days?.length > 0 && !confirm('This will replace your current itinerary. Continue?')) return;
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
          lineItems: [
            ...(quote.pricing.lineItems || []),
            {
              description: `${data.package?.name || pkg.name} — ${data.tier.minPax}-${data.tier.maxPax} pax package (${quote.travelers.adults} adult${quote.travelers.adults === 1 ? '' : 's'}${data.childAges.length ? ', ' + data.childAges.length + ' child' + (data.childAges.length === 1 ? '' : 'ren') : ''})`,
              quantity: 1,
              unitPrice: Math.round(data.subtotalInQuoteCurrency),
              total: Math.round(data.subtotalInQuoteCurrency),
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
        setQuote({
          ...data,
          contact: contactId,
          deal: dealId,
          days: data.days || [],
          startDate: data.startDate?.split('T')[0] || '',
          endDate: data.endDate?.split('T')[0] || '',
        });
        // Legacy quotes saved with only a contact (no deal) → start in
        // contact-only mode so the operator sees what's actually linked.
        if (!dealId && contactId) setLinkMode('contact');
      }).catch(() => {
        toast.error('Quote not found');
        navigate('/quotes');
      });
    }
  }, [id]);

  // New quote arriving from a deal page (`/quotes/new?deal=<id>`) — pre-fill
  // the deal link, derived contact, travel dates, and party size from the
  // deal so the operator doesn't re-key context they already entered. Runs
  // only once `deals` has loaded so we can find the source object.
  useEffect(() => {
    if (id) return;                          // editing an existing quote — skip
    const dealParam = searchParams.get('deal');
    if (!dealParam) return;
    if (!deals.length) return;               // wait for fetch
    if (quote.deal) return;                  // already populated (e.g. user edited)

    const source = deals.find(d => d._id === dealParam);
    if (!source) return;

    const contactId = source.contact?._id || source.contact || '';
    const startDate = source.travelDates?.start ? new Date(source.travelDates.start).toISOString().slice(0, 10) : '';
    const endDate = source.travelDates?.end ? new Date(source.travelDates.end).toISOString().slice(0, 10) : '';

    setQuote(q => ({
      ...q,
      deal: source._id,
      contact: contactId,
      // Only override empties — operator may have already typed something.
      startDate: q.startDate || startDate,
      endDate: q.endDate || endDate,
      travelers: {
        ...q.travelers,
        adults: source.groupSize > 0 ? source.groupSize : q.travelers.adults,
      },
      pricing: {
        ...q.pricing,
        currency: source.currency || source.budgetCurrency || q.pricing.currency,
      },
    }));
    setLinkMode('deal');
  }, [id, deals, searchParams]);

  // Recalculate pricing when days change — honors per-day margin overrides
  useEffect(() => {
    const globalMargin = quote.pricing.marginPercent;
    let subtotal = 0;
    let totalPrice = 0;
    (quote.days || []).forEach(day => {
      const cost = day.dayCost || 0;
      const margin = day.marginOverride != null ? day.marginOverride : globalMargin;
      subtotal += cost;
      totalPrice += cost * (1 + margin / 100);
    });
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
  }, [quote.days, quote.pricing.marginPercent, quote.travelers]);

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

  const updateDay = (index, updates) => {
    const days = [...quote.days];
    days[index] = { ...days[index], ...updates };

    // Auto-calc day cost. Prefer the quote-currency value (converted via FX
    // at pick time) over the raw source-currency value, so a USD quote with
    // KES activities doesn't silently mix currencies in the total.
    const day = days[index];
    const hotelCost = day.hotel?.ratePerNightInQuoteCurrency || day.hotel?.ratePerNight || 0;
    const actCost = day.activities?.reduce((s, a) => s + (a.totalCostInQuoteCurrency ?? a.totalCost ?? 0), 0) || 0;
    const transCost = day.transport?.totalCostInQuoteCurrency ?? day.transport?.totalCost ?? 0;
    days[index].dayCost = hotelCost + actCost + transCost;

    setQuote({ ...quote, days });
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
  };

  // Pure price + snapshot construction — no state mutation. Returns
  // { snapshot, roomType, error, warnings } so callers can either commit it
  // via updateDay (single hotel pick) or fold it into a multi-field state
  // update (extend-stay, where we also insert a new day in the same beat).
  const priceHotelForCheckIn = async (hotel, checkIn, opts = {}) => {
    const checkOut = new Date(checkIn);
    checkOut.setDate(checkOut.getDate() + 1);

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

  // Pick a hotel for a day and let the server's rate resolver compute the
  // nightly cost against the quote's clientType + party + currency. Falls
  // back to a thin snapshot if pricing can't be resolved.
  const selectHotelForDay = async (dayIndex, hotel, opts = {}) => {
    const checkIn = quote.startDate ? new Date(quote.startDate) : new Date();
    checkIn.setDate(checkIn.getDate() + dayIndex);
    const result = await priceHotelForCheckIn(hotel, checkIn, opts);
    if (result.error) toast.error(humanizeRateError(result.error), { duration: 6000 });
    if (result.warnings.length) result.warnings.slice(0, 2).forEach(w => toast(w, { icon: '⚠️', duration: 6000 }));
    updateDay(dayIndex, { hotel: result.snapshot, roomType: result.roomType });
  };

  // Extend an existing hotel-night by inserting another day after it and
  // re-pricing the same partner hotel for the new date. Restores the
  // multi-night convenience without inheriting a stale per-night rate
  // (different season / stay-tier may apply to the new night). Composes the
  // insert + the priced snapshot into a single setQuote call to dodge the
  // closure-staleness race that would lose the insert if updateDay ran on
  // top of an outdated quote.days.
  const extendStayFromDay = async (dayIndex) => {
    const sourceDay = quote.days[dayIndex];
    if (!sourceDay?.hotel?.hotelId) return;
    const sourceHotel = hotels.find(h => h._id === sourceDay.hotel.hotelId);
    if (!sourceHotel) {
      toast.error('Original hotel is no longer in your partners list — pick manually.');
      return;
    }

    const newDayIndex = dayIndex + 1;
    const checkIn = quote.startDate ? new Date(quote.startDate) : new Date();
    checkIn.setDate(checkIn.getDate() + newDayIndex);

    const result = await priceHotelForCheckIn(sourceHotel, checkIn, {
      preferredRoomType: sourceDay.hotel.roomType,
      preferredMealPlan: sourceDay.hotel.mealPlan,
    });
    if (result.error) toast.error(`Could not re-price for new night — ${humanizeRateError(result.error)}`, { duration: 6000 });
    result.warnings.slice(0, 2).forEach(w => toast(w, { icon: '⚠️', duration: 6000 }));

    const days = [...quote.days];
    const newDay = {
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
      hotel: result.snapshot,
      roomType: result.roomType,
      activities: [],
      transport: null,
      images: [],
      dayCost: result.snapshot.ratePerNightInQuoteCurrency || result.snapshot.ratePerNight || 0,
    };
    days.splice(newDayIndex, 0, newDay);
    days.forEach((d, i) => d.dayNumber = i + 1);
    setQuote({ ...quote, days });
    setExpandedDay(newDayIndex);
    if (!result.error) toast.success('Added another night at the same hotel');
  };

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
      };
      updateDay(dayIndex, { activities: [...(day.activities || []), newAct] });
      if (data.warnings?.length) {
        data.warnings.slice(0, 2).forEach(w => toast(w, { icon: '⚠️' }));
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Activity pricing failed');
      // Fall back to a zero-cost snapshot rather than silently miscalculating.
      const newAct = { ...baseSnapshot, totalCost: 0, totalCostInQuoteCurrency: 0 };
      updateDay(dayIndex, { activities: [...(day.activities || []), newAct] });
    }
  };

  const removeActivityFromDay = (dayIndex, actIdx) => {
    const day = quote.days[dayIndex];
    updateDay(dayIndex, { activities: day.activities.filter((_, i) => i !== actIdx) });
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
    const day = quote.days[dayIndex];
    if (!day.transport) return;
    updateDay(dayIndex, { transport: { ...day.transport, [field]: value } });
  };

  // Image helpers — flexible gallery for each day
  const addImageToDay = (dayIndex, image) => {
    const day = quote.days[dayIndex];
    updateDay(dayIndex, { images: [...(day.images || []), image] });
  };

  const removeImageFromDay = (dayIndex, imgIdx) => {
    const day = quote.days[dayIndex];
    updateDay(dayIndex, { images: day.images.filter((_, i) => i !== imgIdx) });
  };

  const setHeroImageForDay = (dayIndex, imgIdx) => {
    const day = quote.days[dayIndex];
    const images = [...day.images];
    const [hero] = images.splice(imgIdx, 1);
    updateDay(dayIndex, { images: [hero, ...images] });
  };

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
    } catch (err) {
      toast.error(err.response?.data?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  // Get relevant hotels for a destination
  const getHotelsForDestination = (dest) => {
    if (!dest) return [];
    return hotels.filter(h => h.destination.toLowerCase().includes(dest.toLowerCase()));
  };

  // Get relevant activities for a destination
  const getActivitiesForDestination = (dest) => {
    if (!dest) return [];
    return activities.filter(a => a.destination.toLowerCase().includes(dest.toLowerCase()));
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <button onClick={() => navigate('/quotes')} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors self-start sm:self-auto">
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
                className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-card border border-border text-sm font-medium text-muted-foreground hover:border-border transition-colors"
                title="Copy share link"
              >
                <Eye className="w-4 h-4" /> Share Link
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
                className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-card border border-border text-sm font-medium text-muted-foreground hover:border-border transition-colors"
              >
                <FileText className="w-4 h-4" /> PDF
              </button>
              <button
                onClick={async () => {
                  const name = prompt('Template name:', quote.title);
                  if (!name?.trim()) return;
                  const description = prompt('Description (optional):', '') || '';
                  try {
                    await api.post(`/quotes/${id}/save-as-template`, { templateName: name, templateDescription: description });
                    toast.success('Saved as template');
                  } catch (err) { toast.error('Failed to save template'); }
                }}
                className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-card border border-border text-sm font-medium text-muted-foreground hover:border-border transition-colors"
                title="Save as reusable template"
              >
                <Star className="w-4 h-4" /> Save as Template
              </button>
              <button
                onClick={async () => {
                  if (!confirm('Create a new version of this quote? The current version will be preserved.')) return;
                  try {
                    const { data } = await api.post(`/quotes/${id}/version`);
                    toast.success(`Version ${data.version} created`);
                    navigate(`/quotes/${data._id}`);
                  } catch { toast.error('Version creation failed'); }
                }}
                className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-card border border-border text-sm font-medium text-muted-foreground hover:border-border transition-colors"
                title="Create new version"
              >
                <Copy className="w-4 h-4" /> New Version
              </button>
            </>
          )}
          <button
            onClick={() => setShowPreview(!showPreview)}
            className={`inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${showPreview ? 'bg-primary text-white border-primary hover:bg-primary' : 'bg-card border-border text-muted-foreground hover:border-border'}`}
            title="Toggle live preview"
          >
            <Eye className="w-4 h-4" /> {showPreview ? 'Hide Preview' : 'Preview'}
          </button>
          <button onClick={() => handleSave('draft')} disabled={saving} className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-card border border-border text-sm font-medium text-foreground hover:border-border transition-colors disabled:opacity-50">
            <Save className="w-4 h-4" /> Save Draft
          </button>
          <button onClick={() => handleSave('sent')} disabled={saving} className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary transition-colors disabled:opacity-50">
            <Send className="w-4 h-4" /> Save & Send
          </button>
        </div>
      </div>

      <div className={showPreview ? 'grid grid-cols-1 lg:grid-cols-2 gap-4' : 'grid grid-cols-1 xl:grid-cols-4 gap-6'}>
        {showPreview && (
          <div className="lg:order-2 lg:sticky lg:top-4 max-h-[60vh] lg:max-h-[calc(100vh-2rem)] overflow-y-auto rounded-xl border border-border bg-card">
            <div className="sticky top-0 z-10 bg-primary/10 border-b border-amber-100 px-3 py-1.5 text-[10px] font-semibold text-primary uppercase tracking-wide flex items-center gap-1.5">
              <Eye className="w-3 h-3" /> Live Preview
            </div>
            <div className="origin-top scale-[0.75] -mt-12">
              <QuoteRenderer quote={quote} previewMode={true} />
            </div>
          </div>
        )}
        <div className={showPreview ? 'lg:order-1 space-y-4' : 'xl:col-span-3 space-y-4'}>
          {/* Trip Info */}
          <div className="bg-card rounded-xl border border-border p-4 sm:p-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Trip Title</label>
                <input
                  type="text"
                  value={quote.title}
                  onChange={(e) => setQuote({ ...quote, title: e.target.value })}
                  placeholder="e.g. 13-Day Kenya Safari & Beach Holiday"
                  className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm text-foreground focus:outline-none focus:border-primary transition-colors"
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
                        // Auto-derive contact from the picked deal — Deal.contact
                        // is canonical, and downstream code (share page, voucher
                        // generator, invoice builder) reads quote.contact.
                        const picked = deals.find(d => d._id === dealId);
                        const contactId = picked?.contact?._id || picked?.contact || '';
                        setQuote({ ...quote, deal: dealId || '', contact: contactId });
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
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Start Date</label>
                <input
                  type="date"
                  value={quote.startDate}
                  onChange={(e) => setQuote({ ...quote, startDate: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm text-foreground focus:outline-none focus:border-primary transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Travelers</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    min={1}
                    value={quote.travelers.adults}
                    onChange={(e) => setQuote({ ...quote, travelers: { ...quote.travelers, adults: parseInt(e.target.value) || 1 } })}
                    className="w-20 px-3 py-2 rounded-lg bg-background border border-border text-sm text-foreground focus:outline-none focus:border-primary transition-colors"
                    placeholder="Adults"
                  />
                  <input
                    type="number"
                    min={0}
                    value={quote.travelers.children}
                    onChange={(e) => setQuote({ ...quote, travelers: { ...quote.travelers, children: parseInt(e.target.value) || 0 } })}
                    className="w-20 px-3 py-2 rounded-lg bg-background border border-border text-sm text-foreground focus:outline-none focus:border-primary transition-colors"
                    placeholder="Kids"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Cover Narrative + Tour Type */}
          <div className="bg-card rounded-xl border border-border p-4 sm:p-5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">End Date</label>
                <input
                  type="date"
                  value={quote.endDate || ''}
                  onChange={(e) => setQuote({ ...quote, endDate: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm text-foreground focus:outline-none focus:border-primary transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Currency</label>
                <select
                  value={quote.pricing.currency}
                  onChange={(e) => setQuote({ ...quote, pricing: { ...quote.pricing, currency: e.target.value } })}
                  className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm text-foreground focus:outline-none focus:border-primary transition-colors"
                >
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="GBP">GBP (£)</option>
                  <option value="KES">KES (KSh)</option>
                  <option value="TZS">TZS</option>
                  <option value="UGX">UGX</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
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

          {/* Timeline / Segments */}
          <div className="space-y-3">
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
                onSelectHotel={(hotel) => selectHotelForDay(idx, hotel)}
                onExtendStay={() => extendStayFromDay(idx)}
                onAddActivity={(activity) => addActivityToDay(idx, activity)}
                onRemoveActivity={(actIdx) => removeActivityFromDay(idx, actIdx)}
                onSelectTransport={(t, opts) => setTransportForDay(idx, t, opts)}
                onClearTransport={() => clearTransportForDay(idx)}
                onUpdateTransportField={(field, value) => updateDayTransportField(idx, field, value)}
                onAddImage={(image) => addImageToDay(idx, image)}
                onRemoveImage={(imgIdx) => removeImageFromDay(idx, imgIdx)}
                onSetHero={(imgIdx) => setHeroImageForDay(idx, imgIdx)}
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
                  title="Apply a pre-built package (fills days + adds line item)"
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

            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal (cost)</span>
                <span className="text-foreground font-medium">{formatCurrency(quote.pricing.subtotal, quote.pricing.currency)}</span>
              </div>

              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">Margin</span>
                  <span className="text-foreground font-medium">{quote.pricing.marginPercent}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={50}
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
                  <span>50%</span>
                </div>
              </div>

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
          <AIPanel quote={quote} setQuote={setQuote} destinations={destinations} />

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
    </div>
  );
}

// ─── AI PANEL ───────────────────────────────────

function AIPanel({ quote, setQuote, destinations }) {
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
  const [suggestingRoute, setSuggestingRoute] = useState(false);
  const [routeResult, setRouteResult] = useState(null);

  // Calculate trip length from dates or segments
  const calcTripLength = () => {
    if (quote.startDate && quote.endDate) {
      const diff = Math.ceil((new Date(quote.endDate) - new Date(quote.startDate)) / (1000 * 60 * 60 * 24));
      if (diff > 0) return diff;
    }
    return quote.days?.length || 7;
  };

  const [tripLength, setTripLength] = useState(calcTripLength());
  const [interests, setInterests] = useState('safari, beach');

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

  const suggestRoute = async () => {
    setSuggestingRoute(true);
    try {
      const destNames = (destinations || []).map(d => d.name);
      const { data } = await api.post('/ai/suggest-route', {
        landingCity: quote.startPoint || 'Nairobi',
        tripLength: parseInt(tripLength) || 7,
        interests: interests.split(',').map(i => i.trim()),
        budget: quote.pricing.currency === 'KES' ? 'mid-range' : 'luxury',
        destinations: destNames.length > 0 ? destNames : undefined,
        travelers: `${quote.travelers.adults} adults${quote.travelers.children > 0 ? `, ${quote.travelers.children} children` : ''}`,
        tourType: quote.tourType,
      });
      setRouteResult(data);
    } catch (err) {
      if (import.meta.env.DEV) {
        console.error('Route suggest error:', err?.response?.status, err?.response?.data, err?.message);
      }
      toast.error(err.response?.data?.message || err.message || 'Route suggestion failed');
    } finally {
      setSuggestingRoute(false);
    }
  };

  const applyRoute = () => {
    if (!routeResult?.route) return;
    // Convert route stops into days (one day per night at each location)
    const newDays = [];
    let dayNum = 1;
    routeResult.route.forEach((r) => {
      for (let i = 0; i < (r.nights || 1); i++) {
        newDays.push({
          dayNumber: dayNum++,
          title: i === 0 ? `Arrive ${r.destination}` : r.destination,
          location: r.destination,
          isTransitDay: false,
          narrative: '',
          meals: { breakfast: i > 0, lunch: false, dinner: i === 0, notes: '' },
          hotel: null,
          roomType: '',
          activities: [],
          transport: null,
          images: [],
          dayCost: 0,
        });
      }
    });
    setQuote({ ...quote, days: newDays });
    setRouteResult(null);
    toast.success('Route applied! Now select hotels and activities.');
  };

  // ─── Draft from prompt ───
  const [showPromptDraft, setShowPromptDraft] = useState(false);
  const [draftPrompt, setDraftPrompt] = useState('');
  const [draftBudget, setDraftBudget] = useState('mid-range');
  const [drafting, setDrafting] = useState(false);

  const draftFromPrompt = async () => {
    if (!draftPrompt.trim()) { toast.error('Describe the trip first'); return; }
    if (quote.days?.length > 0 && !confirm('This will replace your current itinerary. Continue?')) return;

    setDrafting(true);
    try {
      const { data } = await api.post('/ai/draft-itinerary', {
        prompt: draftPrompt,
        tripLength: parseInt(tripLength) || undefined,
        travelers: quote.travelers.adults + quote.travelers.children,
        budget: draftBudget,
        startDate: quote.startDate || undefined,
        adults: quote.travelers.adults,
        childAges: quote.travelers.childAges || [],
        clientType: quote.clientType,
        nationality: quote.nationality,
        quoteCurrency: quote.pricing.currency,
      });

      setQuote({
        ...quote,
        title: data.title || quote.title,
        coverNarrative: data.coverNarrative || quote.coverNarrative,
        highlights: data.highlights?.length ? data.highlights : quote.highlights,
        days: data.days || [],
      });

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
              <div className="grid grid-cols-2 gap-1.5">
                <div>
                  <label className="block text-[9px] text-muted-foreground mb-0.5">Days</label>
                  <input type="number" min={3} max={21} value={tripLength} onChange={(e) => setTripLength(e.target.value)}
                    className="w-full px-2 py-1 rounded-md bg-card border border-purple-200 text-xs focus:outline-none focus:border-purple-400" />
                </div>
                <div>
                  <label className="block text-[9px] text-muted-foreground mb-0.5">Budget</label>
                  <select value={draftBudget} onChange={(e) => setDraftBudget(e.target.value)}
                    className="w-full px-2 py-1 rounded-md bg-card border border-purple-200 text-xs focus:outline-none focus:border-purple-400">
                    <option value="budget">Budget</option>
                    <option value="mid-range">Mid-range</option>
                    <option value="luxury">Luxury</option>
                  </select>
                </div>
              </div>
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

        {/* Route suggestion */}
        <div className="pt-2 border-t border-border">
          <p className="text-xs font-medium text-muted-foreground mb-2">Suggest Route</p>
          <p className="text-[10px] text-muted-foreground/70 mb-2">
            From {quote.startPoint || 'Nairobi'} · {quote.travelers.adults + quote.travelers.children} travelers · {quote.tourType}
          </p>
          <div className="grid grid-cols-2 gap-2 mb-2">
            <div>
              <label className="block text-[10px] text-muted-foreground/70 mb-0.5">Days</label>
              <input
                type="number"
                min={3}
                max={21}
                value={tripLength}
                onChange={(e) => setTripLength(e.target.value)}
                className="w-full px-2 py-1.5 rounded-md bg-background border border-border text-xs focus:outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-[10px] text-muted-foreground/70 mb-0.5">Interests</label>
              <input
                type="text"
                value={interests}
                onChange={(e) => setInterests(e.target.value)}
                className="w-full px-2 py-1.5 rounded-md bg-background border border-border text-xs focus:outline-none focus:border-primary"
                placeholder="safari, beach"
              />
            </div>
          </div>
          <button
            onClick={suggestRoute}
            disabled={suggestingRoute}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs text-muted-foreground font-medium hover:border-primary/50 hover:text-primary transition-colors disabled:opacity-50"
          >
            <MapPin className="w-3 h-3" />
            {suggestingRoute ? 'Thinking...' : 'Suggest Route'}
          </button>
        </div>

        {/* Route result */}
        {routeResult && (
          <div className="mt-2 p-3 rounded-lg bg-green-50 border border-green-200 animate-scale-in">
            <p className="text-xs text-green-800 font-medium mb-2">{routeResult.summary}</p>
            <div className="space-y-1 mb-2">
              {routeResult.route?.map((r, i) => (
                <div key={i} className="flex items-center justify-between text-xs">
                  <span className="text-green-700 font-medium">{r.destination}</span>
                  <span className="text-green-600">{r.nights} nights</span>
                </div>
              ))}
            </div>
            <button
              onClick={applyRoute}
              className="w-full px-3 py-1.5 rounded-md bg-green-600 text-white text-xs font-medium hover:bg-green-700 transition-colors"
            >
              Apply This Route
            </button>
          </div>
        )}
      </div>
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

function LineItemsEditor({ lineItems, onChange, segments, marginPercent, currency }) {
  const [editIdx, setEditIdx] = useState(null);
  const [collapsed, setCollapsed] = useState(lineItems.length > 0);

  // `segments` here is actually `quote.days` (one entry per night). Aggregate
  // them first so a 5-night Mara stay generates ONE line item with quantity 5
  // instead of five single-night items. Pass-through fees scale by nights too,
  // since the snapshot stores one night's worth (price-stay is called per day).
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
        });
      }
      // Pass-through fees — snapshot is per-night, scale by stay length.
      // No markup (pass-through), no roll-up across hotels (fees can differ).
      for (const fee of (seg.hotel?.passThroughFees || [])) {
        const perNight = fee.amountInQuoteCurrency || 0;
        if (perNight > 0 && fee.mandatory !== false && seg.nights > 0) {
          items.push({
            description: `${fee.name}${seg.destination ? ' — ' + seg.destination : ''}`,
            quantity: seg.nights,
            unitPrice: Math.round(perNight),
            total: Math.round(perNight * seg.nights),
          });
        }
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
          });
        }
      }
    }

    onChange(items);
    toast.success(`Generated ${items.length} line items`);
  };

  const addItem = () => {
    onChange([...lineItems, { description: '', quantity: 1, unitPrice: 0, total: 0 }]);
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

  return (
    <div className="border-t border-border pt-3 mt-1">
      <div className="flex items-center justify-between mb-2">
        <button
          type="button"
          onClick={() => setCollapsed(c => !c)}
          className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${collapsed ? '-rotate-90' : ''}`} />
          Line Items
          {lineItems.length > 0 && (
            <span className="text-[10px] text-muted-foreground/70 font-normal">
              · {lineItems.length} item{lineItems.length !== 1 ? 's' : ''} · {formatCurrency(itemsTotal, currency)}
            </span>
          )}
        </button>
        {!collapsed && (
          <button
            onClick={autoGenerate}
            className="text-[10px] text-primary hover:underline flex items-center gap-0.5"
          >
            <Sparkles className="w-3 h-3" /> Auto-generate
          </button>
        )}
      </div>

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
                      className="w-20 px-1.5 py-1 rounded border border-border text-[11px] bg-card focus:outline-none focus:border-primary"
                      placeholder="Price"
                    />
                    <span className="text-[10px] text-muted-foreground/70">=</span>
                    <span className="text-[11px] font-semibold text-foreground">{formatCurrency(item.total, currency)}</span>
                    <button onClick={() => setEditIdx(null)} className="ml-auto text-[10px] text-primary">Done</button>
                  </div>
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
        <div className="flex justify-between mt-2 pt-2 border-t border-border">
          <span className="text-xs text-muted-foreground">Line items total</span>
          <span className="text-xs font-bold text-foreground">
            {formatCurrency(itemsTotal, currency)}
          </span>
        </div>
      )}
    </div>
  );
}

// ─── Day Card Component ──────────────────────────

function DayCard({
  day, index, isExpanded, onToggle, onUpdate, onRemove, onMoveUp, onMoveDown,
  onDuplicate, onAddAfter, isFirst, isLast,
  hotels, activities, transport, destinations, currency, marginPercent,
  onSelectHotel, onExtendStay, onAddActivity, onRemoveActivity,
  onSelectTransport, onClearTransport, onUpdateTransportField,
  onAddImage, onRemoveImage, onSetHero,
}) {
  const [showHotelPicker, setShowHotelPicker] = useState(false);
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

  const matchedHotels = hotels.filter(h => !day.location || h.destination?.toLowerCase().includes(day.location.toLowerCase()));
  const matchedActivities = activities.filter(a => !day.location || a.destination?.toLowerCase().includes(day.location.toLowerCase()));
  // Transport: filter by matching destination if any are tagged on the
  // partner doc, otherwise show all (vehicles are often used trip-wide).
  const matchedTransport = (transport || []).filter(t => {
    if (!day.location) return true;
    const dests = t.destinations || [];
    if (!dests.length) return true;
    return dests.some(d => d.toLowerCase().includes(day.location.toLowerCase()) || day.location.toLowerCase().includes(d.toLowerCase()));
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
                Cost / Price
                {day.marginOverride != null && (
                  <span className="text-[8px] bg-primary/15 text-primary px-1 rounded font-semibold">{day.marginOverride}%</span>
                )}
              </div>
              <div className="text-xs">
                <span className="text-muted-foreground">{formatCurrency(day.dayCost, currency)}</span>
                <span className="text-muted-foreground/40 mx-1">→</span>
                <span className="text-foreground font-semibold">
                  {formatCurrency(Math.round(day.dayCost * (1 + ((day.marginOverride != null ? day.marginOverride : marginPercent) || 0) / 100)), currency)}
                </span>
              </div>
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
                      <p className="text-sm font-medium text-foreground truncate">{day.hotel.name}</p>
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
                      {day.hotel.mandatoryAddOnsPerNightTotal > 0 && (
                        <p className="text-[10px] text-muted-foreground/70 truncate" title={(day.hotel.mandatoryAddOnsPerNight || []).map(m => m.name).join(', ')}>
                          Includes mandatory: {formatCurrency((day.hotel.mandatoryAddOnsPerNightTotal || 0) * (day.hotel.fxRate || 1), currency)}/night
                          {day.hotel.mandatoryAddOnsPerNight?.length ? ` (${day.hotel.mandatoryAddOnsPerNight.map(m => m.name).join(', ')})` : ''}
                        </p>
                      )}
                    </div>
                    <button onClick={() => setShowHotelPicker(true)} className="text-[10px] text-primary hover:underline">Change</button>
                  </div>
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
                <div className="mt-2 p-3 rounded-lg bg-background border border-border max-h-64 overflow-y-auto space-y-1.5">
                  {matchedHotels.length === 0 ? (
                    <p className="text-xs text-muted-foreground/70 text-center py-2">No hotels for this location. Add some in Partners.</p>
                  ) : matchedHotels.map(h => {
                    // Preview: show every active rate list's label so operator
                    // can see audience/meal plan options before clicking.
                    const activeLists = (h.rateLists || []).filter(l => l.isActive !== false);
                    return (
                      <div key={h._id} className="bg-card rounded p-2 border border-border">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-medium text-foreground truncate">{h.name}</p>
                          <button
                            onClick={() => { onSelectHotel(h); setShowHotelPicker(false); }}
                            className="text-[10px] px-2 py-0.5 rounded bg-primary text-white hover:opacity-90 shrink-0"
                          >
                            Select
                          </button>
                        </div>
                        {activeLists.length > 0 ? (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {activeLists.map((l, li) => (
                              <span key={li} className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                                {l.name} · {(l.audience || []).join('/')} · {l.currency} · {l.mealPlan}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <p className="text-[10px] text-muted-foreground/70 mt-1">No rate lists configured</p>
                        )}
                      </div>
                    );
                  })}
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
