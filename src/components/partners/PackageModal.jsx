import { useState } from 'react';
import Modal from '../shared/Modal';
import ImageGallery from '../shared/ImageGallery';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import { Plus, Trash2, ChevronDown, ChevronUp, Copy } from 'lucide-react';

const CURRENCIES = ['USD', 'EUR', 'GBP', 'KES', 'TZS', 'UGX'];
const AUDIENCE_TAGS = ['retail', 'contract', 'resident'];
const MEAL_PLANS = [
  { code: 'RO', label: 'Room Only' },
  { code: 'BB', label: 'Bed & Breakfast' },
  { code: 'HB', label: 'Half Board' },
  { code: 'FB', label: 'Full Board' },
  { code: 'AI', label: 'All Inclusive' },
];

const inputCls = 'w-full px-3 py-2 rounded-lg bg-background border border-border text-sm text-foreground focus:outline-none focus:border-primary transition-colors';
const smallInput = 'w-full px-2.5 py-1.5 rounded-md border border-border bg-background text-xs text-foreground focus:outline-none focus:border-primary transition-colors';
const labelCls = 'block text-xs font-medium text-muted-foreground mb-1';
const smallLabel = 'block text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1';

function toDateInput(d) {
  if (!d) return '';
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? '' : dt.toISOString().slice(0, 10);
}

function emptyPricingList(name = 'Rack 2026') {
  return {
    name,
    audience: ['retail'],
    currency: 'USD',
    validFrom: '',
    validTo: '',
    priority: 0,
    seasonLabel: '',
    paxTiers: [{ minPax: 1, maxPax: 2, pricePerPerson: 0 }],
    singleSupplement: 0,
    childBrackets: [],
    mealPlan: 'FB',
    mealPlanLabel: 'Full Board',
    inclusions: [],
    exclusions: [],
    notes: '',
    isActive: true,
  };
}

export default function PackageModal({ item, onClose, onSaved }) {
  const isEdit = !!item?._id;
  const [images, setImages] = useState(item?.images || []);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(() => {
    // Migrate legacy item.pricing (single) → pricingLists[] on first open.
    const legacy = item?.pricing && !item?.pricingLists?.length ? [{
      ...emptyPricingList(),
      ...item.pricing,
      validFrom: toDateInput(item.pricing.validFrom),
      validTo: toDateInput(item.pricing.validTo),
      paxTiers: item.pricing.paxTiers?.length ? item.pricing.paxTiers : [{ minPax: 1, maxPax: 2, pricePerPerson: 0 }],
    }] : null;

    return {
      name: item?.name || '',
      destination: item?.destination || '',
      description: item?.description || '',
      durationDays: item?.durationDays || 0,
      durationNights: item?.durationNights || 0,
      tags: item?.tags?.join(', ') || '',
      notes: item?.notes || '',
      segments: item?.segments?.length ? item.segments.map(s => ({ ...s })) : [{ startDay: 1, endDay: 1, location: '', hotelName: '', notes: '' }],
      pricingLists: item?.pricingLists?.length
        ? item.pricingLists.map(l => ({
            ...l,
            validFrom: toDateInput(l.validFrom),
            validTo: toDateInput(l.validTo),
          }))
        : (legacy || []),
      cancellationTiers: item?.cancellationTiers || [],
      depositPct: item?.depositPct || 30,
      bookingTerms: item?.bookingTerms || '',
    };
  });

  const updateList = (i, patch) => setForm(f => ({
    ...f,
    pricingLists: f.pricingLists.map((l, idx) => idx === i ? { ...l, ...patch } : l),
  }));
  const addList = () => setForm(f => ({ ...f, pricingLists: [...f.pricingLists, emptyPricingList()] }));
  const removeList = (i) => setForm(f => ({ ...f, pricingLists: f.pricingLists.filter((_, idx) => idx !== i) }));
  const duplicateList = (i) => {
    const copy = JSON.parse(JSON.stringify(form.pricingLists[i]));
    copy.name = copy.name + ' (copy)';
    setForm(f => ({ ...f, pricingLists: [...f.pricingLists, copy] }));
  };

  const addSegment = () => {
    const last = form.segments[form.segments.length - 1];
    const startDay = (last?.endDay || 0) + 1 || 1;
    setForm({ ...form, segments: [...form.segments, { startDay, endDay: startDay, location: '', hotelName: '', notes: '' }] });
  };
  const removeSegment = (i) => setForm({ ...form, segments: form.segments.filter((_, idx) => idx !== i) });
  const updateSegment = (i, patch) => setForm({
    ...form, segments: form.segments.map((s, idx) => idx === i ? { ...s, ...patch } : s),
  });

  const updateCancTier = (i, patch) => setForm(f => ({
    ...f,
    cancellationTiers: f.cancellationTiers.map((t, idx) => idx === i ? { ...t, ...patch } : t),
  }));
  const addCancTier = () => setForm(f => ({ ...f, cancellationTiers: [...(f.cancellationTiers || []), { daysBefore: 30, penaltyPct: 50, notes: '' }] }));
  const removeCancTier = (i) => setForm(f => ({ ...f, cancellationTiers: f.cancellationTiers.filter((_, idx) => idx !== i) }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name) { toast.error('Name is required'); return; }
    setSaving(true);
    try {
      const toDateOrNull = (v) => v ? new Date(v) : null;
      const payload = {
        ...form,
        tags: form.tags ? form.tags.split(',').map(s => s.trim()).filter(Boolean) : [],
        durationDays: Number(form.durationDays) || 0,
        durationNights: Number(form.durationNights) || 0,
        depositPct: Number(form.depositPct) || 0,
        segments: form.segments.map(s => ({
          startDay: Number(s.startDay) || 1,
          endDay: Number(s.endDay) || 1,
          location: s.location || '',
          hotel: s.hotel || null,
          hotelName: s.hotelName || '',
          notes: s.notes || '',
        })),
        pricingLists: form.pricingLists.map(l => ({
          ...l,
          validFrom: toDateOrNull(l.validFrom),
          validTo: toDateOrNull(l.validTo),
          priority: Number(l.priority) || 0,
          singleSupplement: Number(l.singleSupplement) || 0,
          paxTiers: (l.paxTiers || []).map(t => ({
            minPax: Number(t.minPax) || 1,
            maxPax: Number(t.maxPax) || 99,
            pricePerPerson: Number(t.pricePerPerson) || 0,
          })),
          childBrackets: (l.childBrackets || []).map(b => ({
            ...b,
            minAge: Number(b.minAge) || 0,
            maxAge: Number(b.maxAge) || 17,
            value: Number(b.value) || 0,
          })),
          inclusions: Array.isArray(l.inclusions) ? l.inclusions.filter(Boolean) : [],
          exclusions: Array.isArray(l.exclusions) ? l.exclusions.filter(Boolean) : [],
        })),
        cancellationTiers: (form.cancellationTiers || []).map(t => ({
          daysBefore: Number(t.daysBefore) || 0,
          penaltyPct: Number(t.penaltyPct) || 0,
          notes: t.notes || '',
        })),
      };
      if (isEdit) {
        await api.put(`/partners/packages/${item._id}`, payload);
        toast.success('Package updated');
      } else {
        await api.post('/partners/packages', payload);
        toast.success('Package added');
      }
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={isEdit ? 'Edit Package' : 'Add Package'} onClose={onClose} xwide persistent>
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* ─── Basics ─────────────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Package Name *</label>
            <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className={inputCls} placeholder="Through the Rift" required />
          </div>
          <div>
            <label className={labelCls}>Destination / Region</label>
            <input type="text" value={form.destination} onChange={e => setForm({ ...form, destination: e.target.value })} className={inputCls} placeholder="Loita Hills" />
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className={labelCls}>Duration (days)</label>
            <input type="number" value={form.durationDays} onChange={e => setForm({ ...form, durationDays: e.target.value })} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Duration (nights)</label>
            <input type="number" value={form.durationNights} onChange={e => setForm({ ...form, durationNights: e.target.value })} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Deposit %</label>
            <input type="number" value={form.depositPct} onChange={e => setForm({ ...form, depositPct: e.target.value })} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Tags</label>
            <input type="text" value={form.tags} onChange={e => setForm({ ...form, tags: e.target.value })} className={inputCls} placeholder="walking, migration" />
          </div>
        </div>

        <div>
          <label className={labelCls}>Description</label>
          <textarea rows={2} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className={`${inputCls} resize-none`} />
        </div>

        {/* ─── Segments ─────────────────────────────────────────── */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-foreground">Trail Segments ({form.segments.length})</span>
            <button type="button" onClick={addSegment} className="text-xs text-primary hover:underline inline-flex items-center gap-1">
              <Plus className="w-3 h-3" /> Add segment
            </button>
          </div>
          <div className="space-y-2">
            {form.segments.map((s, i) => (
              <div key={i} className="grid grid-cols-2 md:grid-cols-12 gap-2 items-end p-2 rounded border border-border bg-background">
                <div className="md:col-span-1">
                  <label className={smallLabel}>Day From</label>
                  <input type="number" value={s.startDay} onChange={e => updateSegment(i, { startDay: e.target.value })} className={smallInput} />
                </div>
                <div className="md:col-span-1">
                  <label className={smallLabel}>Day To</label>
                  <input type="number" value={s.endDay} onChange={e => updateSegment(i, { endDay: e.target.value })} className={smallInput} />
                </div>
                <div className="md:col-span-3">
                  <label className={smallLabel}>Location</label>
                  <input type="text" value={s.location} onChange={e => updateSegment(i, { location: e.target.value })} className={smallInput} placeholder="Oltyiani" />
                </div>
                <div className="md:col-span-3">
                  <label className={smallLabel}>Hotel / Camp</label>
                  <input type="text" value={s.hotelName} onChange={e => updateSegment(i, { hotelName: e.target.value })} className={smallInput} placeholder="Oltyiani Camp" />
                </div>
                <div className="md:col-span-3">
                  <label className={smallLabel}>Notes</label>
                  <input type="text" value={s.notes} onChange={e => updateSegment(i, { notes: e.target.value })} className={smallInput} />
                </div>
                <div className="md:col-span-1 flex justify-end">
                  <button type="button" onClick={() => removeSegment(i)} disabled={form.segments.length <= 1} className="p-1.5 rounded hover:bg-red-50 text-muted-foreground hover:text-red-500 disabled:opacity-30">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ─── Pricing Lists ─────────────────────────────────────── */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div>
              <span className="text-xs font-semibold text-foreground">Pricing Lists ({form.pricingLists.length})</span>
              <p className="text-[10px] text-muted-foreground/80">One per audience + season (Rack / STO / Resident). Resolver picks by clientType + trip dates.</p>
            </div>
            <button type="button" onClick={addList} className="text-xs text-primary hover:underline inline-flex items-center gap-1">
              <Plus className="w-3 h-3" /> Add pricing list
            </button>
          </div>
          {form.pricingLists.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-6 text-center">
              <p className="text-xs text-muted-foreground mb-2">No pricing lists yet.</p>
              <button type="button" onClick={addList} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-white text-xs font-medium hover:bg-primary transition-colors">
                <Plus className="w-3.5 h-3.5" /> Add Pricing List
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {form.pricingLists.map((list, i) => (
                <PricingListEditor
                  key={i}
                  list={list}
                  defaultOpen={i === 0}
                  onChange={(patch) => updateList(i, patch)}
                  onRemove={() => removeList(i)}
                  onDuplicate={() => duplicateList(i)}
                />
              ))}
            </div>
          )}
        </div>

        {/* ─── Cancellation / Booking Terms ───────────────────────── */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-semibold text-foreground">Cancellation Tiers ({(form.cancellationTiers || []).length})</span>
            <button type="button" onClick={addCancTier} className="text-xs text-primary hover:underline inline-flex items-center gap-1">
              <Plus className="w-3 h-3" /> Add tier
            </button>
          </div>
          {(form.cancellationTiers || []).map((t, i) => (
            <div key={i} className="grid grid-cols-1 md:grid-cols-12 gap-2 mb-1.5">
              <div className="md:col-span-3">
                <label className={smallLabel}>Days before</label>
                <input type="number" value={t.daysBefore} onChange={e => updateCancTier(i, { daysBefore: e.target.value })} className={smallInput} />
              </div>
              <div className="md:col-span-2">
                <label className={smallLabel}>Penalty %</label>
                <input type="number" value={t.penaltyPct} onChange={e => updateCancTier(i, { penaltyPct: e.target.value })} className={smallInput} />
              </div>
              <div className="md:col-span-6">
                <label className={smallLabel}>Notes</label>
                <input type="text" value={t.notes || ''} onChange={e => updateCancTier(i, { notes: e.target.value })} className={smallInput} />
              </div>
              <div className="md:col-span-1 flex items-end justify-end">
                <button type="button" onClick={() => removeCancTier(i)} className="p-1.5 rounded hover:bg-red-50 text-muted-foreground hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            </div>
          ))}
        </div>

        <div>
          <label className={labelCls}>Booking Terms</label>
          <textarea rows={2} value={form.bookingTerms} onChange={e => setForm({ ...form, bookingTerms: e.target.value })} className={`${inputCls} resize-none`} />
        </div>

        {isEdit && (
          <ImageGallery
            entityType="package"
            entityId={item._id}
            images={images}
            onUpdated={async () => {
              try {
                const { data } = await api.get(`/partners/packages/${item._id}`);
                setImages(data.images || []);
              } catch { /* silent */ }
              onSaved();
            }}
          />
        )}

        <div className="flex justify-end gap-2 pt-2 border-t border-border">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:bg-muted transition-colors">Cancel</button>
          <button type="submit" disabled={saving} className="px-5 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary transition-colors disabled:opacity-50">
            {saving ? 'Saving...' : isEdit ? 'Update Package' : 'Add Package'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ─── One pricing list editor (audience, tiers, children, inclusions) ──────────
function PricingListEditor({ list, defaultOpen, onChange, onRemove, onDuplicate }) {
  const [open, setOpen] = useState(defaultOpen);

  const toggleAudience = (tag) => {
    const set = new Set(list.audience || []);
    if (set.has(tag)) set.delete(tag); else set.add(tag);
    onChange({ audience: Array.from(set) });
  };

  const updateTier = (i, patch) => onChange({
    paxTiers: list.paxTiers.map((t, idx) => idx === i ? { ...t, ...patch } : t),
  });
  const addTier = () => onChange({ paxTiers: [...(list.paxTiers || []), { minPax: 1, maxPax: 99, pricePerPerson: 0 }] });
  const removeTier = (i) => onChange({ paxTiers: list.paxTiers.filter((_, idx) => idx !== i) });

  const updateBracket = (i, patch) => onChange({
    childBrackets: list.childBrackets.map((b, idx) => idx === i ? { ...b, ...patch } : b),
  });
  const addBracket = () => onChange({
    childBrackets: [...(list.childBrackets || []), { label: '', minAge: 0, maxAge: 17, mode: 'pct', value: 50, sharingRule: 'sharing_with_adults' }],
  });
  const removeBracket = (i) => onChange({ childBrackets: list.childBrackets.filter((_, idx) => idx !== i) });

  return (
    <div className={`rounded-lg border ${list.isActive === false ? 'border-dashed border-border/60 bg-muted/30' : 'border-border bg-background'}`}>
      <div className="flex items-center gap-2 px-3 py-2">
        <button type="button" onClick={() => setOpen(!open)} className="p-1 rounded hover:bg-muted text-muted-foreground">
          {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
        <input
          type="text"
          value={list.name}
          onChange={e => onChange({ name: e.target.value })}
          placeholder="Pricing list name"
          className="flex-1 min-w-0 px-2 py-1 rounded-md border border-transparent hover:border-border focus:border-primary bg-transparent text-sm font-semibold text-foreground focus:outline-none"
        />
        <div className="flex items-center gap-1 shrink-0">
          {(list.audience || []).map(a => (
            <span key={a} className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-primary/10 text-primary uppercase">{a}</span>
          ))}
          <span className="px-1.5 py-0.5 rounded text-[10px] bg-muted text-muted-foreground">{list.currency}</span>
          {list.priority > 0 && <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-100 text-amber-700">P{list.priority}</span>}
          <button type="button" onClick={onDuplicate} title="Duplicate" className="p-1 rounded hover:bg-muted text-muted-foreground">
            <Copy className="w-3.5 h-3.5" />
          </button>
          <button type="button" onClick={onRemove} title="Remove" className="p-1 rounded hover:bg-red-50 text-muted-foreground hover:text-red-500">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-border px-3 py-3 space-y-3">
          {/* Meta */}
          <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
            <div>
              <label className={smallLabel}>Currency</label>
              <select value={list.currency} onChange={e => onChange({ currency: e.target.value })} className={smallInput}>
                {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className={smallLabel}>Meal Plan</label>
              <select
                value={list.mealPlan}
                onChange={e => {
                  const mp = MEAL_PLANS.find(m => m.code === e.target.value);
                  onChange({ mealPlan: e.target.value, mealPlanLabel: mp?.label || list.mealPlanLabel });
                }}
                className={smallInput}
              >
                {MEAL_PLANS.map(m => <option key={m.code} value={m.code}>{m.code}</option>)}
              </select>
            </div>
            <div>
              <label className={smallLabel}>Valid From</label>
              <input type="date" value={list.validFrom} onChange={e => onChange({ validFrom: e.target.value })} className={smallInput} />
            </div>
            <div>
              <label className={smallLabel}>Valid To</label>
              <input type="date" value={list.validTo} onChange={e => onChange({ validTo: e.target.value })} className={smallInput} />
            </div>
            <div>
              <label className={smallLabel}>Priority</label>
              <input type="number" value={list.priority} onChange={e => onChange({ priority: parseInt(e.target.value) || 0 })} className={smallInput} />
            </div>
            <div>
              <label className={smallLabel}>Single Supp</label>
              <input type="number" value={list.singleSupplement} onChange={e => onChange({ singleSupplement: parseFloat(e.target.value) || 0 })} className={smallInput} />
            </div>
          </div>

          <div>
            <label className={smallLabel}>Audience</label>
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
                <input type="checkbox" checked={list.isActive !== false} onChange={e => onChange({ isActive: e.target.checked })} />
                Active
              </label>
            </div>
          </div>

          {/* Pax tiers */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className={smallLabel}>Pax Tiers ({list.currency} per person)</span>
              <button type="button" onClick={addTier} className="text-[11px] text-primary hover:underline inline-flex items-center gap-1">
                <Plus className="w-3 h-3" /> Add tier
              </button>
            </div>
            <div className="space-y-1.5">
              {(list.paxTiers || []).map((t, i) => (
                <div key={i} className="grid grid-cols-4 gap-2 items-end">
                  <div>
                    <label className={smallLabel}>Min Pax</label>
                    <input type="number" value={t.minPax} onChange={e => updateTier(i, { minPax: e.target.value })} className={smallInput} />
                  </div>
                  <div>
                    <label className={smallLabel}>Max Pax</label>
                    <input type="number" value={t.maxPax} onChange={e => updateTier(i, { maxPax: e.target.value })} className={smallInput} />
                  </div>
                  <div>
                    <label className={smallLabel}>Price/Person</label>
                    <input type="number" value={t.pricePerPerson} onChange={e => updateTier(i, { pricePerPerson: e.target.value })} className={smallInput} />
                  </div>
                  <button type="button" onClick={() => removeTier(i)} disabled={list.paxTiers.length <= 1} className="p-1.5 rounded hover:bg-red-50 text-muted-foreground hover:text-red-500 disabled:opacity-30 justify-self-end">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Child brackets */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className={smallLabel}>Child Brackets ({(list.childBrackets || []).length})</span>
              <button type="button" onClick={addBracket} className="text-[11px] text-primary hover:underline inline-flex items-center gap-1">
                <Plus className="w-3 h-3" /> Add bracket
              </button>
            </div>
            {(list.childBrackets || []).map((b, i) => (
              <div key={i} className="grid grid-cols-6 gap-2 items-end mb-1.5">
                <div>
                  <label className={smallLabel}>Label</label>
                  <input type="text" value={b.label} onChange={e => updateBracket(i, { label: e.target.value })} className={smallInput} placeholder="0-3" />
                </div>
                <div>
                  <label className={smallLabel}>Min Age</label>
                  <input type="number" value={b.minAge} onChange={e => updateBracket(i, { minAge: e.target.value })} className={smallInput} />
                </div>
                <div>
                  <label className={smallLabel}>Max Age</label>
                  <input type="number" value={b.maxAge} onChange={e => updateBracket(i, { maxAge: e.target.value })} className={smallInput} />
                </div>
                <div>
                  <label className={smallLabel}>Mode</label>
                  <select value={b.mode} onChange={e => updateBracket(i, { mode: e.target.value })} className={smallInput}>
                    <option value="free">Free</option>
                    <option value="pct">% of adult</option>
                    <option value="flat">Flat</option>
                  </select>
                </div>
                <div>
                  <label className={smallLabel}>Value</label>
                  <input type="number" value={b.value} onChange={e => updateBracket(i, { value: e.target.value })} className={smallInput} disabled={b.mode === 'free'} />
                </div>
                <button type="button" onClick={() => removeBracket(i)} className="p-1.5 rounded hover:bg-red-50 text-muted-foreground hover:text-red-500 justify-self-end">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>

          {/* Inclusions / Exclusions */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className={smallLabel}>Inclusions (one per line)</label>
              <textarea
                rows={4}
                value={(list.inclusions || []).join('\n')}
                onChange={e => onChange({ inclusions: e.target.value.split('\n') })}
                className={`${smallInput} resize-none`}
              />
            </div>
            <div>
              <label className={smallLabel}>Exclusions (one per line)</label>
              <textarea
                rows={4}
                value={(list.exclusions || []).join('\n')}
                onChange={e => onChange({ exclusions: e.target.value.split('\n') })}
                className={`${smallInput} resize-none`}
              />
            </div>
          </div>

          <div>
            <label className={smallLabel}>Internal Notes</label>
            <input type="text" value={list.notes || ''} onChange={e => onChange({ notes: e.target.value })} className={smallInput} />
          </div>
        </div>
      )}
    </div>
  );
}
