import { useState } from 'react';
import Modal from '../shared/Modal';
import PhoneInput from '../shared/PhoneInput';
import api from '../../utils/api';
import toast from 'react-hot-toast';

export default function ContactModal({ contact, team, onClose, onSaved }) {
  const isEdit = !!contact?._id;
  const [form, setForm] = useState({
    firstName: contact?.firstName || '',
    lastName: contact?.lastName || '',
    email: contact?.email || '',
    phone: contact?.phone || '',
    company: contact?.company || '',
    position: contact?.position || '',
    country: contact?.country || '',
    assignedTo: contact?.assignedTo?._id || contact?.assignedTo || '',
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.firstName.trim()) { toast.error('First name is required'); return; }
    setSaving(true);
    try {
      const payload = { ...form, assignedTo: form.assignedTo || undefined };
      if (isEdit) {
        await api.put(`/crm/contacts/${contact._id}`, payload);
        toast.success('Contact updated');
      } else {
        await api.post('/crm/contacts', payload);
        toast.success('Contact added');
      }
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const inputCls = 'w-full px-3 py-2 rounded-lg bg-sand-50 border border-sand-200 text-sm text-slate-brand focus:outline-none focus:border-amber-brand transition-colors';

  return (
    <Modal title={isEdit ? 'Edit Contact' : 'Add Contact'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-sand-600 mb-1">First Name *</label>
            <input type="text" value={form.firstName} onChange={e => setForm({...form, firstName: e.target.value})} className={inputCls} required />
          </div>
          <div>
            <label className="block text-xs font-medium text-sand-600 mb-1">Last Name</label>
            <input type="text" value={form.lastName} onChange={e => setForm({...form, lastName: e.target.value})} className={inputCls} />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-sand-600 mb-1">Email</label>
          <input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} className={inputCls} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-sand-600 mb-1">Phone</label>
            <PhoneInput value={form.phone} onChange={(val) => setForm({...form, phone: val})} />
          </div>
          <div>
            <label className="block text-xs font-medium text-sand-600 mb-1">Country</label>
            <input type="text" value={form.country} onChange={e => setForm({...form, country: e.target.value})} className={inputCls} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-sand-600 mb-1">Company</label>
            <input type="text" value={form.company} onChange={e => setForm({...form, company: e.target.value})} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-sand-600 mb-1">Position</label>
            <input type="text" value={form.position} onChange={e => setForm({...form, position: e.target.value})} className={inputCls} />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-sand-600 mb-1">Assigned To</label>
          <select value={form.assignedTo} onChange={e => setForm({...form, assignedTo: e.target.value})} className={inputCls}>
            <option value="">Unassigned</option>
            {team?.map(m => <option key={m._id} value={m._id}>{m.name}</option>)}
          </select>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-sand-500 hover:bg-sand-100">Cancel</button>
          <button type="submit" disabled={saving} className="px-5 py-2 rounded-lg bg-amber-brand text-white text-sm font-medium hover:bg-amber-700 disabled:opacity-50">
            {saving ? 'Saving...' : isEdit ? 'Update' : 'Add Contact'}
          </button>
        </div>
      </form>
    </Modal>
  );
}