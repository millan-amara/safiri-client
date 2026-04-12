import { useState } from 'react';
import Modal from '../shared/Modal';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';

const REMINDER_OPTIONS = [
  { value: '',    label: (orgDefault) => `Workspace default (${orgDefault}h before)` },
  { value: '0',   label: () => 'No reminder' },
  { value: '0.5', label: () => '30 minutes before' },
  { value: '1',   label: () => '1 hour before' },
  { value: '2',   label: () => '2 hours before' },
  { value: '4',   label: () => '4 hours before' },
  { value: '8',   label: () => '8 hours before' },
  { value: '24',  label: () => '1 day before' },
  { value: '48',  label: () => '2 days before' },
  { value: '72',  label: () => '3 days before' },
];

export default function TaskModal({ task, deals, team, onClose, onSaved }) {
  const isEdit = !!task?._id;
  const { organization } = useAuth();
  const orgDefaultHours = organization?.defaults?.taskReminderHours ?? 24;

  const [form, setForm] = useState({
    title: task?.title || '',
    description: task?.description || '',
    deal: task?.deal?._id || task?.deal || '',
    assignedTo: task?.assignedTo?._id || task?.assignedTo || '',
    dueDate: task?.dueDate ? task.dueDate.slice(0, 16) : '',
    priority: task?.priority || 'medium',
    status: task?.status || 'todo',
    reminderHours: task?.reminderHours != null ? String(task.reminderHours) : '',
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) { toast.error('Title is required'); return; }
    setSaving(true);
    try {
      const payload = {
        ...form,
        deal: form.deal || undefined,
        assignedTo: form.assignedTo || undefined,
        dueDate: form.dueDate || undefined,
        reminderHours: form.reminderHours === '' ? null : parseFloat(form.reminderHours),
      };
      if (isEdit) {
        await api.put(`/crm/tasks/${task._id}`, payload);
        toast.success('Task updated');
      } else {
        await api.post('/crm/tasks', payload);
        toast.success('Task created');
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
    <Modal title={isEdit ? 'Edit Task' : 'New Task'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Title *</label>
          <input type="text" value={form.title} onChange={e => setForm({...form, title: e.target.value})} className={inputCls} placeholder="e.g. Follow up with client" required />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Description</label>
          <textarea rows={2} value={form.description} onChange={e => setForm({...form, description: e.target.value})} className={`${inputCls} resize-none`} placeholder="Optional details..." />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Assigned To</label>
            <select value={form.assignedTo} onChange={e => setForm({...form, assignedTo: e.target.value})} className={inputCls}>
              <option value="">Unassigned</option>
              {team?.map(m => <option key={m._id} value={m._id}>{m.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Due Date & Time</label>
            <input type="datetime-local" value={form.dueDate} onChange={e => setForm({...form, dueDate: e.target.value})} className={inputCls} />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">WhatsApp Reminder</label>
          <select value={form.reminderHours} onChange={e => setForm({...form, reminderHours: e.target.value})} className={inputCls}>
            {REMINDER_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label(orgDefaultHours)}</option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Priority</label>
            <select value={form.priority} onChange={e => setForm({...form, priority: e.target.value})} className={inputCls}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Linked Deal</label>
            <select value={form.deal} onChange={e => setForm({...form, deal: e.target.value})} className={inputCls}>
              <option value="">No deal</option>
              {deals?.map(d => <option key={d._id} value={d._id}>{d.title}</option>)}
            </select>
          </div>
        </div>
        {isEdit && (
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Status</label>
            <select value={form.status} onChange={e => setForm({...form, status: e.target.value})} className={inputCls}>
              <option value="todo">To Do</option>
              <option value="in_progress">In Progress</option>
              <option value="done">Done</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:bg-muted">Cancel</button>
          <button type="submit" disabled={saving} className="px-5 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary disabled:opacity-50">
            {saving ? 'Saving...' : isEdit ? 'Update Task' : 'Create Task'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
