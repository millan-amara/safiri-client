import { useState, useEffect, useRef } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { formatCurrency, cldThumb } from '../utils/helpers';
import toast from 'react-hot-toast';
import QuoteRenderer from '../components/quote/QuoteRenderer';
import {
  ArrowLeft, Plus, GripVertical, Trash2, MapPin, Hotel, Ticket, FileText,
  Truck, DollarSign, Save, Send, Eye, ChevronDown, ChevronUp,
  Sparkles, X, Calendar, Users as UsersIcon, Copy, Image as ImageIcon,
  Coffee, Sun, Sunset, Star, EyeOff, CheckCircle,
} from 'lucide-react';

export default function QuoteBuilderPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { organization } = useAuth();

  const [quote, setQuote] = useState({
    title: '',
    tourType: 'private',
    contact: '',
    travelers: { adults: 2, children: 0, childAges: [] },
    startDate: '',
    endDate: '',
    startPoint: 'Nairobi',
    endPoint: 'Nairobi',
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
  const [contacts, setContacts] = useState([]);
  const [destinations, setDestinations] = useState([]);
  const [expandedDay, setExpandedDay] = useState(0);
  const [showPreview, setShowPreview] = useState(false);
  const [saving, setSaving] = useState(false);

  // Load partner data
  useEffect(() => {
    Promise.all([
      api.get('/partners/hotels'),
      api.get('/partners/activities'),
      api.get('/partners/transport'),
      api.get('/crm/contacts'),
      api.get('/destinations'),
    ]).then(([h, a, t, c, d]) => {
      setHotels(h.data.hotels);
      setActivities(a.data.activities);
      setTransport(t.data.transport);
      setContacts(c.data.contacts);
      setDestinations(d.data.destinations);
    });
  }, []);

  // Load existing quote
  useEffect(() => {
    if (id) {
      api.get(`/quotes/${id}`).then(({ data }) => {
        setQuote({
          ...data,
          days: data.days || [],
          startDate: data.startDate?.split('T')[0] || '',
          endDate: data.endDate?.split('T')[0] || '',
        });
      }).catch(() => {
        toast.error('Quote not found');
        navigate('/quotes');
      });
    }
  }, [id]);

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
    const newDay = {
      dayNumber: days.length + 1,
      title: '',
      location: lastDay?.location || '',
      isTransitDay: false,
      narrative: '',
      meals: { breakfast: false, lunch: false, dinner: false, notes: '' },
      hotel: lastDay?.hotel || null,
      roomType: lastDay?.roomType || '',
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

    // Auto-calc day cost
    const day = days[index];
    const hotelCost = day.hotel?.ratePerNight || 0;
    const actCost = day.activities?.reduce((s, a) => s + (a.totalCost || 0), 0) || 0;
    const transCost = day.transport?.totalCost || 0;
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

  const duplicateDay = (index) => {
    const days = [...quote.days];
    const copy = JSON.parse(JSON.stringify(days[index]));
    copy._id = undefined;
    days.splice(index + 1, 0, copy);
    days.forEach((d, i) => d.dayNumber = i + 1);
    setQuote({ ...quote, days });
    setExpandedDay(index + 1);
  };

  const selectHotelForDay = (dayIndex, hotel, rate) => {
    updateDay(dayIndex, {
      hotel: {
        hotelId: hotel._id,
        name: hotel.name,
        roomType: rate.roomType,
        ratePerNight: rate.ratePerNight,
        mealPlan: rate.mealPlan,
        images: hotel.images || [],
        description: hotel.description,
      },
      roomType: rate.roomType,
    });
  };

  const addActivityToDay = (dayIndex, activity) => {
    const day = quote.days[dayIndex];
    const totalPax = quote.travelers.adults + quote.travelers.children;
    const totalCost = activity.pricingModel === 'per_person'
      ? activity.costPerPerson * totalPax
      : activity.groupRate || activity.costPerPerson;

    const newAct = {
      activityId: activity._id,
      name: activity.name,
      costPerPerson: activity.costPerPerson,
      groupRate: activity.groupRate,
      totalCost,
      isOptional: false,
      description: activity.description,
    };
    updateDay(dayIndex, { activities: [...(day.activities || []), newAct] });
  };

  const removeActivityFromDay = (dayIndex, actIdx) => {
    const day = quote.days[dayIndex];
    updateDay(dayIndex, { activities: day.activities.filter((_, i) => i !== actIdx) });
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
      const payload = {
        ...quote,
        status: status || quote.status || 'draft',
        deal: searchParams.get('deal') || quote.deal,
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
              <a
                href={`${import.meta.env.VITE_API_URL || '/api'}/pdf/${id}/pdf/download?token=${localStorage.getItem('token')}`}
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-card border border-border text-sm font-medium text-muted-foreground hover:border-border transition-colors"
              >
                <FileText className="w-4 h-4" /> PDF
              </a>
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
                <label className="block text-xs font-medium text-muted-foreground mb-1">Client</label>
                <select
                  value={quote.contact || ''}
                  onChange={(e) => setQuote({ ...quote, contact: e.target.value || null })}
                  className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm text-foreground focus:outline-none focus:border-primary transition-colors"
                >
                  <option value="">Select contact...</option>
                  {contacts.map(c => (
                    <option key={c._id} value={c._id}>{c.firstName} {c.lastName}{c.company ? ` (${c.company})` : ''}</option>
                  ))}
                </select>
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
                </select>
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
                onSelectHotel={(hotel, rate) => selectHotelForDay(idx, hotel, rate)}
                onAddActivity={(activity) => addActivityToDay(idx, activity)}
                onRemoveActivity={(actIdx) => removeActivityFromDay(idx, actIdx)}
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
            <button
              onClick={() => addDay()}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-border text-sm text-muted-foreground hover:border-primary hover:text-primary transition-colors"
            >
              <Plus className="w-4 h-4" /> Add Day
            </button>

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

          {/* Inclusions & Exclusions */}
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
      console.error('Route suggest error:', err?.response?.status, err?.response?.data, err?.message);
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
function ListEditor({ title, icon, items, onChange, color }) {
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
      <h3 className="text-sm font-semibold text-foreground mb-3">{icon} {title}</h3>
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

function LineItemsEditor({ lineItems, onChange, segments, marginPercent, currency }) {
  const [editIdx, setEditIdx] = useState(null);
  const [collapsed, setCollapsed] = useState(lineItems.length > 0);

  const autoGenerate = () => {
    const items = [];
    const markup = 1 + (marginPercent / 100);

    for (const seg of segments) {
      // Hotel
      if (seg.hotel?.name && seg.hotel.ratePerNight > 0) {
        items.push({
          description: `${seg.hotel.name} — ${seg.hotel.roomType || 'Standard'} (${seg.nights} night${seg.nights !== 1 ? 's' : ''})`,
          quantity: seg.nights,
          unitPrice: Math.round(seg.hotel.ratePerNight * markup),
          total: Math.round(seg.hotel.ratePerNight * seg.nights * markup),
        });
      }

      // Activities
      for (const act of (seg.activities || [])) {
        if (act.totalCost > 0) {
          items.push({
            description: `${act.name}${seg.destination ? ' — ' + seg.destination : ''}`,
            quantity: 1,
            unitPrice: Math.round(act.totalCost * markup),
            total: Math.round(act.totalCost * markup),
          });
        }
      }

      // Transport
      if (seg.transport?.name && seg.transport.totalCost > 0) {
        items.push({
          description: `${seg.transport.name}${seg.transport.type ? ' (' + seg.transport.type + ')' : ''}`,
          quantity: 1,
          unitPrice: Math.round(seg.transport.totalCost * markup),
          total: Math.round(seg.transport.totalCost * markup),
        });
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
  onSelectHotel, onAddActivity, onRemoveActivity,
  onAddImage, onRemoveImage, onSetHero,
}) {
  const [showHotelPicker, setShowHotelPicker] = useState(false);
  const [showActivityPicker, setShowActivityPicker] = useState(false);
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
                <div className="flex items-center gap-3 p-2.5 rounded-lg bg-background border border-border">
                  {day.hotel.images?.[0]?.url && <img src={day.hotel.images[0].url} alt="" className="w-12 h-12 rounded-md object-cover" />}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{day.hotel.name}</p>
                    <p className="text-[10px] text-muted-foreground">{day.hotel.roomType} · {formatCurrency(day.hotel.ratePerNight, currency)}/night</p>
                  </div>
                  <button onClick={() => setShowHotelPicker(true)} className="text-[10px] text-primary hover:underline">Change</button>
                </div>
              ) : (
                <button onClick={() => setShowHotelPicker(true)} className="w-full p-2.5 rounded-lg border border-dashed border-border text-xs text-muted-foreground hover:border-primary hover:text-primary">
                  <Hotel className="w-3.5 h-3.5 inline mr-1" /> Select hotel
                </button>
              )}

              {showHotelPicker && (
                <div className="mt-2 p-3 rounded-lg bg-background border border-border max-h-64 overflow-y-auto space-y-1.5">
                  {matchedHotels.length === 0 ? (
                    <p className="text-xs text-muted-foreground/70 text-center py-2">No hotels for this location. Add some in Partners.</p>
                  ) : matchedHotels.map(h => (
                    <div key={h._id} className="bg-card rounded p-2 border border-border">
                      <p className="text-xs font-medium text-foreground">{h.name}</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {h.rates?.map((r, ri) => (
                          <button key={ri} onClick={() => { onSelectHotel(h, r); setShowHotelPicker(false); }}
                            className="text-[10px] px-2 py-0.5 rounded bg-primary/10 hover:bg-primary/15 text-primary border border-amber-100">
                            {r.roomType} · {formatCurrency(r.ratePerNight, currency)}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                  <button onClick={() => setShowHotelPicker(false)} className="text-[10px] text-muted-foreground/70 hover:underline w-full text-right pt-1">Close</button>
                </div>
              )}
            </div>

            {/* Activities */}
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Activities</label>
              {day.activities?.length > 0 && (
                <div className="space-y-1 mb-2">
                  {day.activities.map((a, i) => (
                    <div key={i} className="flex items-center justify-between p-2 rounded bg-background border border-border">
                      <div className="flex items-center gap-2 min-w-0">
                        <Ticket className="w-3 h-3 text-muted-foreground/70 flex-shrink-0" />
                        <span className="text-xs text-foreground truncate">{a.name}</span>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-[10px] text-muted-foreground">{formatCurrency(a.totalCost, currency)}</span>
                        <button onClick={() => onRemoveActivity(i)} className="text-muted-foreground/70 hover:text-red-500">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <button onClick={() => setShowActivityPicker(!showActivityPicker)} className="w-full p-2 rounded-lg border border-dashed border-border text-xs text-muted-foreground hover:border-primary hover:text-primary">
                <Plus className="w-3 h-3 inline mr-0.5" /> Add activity
              </button>
              {showActivityPicker && (
                <div className="mt-2 p-3 rounded-lg bg-background border border-border max-h-48 overflow-y-auto space-y-1">
                  {matchedActivities.length === 0 ? (
                    <p className="text-xs text-muted-foreground/70 text-center py-2">No activities for this location.</p>
                  ) : matchedActivities.map(a => (
                    <button key={a._id} onClick={() => { onAddActivity(a); }}
                      className="w-full text-left p-2 rounded bg-card hover:bg-primary/10 border border-border transition-colors">
                      <p className="text-xs font-medium text-foreground">{a.name}</p>
                      <p className="text-[10px] text-muted-foreground">{formatCurrency(a.costPerPerson || a.groupRate || 0, currency)} {a.pricingModel === 'per_person' ? '/person' : '/group'}</p>
                    </button>
                  ))}
                  <button onClick={() => setShowActivityPicker(false)} className="text-[10px] text-muted-foreground/70 hover:underline w-full text-right pt-1">Close</button>
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
  pricing: { label: 'Pricing', description: 'Total price and per-person breakdown' },
  inclusions: { label: 'Inclusions', description: "What's included in the price" },
  exclusions: { label: 'Exclusions', description: "What's not included" },
  payment_terms: { label: 'Payment Terms', description: 'Deposit and balance schedule' },
  about_us: { label: 'About Us', description: 'Your company story (off by default)' },
  terms: { label: 'Terms & Conditions', description: 'Legal terms (off by default)' },
};

function BlockToggles({ blocks = [], onChange }) {
  const sorted = [...blocks].sort((a, b) => a.order - b.order);

  const toggle = (id) => {
    onChange(blocks.map(b => b.id === id ? { ...b, enabled: !b.enabled } : b));
  };

  const move = (idx, dir) => {
    const sorted = [...blocks].sort((a, b) => a.order - b.order);
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= sorted.length) return;
    [sorted[idx], sorted[newIdx]] = [sorted[newIdx], sorted[idx]];
    sorted.forEach((b, i) => b.order = i);
    onChange(sorted);
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
