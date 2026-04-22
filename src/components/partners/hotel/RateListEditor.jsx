// One rate list editor. A rate list is a self-contained price sheet:
// audience + currency + validity + priority + meal plan + seasons +
// add-ons + pass-through fees + cancellation tiers. Matches the shape
// in server/models/Hotel.js.

import { useState } from 'react';
import { ChevronDown, ChevronUp, Plus, Trash2, Copy } from 'lucide-react';

const CURRENCIES = ['USD', 'EUR', 'GBP', 'KES', 'TZS', 'UGX', 'RWF', 'ZAR'];
const MEAL_PLANS = [
  { code: 'RO', label: 'Room Only' },
  { code: 'BB', label: 'Bed & Breakfast' },
  { code: 'HB', label: 'Half Board' },
  { code: 'FB', label: 'Full Board' },
  { code: 'AI', label: 'All Inclusive' },
  { code: 'GAME_PACKAGE', label: 'Game Package' },
];
const AUDIENCE_TAGS = ['retail', 'contract', 'resident'];

const input = 'w-full px-2.5 py-1.5 rounded-md border border-border bg-background text-xs text-foreground focus:outline-none focus:border-primary transition-colors';
const label = 'block text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1';

// Format a Date or ISO string for an <input type="date">.
function dateInputValue(d) {
  if (!d) return '';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return '';
  return dt.toISOString().slice(0, 10);
}

function emptyRoomPricing() {
  return {
    roomType: 'Standard',
    maxOccupancy: 2,
    singleOccupancy: 0,
    perPersonSharing: 0,
    triplePerPerson: 0,
    quadPerPerson: 0,
    singleSupplement: 0,
    childBrackets: [],
    notes: '',
  };
}

function emptySeason(label = 'Mid') {
  return {
    label,
    dateRanges: [{ from: '', to: '' }],
    daysOfWeek: [],
    specificDates: [],
    minNights: 1,
    rooms: [emptyRoomPricing()],
    supplements: [],
  };
}

// Short labels for the weekday row; index = JS getDay() value (0=Sun)
const DOW_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function emptyList() {
  return {
    name: 'Rack 2026',
    audience: ['retail'],
    currency: 'USD',
    validFrom: '',
    validTo: '',
    priority: 0,
    mealPlan: 'FB',
    mealPlanLabel: 'Full Board',
    seasons: [emptySeason('High')],
    addOns: [],
    passThroughFees: [],
    cancellationTiers: [],
    depositPct: 30,
    bookingTerms: '',
    notes: '',
    isActive: true,
  };
}

export { emptyList };

export default function RateListEditor({ list, index, onChange, onRemove, onDuplicate }) {
  const [expanded, setExpanded] = useState(index === 0);
  const [tab, setTab] = useState('pricing'); // pricing | addons | fees | terms

  const update = (patch) => onChange({ ...list, ...patch });
  const updateSeason = (sIdx, patch) => update({
    seasons: list.seasons.map((s, i) => i === sIdx ? { ...s, ...patch } : s),
  });
  const addSeason = () => update({ seasons: [...list.seasons, emptySeason('New Season')] });
  const removeSeason = (sIdx) => update({ seasons: list.seasons.filter((_, i) => i !== sIdx) });
  const duplicateSeason = (sIdx) => update({
    seasons: [...list.seasons, JSON.parse(JSON.stringify(list.seasons[sIdx]))],
  });

  const toggleAudience = (tag) => {
    const set = new Set(list.audience || []);
    if (set.has(tag)) set.delete(tag); else set.add(tag);
    update({ audience: Array.from(set) });
  };

  return (
    <div className={`rounded-lg border ${list.isActive === false ? 'border-dashed border-border/60 bg-muted/30' : 'border-border bg-background'}`}>
      {/* Header row */}
      <div className="flex items-center gap-2 px-3 py-2">
        <button type="button" onClick={() => setExpanded(!expanded)} className="p-1 rounded hover:bg-muted text-muted-foreground">
          {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
        <input
          type="text"
          value={list.name}
          onChange={e => update({ name: e.target.value })}
          placeholder="Rate list name"
          className="flex-1 min-w-0 px-2 py-1 rounded-md border border-transparent hover:border-border focus:border-primary bg-transparent text-sm font-semibold text-foreground focus:outline-none"
        />
        <div className="flex items-center gap-1 shrink-0">
          {(list.audience || []).map(a => (
            <span key={a} className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-primary/10 text-primary uppercase">{a}</span>
          ))}
          <span className="px-1.5 py-0.5 rounded text-[10px] bg-muted text-muted-foreground">{list.currency}</span>
          <span className="px-1.5 py-0.5 rounded text-[10px] bg-muted text-muted-foreground">{list.mealPlan}</span>
          {list.priority > 0 && <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-100 text-amber-700">P{list.priority}</span>}
          <button type="button" onClick={onDuplicate} title="Duplicate" className="p-1 rounded hover:bg-muted text-muted-foreground">
            <Copy className="w-3.5 h-3.5" />
          </button>
          <button type="button" onClick={onRemove} title="Remove" className="p-1 rounded hover:bg-red-50 text-muted-foreground hover:text-red-500">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-border px-3 py-3 space-y-3">
          {/* Meta row */}
          <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
            <div>
              <label className={label}>Currency</label>
              <select value={list.currency} onChange={e => update({ currency: e.target.value })} className={input}>
                {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className={label}>Meal Plan</label>
              <select
                value={list.mealPlan}
                onChange={e => {
                  const mp = MEAL_PLANS.find(m => m.code === e.target.value);
                  update({ mealPlan: e.target.value, mealPlanLabel: mp?.label || list.mealPlanLabel });
                }}
                className={input}
              >
                {MEAL_PLANS.map(m => <option key={m.code} value={m.code}>{m.code} — {m.label}</option>)}
              </select>
            </div>
            <div>
              <label className={label}>Valid From</label>
              <input type="date" value={dateInputValue(list.validFrom)} onChange={e => update({ validFrom: e.target.value })} className={input} />
            </div>
            <div>
              <label className={label}>Valid To</label>
              <input type="date" value={dateInputValue(list.validTo)} onChange={e => update({ validTo: e.target.value })} className={input} />
            </div>
            <div>
              <label className={label}>Priority</label>
              <input type="number" value={list.priority} onChange={e => update({ priority: parseInt(e.target.value) || 0 })} className={input} />
            </div>
            <div>
              <label className={label}>Deposit %</label>
              <input type="number" value={list.depositPct} onChange={e => update({ depositPct: parseInt(e.target.value) || 0 })} className={input} />
            </div>
          </div>

          <div>
            <label className={label}>Audience (choose one or more)</label>
            <div className="flex flex-wrap gap-1.5">
              {AUDIENCE_TAGS.map(tag => {
                const on = (list.audience || []).includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleAudience(tag)}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium uppercase tracking-wide ${on ? 'bg-primary text-white' : 'bg-muted text-muted-foreground hover:bg-muted/70'}`}
                  >
                    {tag}
                  </button>
                );
              })}
              <label className="inline-flex items-center gap-1.5 ml-2 text-xs text-muted-foreground">
                <input type="checkbox" checked={list.isActive !== false} onChange={e => update({ isActive: e.target.checked })} />
                Active
              </label>
            </div>
          </div>

          {/* Tab switcher */}
          <div className="flex gap-1 border-b border-border">
            {[
              { id: 'pricing', label: `Seasons & Rooms (${list.seasons?.length || 0})` },
              { id: 'addons', label: `Add-ons (${list.addOns?.length || 0})` },
              { id: 'fees', label: `Pass-through Fees (${list.passThroughFees?.length || 0})` },
              { id: 'terms', label: 'Cancellation & Terms' },
            ].map(t => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`px-3 py-1.5 text-xs font-medium border-b-2 -mb-px transition-colors ${tab === t.id ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === 'pricing' && (
            <SeasonsTab
              seasons={list.seasons || []}
              currency={list.currency}
              onAdd={addSeason}
              onRemove={removeSeason}
              onDuplicate={duplicateSeason}
              onChange={updateSeason}
            />
          )}
          {tab === 'addons' && (
            <AddOnsTab
              addOns={list.addOns || []}
              currency={list.currency}
              onChange={(addOns) => update({ addOns })}
            />
          )}
          {tab === 'fees' && (
            <FeesTab
              fees={list.passThroughFees || []}
              defaultCurrency={list.currency}
              onChange={(passThroughFees) => update({ passThroughFees })}
            />
          )}
          {tab === 'terms' && (
            <TermsTab list={list} update={update} />
          )}
        </div>
      )}
    </div>
  );
}

// ─── SEASONS TAB ────────────────────────────────────────────────────────
function SeasonsTab({ seasons, currency, onAdd, onRemove, onDuplicate, onChange }) {
  return (
    <div className="space-y-3">
      {seasons.map((s, i) => (
        <SeasonEditor
          key={i}
          season={s}
          currency={currency}
          onChange={(patch) => onChange(i, patch)}
          onRemove={() => onRemove(i)}
          onDuplicate={() => onDuplicate(i)}
        />
      ))}
      <button type="button" onClick={onAdd} className="w-full px-3 py-2 rounded-md border border-dashed border-border text-xs text-muted-foreground hover:text-foreground hover:border-primary transition-colors inline-flex items-center justify-center gap-1.5">
        <Plus className="w-3.5 h-3.5" /> Add Season
      </button>
    </div>
  );
}

function SeasonEditor({ season, currency, onChange, onRemove, onDuplicate }) {
  const updateRoom = (rIdx, patch) => onChange({
    rooms: season.rooms.map((r, i) => i === rIdx ? { ...r, ...patch } : r),
  });
  const addRoom = () => onChange({ rooms: [...(season.rooms || []), emptyRoomPricing()] });
  const removeRoom = (rIdx) => onChange({ rooms: season.rooms.filter((_, i) => i !== rIdx) });

  const updateRange = (rIdx, patch) => onChange({
    dateRanges: season.dateRanges.map((r, i) => i === rIdx ? { ...r, ...patch } : r),
  });
  const addRange = () => onChange({ dateRanges: [...(season.dateRanges || []), { from: '', to: '' }] });
  const removeRange = (rIdx) => onChange({ dateRanges: season.dateRanges.filter((_, i) => i !== rIdx) });

  return (
    <div className="rounded-md border border-border bg-card p-3 space-y-3">
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={season.label}
          onChange={e => onChange({ label: e.target.value })}
          placeholder="Season label (e.g. High, Mid, Peak)"
          className="flex-1 px-2 py-1 rounded-md border border-transparent hover:border-border focus:border-primary bg-transparent text-sm font-semibold text-foreground focus:outline-none"
        />
        <div>
          <label className="text-[10px] text-muted-foreground mr-1">Min nights</label>
          <input
            type="number"
            min={1}
            value={season.minNights || 1}
            onChange={e => onChange({ minNights: parseInt(e.target.value) || 1 })}
            className="w-14 px-2 py-1 rounded-md border border-border bg-background text-xs text-foreground focus:outline-none focus:border-primary"
          />
        </div>
        <button type="button" onClick={onDuplicate} title="Duplicate" className="p-1 rounded hover:bg-muted text-muted-foreground"><Copy className="w-3.5 h-3.5" /></button>
        <button type="button" onClick={onRemove} title="Remove" className="p-1 rounded hover:bg-red-50 text-muted-foreground hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
      </div>

      {/* Date ranges */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className={label}>Date Ranges</span>
          <button type="button" onClick={addRange} className="text-[11px] text-primary hover:underline inline-flex items-center gap-1">
            <Plus className="w-3 h-3" /> Add range
          </button>
        </div>
        <div className="space-y-1.5">
          {(season.dateRanges || []).map((r, i) => (
            <div key={i} className="flex items-center gap-2">
              <input type="date" value={dateInputValue(r.from)} onChange={e => updateRange(i, { from: e.target.value })} className={input} />
              <span className="text-xs text-muted-foreground">→</span>
              <input type="date" value={dateInputValue(r.to)} onChange={e => updateRange(i, { to: e.target.value })} className={input} />
              <button type="button" onClick={() => removeRange(i)} disabled={season.dateRanges.length <= 1} className="p-1 rounded hover:bg-red-50 text-muted-foreground hover:text-red-500 disabled:opacity-30">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Day-of-week filter (optional — for lodges with weekday/weekend splits) */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className={label}>Days of Week (optional — leave empty = applies all days)</span>
          {(season.daysOfWeek || []).length > 0 && (
            <button type="button" onClick={() => onChange({ daysOfWeek: [] })} className="text-[11px] text-muted-foreground hover:text-foreground">
              Clear
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-1">
          {DOW_LABELS.map((lbl, dow) => {
            const on = (season.daysOfWeek || []).includes(dow);
            return (
              <button
                key={dow}
                type="button"
                onClick={() => {
                  const set = new Set(season.daysOfWeek || []);
                  if (set.has(dow)) set.delete(dow); else set.add(dow);
                  onChange({ daysOfWeek: Array.from(set).sort() });
                }}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium uppercase tracking-wide transition-colors ${on ? 'bg-primary text-white' : 'bg-muted text-muted-foreground hover:bg-muted/70'}`}
                title={on ? `This season applies on ${lbl}` : `Click to include ${lbl}`}
              >
                {lbl}
              </button>
            );
          })}
        </div>
        <p className="text-[10px] text-muted-foreground/70 mt-1">
          For weekend/weekday splits: create two seasons with the same date range but different days (e.g. "Weekend" = Fri, Sat / "Weekday" = Sun–Thu).
        </p>
      </div>

      {/* Specific-date overrides (public holidays that the PDF groups with this tier) */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className={label}>Specific Dates (optional — public holidays priced like this season)</span>
          <button
            type="button"
            onClick={() => onChange({ specificDates: [...(season.specificDates || []), ''] })}
            className="text-[11px] text-primary hover:underline inline-flex items-center gap-1"
          >
            <Plus className="w-3 h-3" /> Add date
          </button>
        </div>
        {(season.specificDates || []).length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {season.specificDates.map((d, i) => (
              <div key={i} className="inline-flex items-center gap-1 bg-background border border-border rounded-md px-1.5 py-0.5">
                <input
                  type="date"
                  value={dateInputValue(d)}
                  onChange={e => onChange({
                    specificDates: season.specificDates.map((x, idx) => idx === i ? e.target.value : x),
                  })}
                  className="bg-transparent text-xs text-foreground focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => onChange({
                    specificDates: season.specificDates.filter((_, idx) => idx !== i),
                  })}
                  className="p-0.5 text-muted-foreground hover:text-red-500"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[10px] text-muted-foreground/70">
            Add dates (e.g. Dec 25, Jan 1) to apply this season's pricing on public holidays regardless of day of week.
          </p>
        )}
      </div>

      {/* Rooms */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className={label}>Room Types & Pricing ({currency})</span>
          <button type="button" onClick={addRoom} className="text-[11px] text-primary hover:underline inline-flex items-center gap-1">
            <Plus className="w-3 h-3" /> Add room
          </button>
        </div>
        <div className="space-y-2">
          {(season.rooms || []).map((r, i) => (
            <RoomPricingEditor
              key={i}
              room={r}
              currency={currency}
              onChange={(patch) => updateRoom(i, patch)}
              onRemove={() => removeRoom(i)}
              canRemove={(season.rooms || []).length > 1}
            />
          ))}
        </div>
      </div>

      {/* Supplements */}
      <SupplementsEditor
        supplements={season.supplements || []}
        currency={currency}
        onChange={(supplements) => onChange({ supplements })}
      />
    </div>
  );
}

function RoomPricingEditor({ room, currency, onChange, onRemove, canRemove }) {
  const [childOpen, setChildOpen] = useState((room.childBrackets || []).length > 0);

  const updateChild = (idx, patch) => onChange({
    childBrackets: (room.childBrackets || []).map((b, i) => i === idx ? { ...b, ...patch } : b),
  });
  const addChild = () => onChange({
    childBrackets: [
      ...(room.childBrackets || []),
      { label: '', minAge: 0, maxAge: 17, mode: 'pct', value: 50, sharingRule: 'sharing_with_adults' },
    ],
  });
  const removeChild = (idx) => onChange({
    childBrackets: room.childBrackets.filter((_, i) => i !== idx),
  });

  return (
    <div className="rounded-md border border-border/60 bg-background p-2.5 space-y-2">
      <div className="grid grid-cols-2 sm:grid-cols-7 gap-2">
        <div className="sm:col-span-2">
          <label className={label}>Room Type</label>
          <input type="text" value={room.roomType} onChange={e => onChange({ roomType: e.target.value })} className={input} placeholder="Standard / Deluxe / Family Suite" />
        </div>
        <div>
          <label className={label}>Max Occ.</label>
          <input type="number" min={1} value={room.maxOccupancy} onChange={e => onChange({ maxOccupancy: parseInt(e.target.value) || 2 })} className={input} />
        </div>
        <div>
          <label className={label}>Single</label>
          <input type="number" value={room.singleOccupancy} onChange={e => onChange({ singleOccupancy: parseFloat(e.target.value) || 0 })} className={input} />
        </div>
        <div>
          <label className={label}>PP Sharing</label>
          <input type="number" value={room.perPersonSharing} onChange={e => onChange({ perPersonSharing: parseFloat(e.target.value) || 0 })} className={input} />
        </div>
        <div>
          <label className={label}>Triple PP</label>
          <input type="number" value={room.triplePerPerson} onChange={e => onChange({ triplePerPerson: parseFloat(e.target.value) || 0 })} className={input} />
        </div>
        <div>
          <label className={label}>Quad PP</label>
          <input type="number" value={room.quadPerPerson} onChange={e => onChange({ quadPerPerson: parseFloat(e.target.value) || 0 })} className={input} />
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        <div>
          <label className={label}>Single Supplement</label>
          <input type="number" value={room.singleSupplement} onChange={e => onChange({ singleSupplement: parseFloat(e.target.value) || 0 })} className={input} />
        </div>
        <div className="sm:col-span-2">
          <label className={label}>Notes</label>
          <input type="text" value={room.notes || ''} onChange={e => onChange({ notes: e.target.value })} className={input} placeholder="Min 2 nights on weekends, etc." />
        </div>
      </div>

      {/* Child brackets */}
      <div className="rounded border border-border/50 bg-muted/20 p-2">
        <button
          type="button"
          onClick={() => setChildOpen(!childOpen)}
          className="flex items-center justify-between w-full text-[11px] font-medium text-muted-foreground uppercase tracking-wide"
        >
          <span>Child Pricing ({(room.childBrackets || []).length} bracket{(room.childBrackets || []).length === 1 ? '' : 's'})</span>
          {childOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
        {childOpen && (
          <div className="mt-2 space-y-1.5">
            {(room.childBrackets || []).map((b, i) => (
              <div key={i} className="grid grid-cols-2 sm:grid-cols-7 gap-1.5 items-end">
                <div>
                  <label className={label}>Label</label>
                  <input type="text" value={b.label} onChange={e => updateChild(i, { label: e.target.value })} className={input} placeholder="0–3 / 4–11" />
                </div>
                <div>
                  <label className={label}>Min Age</label>
                  <input type="number" value={b.minAge} onChange={e => updateChild(i, { minAge: parseInt(e.target.value) || 0 })} className={input} />
                </div>
                <div>
                  <label className={label}>Max Age</label>
                  <input type="number" value={b.maxAge} onChange={e => updateChild(i, { maxAge: parseInt(e.target.value) || 0 })} className={input} />
                </div>
                <div>
                  <label className={label}>Mode</label>
                  <select value={b.mode} onChange={e => updateChild(i, { mode: e.target.value })} className={input}>
                    <option value="free">Free</option>
                    <option value="pct">% of adult</option>
                    <option value="flat">Flat amount</option>
                  </select>
                </div>
                <div>
                  <label className={label}>Value</label>
                  <input type="number" value={b.value} onChange={e => updateChild(i, { value: parseFloat(e.target.value) || 0 })} className={input} disabled={b.mode === 'free'} />
                </div>
                <div>
                  <label className={label}>Sharing</label>
                  <select value={b.sharingRule} onChange={e => updateChild(i, { sharingRule: e.target.value })} className={input}>
                    <option value="sharing_with_adults">Shares</option>
                    <option value="own_room">Own room</option>
                    <option value="any">Any</option>
                  </select>
                </div>
                <button type="button" onClick={() => removeChild(i)} className="p-1 rounded hover:bg-red-50 text-muted-foreground hover:text-red-500">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
            <button type="button" onClick={addChild} className="text-[11px] text-primary hover:underline inline-flex items-center gap-1">
              <Plus className="w-3 h-3" /> Add bracket
            </button>
          </div>
        )}
      </div>

      <div className="flex justify-end">
        <button type="button" onClick={onRemove} disabled={!canRemove} className="text-[11px] text-muted-foreground hover:text-red-500 disabled:opacity-30 inline-flex items-center gap-1">
          <Trash2 className="w-3 h-3" /> Remove room
        </button>
      </div>
    </div>
  );
}

function SupplementsEditor({ supplements, currency, onChange }) {
  const add = () => onChange([
    ...supplements,
    { name: '', dates: [{ from: '', to: '' }], amountPerPerson: 0, amountPerRoom: 0, currency: currency, mandatory: true, notes: '' },
  ]);
  const remove = (i) => onChange(supplements.filter((_, idx) => idx !== i));
  const update = (i, patch) => onChange(supplements.map((s, idx) => idx === i ? { ...s, ...patch } : s));
  const updateDate = (i, dIdx, patch) => update(i, {
    dates: supplements[i].dates.map((d, x) => x === dIdx ? { ...d, ...patch } : d),
  });
  const addDate = (i) => update(i, { dates: [...supplements[i].dates, { from: '', to: '' }] });
  const removeDate = (i, dIdx) => update(i, { dates: supplements[i].dates.filter((_, x) => x !== dIdx) });

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className={label}>Date-specific Supplements ({supplements.length}) — Christmas, NYE, etc.</span>
        <button type="button" onClick={add} className="text-[11px] text-primary hover:underline inline-flex items-center gap-1">
          <Plus className="w-3 h-3" /> Add
        </button>
      </div>
      <div className="space-y-2">
        {supplements.map((s, i) => (
          <div key={i} className="rounded border border-border/60 bg-background p-2 space-y-1.5">
            <div className="flex items-center gap-2">
              <input type="text" value={s.name} onChange={e => update(i, { name: e.target.value })} placeholder="Christmas Eve / NYE" className={`${input} flex-1`} />
              <button type="button" onClick={() => remove(i)} className="p-1 rounded hover:bg-red-50 text-muted-foreground hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div>
                <label className={label}>Currency</label>
                <select value={s.currency || currency} onChange={e => update(i, { currency: e.target.value })} className={input} title="Supplements can be in a different currency than the rate list (e.g. USD surcharge on a KES rate card)">
                  {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className={label}>Per Person</label>
                <input type="number" value={s.amountPerPerson} onChange={e => update(i, { amountPerPerson: parseFloat(e.target.value) || 0 })} className={input} />
              </div>
              <div>
                <label className={label}>Per Room</label>
                <input type="number" value={s.amountPerRoom} onChange={e => update(i, { amountPerRoom: parseFloat(e.target.value) || 0 })} className={input} />
              </div>
              <div>
                <label className={label}>Mandatory</label>
                <select value={String(s.mandatory !== false)} onChange={e => update(i, { mandatory: e.target.value === 'true' })} className={input}>
                  <option value="true">Yes</option>
                  <option value="false">No (customer opt-in)</option>
                </select>
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className={label}>Active Dates</span>
                <button type="button" onClick={() => addDate(i)} className="text-[11px] text-primary hover:underline inline-flex items-center gap-1">
                  <Plus className="w-3 h-3" /> Add range
                </button>
              </div>
              <div className="space-y-1">
                {s.dates.map((d, dIdx) => (
                  <div key={dIdx} className="flex items-center gap-1.5">
                    <input type="date" value={dateInputValue(d.from)} onChange={e => updateDate(i, dIdx, { from: e.target.value })} className={input} />
                    <span className="text-xs text-muted-foreground">→</span>
                    <input type="date" value={dateInputValue(d.to)} onChange={e => updateDate(i, dIdx, { to: e.target.value })} className={input} />
                    <button type="button" onClick={() => removeDate(i, dIdx)} disabled={s.dates.length <= 1} className="p-1 rounded text-muted-foreground hover:text-red-500 disabled:opacity-30">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── ADD-ONS TAB ────────────────────────────────────────────────────────
const ADD_ON_UNITS = ['per_person_per_day', 'per_day', 'per_trip', 'per_person', 'per_room_per_day'];
function AddOnsTab({ addOns, currency, onChange }) {
  const add = () => onChange([
    ...addOns,
    { name: '', description: '', unit: 'per_person_per_day', amount: 0, currency: currency, optional: true },
  ]);
  const remove = (i) => onChange(addOns.filter((_, idx) => idx !== i));
  const update = (i, patch) => onChange(addOns.map((a, idx) => idx === i ? { ...a, ...patch } : a));

  return (
    <div className="space-y-2">
      <p className="text-[11px] text-muted-foreground">Drinks packages, vehicle hire, spa, extra meals. Listed on the quote — optional add-ons are opt-in by the guest; mandatory are automatically included. Each can be priced in its own currency.</p>
      {addOns.map((a, i) => (
        <div key={i} className="rounded border border-border/60 bg-background p-2.5 grid grid-cols-1 md:grid-cols-12 gap-2">
          <div className="md:col-span-3">
            <label className={label}>Name</label>
            <input type="text" value={a.name} onChange={e => update(i, { name: e.target.value })} placeholder="Drinks Package" className={input} />
          </div>
          <div className="md:col-span-3">
            <label className={label}>Description</label>
            <input type="text" value={a.description || ''} onChange={e => update(i, { description: e.target.value })} placeholder="House beer, wine, spirits" className={input} />
          </div>
          <div className="md:col-span-2">
            <label className={label}>Unit</label>
            <select value={a.unit} onChange={e => update(i, { unit: e.target.value })} className={input}>
              {ADD_ON_UNITS.map(u => <option key={u} value={u}>{u.replace(/_/g, ' ')}</option>)}
            </select>
          </div>
          <div className="md:col-span-1">
            <label className={label}>Currency</label>
            <select value={a.currency || currency} onChange={e => update(i, { currency: e.target.value })} className={input} title="Defaults to rate list currency; override for USD add-ons on a KES list etc.">
              {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="md:col-span-1">
            <label className={label}>Amount</label>
            <input type="number" value={a.amount} onChange={e => update(i, { amount: parseFloat(e.target.value) || 0 })} className={input} />
          </div>
          <div className="md:col-span-1">
            <label className={label}>Type</label>
            <select value={String(a.optional !== false)} onChange={e => update(i, { optional: e.target.value === 'true' })} className={input}>
              <option value="true">Optional</option>
              <option value="false">Mandatory</option>
            </select>
          </div>
          <div className="md:col-span-1 flex items-end justify-end">
            <button type="button" onClick={() => remove(i)} className="p-1.5 rounded hover:bg-red-50 text-muted-foreground hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
          </div>
        </div>
      ))}
      <button type="button" onClick={add} className="w-full px-3 py-2 rounded-md border border-dashed border-border text-xs text-muted-foreground hover:text-foreground hover:border-primary transition-colors inline-flex items-center justify-center gap-1.5">
        <Plus className="w-3.5 h-3.5" /> Add Add-on
      </button>
    </div>
  );
}

// ─── PASS-THROUGH FEES TAB ──────────────────────────────────────────────
const FEE_UNITS = ['per_person_per_day', 'per_person_per_entry', 'per_person_per_night', 'per_room_per_night', 'flat'];
function FeesTab({ fees, defaultCurrency, onChange }) {
  const add = () => onChange([
    ...fees,
    { name: '', unit: 'per_person_per_day', currency: defaultCurrency, flatAmount: 0, tieredRows: [], mandatory: true, notes: '' },
  ]);
  const remove = (i) => onChange(fees.filter((_, idx) => idx !== i));
  const update = (i, patch) => onChange(fees.map((f, idx) => idx === i ? { ...f, ...patch } : f));
  const updateRow = (i, rIdx, patch) => update(i, {
    tieredRows: fees[i].tieredRows.map((r, x) => x === rIdx ? { ...r, ...patch } : r),
  });
  const addRow = (i) => update(i, {
    tieredRows: [
      ...fees[i].tieredRows,
      { adultCitizen: 0, adultResident: 0, adultNonResident: 0, childCitizen: 0, childResident: 0, childNonResident: 0, childMinAge: 9, childMaxAge: 17, validFrom: '', validTo: '', notes: '' },
    ],
  });
  const removeRow = (i, rIdx) => update(i, { tieredRows: fees[i].tieredRows.filter((_, x) => x !== rIdx) });

  return (
    <div className="space-y-3">
      <p className="text-[11px] text-muted-foreground">Park entrance fees, community fees, government levies. Paid by guest to the lodge on check-in, then passed to the third party. Price can vary by nationality and age.</p>
      {fees.map((f, i) => (
        <div key={i} className="rounded border border-border/60 bg-background p-2.5 space-y-2">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-2">
            <div className="md:col-span-4">
              <label className={label}>Fee Name</label>
              <input type="text" value={f.name} onChange={e => update(i, { name: e.target.value })} placeholder="Mara Reserve Fee" className={input} />
            </div>
            <div className="md:col-span-3">
              <label className={label}>Unit</label>
              <select value={f.unit} onChange={e => update(i, { unit: e.target.value })} className={input}>
                {FEE_UNITS.map(u => <option key={u} value={u}>{u.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className={label}>Currency</label>
              <select value={f.currency || defaultCurrency} onChange={e => update(i, { currency: e.target.value })} className={input}>
                {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className={label}>Flat Amount</label>
              <input type="number" value={f.flatAmount || 0} onChange={e => update(i, { flatAmount: parseFloat(e.target.value) || 0 })} className={input} placeholder="Used if no tiered table" />
            </div>
            <div className="md:col-span-1 flex items-end justify-end">
              <button type="button" onClick={() => remove(i)} className="p-1.5 rounded hover:bg-red-50 text-muted-foreground hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <span className={label}>Tiered pricing (optional — by nationality & age)</span>
              <button type="button" onClick={() => addRow(i)} className="text-[11px] text-primary hover:underline inline-flex items-center gap-1">
                <Plus className="w-3 h-3" /> Add tier row
              </button>
            </div>
            {(f.tieredRows || []).map((r, rIdx) => (
              <div key={rIdx} className="rounded border border-border/40 bg-muted/20 p-2 mb-1.5 space-y-1.5">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  <div>
                    <label className={label}>Adult Citizen</label>
                    <input type="number" value={r.adultCitizen} onChange={e => updateRow(i, rIdx, { adultCitizen: parseFloat(e.target.value) || 0 })} className={input} />
                  </div>
                  <div>
                    <label className={label}>Adult Resident</label>
                    <input type="number" value={r.adultResident} onChange={e => updateRow(i, rIdx, { adultResident: parseFloat(e.target.value) || 0 })} className={input} />
                  </div>
                  <div>
                    <label className={label}>Adult Non-Resident</label>
                    <input type="number" value={r.adultNonResident} onChange={e => updateRow(i, rIdx, { adultNonResident: parseFloat(e.target.value) || 0 })} className={input} />
                  </div>
                  <div>
                    <label className={label}>Valid From</label>
                    <input type="date" value={dateInputValue(r.validFrom)} onChange={e => updateRow(i, rIdx, { validFrom: e.target.value })} className={input} />
                  </div>
                  <div>
                    <label className={label}>Child Citizen</label>
                    <input type="number" value={r.childCitizen} onChange={e => updateRow(i, rIdx, { childCitizen: parseFloat(e.target.value) || 0 })} className={input} />
                  </div>
                  <div>
                    <label className={label}>Child Resident</label>
                    <input type="number" value={r.childResident} onChange={e => updateRow(i, rIdx, { childResident: parseFloat(e.target.value) || 0 })} className={input} />
                  </div>
                  <div>
                    <label className={label}>Child Non-Resident</label>
                    <input type="number" value={r.childNonResident} onChange={e => updateRow(i, rIdx, { childNonResident: parseFloat(e.target.value) || 0 })} className={input} />
                  </div>
                  <div>
                    <label className={label}>Valid To</label>
                    <input type="date" value={dateInputValue(r.validTo)} onChange={e => updateRow(i, rIdx, { validTo: e.target.value })} className={input} />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-1.5 items-end">
                  <div>
                    <label className={label}>Child Min Age</label>
                    <input type="number" value={r.childMinAge} onChange={e => updateRow(i, rIdx, { childMinAge: parseInt(e.target.value) || 0 })} className={input} />
                  </div>
                  <div>
                    <label className={label}>Child Max Age</label>
                    <input type="number" value={r.childMaxAge} onChange={e => updateRow(i, rIdx, { childMaxAge: parseInt(e.target.value) || 0 })} className={input} />
                  </div>
                  <button type="button" onClick={() => removeRow(i, rIdx)} className="text-[11px] text-muted-foreground hover:text-red-500 inline-flex items-center gap-1 justify-end">
                    <Trash2 className="w-3 h-3" /> Remove row
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={label}>Notes</label>
              <input type="text" value={f.notes || ''} onChange={e => update(i, { notes: e.target.value })} className={input} />
            </div>
            <div>
              <label className={label}>Type</label>
              <select value={String(f.mandatory !== false)} onChange={e => update(i, { mandatory: e.target.value === 'true' })} className={input}>
                <option value="true">Mandatory</option>
                <option value="false">Optional</option>
              </select>
            </div>
          </div>
        </div>
      ))}
      <button type="button" onClick={add} className="w-full px-3 py-2 rounded-md border border-dashed border-border text-xs text-muted-foreground hover:text-foreground hover:border-primary transition-colors inline-flex items-center justify-center gap-1.5">
        <Plus className="w-3.5 h-3.5" /> Add Pass-through Fee
      </button>
    </div>
  );
}

// ─── TERMS TAB ──────────────────────────────────────────────────────────
function TermsTab({ list, update }) {
  const updateTier = (i, patch) => update({
    cancellationTiers: list.cancellationTiers.map((t, idx) => idx === i ? { ...t, ...patch } : t),
  });
  const addTier = () => update({
    cancellationTiers: [...(list.cancellationTiers || []), { daysBefore: 30, penaltyPct: 50, notes: '' }],
  });
  const removeTier = (i) => update({ cancellationTiers: list.cancellationTiers.filter((_, idx) => idx !== i) });

  return (
    <div className="space-y-3">
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className={label}>Cancellation Tiers ({(list.cancellationTiers || []).length})</span>
          <button type="button" onClick={addTier} className="text-[11px] text-primary hover:underline inline-flex items-center gap-1">
            <Plus className="w-3 h-3" /> Add tier
          </button>
        </div>
        {(list.cancellationTiers || []).map((t, i) => (
          <div key={i} className="grid grid-cols-1 md:grid-cols-12 gap-2 mb-1.5">
            <div className="md:col-span-3">
              <label className={label}>Days before arrival</label>
              <input type="number" value={t.daysBefore} onChange={e => updateTier(i, { daysBefore: parseInt(e.target.value) || 0 })} className={input} />
            </div>
            <div className="md:col-span-2">
              <label className={label}>Penalty %</label>
              <input type="number" value={t.penaltyPct} onChange={e => updateTier(i, { penaltyPct: parseInt(e.target.value) || 0 })} className={input} />
            </div>
            <div className="md:col-span-6">
              <label className={label}>Notes</label>
              <input type="text" value={t.notes || ''} onChange={e => updateTier(i, { notes: e.target.value })} className={input} />
            </div>
            <div className="md:col-span-1 flex items-end justify-end">
              <button type="button" onClick={() => removeTier(i)} className="p-1.5 rounded hover:bg-red-50 text-muted-foreground hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          </div>
        ))}
      </div>

      <div>
        <label className={label}>Booking Terms (free text)</label>
        <textarea rows={3} value={list.bookingTerms || ''} onChange={e => update({ bookingTerms: e.target.value })} className={`${input} resize-none`} placeholder="Contract terms, hold periods, special conditions..." />
      </div>

      <div>
        <label className={label}>Internal Notes</label>
        <textarea rows={2} value={list.notes || ''} onChange={e => update({ notes: e.target.value })} className={`${input} resize-none`} placeholder="Only visible to your team" />
      </div>
    </div>
  );
}
