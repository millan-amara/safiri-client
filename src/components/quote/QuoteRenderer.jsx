import { useState, useEffect, useRef } from 'react';
import { formatCurrency, formatDate, mealPlanLabels } from '../../utils/helpers';
import {
  MapPin, Calendar, Users as UsersIcon, Clock, ChevronDown,
  Sun, Sunrise, Sunset, Moon, Coffee, Star, Phone, Mail,
  Globe, CheckCircle, XCircle, ExternalLink,
} from 'lucide-react';

const timeIcons = {
  early_morning: Sunrise,
  morning: Sun,
  afternoon: Sun,
  evening: Sunset,
  all_day: Sun,
  night: Moon,
};

export default function QuoteRenderer({ quote, token, previewMode = false }) {
  const [activeDay, setActiveDay] = useState(0);
  const heroRef = useRef(null);

  const brand = quote.brandingSnapshot || {};
  const primaryColor = brand.primaryColor || '#B45309';
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
      activities: (d.activities || []).map(a => ({ timeOfDay: a.timeOfDay || 'morning', description: a.name })),
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

  return (
    <div className="min-h-screen bg-stone-50" style={{ '--brand': primaryColor }}>
      {/* ─── HERO COVER ─────────────────────────────── */}
      <header
        ref={heroRef}
        className="relative min-h-[85vh] flex items-end"
        style={{
          background: `linear-gradient(135deg, ${primaryColor}18 0%, ${primaryColor}08 50%, transparent 100%)`,
        }}
      >
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-1/3 h-full opacity-5">
          <div className="absolute top-16 right-16 w-40 h-40 rounded-full" style={{ backgroundColor: primaryColor }} />
          <div className="absolute bottom-32 right-32 w-24 h-24 rounded-full" style={{ backgroundColor: primaryColor }} />
        </div>

        <div className="relative z-10 w-full max-w-5xl mx-auto px-6 pb-16 pt-24">
          {/* Logo */}
          {brand.logo && (
            <img src={brand.logo} alt={brand.companyName} className="h-12 mb-8 object-contain" />
          )}
          {!brand.logo && brand.companyName && (
            <p className="text-sm font-semibold uppercase tracking-widest mb-6" style={{ color: primaryColor }}>{brand.companyName}</p>
          )}

          <p className="text-sm text-stone-500 mb-2">Proposal for {quote.contact?.firstName} {quote.contact?.lastName}</p>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-stone-900 leading-tight mb-8" style={{ fontFamily: 'Playfair Display, serif' }}>
            {quote.title}
          </h1>

          {quote.coverNarrative && (
            <p className="text-base text-stone-600 max-w-2xl leading-relaxed mb-10">{quote.coverNarrative}</p>
          )}

          {/* Quick facts */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-2xl">
            {[
              { icon: Calendar, label: 'Duration', value: `${totalDays} Days / ${totalNights} Nights` },
              { icon: UsersIcon, label: 'Travelers', value: `${totalPax} Traveler${totalPax !== 1 ? 's' : ''}` },
              { icon: MapPin, label: 'Start', value: quote.startPoint },
              { icon: Calendar, label: 'Date', value: quote.startDate ? formatDate(quote.startDate) : 'TBD' },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="bg-white/70 backdrop-blur-sm rounded-xl p-3 border border-stone-200/60">
                <div className="flex items-center gap-1.5 mb-1">
                  <Icon className="w-3.5 h-3.5" style={{ color: primaryColor }} />
                  <span className="text-[10px] uppercase tracking-wide text-stone-400 font-semibold">{label}</span>
                </div>
                <p className="text-sm font-semibold text-stone-800">{value}</p>
              </div>
            ))}
          </div>
        </div>
      </header>

      {/* ─── HIGHLIGHTS BLOCK ───────────────────────── */}
      {blockEnabled('highlights') && (
        <section className="max-w-5xl mx-auto px-6 py-16">
          <h2 className="text-2xl font-bold text-stone-900 mb-6" style={{ fontFamily: 'Playfair Display, serif' }}>
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
        <RouteMap days={quote.days || []} startPoint={quote.startPoint} endPoint={quote.endPoint} primaryColor={primaryColor} />
      )}

      {/* ─── DAY BY DAY BLOCK ───────────────────────── */}
      {blockEnabled('day_by_day') && (
        <section className="max-w-5xl mx-auto px-6 pb-16">
          <h2 className="text-2xl font-bold text-stone-900 mb-8" style={{ fontFamily: 'Playfair Display, serif' }}>
            Day by Day
          </h2>

        <div className="space-y-6">
          {days.map((day, i) => (
            <div
              key={i}
              className={`rounded-2xl overflow-hidden border transition-all ${
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
              {activeDay === i && (
                <div className="border-t border-stone-100 bg-stone-50/50">
                  <div className="grid grid-cols-1 lg:grid-cols-5 gap-0">
                    {/* Left — narrative + images */}
                    <div className="lg:col-span-3 p-6">
                      {day.narrative && (
                        <p className="text-sm text-stone-600 leading-relaxed mb-5">{day.narrative}</p>
                      )}

                      {day.heroImage?.url && (
                        <img
                          src={day.heroImage.url}
                          alt={day.destination}
                          className="w-full h-48 object-cover rounded-xl mb-4"
                        />
                      )}

                      {day.transport && (
                        <div className="flex items-center gap-2 mb-4 p-3 rounded-lg bg-white border border-stone-200">
                          <div className="w-7 h-7 rounded-md flex items-center justify-center text-white text-xs" style={{ backgroundColor: primaryColor }}>→</div>
                          <div>
                            <p className="text-xs font-semibold text-stone-700">{day.transport.name}</p>
                            {day.transport.estimatedTime && (
                              <p className="text-[11px] text-stone-400">Transfer time: {day.transport.estimatedTime}</p>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Activities */}
                      {day.activities?.length > 0 && (
                        <div className="space-y-2">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-stone-400">Activities</h4>
                          {day.activities.map((act, ai) => {
                            const TimeIcon = timeIcons[act.timeOfDay] || Sun;
                            return (
                              <div key={ai} className="flex items-start gap-2.5">
                                <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5" style={{ backgroundColor: primaryColor + '15' }}>
                                  <TimeIcon className="w-3 h-3" style={{ color: primaryColor }} />
                                </div>
                                <p className="text-sm text-stone-700">{act.description}</p>
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
                          {day.hotel.roomType && <p className="text-xs text-stone-500 mt-0.5">{day.hotel.roomType}</p>}
                          {day.hotel.description && (
                            <p className="text-xs text-stone-500 mt-2 leading-relaxed line-clamp-4">{day.hotel.description}</p>
                          )}
                          {day.hotel.images?.[0]?.url && (
                            <img src={day.hotel.images[0].url} alt={day.hotel.name} className="w-full h-28 object-cover rounded-lg mt-3" />
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
              )}
            </div>
          ))}
        </div>
      </section>
      )}

      {/* ─── ACCOMMODATIONS BLOCK ───────────────────── */}
      {blockEnabled('accommodations') && uniqueHotels.length > 0 && (
        <section className="max-w-5xl mx-auto px-6 pb-16">
          <h2 className="text-2xl font-bold text-stone-900 mb-6" style={{ fontFamily: 'Playfair Display, serif' }}>
            Where You'll Stay
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {uniqueHotels.map((hotel, i) => (
              <div key={i} className="rounded-2xl overflow-hidden border border-stone-200 bg-white">
                {hotel.images?.[0]?.url && (
                  <div className="h-48 bg-stone-100 overflow-hidden">
                    <img src={hotel.images[0].url} alt={hotel.name} className="w-full h-full object-cover" />
                  </div>
                )}
                <div className="p-5">
                  <h3 className="text-base font-bold text-stone-900">{hotel.name}</h3>
                  {hotel.roomType && <p className="text-xs text-stone-500 mt-0.5">{hotel.roomType}</p>}
                  {hotel.mealPlan && (
                    <p className="text-xs text-stone-500 mt-1">{mealPlanLabels[hotel.mealPlan] || hotel.mealPlan}</p>
                  )}
                  {hotel.description && (
                    <p className="text-sm text-stone-600 mt-3 leading-relaxed line-clamp-3">{hotel.description}</p>
                  )}
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
            <h2 className="text-2xl font-bold text-stone-900 mb-2" style={{ fontFamily: 'Playfair Display, serif' }}>
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
          </div>
        </div>
      </section>
      )}

      {/* ─── INCLUSIONS / EXCLUSIONS BLOCKS ─────────── */}
      {(blockEnabled('inclusions') || blockEnabled('exclusions')) && (quote.inclusions?.length > 0 || quote.exclusions?.length > 0) && (
        <section className="max-w-5xl mx-auto px-6 pb-16">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 p-6 rounded-2xl border border-stone-200 bg-white">
            {blockEnabled('inclusions') && quote.inclusions?.length > 0 && (
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-stone-400 mb-3 flex items-center gap-1">
                  <CheckCircle className="w-3.5 h-3.5 text-green-500" /> Included
                </h4>
                <div className="space-y-1.5">
                  {quote.inclusions.map((inc, i) => (
                    <p key={i} className="text-sm text-stone-600 flex items-start gap-2">
                      <span className="text-green-500 mt-0.5">→</span> {inc}
                    </p>
                  ))}
                </div>
              </div>
            )}
            {blockEnabled('exclusions') && quote.exclusions?.length > 0 && (
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-stone-400 mb-3 flex items-center gap-1">
                  <XCircle className="w-3.5 h-3.5 text-stone-400" /> Excluded
                </h4>
                <div className="space-y-1.5">
                  {quote.exclusions.map((exc, i) => (
                    <p key={i} className="text-sm text-stone-500 flex items-start gap-2">
                      <span className="text-stone-400 mt-0.5">→</span> {exc}
                    </p>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ─── PAYMENT TERMS BLOCK ───────────────────── */}
      {blockEnabled('payment_terms') && quote.paymentTerms && (
        <section className="max-w-5xl mx-auto px-6 pb-16">
          <div className="p-6 rounded-2xl bg-stone-50 border border-stone-200">
            <h4 className="text-xs font-bold uppercase tracking-wider text-stone-400 mb-2">Payment Terms</h4>
            <p className="text-sm text-stone-600">{quote.paymentTerms}</p>
          </div>
        </section>
      )}

      {/* ─── CLIENT RESPONSE ─────────────────────────── */}
      {!previewMode && quote.status !== 'accepted' && (
        <ClientResponseSection token={token} quoteStatus={quote.status} primaryColor={primaryColor} />
      )}
      {!previewMode && quote.status === 'accepted' && (
        <section className="max-w-5xl mx-auto px-6 pb-16">
          <div className="rounded-2xl bg-green-50 border border-green-200 p-8 text-center">
            <div className="w-14 h-14 rounded-full bg-green-500 text-white flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-7 h-7" />
            </div>
            <h3 className="text-xl font-bold text-green-800 mb-2" style={{ fontFamily: 'Playfair Display, serif' }}>
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
              <h3 className="text-lg font-bold text-stone-900 mb-3" style={{ fontFamily: 'Playfair Display, serif' }}>
                About {brand.companyName || 'Us'}
              </h3>
              <p className="text-sm text-stone-500 leading-relaxed">
                {quote.brandingSnapshot?.companyName
                  ? `We look forward to making your trip unforgettable. Don't hesitate to reach out with any questions.`
                  : ''}
              </p>
            </div>
            <div>
              <h3 className="text-lg font-bold text-stone-900 mb-3" style={{ fontFamily: 'Playfair Display, serif' }}>Contact</h3>
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

function RouteMap({ days, startPoint, endPoint, primaryColor }) {
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
      <h2 className="text-2xl font-bold text-stone-900 mb-6" style={{ fontFamily: 'Playfair Display, serif' }}>
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

function ClientResponseSection({ token, quoteStatus, primaryColor }) {
  const [mode, setMode] = useState(null); // null | 'accept' | 'changes'
  const [message, setMessage] = useState('');
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleAccept = async () => {
    setSubmitting(true);
    try {
      await fetch(`/api/quotes/share/${token}/accept`, { method: 'POST' });
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
      await fetch(`/api/quotes/share/${token}/request-changes`, {
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
          <h2 className="text-xl font-bold text-stone-900 mb-2" style={{ fontFamily: 'Playfair Display, serif' }}>
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