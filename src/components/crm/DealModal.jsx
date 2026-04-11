import { useState } from 'react';
import Modal from '../shared/Modal';
import PhoneInput from '../shared/PhoneInput';
import api from '../../utils/api';
import toast from 'react-hot-toast';

const TRIP_TYPES = [
  { value: '', label: 'Not specified' },
  { value: 'safari', label: 'Safari' },
  { value: 'beach', label: 'Beach Holiday' },
  { value: 'honeymoon', label: 'Honeymoon' },
  { value: 'family', label: 'Family Trip' },
  { value: 'corporate', label: 'Corporate / Group' },
  { value: 'adventure', label: 'Adventure' },
  { value: 'cultural', label: 'Cultural' },
  { value: 'mixed', label: 'Mixed (Safari + Beach)' },
];

const LEAD_SOURCES = [
  { value: '', label: 'Not specified' },
  { value: 'website', label: 'Website' },
  { value: 'referral', label: 'Referral' },
  { value: 'repeat', label: 'Repeat Client' },
  { value: 'travel_agent', label: 'Travel Agent' },
  { value: 'social', label: 'Social Media' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone Call' },
  { value: 'walk_in', label: 'Walk-in' },
  { value: 'other', label: 'Other' },
];

const INTEREST_OPTIONS = ['Safari', 'Beach', 'Culture', 'Adventure', 'Wildlife', 'Photography', 'Birding', 'Hiking', 'Diving', 'Relaxation'];

export default function DealModal({ deal, pipelines, contacts, team, onClose, onSaved }) {
  const isEdit = !!deal?._id;
  const defaultPipeline = pipelines?.find(p => p.isDefault) || pipelines?.[0];

  const [form, setForm] = useState({
    title: deal?.title || '',
    contact: deal?.contact?._id || deal?.contact || '',
    assignedTo: deal?.assignedTo?._id || deal?.assignedTo || '',
    pipeline: deal?.pipeline?._id || deal?.pipeline || defaultPipeline?._id || '',
    stage: deal?.stage || defaultPipeline?.stages?.[0]?.name || '',
    // Trip details
    destination: deal?.destination || '',
    arrivalCity: deal?.arrivalCity || '',
    tripType: deal?.tripType || '',
    tripDuration: deal?.tripDuration || '',
    groupSize: deal?.groupSize || '',
    budget: deal?.budget || '',
    budgetCurrency: deal?.budgetCurrency || 'USD',
    startDate: deal?.travelDates?.start?.split('T')[0] || '',
    endDate: deal?.travelDates?.end?.split('T')[0] || '',
    interests: deal?.interests || [],
    specialRequests: deal?.specialRequests || '',
    // Sales
    leadSource: deal?.leadSource || '',
    expectedCloseDate: deal?.expectedCloseDate?.split('T')[0] || '',
    value: deal?.value || '',
  });
  const [saving, setSaving] = useState(false);

  const selectedPipeline = pipelines?.find(p => p._id === form.pipeline);

  const toggleInterest = (interest) => {
    const lower = interest.toLowerCase();
    setForm(prev => ({
      ...prev,
      interests: prev.interests.includes(lower)
        ? prev.interests.filter(i => i !== lower)
        : [...prev.interests, lower],
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) { toast.error('Title is required'); return; }
    setSaving(true);
    try {
      const payload = {
        title: form.title,
        contact: form.contact || undefined,
        assignedTo: form.assignedTo || undefined,
        pipeline: form.pipeline,
        stage: form.stage,
        destination: form.destination,
        arrivalCity: form.arrivalCity,
        tripType: form.tripType,
        tripDuration: parseInt(form.tripDuration) || 0,
        groupSize: parseInt(form.groupSize) || 0,
        budget: parseFloat(form.budget) || 0,
        budgetCurrency: form.budgetCurrency,
        travelDates: {
          start: form.startDate || null,
          end: form.endDate || null,
        },
        interests: form.interests,
        specialRequests: form.specialRequests,
        leadSource: form.leadSource,
        expectedCloseDate: form.expectedCloseDate || null,
        value: parseFloat(form.value) || 0,
      };
      if (isEdit) {
        await api.put(`/crm/deals/${deal._id}`, payload);
        toast.success('Deal updated');
      } else {
        await api.post('/crm/deals', payload);
        toast.success('Deal created');
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
    <Modal title={isEdit ? 'Edit Deal' : 'New Deal'} onClose={onClose} wide>
      <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
        {/* Title + Assignment */}
        <div>
          <label className={labelCls}>Deal Title *</label>
          <input type="text" value={form.title} onChange={e => setForm({...form, title: e.target.value})} className={inputCls} placeholder="e.g. Russo Family — 10 Day Kenya Safari" required />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className={labelCls}>Contact</label>
            <select value={form.contact} onChange={e => setForm({...form, contact: e.target.value})} className={inputCls}>
              <option value="">No contact</option>
              {contacts?.map(c => <option key={c._id} value={c._id}>{c.firstName} {c.lastName}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Assigned To</label>
            <select value={form.assignedTo} onChange={e => setForm({...form, assignedTo: e.target.value})} className={inputCls}>
              <option value="">Unassigned</option>
              {team?.map(m => <option key={m._id} value={m._id}>{m.name}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Lead Source</label>
            <select value={form.leadSource} onChange={e => setForm({...form, leadSource: e.target.value})} className={inputCls}>
              {LEAD_SOURCES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
        </div>

        {/* Pipeline + Stage */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Pipeline</label>
            <select value={form.pipeline} onChange={e => {
              const pl = pipelines?.find(p => p._id === e.target.value);
              setForm({...form, pipeline: e.target.value, stage: pl?.stages?.[0]?.name || ''});
            }} className={inputCls}>
              {pipelines?.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Stage</label>
            <select value={form.stage} onChange={e => setForm({...form, stage: e.target.value})} className={inputCls}>
              {selectedPipeline?.stages?.sort((a,b) => a.order - b.order).map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
            </select>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-border pt-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Trip Details</p>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className={labelCls}>Trip Type</label>
            <select value={form.tripType} onChange={e => setForm({...form, tripType: e.target.value})} className={inputCls}>
              {TRIP_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Destination(s)</label>
            <input type="text" value={form.destination} onChange={e => setForm({...form, destination: e.target.value})} className={inputCls} placeholder="Maasai Mara, Diani" />
          </div>
          <div>
            <label className={labelCls}>Arrival City</label>
            <input type="text" value={form.arrivalCity} onChange={e => setForm({...form, arrivalCity: e.target.value})} className={inputCls} placeholder="Nairobi" />
          </div>
        </div>

        <div className="grid grid-cols-4 gap-3">
          <div>
            <label className={labelCls}>Duration (nights)</label>
            <input type="number" min={0} value={form.tripDuration} onChange={e => setForm({...form, tripDuration: e.target.value})} className={inputCls} placeholder="10" />
          </div>
          <div>
            <label className={labelCls}>Group Size</label>
            <input type="number" min={1} value={form.groupSize} onChange={e => setForm({...form, groupSize: e.target.value})} className={inputCls} placeholder="4" />
          </div>
          <div>
            <label className={labelCls}>Start Date</label>
            <input type="date" value={form.startDate} onChange={e => setForm({...form, startDate: e.target.value})} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>End Date</label>
            <input type="date" value={form.endDate} onChange={e => setForm({...form, endDate: e.target.value})} className={inputCls} />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className={labelCls}>Budget</label>
            <input type="number" min={0} value={form.budget} onChange={e => setForm({...form, budget: e.target.value})} className={inputCls} placeholder="5000" />
          </div>
          <div>
            <label className={labelCls}>Currency</label>
            <select value={form.budgetCurrency} onChange={e => setForm({...form, budgetCurrency: e.target.value})} className={inputCls}>
              <option value="USD">USD</option><option value="EUR">EUR</option><option value="GBP">GBP</option><option value="KES">KES</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Deal Value</label>
            <input type="number" min={0} value={form.value} onChange={e => setForm({...form, value: e.target.value})} className={inputCls} placeholder="Expected revenue" />
          </div>
        </div>

        {/* Interests */}
        <div>
          <label className={labelCls}>Interests</label>
          <div className="flex flex-wrap gap-1.5">
            {INTEREST_OPTIONS.map(interest => {
              const active = form.interests.includes(interest.toLowerCase());
              return (
                <button
                  key={interest}
                  type="button"
                  onClick={() => toggleInterest(interest)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                    active ? 'bg-primary text-white' : 'bg-muted text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {interest}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label className={labelCls}>Special Requests</label>
          <textarea rows={2} value={form.specialRequests} onChange={e => setForm({...form, specialRequests: e.target.value})} className={`${inputCls} resize-none`} placeholder="Wheelchair access, dietary needs, celebrations..." />
        </div>

        <div>
          <label className={labelCls}>Expected Close Date</label>
          <input type="date" value={form.expectedCloseDate} onChange={e => setForm({...form, expectedCloseDate: e.target.value})} className={`${inputCls} w-48`} />
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-border">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:bg-muted">Cancel</button>
          <button type="submit" disabled={saving} className="px-5 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary disabled:opacity-50">
            {saving ? 'Saving...' : isEdit ? 'Update Deal' : 'Create Deal'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
