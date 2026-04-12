import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { getInitials, formatDate } from '../utils/helpers';
import PhoneInput from '../components/shared/PhoneInput';
import {
  Palette, Globe, Users as UsersIcon, Zap, Building, Save,
  Plus, Trash2, ToggleLeft, ToggleRight, Shield, Mail, Upload, Image,
  GitBranch, GripVertical, Edit2, X, ChevronUp, ChevronDown,
  Play, Clock, Search, CheckCircle2, AlertCircle, Key, Eye, EyeOff, Copy, Check,
  CreditCard,
} from 'lucide-react';

const TABS = [
  { id: 'branding', label: 'Branding', icon: Palette },
  { id: 'defaults', label: 'Defaults', icon: Globe },
  { id: 'pipelines', label: 'Pipelines', icon: GitBranch },
  { id: 'team', label: 'Team', icon: UsersIcon },
  { id: 'api', label: 'API & Webhooks', icon: Key },
  { id: 'billing', label: 'Billing', icon: CreditCard },
];

export default function SettingsPage() {
  const { organization, updateOrganization } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState('branding');
  const [org, setOrg] = useState(null);
  const [team, setTeam] = useState([]);
  const [pipelines, setPipelines] = useState([]);
  const [saving, setSaving] = useState(false);

  const fetchAll = () => {
    api.get('/settings/organization').then(({ data }) => setOrg(data));
    api.get('/settings/team').then(({ data }) => setTeam(data.members));
    api.get('/crm/pipelines').then(({ data }) => setPipelines(data.pipelines));
  };

  useEffect(() => { fetchAll(); }, []);

  const saveOrg = async () => {
    setSaving(true);
    try {
      const { data } = await api.put('/settings/organization', org);
      setOrg(data);
      updateOrganization(data);
      toast.success('Settings saved');
    } catch {
      toast.error('Save failed');
    } finally {
      setSaving(false);
    }
  };

  if (!org) return (
    <div className="flex items-center justify-center h-40">
      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground" style={{ fontFamily: 'Playfair Display, serif' }}>Settings</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Manage your workspace</p>
      </div>

      <div className="flex gap-6 flex-col lg:flex-row">
        {/* Sidebar nav */}
        <div className="lg:w-48 flex lg:flex-col gap-1 overflow-x-auto">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => id === 'billing' ? navigate('/settings/billing') : setTab(id)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                tab === id ? 'bg-primary text-white' : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              <Icon className="w-4 h-4" /> {label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 max-w-2xl">
          {/* BRANDING */}
          {tab === 'branding' && (
            <div className="bg-card rounded-xl border border-border p-6 space-y-5">
              <h3 className="text-base font-semibold text-foreground">Branding</h3>

              {/* Logo Upload */}
              <LogoUpload logo={org.branding?.logo} onUploaded={(url) => setOrg({ ...org, branding: { ...org.branding, logo: url } })} />

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Company Name</label>
                <input
                  type="text"
                  value={org.name}
                  onChange={(e) => setOrg({ ...org, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm focus:outline-none focus:border-primary transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-2">Brand Colors</label>
                <div className="flex gap-4">
                  {[
                    { key: 'primaryColor', label: 'Primary' },
                    { key: 'secondaryColor', label: 'Secondary' },
                    { key: 'accentColor', label: 'Accent' },
                  ].map(({ key, label }) => (
                    <div key={key} className="flex items-center gap-2">
                      <input
                        type="color"
                        value={org.branding?.[key] || '#000000'}
                        onChange={(e) => setOrg({ ...org, branding: { ...org.branding, [key]: e.target.value } })}
                        className="w-8 h-8 rounded-md border border-border cursor-pointer"
                      />
                      <span className="text-xs text-muted-foreground">{label}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Email</label>
                  <input
                    type="email"
                    value={org.businessInfo?.email || ''}
                    onChange={(e) => setOrg({ ...org, businessInfo: { ...org.businessInfo, email: e.target.value } })}
                    className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm focus:outline-none focus:border-primary transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Phone</label>
                  <PhoneInput
                    value={org.businessInfo?.phone || ''}
                    onChange={(val) => setOrg({ ...org, businessInfo: { ...org.businessInfo, phone: val } })}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Website</label>
                <input
                  type="text"
                  value={org.businessInfo?.website || ''}
                  onChange={(e) => setOrg({ ...org, businessInfo: { ...org.businessInfo, website: e.target.value } })}
                  className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm focus:outline-none focus:border-primary transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">About Us (shown on quotes)</label>
                <textarea
                  rows={3}
                  value={org.businessInfo?.aboutUs || ''}
                  onChange={(e) => setOrg({ ...org, businessInfo: { ...org.businessInfo, aboutUs: e.target.value } })}
                  className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm focus:outline-none focus:border-primary transition-colors resize-none"
                />
              </div>

              <div className="pt-4 border-t border-border">
                <h4 className="text-sm font-semibold text-foreground mb-1">Cover Quote</h4>
                <p className="text-xs text-muted-foreground mb-3">Replaces the default Henry Miller quote on the closing page of every quote.</p>
                <div className="grid grid-cols-[1fr_180px] gap-3">
                  <textarea
                    rows={2}
                    placeholder={`e.g. "Travel makes one modest. You see what a tiny place you occupy in the world."`}
                    value={org.branding?.coverQuote || ''}
                    onChange={(e) => setOrg({ ...org, branding: { ...org.branding, coverQuote: e.target.value } })}
                    className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm focus:outline-none focus:border-primary transition-colors resize-none"
                  />
                  <input
                    type="text"
                    placeholder="Author (optional)"
                    value={org.branding?.coverQuoteAuthor || ''}
                    onChange={(e) => setOrg({ ...org, branding: { ...org.branding, coverQuoteAuthor: e.target.value } })}
                    className="px-3 py-2 rounded-lg bg-background border border-border text-sm focus:outline-none focus:border-primary transition-colors"
                  />
                </div>
              </div>

              <button onClick={saveOrg} disabled={saving} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary transition-colors disabled:opacity-50">
                <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          )}

          {/* DEFAULTS */}
          {tab === 'defaults' && (
            <div className="bg-card rounded-xl border border-border p-6 space-y-5">
              <h3 className="text-base font-semibold text-foreground">Quote Defaults</h3>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Default Currency</label>
                  <select
                    value={org.defaults?.currency || 'USD'}
                    onChange={(e) => setOrg({ ...org, defaults: { ...org.defaults, currency: e.target.value } })}
                    className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm focus:outline-none focus:border-primary transition-colors"
                  >
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="GBP">GBP (£)</option>
                    <option value="KES">KES (KSh)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Default Margin %</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={org.defaults?.marginPercent || 20}
                    onChange={(e) => setOrg({ ...org, defaults: { ...org.defaults, marginPercent: parseInt(e.target.value) } })}
                    className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm focus:outline-none focus:border-primary transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Payment Terms</label>
                <textarea
                  rows={2}
                  value={org.defaults?.paymentTerms || ''}
                  onChange={(e) => setOrg({ ...org, defaults: { ...org.defaults, paymentTerms: e.target.value } })}
                  className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm focus:outline-none focus:border-primary transition-colors resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">WhatsApp Task Reminder</label>
                <div className="flex items-center gap-3">
                  <select
                    value={org.defaults?.taskReminderHours ?? 24}
                    onChange={(e) => setOrg({ ...org, defaults: { ...org.defaults, taskReminderHours: parseInt(e.target.value) } })}
                    className="w-48 px-3 py-2 rounded-lg bg-background border border-border text-sm focus:outline-none focus:border-primary transition-colors"
                  >
                    <option value={1}>1 hour before due</option>
                    <option value={2}>2 hours before due</option>
                    <option value={4}>4 hours before due</option>
                    <option value={8}>8 hours before due</option>
                    <option value={24}>24 hours before due</option>
                    <option value={48}>2 days before due</option>
                    <option value={72}>3 days before due</option>
                  </select>
                  <p className="text-xs text-muted-foreground">Send reminder WhatsApp this far before a task is due</p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">n8n Webhook URL (optional)</label>
                <input
                  type="url"
                  value={org.webhookUrl || ''}
                  onChange={(e) => setOrg({ ...org, webhookUrl: e.target.value })}
                  placeholder="https://your-n8n.com/webhook/..."
                  className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm focus:outline-none focus:border-primary transition-colors"
                />
              </div>

              <button onClick={saveOrg} disabled={saving} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary transition-colors disabled:opacity-50">
                <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          )}

          {/* TEAM */}
          {tab === 'team' && (
            <div className="space-y-4">
              <ProfileSection />
              <TeamSection team={team} onRefresh={async () => {
                const { data } = await api.get('/settings/team');
                setTeam(data.members);
              }} />
            </div>
          )}

          {/* PIPELINES */}
          {tab === 'pipelines' && (
            <PipelinesSection pipelines={pipelines} onRefresh={() => api.get('/crm/pipelines').then(({ data }) => setPipelines(data.pipelines))} />
          )}

          {/* API & WEBHOOKS */}
          {tab === 'api' && (
            <ApiKeySection org={org} />
          )}
        </div>
      </div>
    </div>
  );
}

function LogoUpload({ logo, onUploaded }) {
  const fileRef = useRef();
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('logo', file);
      const { data } = await api.post('/uploads/logo', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      onUploaded(data.url);
      toast.success('Logo uploaded');
    } catch {
      toast.error('Upload failed');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div>
      <label className="block text-xs font-medium text-muted-foreground mb-2">Company Logo</label>
      <div className="flex items-center gap-4">
        {logo ? (
          <img src={logo} alt="Logo" className="h-14 w-auto object-contain rounded-lg border border-border bg-card p-1" />
        ) : (
          <div className="w-14 h-14 rounded-lg border-2 border-dashed border-border flex items-center justify-center">
            <Image className="w-6 h-6 text-muted-foreground/40" />
          </div>
        )}
        <div>
          <input type="file" ref={fileRef} onChange={handleUpload} accept="image/*" className="hidden" />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted text-foreground text-xs font-medium hover:bg-muted transition-colors disabled:opacity-50"
          >
            <Upload className="w-3.5 h-3.5" />
            {uploading ? 'Uploading...' : logo ? 'Change Logo' : 'Upload Logo'}
          </button>
          <p className="text-[10px] text-muted-foreground/70 mt-1">PNG, JPG or SVG. Max 2MB.</p>
        </div>
      </div>
    </div>
  );
}
function ProfileSection() {
  const { user } = useAuth();
  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [jobTitle, setJobTitle] = useState(user?.jobTitle || '');
  const [avatar, setAvatar] = useState(user?.avatar || '');
  const [signature, setSignature] = useState(user?.signature || '');
  const [signatureNote, setSignatureNote] = useState(user?.signatureNote || '');
  const [saving, setSaving] = useState(false);
  const [uploadingField, setUploadingField] = useState(null);
  const avatarRef = useRef();
  const signatureRef = useRef();

  const handleAssetUpload = async (e, setter, fieldName) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingField(fieldName);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const { data } = await api.post('/uploads/user-asset', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setter(data.url);
      toast.success('Uploaded');
    } catch {
      toast.error('Upload failed');
    } finally {
      setUploadingField(null);
      if (e.target) e.target.value = '';
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put('/settings/profile', { name, phone, jobTitle, avatar, signature, signatureNote });
      toast.success('Profile updated');
    } catch {
      toast.error('Update failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-card rounded-xl border border-border p-6 space-y-5">
      <h3 className="text-base font-semibold text-foreground">My Profile</h3>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm text-foreground focus:outline-none focus:border-primary transition-colors"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">WhatsApp Number</label>
          <PhoneInput value={phone} onChange={setPhone} />
        </div>
        <div className="col-span-2">
          <label className="block text-xs font-medium text-muted-foreground mb-1">Job Title</label>
          <input
            type="text"
            value={jobTitle}
            onChange={(e) => setJobTitle(e.target.value)}
            placeholder="e.g. Travel Designer"
            className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm text-foreground focus:outline-none focus:border-primary transition-colors"
          />
        </div>
      </div>

      <div className="pt-4 border-t border-border">
        <h4 className="text-sm font-semibold text-foreground mb-1">Quote Signature</h4>
        <p className="text-xs text-muted-foreground mb-4">Shown on the closing section of quotes you author. Adds a personal touch for clients.</p>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-2">Your Photo</label>
            <div className="flex items-center gap-3">
              {avatar
                ? <img src={avatar} alt="" className="w-14 h-14 rounded-full object-cover border border-border" />
                : <div className="w-14 h-14 rounded-full bg-muted border border-border flex items-center justify-center text-xs text-muted-foreground">None</div>}
              <input type="file" ref={avatarRef} onChange={(e) => handleAssetUpload(e, setAvatar, 'avatar')} accept="image/*" className="hidden" />
              <button type="button" onClick={() => avatarRef.current?.click()} disabled={uploadingField === 'avatar'} className="px-3 py-1.5 rounded-lg bg-background border border-border text-xs font-medium text-foreground hover:border-primary transition-colors disabled:opacity-50">
                {uploadingField === 'avatar' ? 'Uploading...' : avatar ? 'Change' : 'Upload'}
              </button>
              {avatar && (
                <button type="button" onClick={() => setAvatar('')} className="text-xs text-muted-foreground hover:text-foreground">Remove</button>
              )}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-2">Signature Image (optional)</label>
            <div className="flex items-center gap-3">
              {signature
                ? <img src={signature} alt="" className="h-12 object-contain border border-border rounded bg-white px-2" />
                : <div className="h-12 w-24 rounded bg-muted border border-border flex items-center justify-center text-xs text-muted-foreground">None</div>}
              <input type="file" ref={signatureRef} onChange={(e) => handleAssetUpload(e, setSignature, 'signature')} accept="image/*" className="hidden" />
              <button type="button" onClick={() => signatureRef.current?.click()} disabled={uploadingField === 'signature'} className="px-3 py-1.5 rounded-lg bg-background border border-border text-xs font-medium text-foreground hover:border-primary transition-colors disabled:opacity-50">
                {uploadingField === 'signature' ? 'Uploading...' : signature ? 'Change' : 'Upload'}
              </button>
              {signature && (
                <button type="button" onClick={() => setSignature('')} className="text-xs text-muted-foreground hover:text-foreground">Remove</button>
              )}
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">If not set, your first name renders in a handwritten font.</p>
          </div>
        </div>

        <div className="mt-4">
          <label className="block text-xs font-medium text-muted-foreground mb-1">Personal Note (optional)</label>
          <textarea
            value={signatureNote}
            onChange={(e) => setSignatureNote(e.target.value)}
            rows={2}
            placeholder="e.g. It would be a privilege to bring this journey to life for you..."
            className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:border-primary transition-colors resize-none"
          />
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary transition-colors disabled:opacity-50"
      >
        <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save'}
      </button>
    </div>
  );
}

function TeamSection({ team, onRefresh }) {
  const [showInvite, setShowInvite] = useState(false);
  const [inviteForm, setInviteForm] = useState({ email: '', role: 'agent' });
  const [inviting, setInviting] = useState(false);

  const handleInvite = async (e) => {
    e.preventDefault();
    setInviting(true);
    try {
      await api.post('/settings/team/invite', inviteForm);
      toast.success(`Invite sent to ${inviteForm.email}`);
      setShowInvite(false);
      setInviteForm({ email: '', role: 'agent' });
      onRefresh();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Invite failed');
    } finally {
      setInviting(false);
    }
  };

  const toggleActive = async (member) => {
    try {
      await api.put(`/settings/team/${member._id}`, { isActive: !member.isActive });
      toast.success(member.isActive ? 'Member disabled' : 'Member enabled');
      onRefresh();
    } catch (err) {
      toast.error('Update failed');
    }
  };

  const changeRole = async (member, newRole) => {
    try {
      await api.put(`/settings/team/${member._id}`, { role: newRole });
      toast.success('Role updated');
      onRefresh();
    } catch (err) {
      toast.error('Update failed');
    }
  };

  const inputCls = 'w-full px-3 py-2 rounded-lg bg-background border border-border text-sm text-foreground focus:outline-none focus:border-primary transition-colors';

  return (
    <div className="bg-card rounded-xl border border-border p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-foreground">Team Members</h3>
        <button onClick={() => setShowInvite(!showInvite)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-medium hover:bg-primary transition-colors">
          <Plus className="w-3.5 h-3.5" /> Invite
        </button>
      </div>

      {showInvite && (
        <form onSubmit={handleInvite} className="p-4 rounded-lg bg-background border border-border space-y-3 animate-scale-in">
          <p className="text-xs text-muted-foreground">They'll receive an email with a link to set up their account.</p>
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <label className="block text-xs font-medium text-muted-foreground mb-1">Email</label>
              <input type="email" value={inviteForm.email} onChange={e => setInviteForm({...inviteForm, email: e.target.value})} className={inputCls} placeholder="colleague@company.com" required autoFocus />
            </div>
            <div className="w-28">
              <label className="block text-xs font-medium text-muted-foreground mb-1">Role</label>
              <select value={inviteForm.role} onChange={e => setInviteForm({...inviteForm, role: e.target.value})} className={inputCls}>
                <option value="agent">Agent</option>
                <option value="admin">Admin</option>
                <option value="viewer">Viewer</option>
              </select>
            </div>
            <button type="submit" disabled={inviting} className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary disabled:opacity-50">
              {inviting ? 'Sending...' : 'Send Invite'}
            </button>
          </div>
        </form>
      )}

      <div className="divide-y divide-border">
        {team.map((member) => {
          const isPending = member.status === 'pending' || (!member.name && !member.lastLogin);
          return (
            <div key={member._id} className="flex items-center justify-between py-3 group">
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold ${
                  isPending ? 'bg-primary/15 text-amber-600' : member.isActive ? 'bg-muted text-muted-foreground' : 'bg-gray-100 text-gray-400'
                }`}>
                  {isPending ? '✉' : getInitials(member.name || member.email)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className={`text-sm font-medium ${member.isActive ? 'text-foreground' : 'text-gray-400'}`}>
                      {member.name || member.email}
                    </p>
                    {isPending && <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/15 text-primary font-medium">Invite pending</span>}
                  </div>
                  <p className="text-xs text-muted-foreground">{member.name ? member.email : ''}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {member.role !== 'owner' && (
                  <select
                    value={member.role}
                    onChange={(e) => changeRole(member, e.target.value)}
                    className="text-xs px-2 py-1 rounded-md border border-border bg-card focus:outline-none opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <option value="admin">Admin</option>
                    <option value="agent">Agent</option>
                    <option value="viewer">Viewer</option>
                  </select>
                )}
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  member.role === 'owner' ? 'bg-primary/15 text-primary' :
                  member.role === 'admin' ? 'bg-blue-100 text-blue-700' :
                  'bg-muted text-muted-foreground'
                }`}>{member.role}</span>
                {member.role !== 'owner' && (
                  <button onClick={() => toggleActive(member)} className="opacity-0 group-hover:opacity-100 transition-opacity">
                    {member.isActive
                      ? <ToggleRight className="w-6 h-6 text-green-500" />
                      : <ToggleLeft className="w-6 h-6 text-muted-foreground/70" />
                    }
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PipelinesSection({ pipelines, onRefresh }) {
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newStages, setNewStages] = useState('New Inquiry, Qualified, Proposal Sent, Negotiation, Won, Lost');
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editStages, setEditStages] = useState([]);
  const [editName, setEditName] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  const stageColors = ['#6B7280','#3B82F6','#F59E0B','#8B5CF6','#10B981','#EF4444','#EC4899','#14B8A6','#F97316'];

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const stages = newStages.split(',').map((s, i) => ({
        name: s.trim(), order: i, color: stageColors[i % stageColors.length],
      })).filter(s => s.name);
      await api.post('/crm/pipelines', { name: newName.trim(), stages });
      toast.success('Pipeline created');
      setShowAdd(false);
      setNewName('');
      setNewStages('New Inquiry, Qualified, Proposal Sent, Negotiation, Won, Lost');
      onRefresh();
    } catch (err) { toast.error(err.response?.data?.message || 'Create failed'); }
    finally { setCreating(false); }
  };

  const startEdit = (pipeline) => {
    setEditingId(pipeline._id);
    setEditName(pipeline.name);
    setEditStages([...pipeline.stages].sort((a, b) => a.order - b.order));
  };

  const saveEdit = async () => {
    setSavingEdit(true);
    try {
      await api.put(`/crm/pipelines/${editingId}`, {
        name: editName,
        stages: editStages.map((s, i) => ({ ...s, order: i })),
      });
      toast.success('Pipeline updated');
      setEditingId(null);
      onRefresh();
    } catch (err) { toast.error('Save failed'); }
    finally { setSavingEdit(false); }
  };

  const deletePipeline = async (id) => {
    if (!confirm('Delete this pipeline? Deals using it will need to be reassigned.')) return;
    try {
      await api.delete(`/crm/pipelines/${id}`);
      toast.success('Pipeline deleted');
      onRefresh();
    } catch (err) { toast.error(err.response?.data?.message || 'Delete failed'); }
  };

  const moveStage = (idx, direction) => {
    const newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= editStages.length) return;
    const updated = [...editStages];
    [updated[idx], updated[newIdx]] = [updated[newIdx], updated[idx]];
    setEditStages(updated);
  };

  const addStage = () => {
    setEditStages([...editStages, { name: '', order: editStages.length, color: stageColors[editStages.length % stageColors.length] }]);
  };

  const removeStage = (idx) => {
    if (editStages.length <= 2) { toast.error('Pipeline needs at least 2 stages'); return; }
    setEditStages(editStages.filter((_, i) => i !== idx));
  };

  const inputCls = 'w-full px-3 py-2 rounded-lg bg-background border border-border text-sm text-foreground focus:outline-none focus:border-primary transition-colors';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-foreground">Pipelines</h3>
        <button onClick={() => setShowAdd(!showAdd)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-medium hover:bg-primary transition-colors">
          <Plus className="w-3.5 h-3.5" /> New Pipeline
        </button>
      </div>

      {showAdd && (
        <form onSubmit={handleCreate} className="bg-card rounded-xl border border-border p-5 space-y-3 animate-scale-in">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Pipeline Name</label>
            <input type="text" value={newName} onChange={e => setNewName(e.target.value)} className={inputCls} placeholder="e.g. Inbound Leads" required autoFocus />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Stages (comma-separated)</label>
            <input type="text" value={newStages} onChange={e => setNewStages(e.target.value)} className={inputCls} placeholder="Stage 1, Stage 2, ..." />
            <p className="text-[10px] text-muted-foreground/70 mt-1">You can reorder and edit stages after creation</p>
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={creating} className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary disabled:opacity-50">{creating ? 'Creating...' : 'Create Pipeline'}</button>
            <button type="button" onClick={() => setShowAdd(false)} className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:bg-muted">Cancel</button>
          </div>
        </form>
      )}

      {pipelines.map((pipeline) => {
        const isEditing = editingId === pipeline._id;
        return (
          <div key={pipeline._id} className="bg-card rounded-xl border border-border p-5">
            {isEditing ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <input type="text" value={editName} onChange={e => setEditName(e.target.value)} className="flex-1 px-3 py-1.5 rounded-lg bg-background border border-border text-sm font-semibold text-foreground focus:outline-none focus:border-primary" />
                  <button onClick={saveEdit} disabled={savingEdit} className="px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-medium hover:bg-primary disabled:opacity-50">
                    <Save className="w-3.5 h-3.5 inline mr-1" />{savingEdit ? 'Saving...' : 'Save'}
                  </button>
                  <button onClick={() => setEditingId(null)} className="text-xs text-muted-foreground/70 hover:text-muted-foreground">Cancel</button>
                </div>
                <div className="space-y-1.5">
                  {editStages.map((stage, idx) => (
                    <div key={idx} className="flex items-center gap-2 group">
                      <div className="flex flex-col">
                        <button onClick={() => moveStage(idx, -1)} disabled={idx === 0} className="text-muted-foreground/40 hover:text-muted-foreground disabled:opacity-20"><ChevronUp className="w-3 h-3" /></button>
                        <button onClick={() => moveStage(idx, 1)} disabled={idx === editStages.length - 1} className="text-muted-foreground/40 hover:text-muted-foreground disabled:opacity-20"><ChevronDown className="w-3 h-3" /></button>
                      </div>
                      <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: stage.color }} />
                      <input
                        type="text"
                        value={stage.name}
                        onChange={e => { const u = [...editStages]; u[idx] = { ...u[idx], name: e.target.value }; setEditStages(u); }}
                        className="flex-1 px-2 py-1 rounded-md bg-background border border-border text-xs focus:outline-none focus:border-primary"
                      />
                      <input
                        type="color"
                        value={stage.color}
                        onChange={e => { const u = [...editStages]; u[idx] = { ...u[idx], color: e.target.value }; setEditStages(u); }}
                        className="w-6 h-6 rounded border border-border cursor-pointer"
                      />
                      <button onClick={() => removeStage(idx)} className="text-muted-foreground/40 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
                <button onClick={addStage} className="w-full py-1.5 rounded-md border border-dashed border-border text-[10px] text-muted-foreground hover:border-primary hover:text-primary transition-colors">+ Add Stage</button>
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-semibold text-foreground">{pipeline.name}</h4>
                    {pipeline.isDefault && <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/15 text-primary font-medium">Default</span>}
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => startEdit(pipeline)} className="text-xs text-primary hover:underline flex items-center gap-0.5">
                      <Edit2 className="w-3 h-3" /> Edit
                    </button>
                    {!pipeline.isDefault && (
                      <button onClick={() => deletePipeline(pipeline._id)} className="text-xs text-red-400 hover:underline ml-2 flex items-center gap-0.5">
                        <Trash2 className="w-3 h-3" /> Delete
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {[...pipeline.stages].sort((a, b) => a.order - b.order).map((stage, i) => (
                    <div key={i} className="flex items-center gap-1">
                      {i > 0 && <span className="text-muted-foreground/40 text-xs">→</span>}
                      <span className="text-xs px-2 py-1 rounded-md border border-border" style={{ borderLeftColor: stage.color, borderLeftWidth: 3 }}>
                        {stage.name}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}


function ApiKeySection({ org }) {
  const [copied, setCopied] = useState(false);
  const [visible, setVisible] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [apiKey, setApiKey] = useState(org?.apiKey || '');

  const copy = () => {
    if (!apiKey) return;
    navigator.clipboard.writeText(apiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('API key copied');
  };

  const regenerate = async () => {
    if (!confirm('Regenerate API key? The old key will stop working immediately.')) return;
    setRegenerating(true);
    try {
      const { data } = await api.post('/settings/api-key/regenerate');
      setApiKey(data.apiKey);
      toast.success('API key regenerated');
    } catch (err) { toast.error('Failed to regenerate'); }
    finally { setRegenerating(false); }
  };

  return (
    <div className="space-y-4">
      <div className="bg-card rounded-xl border border-border p-5">
        <h3 className="text-sm font-semibold text-foreground mb-1">API Key</h3>
        <p className="text-xs text-muted-foreground mb-4">
          Use this key in the <code className="bg-muted px-1 py-0.5 rounded text-[10px]">x-api-key</code> header when calling the CRM from n8n or any external tool.
        </p>
        <div className="flex items-center gap-2">
          <div className="flex-1 font-mono text-sm bg-background px-3 py-2.5 rounded-lg border border-border truncate text-foreground">
            {visible ? (apiKey || 'No API key generated') : '•'.repeat(32)}
          </div>
          <button onClick={() => setVisible(v => !v)} className="p-2 rounded-lg border border-border hover:bg-background transition-colors text-muted-foreground">
            {visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
          <button onClick={copy} disabled={!apiKey} className="p-2 rounded-lg border border-border hover:bg-background transition-colors text-muted-foreground disabled:opacity-50">
            {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>
        <button onClick={regenerate} disabled={regenerating} className="mt-3 text-xs text-red-500 hover:underline disabled:opacity-50">
          {regenerating ? 'Regenerating...' : 'Regenerate API key'}
        </button>
      </div>

      <div className="bg-card rounded-xl border border-border p-5">
        <h3 className="text-sm font-semibold text-foreground mb-3">Webhook Endpoints</h3>
        <p className="text-xs text-muted-foreground mb-4">Use these endpoints from n8n, Zapier, or any HTTP client. All requests require the <code className="bg-muted px-1 py-0.5 rounded text-[10px]">x-api-key</code> header.</p>

        <div className="bg-background rounded-lg p-4 space-y-3 border border-border">
          <div>
            <p className="text-xs font-semibold text-foreground mb-1">n8n HTTP Request node setup:</p>
            <div className="space-y-1 text-xs text-muted-foreground">
              <p>Header: <code className="text-foreground bg-muted px-1 rounded">x-api-key: {visible ? (apiKey || 'your-key') : '(click eye to reveal)'}</code></p>
            </div>
          </div>

          <div className="border-t border-border pt-3">
            <p className="text-xs font-semibold text-foreground mb-2">Available endpoints:</p>
            <div className="space-y-2">
              {[
                { method: 'GET', path: '/api/webhooks/contacts', desc: 'List contacts (supports ?email= filter)' },
                { method: 'POST', path: '/api/webhooks/contacts', desc: 'Create or upsert contact by email' },
                { method: 'PUT', path: '/api/webhooks/contacts/:id', desc: 'Update a contact' },
                { method: 'GET', path: '/api/webhooks/deals', desc: 'List deals (supports ?stage= filter)' },
                { method: 'POST', path: '/api/webhooks/deals', desc: 'Create a new deal' },
                { method: 'POST', path: '/api/webhooks/events', desc: 'Fire an automation trigger' },
              ].map((ep, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded mt-0.5 ${ep.method === 'GET' ? 'bg-green-100 text-green-700' : ep.method === 'POST' ? 'bg-blue-100 text-blue-700' : 'bg-primary/15 text-primary'}`}>
                    {ep.method}
                  </span>
                  <div>
                    <code className="text-xs text-foreground">{ep.path}</code>
                    <p className="text-[10px] text-muted-foreground/70">{ep.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="border-t border-border pt-3">
            <p className="text-xs font-semibold text-foreground mb-1">Example: create contact from n8n</p>
            <pre className="bg-card rounded-md p-3 border border-border text-[10px] text-foreground overflow-x-auto leading-relaxed">{`POST /api/webhooks/contacts
x-api-key: ${visible ? (apiKey || 'sk_...') : 'sk_...'}

{
  "firstName": "Sarah",
  "lastName": "Chen",
  "email": "sarah@example.com",
  "phone": "+254712345678",
  "source": "website",
  "tags": ["safari", "honeymoon"]
}`}</pre>
          </div>
        </div>
      </div>
    </div>
  );
}
