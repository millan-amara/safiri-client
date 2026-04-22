import { useState } from 'react';
import Modal from '../shared/Modal';
import ImageGallery from '../shared/ImageGallery';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import { Plus, Trash2 } from 'lucide-react';

const CURRENCIES = ['USD', 'EUR', 'GBP', 'KES', 'TZS', 'UGX'];
const AUDIENCE_TAGS = ['retail', 'contract', 'resident'];

const inputCls = 'w-full px-3 py-2 rounded-lg bg-background border border-border text-sm text-foreground focus:outline-none focus:border-primary transition-colors';
const labelCls = 'block text-xs font-medium text-muted-foreground mb-1';

function toDateInput(d) {
  if (!d) return '';
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? '' : dt.toISOString().slice(0, 10);
}

export default function PackageModal({ item, onClose, onSaved }) {
  const isEdit = !!item?._id;
  const [images, setImages] = useState(item?.images || []);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: item?.name || '',
    destination: item?.destination || '',
    description: item?.description || '',
    durationDays: item?.durationDays || 0,
    durationNights: item?.durationNights || 0,
    tags: item?.tags?.join(', ') || '',
    notes: item?.notes || '',
    segments: item?.segments?.length ? item.segments.map(s => ({ ...s })) : [{ startDay: 1, endDay: 1, location: '', hotelName: '', notes: '' }],
    pricing: item?.pricing ? {
      ...item.pricing,
      validFrom: toDateInput(item.pricing.validFrom),
      validTo: toDateInput(item.pricing.validTo),
      paxTiers: item.pricing.paxTiers?.length ? item.pricing.paxTiers : [{ minPax: 1, maxPax: 2, pricePerPerson: 0 }],
      childBrackets: item.pricing.childBrackets || [],
      inclusions: item.pricing.inclusions?.join('\n') || '',
      exclusions: item.pricing.exclusions?.join('\n') || '',
    } : {
      audience: ['retail'],
      currency: 'USD',
      validFrom: '',
      validTo: '',
      seasonLabel: '',
      paxTiers: [{ minPax: 1, maxPax: 2, pricePerPerson: 0 }],
      singleSupplement: 0,
      mealPlan: 'FB',
      mealPlanLabel: 'Full Board',
      childBrackets: [],
      inclusions: '',
      exclusions: '',
      notes: '',
    },
    cancellationTiers: item?.cancellationTiers || [],
    depositPct: item?.depositPct || 30,
    bookingTerms: item?.bookingTerms || '',
  });

  const updatePricing = (patch) => setForm({ ...form, pricing: { ...form.pricing, ...patch } });
  const addTier = () => updatePricing({ paxTiers: [...form.pricing.paxTiers, { minPax: 1, maxPax: 99, pricePerPerson: 0 }] });
  const removeTier = (i) => updatePricing({ paxTiers: form.pricing.paxTiers.filter((_, idx) => idx !== i) });
  const updateTier = (i, patch) => updatePricing({
    paxTiers: form.pricing.paxTiers.map((t, idx) => idx === i ? { ...t, ...patch } : t),
  });

  const addSegment = () => {
    const last = form.segments[form.segments.length - 1];
    const startDay = (last?.endDay || 0) + 1 || 1;
    setForm({ ...form, segments: [...form.segments, { startDay, endDay: startDay, location: '', hotelName: '', notes: '' }] });
  };
  const removeSegment = (i) => setForm({ ...form, segments: form.segments.filter((_, idx) => idx !== i) });
  const updateSegment = (i, patch) => setForm({
    ...form, segments: form.segments.map((s, idx) => idx === i ? { ...s, ...patch } : s),
  });

  const addChildBracket = () => updatePricing({
    childBrackets: [...form.pricing.childBrackets, { label: '', minAge: 0, maxAge: 17, mode: 'pct', value: 50, sharingRule: 'sharing_with_adults' }],
  });
  const removeChildBracket = (i) => updatePricing({
    childBrackets: form.pricing.childBrackets.filter((_, idx) => idx !== i),
  });
  const updateChildBracket = (i, patch) => updatePricing({
    childBrackets: form.pricing.childBrackets.map((b, idx) => idx === i ? { ...b, ...patch } : b),
  });

  const toggleAudience = (tag) => {
    const set = new Set(form.pricing.audience || []);
    if (set.has(tag)) set.delete(tag); else set.add(tag);
    updatePricing({ audience: Array.from(set) });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name) { toast.error('Name is required'); return; }
    setSaving(true);
    try {
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
        pricing: {
          ...form.pricing,
          validFrom: form.pricing.validFrom ? new Date(form.pricing.validFrom) : null,
          validTo: form.pricing.validTo ? new Date(form.pricing.validTo) : null,
          singleSupplement: Number(form.pricing.singleSupplement) || 0,
          paxTiers: form.pricing.paxTiers.map(t => ({
            minPax: Number(t.minPax) || 1,
            maxPax: Number(t.maxPax) || 99,
            pricePerPerson: Number(t.pricePerPerson) || 0,
          })),
          childBrackets: (form.pricing.childBrackets || []).map(b => ({
            ...b,
            minAge: Number(b.minAge) || 0,
            maxAge: Number(b.maxAge) || 17,
            value: Number(b.value) || 0,
          })),
          inclusions: form.pricing.inclusions ? form.pricing.inclusions.split('\n').map(s => s.trim()).filter(Boolean) : [],
          exclusions: form.pricing.exclusions ? form.pricing.exclusions.split('\n').map(s => s.trim()).filter(Boolean) : [],
        },
        cancellationTiers: form.cancellationTiers,
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
    <Modal title={isEdit ? 'Edit Package' : 'Add Package'} onClose={onClose} xwide>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Package Name *</label>
            <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className={inputCls} placeholder="Great Migration Trail" required />
          </div>
          <div>
            <label className={labelCls}>Destination / Region</label>
            <input type="text" value={form.destination} onChange={e => setForm({ ...form, destination: e.target.value })} className={inputCls} placeholder="Kenya + Tanzania" />
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
            <label className={labelCls}>Meal Plan</label>
            <input type="text" value={form.pricing.mealPlan} onChange={e => updatePricing({ mealPlan: e.target.value })} className={inputCls} placeholder="FB / AI / GAME_PACKAGE" />
          </div>
          <div>
            <label className={labelCls}>Currency</label>
            <select value={form.pricing.currency} onChange={e => updatePricing({ currency: e.target.value })} className={inputCls}>
              {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className={labelCls}>Description</label>
          <textarea rows={2} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className={`${inputCls} resize-none`} />
        </div>

        {/* Segments */}
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
                  <label className={labelCls}>Day From</label>
                  <input type="number" value={s.startDay} onChange={e => updateSegment(i, { startDay: e.target.value })} className={inputCls} />
                </div>
                <div className="md:col-span-1">
                  <label className={labelCls}>Day To</label>
                  <input type="number" value={s.endDay} onChange={e => updateSegment(i, { endDay: e.target.value })} className={inputCls} />
                </div>
                <div className="md:col-span-3">
                  <label className={labelCls}>Location</label>
                  <input type="text" value={s.location} onChange={e => updateSegment(i, { location: e.target.value })} className={inputCls} placeholder="Maasai Mara" />
                </div>
                <div className="md:col-span-3">
                  <label className={labelCls}>Hotel/Camp Name</label>
                  <input type="text" value={s.hotelName} onChange={e => updateSegment(i, { hotelName: e.target.value })} className={inputCls} placeholder="Rekero Camp" />
                </div>
                <div className="md:col-span-3">
                  <label className={labelCls}>Notes</label>
                  <input type="text" value={s.notes} onChange={e => updateSegment(i, { notes: e.target.value })} className={inputCls} />
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

        {/* Pricing */}
        <div className="rounded-lg border border-border p-3 space-y-3">
          <div className="text-xs font-semibold text-foreground">Pricing</div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <div>
              <label className={labelCls}>Valid From</label>
              <input type="date" value={form.pricing.validFrom} onChange={e => updatePricing({ validFrom: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Valid To</label>
              <input type="date" value={form.pricing.validTo} onChange={e => updatePricing({ validTo: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Season Label</label>
              <input type="text" value={form.pricing.seasonLabel} onChange={e => updatePricing({ seasonLabel: e.target.value })} className={inputCls} placeholder="High / Any" />
            </div>
            <div>
              <label className={labelCls}>Single Supplement</label>
              <input type="number" value={form.pricing.singleSupplement} onChange={e => updatePricing({ singleSupplement: e.target.value })} className={inputCls} />
            </div>
          </div>

          <div>
            <label className={labelCls}>Audience</label>
            <div className="flex flex-wrap gap-1.5">
              {AUDIENCE_TAGS.map(tag => {
                const on = (form.pricing.audience || []).includes(tag);
                return (
                  <button key={tag} type="button" onClick={() => toggleAudience(tag)}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium uppercase tracking-wide ${on ? 'bg-primary text-white' : 'bg-muted text-muted-foreground hover:bg-muted/70'}`}>
                    {tag}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Pax tiers */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-medium text-foreground">Pax-tier Pricing ({form.pricing.currency} / person)</span>
              <button type="button" onClick={addTier} className="text-xs text-primary hover:underline inline-flex items-center gap-1">
                <Plus className="w-3 h-3" /> Add tier
              </button>
            </div>
            <div className="space-y-1.5">
              {form.pricing.paxTiers.map((t, i) => (
                <div key={i} className="grid grid-cols-4 gap-2 items-end">
                  <div>
                    <label className={labelCls}>Min Pax</label>
                    <input type="number" value={t.minPax} onChange={e => updateTier(i, { minPax: e.target.value })} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Max Pax</label>
                    <input type="number" value={t.maxPax} onChange={e => updateTier(i, { maxPax: e.target.value })} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Price/Person</label>
                    <input type="number" value={t.pricePerPerson} onChange={e => updateTier(i, { pricePerPerson: e.target.value })} className={inputCls} />
                  </div>
                  <button type="button" onClick={() => removeTier(i)} disabled={form.pricing.paxTiers.length <= 1} className="p-1.5 rounded hover:bg-red-50 text-muted-foreground hover:text-red-500 disabled:opacity-30 justify-self-end">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Child brackets */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-medium text-foreground">Child Brackets ({form.pricing.childBrackets.length})</span>
              <button type="button" onClick={addChildBracket} className="text-xs text-primary hover:underline inline-flex items-center gap-1">
                <Plus className="w-3 h-3" /> Add bracket
              </button>
            </div>
            {form.pricing.childBrackets.map((b, i) => (
              <div key={i} className="grid grid-cols-6 gap-2 items-end mb-1.5">
                <div>
                  <label className={labelCls}>Label</label>
                  <input type="text" value={b.label} onChange={e => updateChildBracket(i, { label: e.target.value })} className={inputCls} placeholder="0-3" />
                </div>
                <div>
                  <label className={labelCls}>Min Age</label>
                  <input type="number" value={b.minAge} onChange={e => updateChildBracket(i, { minAge: e.target.value })} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Max Age</label>
                  <input type="number" value={b.maxAge} onChange={e => updateChildBracket(i, { maxAge: e.target.value })} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Mode</label>
                  <select value={b.mode} onChange={e => updateChildBracket(i, { mode: e.target.value })} className={inputCls}>
                    <option value="free">Free</option>
                    <option value="pct">% of adult</option>
                    <option value="flat">Flat</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Value</label>
                  <input type="number" value={b.value} onChange={e => updateChildBracket(i, { value: e.target.value })} className={inputCls} disabled={b.mode === 'free'} />
                </div>
                <button type="button" onClick={() => removeChildBracket(i)} className="p-1.5 rounded hover:bg-red-50 text-muted-foreground hover:text-red-500 justify-self-end">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Inclusions (one per line)</label>
              <textarea rows={3} value={form.pricing.inclusions} onChange={e => updatePricing({ inclusions: e.target.value })} className={`${inputCls} resize-none`} />
            </div>
            <div>
              <label className={labelCls}>Exclusions (one per line)</label>
              <textarea rows={3} value={form.pricing.exclusions} onChange={e => updatePricing({ exclusions: e.target.value })} className={`${inputCls} resize-none`} />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Deposit %</label>
            <input type="number" value={form.depositPct} onChange={e => setForm({ ...form, depositPct: e.target.value })} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Tags (comma separated)</label>
            <input type="text" value={form.tags} onChange={e => setForm({ ...form, tags: e.target.value })} className={inputCls} placeholder="migration, camping" />
          </div>
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
