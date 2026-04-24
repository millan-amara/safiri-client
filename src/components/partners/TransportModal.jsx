import { useState } from 'react';
import Modal from '../shared/Modal';
import api from '../../utils/api';
import toast from 'react-hot-toast';

const TRANSPORT_TYPES = ['4x4', 'van', 'minibus', 'bus', 'flight', 'train', 'boat', 'helicopter', 'other'];
const PRICING_MODELS = ['per_day', 'per_trip', 'per_person', 'per_km'];
const SEASONS = ['all', 'low', 'mid', 'high', 'peak'];
const CURRENCIES = ['KES', 'USD', 'EUR', 'GBP', 'TZS', 'UGX', 'RWF', 'ZAR'];

export default function TransportModal({ item, onClose, onSaved }) {
  const isEdit = !!item?._id;
  const [form, setForm] = useState({
    name: item?.name || '',
    type: item?.type || '4x4',
    capacity: item?.capacity || 6,
    pricingModel: item?.pricingModel || 'per_day',
    season: item?.season || 'all',
    routeOrZone: item?.routeOrZone || '',
    rate: item?.rate || 0,
    currency: item?.currency || 'KES',
    fuelIncluded: item?.fuelIncluded ?? true,
    driverIncluded: item?.driverIncluded ?? true,
    destinations: item?.destinations?.join(', ') || '',
    notes: item?.notes || '',
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error('Name is required'); return; }
    if (!form.rate || Number(form.rate) <= 0) { toast.error('Rate is required'); return; }
    setSaving(true);
    try {
      const payload = {
        ...form,
        capacity: parseInt(form.capacity) || 1,
        rate: parseFloat(form.rate) || 0,
        destinations: form.destinations
          ? form.destinations.split(',').map(d => d.trim()).filter(Boolean)
          : [],
      };
      if (isEdit) {
        await api.put(`/partners/transport/${item._id}`, payload);
        toast.success('Transport updated');
      } else {
        await api.post('/partners/transport', payload);
        toast.success('Transport added');
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
  const labelCls = 'block text-xs font-medium text-muted-foreground mb-1';

  return (
    <Modal title={isEdit ? 'Edit Transport' : 'Add Transport'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className={labelCls}>Name *</label>
          <input
            type="text"
            value={form.name}
            onChange={e => setForm({ ...form, name: e.target.value })}
            className={inputCls}
            placeholder="e.g. Toyota Land Cruiser"
            required
          />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className={labelCls}>Type</label>
            <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} className={inputCls}>
              {TRANSPORT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Capacity (pax)</label>
            <input
              type="number"
              min="1"
              value={form.capacity}
              onChange={e => setForm({ ...form, capacity: e.target.value })}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Season</label>
            <select value={form.season} onChange={e => setForm({ ...form, season: e.target.value })} className={inputCls}>
              {SEASONS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className={labelCls}>Rate *</label>
            <input
              type="number"
              step="0.01"
              value={form.rate}
              onChange={e => setForm({ ...form, rate: e.target.value })}
              className={inputCls}
              required
            />
          </div>
          <div>
            <label className={labelCls}>Pricing</label>
            <select value={form.pricingModel} onChange={e => setForm({ ...form, pricingModel: e.target.value })} className={inputCls}>
              {PRICING_MODELS.map(p => <option key={p} value={p}>{p.replace('_', '/')}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Currency</label>
            <select value={form.currency} onChange={e => setForm({ ...form, currency: e.target.value })} className={inputCls}>
              {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className={labelCls}>Route or Zone</label>
          <input
            type="text"
            value={form.routeOrZone}
            onChange={e => setForm({ ...form, routeOrZone: e.target.value })}
            className={inputCls}
            placeholder="e.g. Nairobi to Maasai Mara"
          />
        </div>

        <div>
          <label className={labelCls}>Destinations served (comma separated)</label>
          <input
            type="text"
            value={form.destinations}
            onChange={e => setForm({ ...form, destinations: e.target.value })}
            className={inputCls}
            placeholder="Maasai Mara, Amboseli, Nakuru"
          />
        </div>

        <div className="flex items-center gap-4 pt-1">
          <label className="inline-flex items-center gap-2 text-sm text-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={form.fuelIncluded}
              onChange={e => setForm({ ...form, fuelIncluded: e.target.checked })}
              className="rounded border-border"
            />
            Fuel included
          </label>
          <label className="inline-flex items-center gap-2 text-sm text-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={form.driverIncluded}
              onChange={e => setForm({ ...form, driverIncluded: e.target.checked })}
              className="rounded border-border"
            />
            Driver included
          </label>
        </div>

        <div>
          <label className={labelCls}>Notes</label>
          <textarea
            rows={2}
            value={form.notes}
            onChange={e => setForm({ ...form, notes: e.target.value })}
            className={`${inputCls} resize-none`}
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:bg-muted">Cancel</button>
          <button type="submit" disabled={saving} className="px-5 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary disabled:opacity-50">
            {saving ? 'Saving...' : isEdit ? 'Update' : 'Add Transport'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
