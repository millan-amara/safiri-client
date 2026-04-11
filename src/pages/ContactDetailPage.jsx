import { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { formatCurrency, formatDate, getInitials } from '../utils/helpers';
import toast from 'react-hot-toast';
import PhoneInput from '../components/shared/PhoneInput';
import ConfirmDialog from '../components/shared/ConfirmDialog';
import {
  ArrowLeft, Mail, Phone, Globe, MapPin, Building, Tag,
  FileText, Upload, Trash2, Edit3, Save, X, Plus, ExternalLink,
} from 'lucide-react';

export default function ContactDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [contact, setContact] = useState(null);
  const [deals, setDeals] = useState([]);
  const [contactTasks, setContactTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const fileRef = useRef();

  const fetchContact = async () => {
    try {
      const { data } = await api.get(`/crm/contacts/${id}`);
      setContact(data.contact);
      setDeals(data.deals);
      setContactTasks(data.tasks || []);
      setForm({
        firstName: data.contact.firstName || '',
        lastName: data.contact.lastName || '',
        email: data.contact.email || '',
        phone: data.contact.phone || '',
        company: data.contact.company || '',
        position: data.contact.position || '',
        country: data.contact.country || '',
        notes: data.contact.notes || '',
        tags: data.contact.tags?.join(', ') || '',
        prefBudget: data.contact.preferences?.budget || '',
        prefInterests: data.contact.preferences?.interests?.join(', ') || '',
        prefGroupSize: data.contact.preferences?.groupSize || '',
        prefCurrency: data.contact.preferences?.preferredCurrency || '',
      });
    } catch {
      toast.error('Contact not found');
      navigate('/crm');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchContact(); }, [id]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put(`/crm/contacts/${id}`, {
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        phone: form.phone,
        company: form.company,
        position: form.position,
        country: form.country,
        notes: form.notes,
        tags: form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
        preferences: {
          budget: form.prefBudget || '',
          interests: form.prefInterests ? form.prefInterests.split(',').map(i => i.trim()).filter(Boolean) : [],
          groupSize: parseInt(form.prefGroupSize) || 0,
          preferredCurrency: form.prefCurrency || '',
        },
      });
      toast.success('Contact updated');
      setEditing(false);
      fetchContact();
    } catch {
      toast.error('Update failed');
    } finally {
      setSaving(false);
    }
  };

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  if (loading || !contact) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const inputCls = 'w-full px-3 py-2 rounded-lg bg-background border border-border text-sm text-foreground focus:outline-none focus:border-primary transition-colors';
  const fullName = `${contact.firstName} ${contact.lastName}`.trim();

  return (
    <div className="space-y-6 animate-fade-in">
      <Link to="/crm" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to CRM
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left — Contact Info */}
        <div className="space-y-4">
          <div className="bg-card rounded-xl border border-border p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-full bg-primary/10 text-primary flex items-center justify-center text-lg font-bold">
                  {getInitials(fullName)}
                </div>
                <div>
                  <h1 className="text-lg font-bold text-foreground">{fullName}</h1>
                  {contact.company && <p className="text-sm text-muted-foreground">{contact.position ? `${contact.position} at ` : ''}{contact.company}</p>}
                </div>
              </div>
              <button
                onClick={() => editing ? handleSave() : setEditing(true)}
                disabled={saving}
                className="text-xs text-primary hover:underline flex items-center gap-1"
              >
                {editing ? <><Save className="w-3 h-3" /> {saving ? 'Saving...' : 'Save'}</> : <><Edit3 className="w-3 h-3" /> Edit</>}
              </button>
            </div>

            {editing ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="block text-xs text-muted-foreground mb-1">First Name</label><input type="text" value={form.firstName} onChange={e => setForm({...form, firstName: e.target.value})} className={inputCls} /></div>
                  <div><label className="block text-xs text-muted-foreground mb-1">Last Name</label><input type="text" value={form.lastName} onChange={e => setForm({...form, lastName: e.target.value})} className={inputCls} /></div>
                </div>
                <div><label className="block text-xs text-muted-foreground mb-1">Email</label><input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} className={inputCls} /></div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Phone</label>
                  <PhoneInput value={form.phone} onChange={(val) => setForm({...form, phone: val})} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="block text-xs text-muted-foreground mb-1">Company</label><input type="text" value={form.company} onChange={e => setForm({...form, company: e.target.value})} className={inputCls} /></div>
                  <div><label className="block text-xs text-muted-foreground mb-1">Position</label><input type="text" value={form.position} onChange={e => setForm({...form, position: e.target.value})} className={inputCls} /></div>
                </div>
                <div><label className="block text-xs text-muted-foreground mb-1">Country</label><input type="text" value={form.country} onChange={e => setForm({...form, country: e.target.value})} className={inputCls} /></div>
                <div><label className="block text-xs text-muted-foreground mb-1">Tags</label><input type="text" value={form.tags} onChange={e => setForm({...form, tags: e.target.value})} className={inputCls} placeholder="VIP, repeat" /></div>
                <div><label className="block text-xs text-muted-foreground mb-1">Notes</label><textarea rows={3} value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} className={`${inputCls} resize-none`} /></div>

                {/* Preferences */}
                <div className="pt-2 border-t border-border">
                  <p className="text-xs font-semibold text-muted-foreground mb-2">Travel Preferences</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1">Budget Level</label>
                      <select value={form.prefBudget} onChange={e => setForm({...form, prefBudget: e.target.value})} className={inputCls}>
                        <option value="">Not set</option>
                        <option value="budget">Budget</option>
                        <option value="mid-range">Mid-range</option>
                        <option value="luxury">Luxury</option>
                        <option value="ultra-luxury">Ultra-luxury</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1">Typical Group Size</label>
                      <input type="number" value={form.prefGroupSize} onChange={e => setForm({...form, prefGroupSize: e.target.value})} className={inputCls} placeholder="e.g. 4" />
                    </div>
                  </div>
                  <div className="mt-2"><label className="block text-xs text-muted-foreground mb-1">Interests</label><input type="text" value={form.prefInterests} onChange={e => setForm({...form, prefInterests: e.target.value})} className={inputCls} placeholder="safari, beach, culture" /></div>
                  <div className="mt-2">
                    <label className="block text-xs text-muted-foreground mb-1">Preferred Currency</label>
                    <select value={form.prefCurrency} onChange={e => setForm({...form, prefCurrency: e.target.value})} className={inputCls}>
                      <option value="">Not set</option>
                      <option value="USD">USD</option><option value="EUR">EUR</option><option value="GBP">GBP</option><option value="KES">KES</option>
                    </select>
                  </div>
                </div>

                <button onClick={() => setEditing(false)} className="text-xs text-muted-foreground/70 hover:text-muted-foreground">Cancel</button>
              </div>
            ) : (
              <div className="space-y-2.5">
                {contact.email && (
                  <a href={`mailto:${contact.email}`} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors">
                    <Mail className="w-4 h-4 text-muted-foreground/70" /> {contact.email}
                  </a>
                )}
                {contact.phone && (
                  <a href={`tel:${contact.phone}`} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors">
                    <Phone className="w-4 h-4 text-muted-foreground/70" /> {contact.phone}
                  </a>
                )}
                {contact.country && (
                  <p className="flex items-center gap-2 text-sm text-muted-foreground">
                    <MapPin className="w-4 h-4 text-muted-foreground/70" /> {contact.country}
                  </p>
                )}
                {contact.source && (
                  <p className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Globe className="w-4 h-4 text-muted-foreground/70" /> Source: {contact.source}
                  </p>
                )}
                {contact.tags?.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap pt-1">
                    <Tag className="w-3.5 h-3.5 text-muted-foreground/70" />
                    {contact.tags.map((tag, i) => (
                      <span key={i} className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">{tag}</span>
                    ))}
                  </div>
                )}
                {contact.notes && (
                  <div className="pt-2 mt-2 border-t border-border">
                    <p className="text-xs text-muted-foreground leading-relaxed">{contact.notes}</p>
                  </div>
                )}
                {(contact.preferences?.budget || contact.preferences?.interests?.length > 0 || contact.preferences?.groupSize > 0) && (
                  <div className="pt-2 mt-2 border-t border-border">
                    <p className="text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-wider mb-1.5">Travel Preferences</p>
                    <div className="space-y-1 text-xs text-muted-foreground">
                      {contact.preferences.budget && <p>Budget: <span className="font-medium text-foreground">{contact.preferences.budget}</span></p>}
                      {contact.preferences.groupSize > 0 && <p>Typical group: <span className="font-medium text-foreground">{contact.preferences.groupSize} travelers</span></p>}
                      {contact.preferences.interests?.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {contact.preferences.interests.map((int, i) => (
                            <span key={i} className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">{int}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Quick actions */}
          <div className="flex gap-2">
            <Link
              to={`/crm?addDeal=true&contactId=${contact._id}`}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-white text-xs font-medium hover:bg-primary transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> New Deal
            </Link>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="px-3 py-2 rounded-lg border border-red-200 text-red-500 text-xs font-medium hover:bg-red-50 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>

          {showDeleteConfirm && (
            <ConfirmDialog
              title="Archive this contact?"
              message={`"${contact.firstName} ${contact.lastName}" will be archived and hidden from your contacts list. Linked deals will remain unaffected.`}
              confirmLabel="Archive Contact"
              onConfirm={async () => {
                await api.delete(`/crm/contacts/${id}`);
                toast.success('Contact archived');
                navigate('/crm');
              }}
              onCancel={() => setShowDeleteConfirm(false)}
            />
          )}

          {/* Meta */}
          <div className="bg-card rounded-xl border border-border p-4">
            <div className="space-y-2 text-xs">
              <div className="flex justify-between"><span className="text-muted-foreground">Created</span><span className="text-foreground">{formatDate(contact.createdAt)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Updated</span><span className="text-foreground">{formatDate(contact.updatedAt)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Source</span><span className="text-foreground">{contact.source || 'manual'}</span></div>
            </div>
          </div>
        </div>

        {/* Right — Deals + Attachments */}
        <div className="lg:col-span-2 space-y-4">
          {/* Deals */}
          <div className="bg-card rounded-xl border border-border p-5">
            <h3 className="text-sm font-semibold text-foreground mb-4">Deals ({deals.length})</h3>
            {deals.length > 0 ? (
              <div className="space-y-2">
                {deals.map((deal) => (
                  <Link
                    key={deal._id}
                    to={`/crm/deals/${deal._id}`}
                    className="flex items-center justify-between p-3 rounded-lg border border-border hover:border-border hover:bg-background transition-all group"
                  >
                    <div>
                      <p className="text-sm font-medium text-foreground">{deal.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {deal.destination && `${deal.destination} · `}
                        {deal.stage}
                        {deal.travelDates?.start && ` · ${formatDate(deal.travelDates.start)}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      {deal.value > 0 && (
                        <span className="text-sm font-semibold text-foreground">{formatCurrency(deal.value)}</span>
                      )}
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        deal.stage === 'Won' ? 'bg-green-100 text-green-700' :
                        deal.stage === 'Lost' ? 'bg-red-100 text-red-600' :
                        'bg-muted text-muted-foreground'
                      }`}>{deal.stage}</span>
                      <ExternalLink className="w-3.5 h-3.5 text-muted-foreground/40 group-hover:text-primary transition-colors" />
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-6">
                <p className="text-sm text-muted-foreground/70 mb-2">No deals for this contact yet</p>
                <Link to={`/crm?addDeal=true&contactId=${contact._id}`} className="text-xs text-primary hover:underline">
                  Create a deal
                </Link>
              </div>
            )}
          </div>

          {/* Tasks for this contact's deals */}
          {contactTasks.length > 0 && (
            <div className="bg-card rounded-xl border border-border p-5">
              <h3 className="text-sm font-semibold text-foreground mb-3">Tasks ({contactTasks.length})</h3>
              <div className="space-y-2">
                {contactTasks.map((task) => (
                  <div key={task._id} className="flex items-center justify-between py-2 border-b border-border/60 last:border-0">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                        task.status === 'done' ? 'bg-green-500 border-green-500' : 'border-border'
                      }`}>
                        {task.status === 'done' && <span className="text-white text-[8px]">✓</span>}
                      </div>
                      <div>
                        <p className={`text-xs font-medium ${task.status === 'done' ? 'text-muted-foreground/70 line-through' : 'text-foreground'}`}>{task.title}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {task.deal && <span className="text-[10px] text-muted-foreground/70">{task.deal.title}</span>}
                          {task.assignedTo && <span className="text-[10px] text-muted-foreground/70">{task.assignedTo.name}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                        task.priority === 'urgent' ? 'bg-red-100 text-red-600' :
                        task.priority === 'high' ? 'bg-orange-100 text-orange-600' :
                        'bg-muted text-muted-foreground'
                      }`}>{task.priority}</span>
                      {task.dueDate && (
                        <span className="text-[10px] text-muted-foreground/70">{formatDate(task.dueDate)}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Attachments */}
          <div className="bg-card rounded-xl border border-border p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-foreground">Attachments</h3>
              <input type="file" ref={fileRef} className="hidden" onChange={async (e) => {
                const file = e.target.files[0];
                if (!file) return;
                // In production: upload to Cloudinary, then save URL
                toast.success(`File "${file.name}" ready for upload (Cloudinary integration needed)`);
              }} />
              <button onClick={() => fileRef.current?.click()} className="text-xs text-primary hover:underline flex items-center gap-1">
                <Upload className="w-3 h-3" /> Upload
              </button>
            </div>
            {contact.attachments?.length > 0 ? (
              <div className="space-y-2">
                {contact.attachments.map((att, i) => (
                  <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-background border border-border">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-muted-foreground/70" />
                      <div>
                        <p className="text-xs font-medium text-foreground">{att.name}</p>
                        <p className="text-[10px] text-muted-foreground/70">{formatDate(att.uploadedAt)}</p>
                      </div>
                    </div>
                    <a href={att.url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">View</a>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground/70 text-center py-4">No attachments yet</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
