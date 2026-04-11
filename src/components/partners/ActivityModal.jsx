import { useState } from 'react';
import Modal from '../shared/Modal';
import api from '../../utils/api';
import toast from 'react-hot-toast';

export default function ActivityModal({ item, onClose, onSaved }) {
  const isEdit = !!item?._id;
  const [form, setForm] = useState({
    name: item?.name || '',
    destination: item?.destination || '',
    description: item?.description || '',
    duration: item?.duration || 0,
    pricingModel: item?.pricingModel || 'per_person',
    season: item?.season || 'all',
    costPerPerson: item?.costPerPerson || 0,
    groupRate: item?.groupRate || 0,
    maxGroupSize: item?.maxGroupSize || 0,
    commissionRate: item?.commissionRate || 0,
    minimumAge: item?.minimumAge || 0,
    tags: item?.tags?.join(', ') || '',
    currency: item?.currency || 'KES',
    notes: item?.notes || '',
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.destination) { toast.error('Name and destination required'); return; }
    setSaving(true);
    try {
      const payload = {
        ...form,
        duration: parseFloat(form.duration) || 0,
        costPerPerson: parseFloat(form.costPerPerson) || 0,
        groupRate: parseFloat(form.groupRate) || 0,
        maxGroupSize: parseInt(form.maxGroupSize) || 0,
        commissionRate: parseFloat(form.commissionRate) || 0,
        minimumAge: parseInt(form.minimumAge) || 0,
        tags: form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
      };
      if (isEdit) {
        await api.put(`/partners/activities/${item._id}`, payload);
        toast.success('Updated');
      } else {
        await api.post('/partners/activities', payload);
        toast.success('Added');
      }
      onSaved();
      onClose();
    } catch (err) {
      toast.error('Save failed');
    } finally {
      setSaving(false);
    }
  };

  const inputCls = 'w-full px-3 py-2 rounded-lg bg-background border border-border text-sm text-foreground focus:outline-none focus:border-primary transition-colors';

  return (
    <Modal title={isEdit ? 'Edit Activity' : 'Add Activity'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Name *</label>
          <input type="text" value={form.name} onChange={e => setForm({...form, name: e.target.value})} className={inputCls} placeholder="Hot Air Balloon Safari" required />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Destination *</label>
            <input type="text" value={form.destination} onChange={e => setForm({...form, destination: e.target.value})} className={inputCls} placeholder="Maasai Mara" required />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Duration (hours)</label>
            <input type="number" step="0.5" value={form.duration} onChange={e => setForm({...form, duration: e.target.value})} className={inputCls} />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Description</label>
          <textarea rows={2} value={form.description} onChange={e => setForm({...form, description: e.target.value})} className={`${inputCls} resize-none`} />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Cost/Person</label>
            <input type="number" value={form.costPerPerson} onChange={e => setForm({...form, costPerPerson: e.target.value})} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Group Rate</label>
            <input type="number" value={form.groupRate} onChange={e => setForm({...form, groupRate: e.target.value})} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Currency</label>
            <select value={form.currency} onChange={e => setForm({...form, currency: e.target.value})} className={inputCls}>
              {['KES','USD','EUR','GBP'].map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Pricing</label>
            <select value={form.pricingModel} onChange={e => setForm({...form, pricingModel: e.target.value})} className={inputCls}>
              {['per_person','per_group','flat'].map(p => <option key={p} value={p}>{p.replace('_','/')}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Commission %</label>
            <input type="number" value={form.commissionRate} onChange={e => setForm({...form, commissionRate: e.target.value})} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Min Age</label>
            <input type="number" value={form.minimumAge} onChange={e => setForm({...form, minimumAge: e.target.value})} className={inputCls} />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Tags (comma separated)</label>
          <input type="text" value={form.tags} onChange={e => setForm({...form, tags: e.target.value})} className={inputCls} placeholder="adventure, safari" />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:bg-muted">Cancel</button>
          <button type="submit" disabled={saving} className="px-5 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary disabled:opacity-50">
            {saving ? 'Saving...' : isEdit ? 'Update' : 'Add Activity'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
