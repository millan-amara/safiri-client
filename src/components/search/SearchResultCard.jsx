import { Star, Image as ImageIcon, AlertTriangle, Info, Users, Clock, MapPin, Car, Sparkles } from 'lucide-react';
import { useState } from 'react';

function fmtMoney(n, currency = 'USD') {
  const num = Number(n);
  if (!Number.isFinite(num)) return '—';
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(num);
  } catch {
    return `${currency} ${Math.round(num).toLocaleString()}`;
  }
}

function FlagBadge({ tone = 'gray', children, title }) {
  const tones = {
    gray: 'bg-sand-100 text-sand-700',
    blue: 'bg-blue-50 text-blue-700',
    amber: 'bg-amber-50 text-amber-800',
    red: 'bg-red-50 text-red-700',
  };
  return (
    <span title={title} className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full ${tones[tone]}`}>
      {children}
    </span>
  );
}

function HotelMeta({ result }) {
  return (
    <div className="flex items-center gap-3 text-xs text-sand-600">
      <span className="flex items-center gap-1">
        <MapPin className="w-3 h-3" />
        {result.destination}{result.location ? ` · ${result.location}` : ''}
      </span>
      {result.stars ? (
        <span className="flex items-center gap-0.5 text-amber-brand">
          {Array.from({ length: result.stars }).map((_, i) => (
            <Star key={i} className="w-3 h-3 fill-current" />
          ))}
        </span>
      ) : null}
      <span className="capitalize">{result.hotelType?.replace(/_/g, ' ')}</span>
    </div>
  );
}

function HotelPriceBlock({ price }) {
  if (price.pricingMode === 'perPersonEstimate') {
    return (
      <div className="text-right">
        <div className="text-base font-semibold text-slate-brand whitespace-nowrap">
          From {fmtMoney(price.perPerson, price.currency)}
        </div>
        <div className="text-[10px] text-sand-500">per person sharing</div>
      </div>
    );
  }
  return (
    <div className="text-right">
      <div className="text-base font-semibold text-slate-brand whitespace-nowrap">
        {fmtMoney(price.total, price.currency)}
      </div>
      <div className="text-[10px] text-sand-500">
        {price.nights} {price.nights === 1 ? 'night' : 'nights'}
        {price.perNight ? ` · ${fmtMoney(price.perNight, price.currency)}/night` : ''}
      </div>
    </div>
  );
}

function HotelBreakdown({ price, inclusions, exclusions }) {
  const b = price.breakdown || {};
  return (
    <div className="mt-3 pt-3 border-t border-sand-200 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
      <span className="text-sand-600">Room subtotal</span>
      <span className="text-right font-medium text-slate-brand">{fmtMoney(b.subtotal, price.currency)}</span>

      {b.mandatoryAddOnsPerNightTotal > 0 && (
        <>
          <span className="text-sand-600">
            Mandatory add-ons{b.mandatoryAddOnsPerNight?.length ? ` (${b.mandatoryAddOnsPerNight.map(x => x.name).join(', ')})` : ''}
          </span>
          <span className="text-right font-medium text-slate-brand">
            included
          </span>
        </>
      )}

      {b.mandatoryFeesTotal > 0 && (
        <>
          <span className="text-sand-600">
            Mandatory fees{(b.passThroughFees || []).length ? ` (${b.passThroughFees.filter(f => f.mandatory !== false).map(f => f.name).join(', ')})` : ''}
          </span>
          <span className="text-right font-medium text-slate-brand">{fmtMoney(b.mandatoryFeesTotal, price.currency)}</span>
        </>
      )}

      {price.fxRate && price.sourceCurrency && price.sourceCurrency !== price.currency && (
        <>
          <span className="text-sand-500 text-[10px]">FX</span>
          <span className="text-right text-sand-500 text-[10px]">
            1 {price.sourceCurrency} = {price.fxRate.toFixed(4)} {price.currency}
          </span>
        </>
      )}

      {(inclusions?.length > 0 || exclusions?.length > 0) && (
        <div className="col-span-2 mt-1.5 pt-1.5 border-t border-sand-100 text-[11px] space-y-0.5">
          {inclusions?.length > 0 && (
            <div><span className="font-medium text-slate-brand">Includes:</span>{' '}
              <span className="text-sand-600">{inclusions.join(', ')}</span></div>
          )}
          {exclusions?.length > 0 && (
            <div><span className="font-medium text-slate-brand">Excludes:</span>{' '}
              <span className="text-sand-600">{exclusions.join(', ')}</span></div>
          )}
        </div>
      )}
    </div>
  );
}

export default function SearchResultCard({ result, onSelect, rationale, rationaleLoading }) {
  const [expanded, setExpanded] = useState(false);
  const flags = result.flags || {};

  return (
    <button
      type="button"
      onClick={() => onSelect?.(result)}
      className="w-full text-left px-4 py-3 hover:bg-sand-50 transition-colors border-b border-sand-100 last:border-b-0 group"
    >
      <div className="flex gap-3">
        {/* Thumbnail */}
        <div className="w-16 h-16 rounded-lg bg-sand-100 flex-shrink-0 overflow-hidden flex items-center justify-center">
          {result.image ? (
            <img src={result.image} alt="" className="w-full h-full object-cover" />
          ) : (
            <ImageIcon className="w-5 h-5 text-sand-400" />
          )}
        </div>

        {/* Body */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-semibold text-slate-brand truncate">{result.name}</div>

              {result.type === 'hotel' && <HotelMeta result={result} />}

              {result.type === 'activity' && (
                <div className="flex items-center gap-3 text-xs text-sand-600">
                  <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{result.destination}</span>
                  {result.duration > 0 && (
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{result.duration}h</span>
                  )}
                  <span className="capitalize">{result.season}</span>
                </div>
              )}

              {result.type === 'transport' && (
                <div className="flex items-center gap-3 text-xs text-sand-600">
                  <span className="flex items-center gap-1"><Car className="w-3 h-3" />{result.transportType}</span>
                  {result.capacity > 0 && (
                    <span className="flex items-center gap-1"><Users className="w-3 h-3" />cap {result.capacity}</span>
                  )}
                  {result.routeOrZone && <span className="truncate">{result.routeOrZone}</span>}
                </div>
              )}

              {result.type === 'package' && (
                <div className="flex items-center gap-3 text-xs text-sand-600">
                  <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{result.destination || '—'}</span>
                  {result.durationNights > 0 && (
                    <span>{result.durationNights} night{result.durationNights === 1 ? '' : 's'}</span>
                  )}
                </div>
              )}
            </div>

            {/* Price */}
            {result.type === 'hotel' && <HotelPriceBlock price={result.computedPrice} />}
            {(result.type === 'activity' || result.type === 'transport') && (
              <div className="text-right">
                <div className="text-base font-semibold text-slate-brand whitespace-nowrap">
                  {fmtMoney(result.computedPrice.total, result.computedPrice.currency)}
                </div>
                <div className="text-[10px] text-sand-500 capitalize">
                  {String(result.computedPrice.pricingMode).replace(/_/g, ' ')}
                  {result.type === 'transport' && result.computedPrice.days > 1 ? ` · ${result.computedPrice.days} days` : ''}
                </div>
              </div>
            )}
            {result.type === 'package' && (
              <div className="text-right">
                <div className="text-base font-semibold text-slate-brand whitespace-nowrap">
                  {fmtMoney(result.computedPrice.total, result.computedPrice.currency)}
                </div>
                <div className="text-[10px] text-sand-500">
                  {fmtMoney(result.computedPrice.perPerson, result.computedPrice.currency)}/pp
                </div>
              </div>
            )}
          </div>

          {/* Flags */}
          {(flags.noDatesGiven || flags.paxAssumed || flags.childAgeAssumed || flags.childRateApplied
            || flags.blockingCondition || flags.imagesMissing || flags.minAgeViolation
            || flags.groupSizeExceeded || flags.capacityExceeded || flags.noPaxGiven
            || flags.noDaysGiven || flags.paxTierFallback || flags.childRebateNotApplied
            || flags.extractionConfidence === 'low') && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {flags.noDatesGiven && (
                <FlagBadge tone="gray" title="No dates given — showing the cheapest published rate">no dates</FlagBadge>
              )}
              {flags.paxAssumed && (
                <FlagBadge tone="gray" title="No pax given — priced for 2 adults">2 adults assumed</FlagBadge>
              )}
              {flags.childAgeAssumed && (
                <FlagBadge tone="amber" title={`Child age unknown — assumed age ${8}`}>child age guessed</FlagBadge>
              )}
              {flags.childRateApplied && (
                <FlagBadge tone="blue" title="A child rate bracket was applied">child rate applied</FlagBadge>
              )}
              {flags.blockingCondition && (
                <FlagBadge tone="red" title="Blocking condition on this rate list — review before quoting">blocking condition</FlagBadge>
              )}
              {flags.minAgeViolation && (
                <FlagBadge tone="red" title="One or more children below minimum age">below min age</FlagBadge>
              )}
              {flags.groupSizeExceeded && (
                <FlagBadge tone="amber" title="Party larger than max group size">over group size</FlagBadge>
              )}
              {flags.capacityExceeded && (
                <FlagBadge tone="amber" title="Party exceeds vehicle capacity">over capacity</FlagBadge>
              )}
              {flags.noPaxGiven && (
                <FlagBadge tone="gray" title="No party size given — priced for 1 person">solo assumed</FlagBadge>
              )}
              {flags.noDaysGiven && (
                <FlagBadge tone="gray" title="No date range — priced for 1 day">1 day assumed</FlagBadge>
              )}
              {flags.paxTierFallback && (
                <FlagBadge tone="amber" title="No pax tier matches — used cheapest tier as fallback">tier fallback</FlagBadge>
              )}
              {flags.childRebateNotApplied && (
                <FlagBadge tone="amber" title="Child rebate brackets exist but aren't applied yet">child rebate TBD</FlagBadge>
              )}
              {flags.imagesMissing && (
                <FlagBadge tone="gray" title="No images on this record">no images</FlagBadge>
              )}
              {flags.extractionConfidence === 'low' && (
                <FlagBadge tone="amber" title="Rate list extracted with low confidence — verify before quoting">
                  <AlertTriangle className="w-2.5 h-2.5" />low confidence
                </FlagBadge>
              )}
            </div>
          )}

          {/* Warnings */}
          {result.warnings?.length > 0 && (
            <div className="mt-1.5 text-[11px] text-amber-700 flex items-start gap-1">
              <Info className="w-3 h-3 flex-shrink-0 mt-0.5" />
              <span className="line-clamp-2">{result.warnings[0]}</span>
            </div>
          )}

          {/* AI rationale (top 3 only — driven by Pass 2 endpoint).
              The text always derives from server-computed numbers, so even if
              the LLM blurs the prose, the price/breakdown above stays correct. */}
          {(rationale || rationaleLoading) && (
            <div className="mt-2 flex items-start gap-1.5 text-[11px] italic text-amber-brand/90">
              <Sparkles className="w-3 h-3 flex-shrink-0 mt-0.5" />
              {rationale ? (
                <span className="not-italic text-sand-700 leading-snug">{rationale}</span>
              ) : (
                <span className="inline-block h-3 w-56 max-w-full bg-sand-100 rounded animate-pulse" aria-label="Generating rationale" />
              )}
            </div>
          )}

          {/* Breakdown toggle (hotels only) */}
          {result.type === 'hotel' && result.computedPrice.pricingMode === 'total' && (
            <>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setExpanded(v => !v); }}
                className="mt-2 text-[11px] font-medium text-amber-brand hover:underline"
              >
                {expanded ? 'Hide breakdown' : 'Show breakdown'}
              </button>
              {expanded && (
                <HotelBreakdown
                  price={result.computedPrice}
                  inclusions={result.inclusions}
                  exclusions={result.exclusions}
                />
              )}
            </>
          )}
        </div>
      </div>
    </button>
  );
}
