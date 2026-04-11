import { useState } from 'react';
import Modal from '../shared/Modal';
import ImageGallery from '../shared/ImageGallery';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import { Plus, Trash2 } from 'lucide-react';

const EMPTY_RATE = {
  roomType: 'Standard',
  maxOccupancy: 2,
  season: 'all',
  startMonth: 1,
  endMonth: 12,
  ratePerNight: 0,
  mealPlan: 'BB',
  childFreeAge: 3,
  childReducedAge: 12,
  childReducedPct: 50,
  minimumNights: 1,
};

export default function HotelModal({ hotel, onClose, onSaved }) {
  const isEdit = !!hotel?._id;
  const [images, setImages] = useState(hotel?.images || []);
  const [form, setForm] = useState({
    name: hotel?.name || '',
    destination: hotel?.destination || '',
    location: hotel?.location || '',
    stars: hotel?.stars || 3,
    type: hotel?.type || 'hotel',
    description: hotel?.description || '',
    currency: hotel?.currency || 'KES',
    tags: hotel?.tags?.join(', ') || '',
    notes: hotel?.notes || '',
    contactEmail: hotel?.contactEmail || '',
    contactPhone: hotel?.contactPhone || '',
    rates: hotel?.rates?.length ? hotel.rates : [{ ...EMPTY_RATE }],
  });
  const [saving, setSaving] = useState(false);

  const updateRate = (idx, field, value) => {
    const rates = [...form.rates];
    rates[idx] = { ...rates[idx], [field]: value };
    setForm({ ...form, rates });
  };

  const addRate = () => setForm({ ...form, rates: [...form.rates, { ...EMPTY_RATE }] });

  const removeRate = (idx) => {
    if (form.rates.length <= 1) return;
    setForm({ ...form, rates: form.rates.filter((_, i) => i !== idx) });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.destination) { toast.error('Name and destination are required'); return; }
    setSaving(true);
    try {
      const payload = {
        ...form,
        tags: form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
        rates: form.rates.map(r => ({
          ...r,
          maxOccupancy: parseInt(r.maxOccupancy) || 2,
          startMonth: parseInt(r.startMonth) || 1,
          endMonth: parseInt(r.endMonth) || 12,
          ratePerNight: parseFloat(r.ratePerNight) || 0,
          childFreeAge: parseInt(r.childFreeAge) || 3,
          childReducedAge: parseInt(r.childReducedAge) || 12,
          childReducedPct: parseInt(r.childReducedPct) || 50,
          minimumNights: parseInt(r.minimumNights) || 1,
        })),
      };

      if (isEdit) {
        await api.put(`/partners/hotels/${hotel._id}`, payload);
        toast.success('Hotel updated');
      } else {
        await api.post('/partners/hotels', payload);
        toast.success('Hotel added');
      }
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const inputCls = 'w-full px-3 py-2 rounded-lg bg-background border border-border text-sm text-foreground focus:outline-none focus:border-primary transition-colors';

  return (
    <Modal title={isEdit ? 'Edit Hotel' : 'Add Hotel'} onClose={onClose} wide>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Hotel Name *</label>
            <input type="text" value={form.name} onChange={e => setForm({...form, name: e.target.value})} className={inputCls} required />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Destination *</label>
            <input type="text" value={form.destination} onChange={e => setForm({...form, destination: e.target.value})} className={inputCls} placeholder="e.g. Maasai Mara" required />
          </div>
        </div>

        <div className="grid grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Location</label>
            <input type="text" value={form.location} onChange={e => setForm({...form, location: e.target.value})} className={inputCls} placeholder="e.g. Talek" />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Stars</label>
            <select value={form.stars} onChange={e => setForm({...form, stars: parseInt(e.target.value)})} className={inputCls}>
              {[1,2,3,4,5].map(s => <option key={s} value={s}>{s} Star</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Type</label>
            <select value={form.type} onChange={e => setForm({...form, type: e.target.value})} className={inputCls}>
              {['hotel','lodge','tented_camp','resort','villa','apartment','guesthouse'].map(t =>
                <option key={t} value={t}>{t.replace('_',' ')}</option>
              )}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Currency</label>
            <select value={form.currency} onChange={e => setForm({...form, currency: e.target.value})} className={inputCls}>
              {['KES','USD','EUR','GBP'].map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Description</label>
          <textarea rows={2} value={form.description} onChange={e => setForm({...form, description: e.target.value})} className={`${inputCls} resize-none`} />
        </div>

        {/* Rates */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-semibold text-foreground">Room Rates</label>
            <button type="button" onClick={addRate} className="text-xs text-primary hover:underline flex items-center gap-1">
              <Plus className="w-3 h-3" /> Add Rate
            </button>
          </div>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {form.rates.map((rate, i) => (
              <div key={i} className="grid grid-cols-6 gap-2 items-end p-2 rounded-lg bg-background border border-border">
                <div>
                  <label className="block text-[10px] text-muted-foreground">Room Type</label>
                  <input type="text" value={rate.roomType} onChange={e => updateRate(i, 'roomType', e.target.value)} className="w-full px-2 py-1 rounded border border-border text-xs bg-card" />
                </div>
                <div>
                  <label className="block text-[10px] text-muted-foreground">Season</label>
                  <select value={rate.season} onChange={e => updateRate(i, 'season', e.target.value)} className="w-full px-2 py-1 rounded border border-border text-xs bg-card">
                    {['all','low','mid','high','peak'].map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] text-muted-foreground">Rate/Night</label>
                  <input type="number" value={rate.ratePerNight} onChange={e => updateRate(i, 'ratePerNight', e.target.value)} className="w-full px-2 py-1 rounded border border-border text-xs bg-card" />
                </div>
                <div>
                  <label className="block text-[10px] text-muted-foreground">Meal Plan</label>
                  <select value={rate.mealPlan} onChange={e => updateRate(i, 'mealPlan', e.target.value)} className="w-full px-2 py-1 rounded border border-border text-xs bg-card">
                    {['RO','BB','HB','FB','AI'].map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] text-muted-foreground">Max Occ.</label>
                  <input type="number" min={1} value={rate.maxOccupancy} onChange={e => updateRate(i, 'maxOccupancy', e.target.value)} className="w-full px-2 py-1 rounded border border-border text-xs bg-card" />
                </div>
                <div className="flex justify-end">
                  <button type="button" onClick={() => removeRate(i)} disabled={form.rates.length <= 1} className="p-1 rounded hover:bg-red-50 text-muted-foreground/70 hover:text-red-500 disabled:opacity-30">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Tags (comma separated)</label>
            <input type="text" value={form.tags} onChange={e => setForm({...form, tags: e.target.value})} className={inputCls} placeholder="safari, luxury" />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Notes</label>
            <input type="text" value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} className={inputCls} />
          </div>
        </div>

        {/* Image Gallery */}
        {isEdit && (
          <ImageGallery
            entityType="hotel"
            entityId={hotel._id}
            images={images}
            onUpdated={async () => {
              try {
                const { data } = await api.get(`/partners/hotels/${hotel._id}`);
                setImages(data.images || []);
              } catch (err) { /* silent */ }
              onSaved();
            }}
          />
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:bg-muted transition-colors">Cancel</button>
          <button type="submit" disabled={saving} className="px-5 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary transition-colors disabled:opacity-50">
            {saving ? 'Saving...' : isEdit ? 'Update Hotel' : 'Add Hotel'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
