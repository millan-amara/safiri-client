import { useState, useEffect, useRef, useMemo } from 'react';
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
  CreditCard, RotateCcw,
} from 'lucide-react';

const TABS = [
  { id: 'branding', label: 'Branding', icon: Palette },
  { id: 'defaults', label: 'Defaults', icon: Globe },
  { id: 'pipelines', label: 'Pipelines', icon: GitBranch },
  { id: 'team', label: 'Team', icon: UsersIcon },
  { id: 'roles', label: 'Roles & Policies', icon: Shield },
  { id: 'api', label: 'API & Webhooks', icon: Key },
  { id: 'billing', label: 'Billing', icon: CreditCard },
];

export default function SettingsPage() {
  const { user, organization, updateOrganization } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState('branding');
  const [org, setOrg] = useState(null);
  const [team, setTeam] = useState([]);
  const [pipelines, setPipelines] = useState([]);
  const [saving, setSaving] = useState(false);

  const isAdmin = ['owner', 'admin'].includes(user?.role);
  const isOwner = user?.role === 'owner';

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
        <h1 className="text-xl sm:text-2xl font-bold text-foreground" style={{ fontFamily: 'Playfair Display, serif' }}>Settings</h1>
        <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">Manage your workspace</p>
      </div>

      <div className="flex gap-4 sm:gap-6 flex-col lg:flex-row">
        {/* Sidebar nav */}
        <div className="lg:w-48 flex lg:flex-col gap-1 overflow-x-auto -mx-4 px-4 lg:mx-0 lg:px-0 pb-1 lg:pb-0">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => id === 'billing' ? navigate('/settings/billing') : setTab(id)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors shrink-0 ${
                tab === id ? 'bg-primary text-white' : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              <Icon className="w-4 h-4" /> {label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 max-w-2xl min-w-0">
          {/* BRANDING */}
          {tab === 'branding' && (
            <div className="bg-card rounded-xl border border-border p-4 sm:p-6 space-y-5">
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
                <div className="flex flex-wrap gap-4">
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                <div className="grid grid-cols-1 sm:grid-cols-[1fr_180px] gap-3">
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
            <div className="bg-card rounded-xl border border-border p-4 sm:p-6 space-y-5">
              <h3 className="text-base font-semibold text-foreground">Quote Defaults</h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <select
                    value={org.defaults?.taskReminderHours ?? 24}
                    onChange={(e) => setOrg({ ...org, defaults: { ...org.defaults, taskReminderHours: parseInt(e.target.value) } })}
                    className="w-full sm:w-48 px-3 py-2 rounded-lg bg-background border border-border text-sm focus:outline-none focus:border-primary transition-colors"
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
                <label className="block text-xs font-medium text-muted-foreground mb-1">Scheduled Messages — Send Time</label>
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <select
                    value={org.preferences?.scheduledMessageHour ?? 9}
                    onChange={(e) => setOrg({ ...org, preferences: { ...(org.preferences || {}), scheduledMessageHour: parseInt(e.target.value) } })}
                    className="w-full sm:w-40 px-3 py-2 rounded-lg bg-background border border-border text-sm focus:outline-none focus:border-primary transition-colors"
                  >
                    {Array.from({ length: 24 }, (_, h) => {
                      const ampm = h === 0 ? '12:00 AM' : h < 12 ? `${h}:00 AM` : h === 12 ? '12:00 PM' : `${h - 12}:00 PM`;
                      return <option key={h} value={h}>{ampm}</option>;
                    })}
                  </select>
                  <select
                    value={org.preferences?.scheduledMessageTimezone || 'Africa/Nairobi'}
                    onChange={(e) => setOrg({ ...org, preferences: { ...(org.preferences || {}), scheduledMessageTimezone: e.target.value } })}
                    className="w-full sm:flex-1 px-3 py-2 rounded-lg bg-background border border-border text-sm focus:outline-none focus:border-primary transition-colors"
                  >
                    <optgroup label="Africa">
                      <option value="Africa/Nairobi">Nairobi (EAT, UTC+3)</option>
                      <option value="Africa/Cairo">Cairo (UTC+2)</option>
                      <option value="Africa/Johannesburg">Johannesburg (UTC+2)</option>
                      <option value="Africa/Lagos">Lagos (UTC+1)</option>
                      <option value="Africa/Accra">Accra (UTC+0)</option>
                      <option value="Africa/Casablanca">Casablanca (UTC+1)</option>
                    </optgroup>
                    <optgroup label="Europe">
                      <option value="Europe/London">London (UTC+0/+1)</option>
                      <option value="Europe/Paris">Paris (UTC+1/+2)</option>
                      <option value="Europe/Madrid">Madrid (UTC+1/+2)</option>
                      <option value="Europe/Berlin">Berlin (UTC+1/+2)</option>
                    </optgroup>
                    <optgroup label="Americas">
                      <option value="America/New_York">New York (UTC-5/-4)</option>
                      <option value="America/Chicago">Chicago (UTC-6/-5)</option>
                      <option value="America/Los_Angeles">Los Angeles (UTC-8/-7)</option>
                    </optgroup>
                    <optgroup label="Asia / Pacific">
                      <option value="Asia/Dubai">Dubai (UTC+4)</option>
                      <option value="Asia/Singapore">Singapore (UTC+8)</option>
                      <option value="Asia/Tokyo">Tokyo (UTC+9)</option>
                      <option value="Australia/Sydney">Sydney (UTC+10/+11)</option>
                    </optgroup>
                  </select>
                </div>
                <p className="text-[10px] text-muted-foreground/70 mt-1">
                  Pre-trip / post-trip messages with relative timing (e.g. "14 days before travel start") send at this hour, in this timezone. Messages with a specific date use the time you pick.
                </p>
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

              <div className="pt-4 border-t border-border">
                <h4 className="text-sm font-semibold text-foreground mb-1">Invoice Defaults</h4>
                <p className="text-xs text-muted-foreground mb-3">Applied to new invoices; operator can override per-invoice.</p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Default Tax %</label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step="any"
                      value={org.preferences?.defaultTaxPercent ?? 0}
                      onChange={(e) => setOrg({ ...org, preferences: { ...(org.preferences || {}), defaultTaxPercent: parseFloat(e.target.value) || 0 } })}
                      className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm focus:outline-none focus:border-primary transition-colors"
                    />
                  </div>
                </div>

                <div className="mt-5 pt-4 border-t border-border">
                  <h5 className="text-xs font-semibold text-foreground mb-1">Deposit + Balance</h5>
                  <p className="text-[11px] text-muted-foreground mb-3">
                    Defaults for the "Split into deposit + balance" action on the deal page. Operator can override per deal.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1">Deposit %</label>
                      <input
                        type="number" min={0} max={100} step="1"
                        value={org.preferences?.depositPercent ?? 30}
                        onChange={(e) => setOrg({ ...org, preferences: { ...(org.preferences || {}), depositPercent: parseInt(e.target.value) || 0 } })}
                        className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm focus:outline-none focus:border-primary transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1">Deposit due (days)</label>
                      <input
                        type="number" min={0} step="1"
                        value={org.preferences?.depositDueDays ?? 7}
                        onChange={(e) => setOrg({ ...org, preferences: { ...(org.preferences || {}), depositDueDays: parseInt(e.target.value) || 0 } })}
                        className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm focus:outline-none focus:border-primary transition-colors"
                      />
                      <p className="text-[10px] text-muted-foreground/70 mt-1">From invoice creation</p>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1">Balance lead (days)</label>
                      <input
                        type="number" min={0} step="1"
                        value={org.preferences?.balanceDaysBeforeTravel ?? 60}
                        onChange={(e) => setOrg({ ...org, preferences: { ...(org.preferences || {}), balanceDaysBeforeTravel: parseInt(e.target.value) || 0 } })}
                        className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm focus:outline-none focus:border-primary transition-colors"
                      />
                      <p className="text-[10px] text-muted-foreground/70 mt-1">Before travel start</p>
                    </div>
                  </div>
                </div>

                <div className="mt-4">
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Payment Instructions</label>
                  <textarea
                    rows={4}
                    value={org.preferences?.paymentInstructions || ''}
                    onChange={(e) => setOrg({ ...org, preferences: { ...(org.preferences || {}), paymentInstructions: e.target.value } })}
                    placeholder={'Bank: Equity Bank\nAccount: 1234567890\nM-Pesa Paybill: 555555\nReference: invoice number'}
                    className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm focus:outline-none focus:border-primary transition-colors resize-none font-mono text-xs"
                  />
                  <p className="text-[10px] text-muted-foreground/70 mt-1">
                    Shown at the bottom of every invoice. Snapshotted at creation, so editing this doesn't change past invoices.
                  </p>
                </div>
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
              <TeamSection
                team={team}
                isAdmin={isAdmin}
                isOwner={isOwner}
                currentUserId={user?._id}
                onRefresh={async () => {
                  const { data } = await api.get('/settings/team');
                  setTeam(data.members);
                }}
              />
            </div>
          )}

          {/* PIPELINES */}
          {tab === 'pipelines' && (
            <PipelinesSection
              pipelines={pipelines}
              team={team}
              isAdmin={isAdmin}
              onRefresh={() => api.get('/crm/pipelines').then(({ data }) => setPipelines(data.pipelines))}
            />
          )}

          {/* ROLES & POLICIES */}
          {tab === 'roles' && (
            <RolesPoliciesSection
              org={org}
              setOrg={setOrg}
              team={team}
              isAdmin={isAdmin}
              onSave={saveOrg}
              saving={saving}
            />
          )}

          {/* API & WEBHOOKS */}
          {tab === 'api' && (
            <div className="space-y-4">
              <ApiKeySection org={org} />
              <AccountingWebhookSection org={org} setOrg={setOrg} onSave={saveOrg} saving={saving} isAdmin={isAdmin} />
              {isAdmin && <WebhookDeliveriesSection />}
            </div>
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
      <div className="flex flex-wrap items-center gap-4">
        {logo ? (
          <img src={logo} alt="Logo" className="h-14 w-auto object-contain rounded-lg border border-border bg-card p-1 shrink-0" />
        ) : (
          <div className="w-14 h-14 rounded-lg border-2 border-dashed border-border flex items-center justify-center shrink-0">
            <Image className="w-6 h-6 text-muted-foreground/40" />
          </div>
        )}
        <div className="min-w-0">
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
    <div className="bg-card rounded-xl border border-border p-4 sm:p-6 space-y-5">
      <h3 className="text-base font-semibold text-foreground">My Profile</h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
        <div className="sm:col-span-2">
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

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-2">Your Photo</label>
            <div className="flex flex-wrap items-center gap-3">
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
            <div className="flex flex-wrap items-center gap-3">
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

function TeamSection({ team, isAdmin, isOwner, currentUserId, onRefresh }) {
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
    <div className="bg-card rounded-xl border border-border p-4 sm:p-6 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-base font-semibold text-foreground">Team Members</h3>
        {isAdmin && (
          <button onClick={() => setShowInvite(!showInvite)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-medium hover:bg-primary transition-colors shrink-0">
            <Plus className="w-3.5 h-3.5" /> Invite
          </button>
        )}
      </div>

      {showInvite && (
        <form onSubmit={handleInvite} className="p-4 rounded-lg bg-background border border-border space-y-3 animate-scale-in">
          <p className="text-xs text-muted-foreground">They'll receive an email with a link to set up their account.</p>
          <div className="flex flex-col sm:flex-row sm:items-end gap-3">
            <div className="flex-1 min-w-0">
              <label className="block text-xs font-medium text-muted-foreground mb-1">Email</label>
              <input type="email" value={inviteForm.email} onChange={e => setInviteForm({...inviteForm, email: e.target.value})} className={inputCls} placeholder="colleague@company.com" required autoFocus />
            </div>
            <div className="w-full sm:w-28">
              <label className="block text-xs font-medium text-muted-foreground mb-1">Role</label>
              <select value={inviteForm.role} onChange={e => setInviteForm({...inviteForm, role: e.target.value})} className={inputCls}>
                <option value="agent">Agent</option>
                <option value="admin">Admin</option>
                <option value="viewer">Viewer</option>
              </select>
            </div>
            <button type="submit" disabled={inviting} className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary disabled:opacity-50 shrink-0">
              {inviting ? 'Sending...' : 'Send Invite'}
            </button>
          </div>
        </form>
      )}

      <div className="divide-y divide-border">
        {team.map((member) => {
          const isPending = member.status === 'pending' || (!member.name && !member.lastLogin);
          return (
            <div key={member._id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 py-3 group">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 ${
                  isPending ? 'bg-primary/15 text-amber-600' : member.isActive ? 'bg-muted text-muted-foreground' : 'bg-gray-100 text-gray-400'
                }`}>
                  {isPending ? '✉' : getInitials(member.name || member.email)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className={`text-sm font-medium truncate ${member.isActive ? 'text-foreground' : 'text-gray-400'}`}>
                      {member.name || member.email}
                    </p>
                    {isPending && <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/15 text-primary font-medium">Invite pending</span>}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{member.name ? member.email : ''}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap shrink-0">
                {isAdmin && member.role !== 'owner' && member._id !== currentUserId && (
                  <select
                    value={member.role}
                    onChange={(e) => changeRole(member, e.target.value)}
                    className="text-xs px-2 py-1 rounded-md border border-border bg-card focus:outline-none sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                  >
                    {isOwner && <option value="owner">Owner (transfer)</option>}
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
                {isAdmin && member.role !== 'owner' && member._id !== currentUserId && (
                  <button onClick={() => toggleActive(member)} className="sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
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

function PipelinesSection({ pipelines, team = [], isAdmin, onRefresh }) {
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newStages, setNewStages] = useState('New Inquiry, Qualified, Proposal Sent, Negotiation, Won, Lost');
  const [newVisibility, setNewVisibility] = useState('organization');
  const [newMembers, setNewMembers] = useState([]);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editStages, setEditStages] = useState([]);
  const [editName, setEditName] = useState('');
  const [editVisibility, setEditVisibility] = useState('organization');
  const [editMembers, setEditMembers] = useState([]);
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
      await api.post('/crm/pipelines', {
        name: newName.trim(),
        stages,
        visibility: newVisibility,
        members: newVisibility === 'members' ? newMembers : [],
      });
      toast.success('Pipeline created');
      setShowAdd(false);
      setNewName('');
      setNewStages('New Inquiry, Qualified, Proposal Sent, Negotiation, Won, Lost');
      setNewVisibility('organization');
      setNewMembers([]);
      onRefresh();
    } catch (err) { toast.error(err.response?.data?.message || 'Create failed'); }
    finally { setCreating(false); }
  };

  const startEdit = (pipeline) => {
    setEditingId(pipeline._id);
    setEditName(pipeline.name);
    setEditStages([...pipeline.stages].sort((a, b) => a.order - b.order));
    setEditVisibility(pipeline.visibility || 'organization');
    setEditMembers((pipeline.members || []).map(String));
  };

  const saveEdit = async () => {
    setSavingEdit(true);
    try {
      await api.put(`/crm/pipelines/${editingId}`, {
        name: editName,
        stages: editStages.map((s, i) => ({ ...s, order: i })),
        visibility: editVisibility,
        members: editVisibility === 'members' ? editMembers : [],
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
    setEditStages([...editStages, { name: '', order: editStages.length, color: stageColors[editStages.length % stageColors.length], type: 'open' }]);
  };

  const removeStage = (idx) => {
    if (editStages.length <= 2) { toast.error('Pipeline needs at least 2 stages'); return; }
    setEditStages(editStages.filter((_, i) => i !== idx));
  };

  const inputCls = 'w-full px-3 py-2 rounded-lg bg-background border border-border text-sm text-foreground focus:outline-none focus:border-primary transition-colors';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-base font-semibold text-foreground">Pipelines</h3>
        {isAdmin && (
          <button onClick={() => setShowAdd(!showAdd)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-medium hover:bg-primary transition-colors shrink-0">
            <Plus className="w-3.5 h-3.5" /> New Pipeline
          </button>
        )}
      </div>

      {showAdd && isAdmin && (
        <form onSubmit={handleCreate} className="bg-card rounded-xl border border-border p-4 sm:p-5 space-y-3 animate-scale-in">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Pipeline Name</label>
            <input type="text" value={newName} onChange={e => setNewName(e.target.value)} className={inputCls} placeholder="e.g. Inbound Leads" required autoFocus />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Stages (comma-separated)</label>
            <input type="text" value={newStages} onChange={e => setNewStages(e.target.value)} className={inputCls} placeholder="Stage 1, Stage 2, ..." />
            <p className="text-[10px] text-muted-foreground/70 mt-1">You can reorder and edit stages after creation</p>
          </div>
          <VisibilityEditor
            visibility={newVisibility}
            members={newMembers}
            onVisibilityChange={setNewVisibility}
            onMembersChange={setNewMembers}
            team={team}
          />
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={creating} className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary disabled:opacity-50">{creating ? 'Creating...' : 'Create Pipeline'}</button>
            <button type="button" onClick={() => setShowAdd(false)} className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:bg-muted">Cancel</button>
          </div>
        </form>
      )}

      {pipelines.map((pipeline) => {
        const isEditing = editingId === pipeline._id;
        return (
          <div key={pipeline._id} className="bg-card rounded-xl border border-border p-4 sm:p-5">
            {isEditing ? (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                  <input type="text" value={editName} onChange={e => setEditName(e.target.value)} className="flex-1 min-w-0 px-3 py-1.5 rounded-lg bg-background border border-border text-sm font-semibold text-foreground focus:outline-none focus:border-primary" />
                  <button onClick={saveEdit} disabled={savingEdit} className="px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-medium hover:bg-primary disabled:opacity-50 shrink-0">
                    <Save className="w-3.5 h-3.5 inline mr-1" />{savingEdit ? 'Saving...' : 'Save'}
                  </button>
                  <button onClick={() => setEditingId(null)} className="text-xs text-muted-foreground/70 hover:text-muted-foreground shrink-0">Cancel</button>
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
                      <select
                        value={stage.type || 'open'}
                        onChange={e => { const u = [...editStages]; u[idx] = { ...u[idx], type: e.target.value }; setEditStages(u); }}
                        className="px-1.5 py-1 rounded-md bg-background border border-border text-[10px] focus:outline-none focus:border-primary"
                        title="Stage role — drives won/lost detection regardless of name"
                      >
                        <option value="open">Open</option>
                        <option value="won">Won</option>
                        <option value="lost">Lost</option>
                      </select>
                      <input
                        type="color"
                        value={stage.color}
                        onChange={e => { const u = [...editStages]; u[idx] = { ...u[idx], color: e.target.value }; setEditStages(u); }}
                        className="w-6 h-6 rounded border border-border cursor-pointer"
                      />
                      <button onClick={() => removeStage(idx)} className="text-muted-foreground/40 hover:text-red-500 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-muted-foreground/70 mt-2">
                  <strong>Stage role</strong> tells SafiriPro which stages count as Won and Lost — used by reporting,
                  notifications, and the marketer feedback loop. Names can be anything (e.g. "Handed to Sales" tagged as Won).
                </p>
                <button onClick={addStage} className="w-full py-1.5 rounded-md border border-dashed border-border text-[10px] text-muted-foreground hover:border-primary hover:text-primary transition-colors">+ Add Stage</button>
                <VisibilityEditor
                  visibility={editVisibility}
                  members={editMembers}
                  onVisibilityChange={setEditVisibility}
                  onMembersChange={setEditMembers}
                  team={team}
                />
              </div>
            ) : (
              <div>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2 min-w-0 flex-1 flex-wrap">
                    <h4 className="text-sm font-semibold text-foreground truncate">{pipeline.name}</h4>
                    {pipeline.isDefault && <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/15 text-primary font-medium shrink-0">Default</span>}
                    {pipeline.visibility === 'members' && (
                      <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 font-medium shrink-0">
                        <Shield className="w-2.5 h-2.5" />
                        Restricted · {(pipeline.members || []).length} members
                      </span>
                    )}
                  </div>
                  {isAdmin && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => startEdit(pipeline)} className="text-xs text-primary hover:underline flex items-center gap-0.5">
                        <Edit2 className="w-3 h-3" /> Edit
                      </button>
                      {!pipeline.isDefault && (
                        <button onClick={() => deletePipeline(pipeline._id)} className="text-xs text-red-400 hover:underline ml-2 flex items-center gap-0.5">
                          <Trash2 className="w-3 h-3" /> Delete
                        </button>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1 flex-wrap">
                  {[...pipeline.stages].sort((a, b) => a.order - b.order).map((stage, i) => (
                    <div key={i} className="flex items-center gap-1">
                      {i > 0 && <span className="text-muted-foreground/40 text-xs">→</span>}
                      <span className="text-xs px-2 py-1 rounded-md border border-border whitespace-nowrap inline-flex items-center gap-1" style={{ borderLeftColor: stage.color, borderLeftWidth: 3 }}>
                        {stage.name}
                        {stage.type === 'won' && <span className="text-[9px] px-1 rounded bg-emerald-100 text-emerald-700 font-medium uppercase tracking-wide">Won</span>}
                        {stage.type === 'lost' && <span className="text-[9px] px-1 rounded bg-red-100 text-red-700 font-medium uppercase tracking-wide">Lost</span>}
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


// Reusable editor for a pipeline's access control. Used in both create and edit forms.
// `visibility` is the current radio choice; `members` is an array of user-id strings.
function VisibilityEditor({ visibility, members, onVisibilityChange, onMembersChange, team }) {
  // Owner/admin always get implicit access — they don't appear in the picker, they're
  // shown separately as "always included" so it's clear they aren't being excluded.
  const selectable = team.filter(m => m.role !== 'owner' && m.role !== 'admin' && m.isActive !== false);
  const adminCount = team.filter(m => (m.role === 'owner' || m.role === 'admin') && m.isActive !== false).length;

  const toggleMember = (userId) => {
    const id = String(userId);
    if (members.includes(id)) {
      onMembersChange(members.filter(m => m !== id));
    } else {
      onMembersChange([...members, id]);
    }
  };

  return (
    <div className="pt-3 border-t border-border space-y-3">
      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-2">Who can see this pipeline?</label>
        <div className="space-y-2">
          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="radio"
              checked={visibility === 'organization'}
              onChange={() => onVisibilityChange('organization')}
              className="mt-0.5"
            />
            <div>
              <span className="text-xs font-medium text-foreground">Everyone in the organization</span>
              <p className="text-[10px] text-muted-foreground/80">All team members see this pipeline (default)</p>
            </div>
          </label>
          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="radio"
              checked={visibility === 'members'}
              onChange={() => onVisibilityChange('members')}
              className="mt-0.5"
            />
            <div>
              <span className="text-xs font-medium text-foreground">Specific members only</span>
              <p className="text-[10px] text-muted-foreground/80">
                Owners + admins always have access. Pick which agents/viewers can also see it.
              </p>
            </div>
          </label>
        </div>
      </div>

      {visibility === 'members' && (
        <div className="pl-5 space-y-2">
          <p className="text-[10px] text-muted-foreground">
            {adminCount > 0 && <>Owner + admins ({adminCount}) always included. </>}
            Pick additional members:
          </p>
          {selectable.length === 0 ? (
            <p className="text-[10px] text-muted-foreground italic">No agents or viewers in your team yet.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-40 overflow-y-auto">
              {selectable.map(member => (
                <label key={member._id} className="flex items-center gap-2 px-2 py-1 rounded-md hover:bg-muted cursor-pointer text-xs">
                  <input
                    type="checkbox"
                    checked={members.includes(String(member._id))}
                    onChange={() => toggleMember(member._id)}
                  />
                  <span className="text-foreground truncate">{member.name || member.email}</span>
                  <span className="text-[10px] text-muted-foreground/70 ml-auto">{member.role}</span>
                </label>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Permissions matrix + org-level policy toggles. Read-only matrix for everyone;
// policy toggles only editable by admin+owner (backend enforces too).
function RolesPoliciesSection({ org, setOrg, team = [], isAdmin, onSave, saving }) {
  const PERMISSIONS = [
    { area: 'Org settings (name, branding, FX)', owner: true, admin: true, agent: false, viewer: false },
    { area: 'Billing & plan changes', owner: true, admin: false, agent: false, viewer: false },
    { area: 'Invite / remove team members', owner: true, admin: true, agent: false, viewer: false },
    { area: 'Change member roles', owner: true, admin: 'partial', agent: false, viewer: false, note: 'Admin cannot edit owner' },
    { area: 'Create / delete pipelines', owner: true, admin: true, agent: false, viewer: false },
    { area: 'Manage pipeline membership', owner: true, admin: true, agent: false, viewer: false },
    { area: 'View deals', owner: 'all', admin: 'all', agent: 'accessible', viewer: 'accessible' },
    { area: 'Create / edit / move deals', owner: true, admin: true, agent: 'accessible', viewer: false },
    { area: 'Reassign deals', owner: true, admin: true, agent: 'policy', viewer: false, note: 'Agent depends on org policy below' },
    { area: 'Delete deals', owner: true, admin: true, agent: 'policy', viewer: false, note: 'Agent depends on org policy below' },
    { area: 'Create / edit contacts', owner: true, admin: true, agent: true, viewer: false },
    { area: 'Delete contacts', owner: true, admin: true, agent: false, viewer: false },
    { area: 'Create / edit / complete tasks', owner: true, admin: true, agent: 'own', viewer: false, note: 'Agent: own + assigned' },
    { area: 'View dashboard / team performance', owner: true, admin: true, agent: 'accessible', viewer: 'accessible' },
    { area: 'Use AI features', owner: true, admin: true, agent: true, viewer: false },
    { area: 'Generate / edit quotes', owner: true, admin: true, agent: 'accessible', viewer: false },
    { area: 'Manage automations', owner: true, admin: true, agent: false, viewer: false },
    { area: 'Manage hotel / activity / destination library', owner: true, admin: true, agent: 'create-edit', viewer: false },
  ];

  const cellFor = (val) => {
    if (val === true) return <span className="text-green-600">✓</span>;
    if (val === false) return <span className="text-muted-foreground/40">—</span>;
    if (val === 'all') return <span className="text-green-600">All</span>;
    if (val === 'accessible') return <span className="text-blue-600 text-[10px]">Accessible only</span>;
    if (val === 'own') return <span className="text-blue-600 text-[10px]">Own only</span>;
    if (val === 'policy') return <span className="text-amber-600 text-[10px]">Per policy</span>;
    if (val === 'partial') return <span className="text-amber-600 text-[10px]">Limited</span>;
    if (val === 'create-edit') return <span className="text-blue-600 text-[10px]">Create/edit</span>;
    return <span className="text-muted-foreground">{val}</span>;
  };

  const updatePref = (key, value) => {
    setOrg({
      ...org,
      preferences: { ...(org.preferences || {}), [key]: value },
    });
  };

  const dealWonNotifyUsers = (org.preferences?.dealWonNotifyUsers || []).map(String);
  const toggleDealWonRecipient = (userId) => {
    const id = String(userId);
    const current = dealWonNotifyUsers;
    const next = current.includes(id) ? current.filter(x => x !== id) : [...current, id];
    updatePref('dealWonNotifyUsers', next);
  };

  return (
    <div className="space-y-4">
      {/* Permissions matrix */}
      <div className="bg-card rounded-xl border border-border p-4 sm:p-6 space-y-4">
        <div>
          <h3 className="text-base font-semibold text-foreground">What each role can do</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Roles are assigned per team member from the Team tab. "Accessible" means restricted to pipelines
            the member belongs to.
          </p>
        </div>

        <div className="overflow-x-auto -mx-4 sm:mx-0">
          <table className="w-full text-xs min-w-[520px]">
            <thead>
              <tr className="text-left border-b border-border">
                <th className="py-2 pl-4 sm:pl-0 pr-2 font-medium text-muted-foreground">Permission</th>
                <th className="py-2 px-2 font-medium text-muted-foreground text-center">Owner</th>
                <th className="py-2 px-2 font-medium text-muted-foreground text-center">Admin</th>
                <th className="py-2 px-2 font-medium text-muted-foreground text-center">Agent</th>
                <th className="py-2 px-2 pr-4 sm:pr-0 font-medium text-muted-foreground text-center">Viewer</th>
              </tr>
            </thead>
            <tbody>
              {PERMISSIONS.map((row, i) => (
                <tr key={i} className="border-b border-border/50 last:border-b-0">
                  <td className="py-2 pl-4 sm:pl-0 pr-2 text-foreground">
                    {row.area}
                    {row.note && <p className="text-[10px] text-muted-foreground/70 mt-0.5">{row.note}</p>}
                  </td>
                  <td className="py-2 px-2 text-center">{cellFor(row.owner)}</td>
                  <td className="py-2 px-2 text-center">{cellFor(row.admin)}</td>
                  <td className="py-2 px-2 text-center">{cellFor(row.agent)}</td>
                  <td className="py-2 px-2 pr-4 sm:pr-0 text-center">{cellFor(row.viewer)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Org-level policy toggles */}
      <div className="bg-card rounded-xl border border-border p-4 sm:p-6 space-y-5">
        <div>
          <h3 className="text-base font-semibold text-foreground">Team policies</h3>
          <p className="text-xs text-muted-foreground mt-1">Org-wide rules that affect what your team can do.</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1">
            Can agents delete deals?
          </label>
          <p className="text-xs text-muted-foreground mb-2">
            Owners and admins can always delete. This setting only affects agents.
          </p>
          <select
            value={org.preferences?.agentDealDeletion || 'own'}
            onChange={(e) => updatePref('agentDealDeletion', e.target.value)}
            disabled={!isAdmin}
            className="w-full sm:w-72 px-3 py-2 rounded-lg bg-background border border-border text-sm focus:outline-none focus:border-primary transition-colors disabled:opacity-60"
          >
            <option value="own">Yes — only deals they created or own</option>
            <option value="none">No — agents cannot delete deals</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1">
            Can agents reassign deals?
          </label>
          <p className="text-xs text-muted-foreground mb-2">
            Owners and admins can always reassign. The default lets an agent hand off
            a deal that's currently theirs (or claim an unassigned one) but stops them
            from poaching deals from teammates.
          </p>
          <select
            value={org.preferences?.agentDealReassign || 'own'}
            onChange={(e) => updatePref('agentDealReassign', e.target.value)}
            disabled={!isAdmin}
            className="w-full sm:w-72 px-3 py-2 rounded-lg bg-background border border-border text-sm focus:outline-none focus:border-primary transition-colors disabled:opacity-60"
          >
            <option value="own">Yes — only deals currently assigned to them</option>
            <option value="none">No — only admins can reassign deals</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1">
            Auto-create invoice when a deal is Won?
          </label>
          <p className="text-xs text-muted-foreground mb-2">
            On any stage typed as "Won", a draft invoice is generated using line items from the latest quote (or the deal value as a fallback). You review and send it manually. Switch off if your team invoices from external accounting software.
          </p>
          <select
            value={org.preferences?.autoGenerateInvoiceOnWon === false ? 'off' : 'on'}
            onChange={(e) => updatePref('autoGenerateInvoiceOnWon', e.target.value === 'on')}
            disabled={!isAdmin}
            className="w-full sm:w-72 px-3 py-2 rounded-lg bg-background border border-border text-sm focus:outline-none focus:border-primary transition-colors disabled:opacity-60"
          >
            <option value="on">Yes — auto-draft on Won</option>
            <option value="off">No — invoices are manual only</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1">
            Lead handoff between pipelines
          </label>
          <p className="text-xs text-muted-foreground mb-2">
            When moving a lead from one pipeline (e.g. Marketing) to another (e.g. Sales), should the
            original deal be moved or should a new deal be created?
          </p>
          <select
            value={org.preferences?.dealHandoffMode || 'convert'}
            onChange={(e) => updatePref('dealHandoffMode', e.target.value)}
            disabled={!isAdmin}
            className="w-full sm:w-72 px-3 py-2 rounded-lg bg-background border border-border text-sm focus:outline-none focus:border-primary transition-colors disabled:opacity-60"
          >
            <option value="convert">Convert — create a new deal in the target pipeline</option>
            <option value="move">Move — same deal moves to the target pipeline</option>
          </select>
          <p className="text-[10px] text-muted-foreground/70 mt-1">
            The handoff feature itself is coming soon — this preference is captured in advance.
          </p>
        </div>

        <div className="pt-4 border-t border-border">
          <label className="block text-sm font-medium text-foreground mb-1">
            Deal-won notifications
          </label>
          <p className="text-xs text-muted-foreground mb-2">
            When a deal moves to <strong>Won</strong>, the deal's owner is the one closing it,
            and the original creator is always notified (closes the marketer feedback loop).
            Pick anyone else who should be looped in (typically your accountant, ops lead, or owner).
          </p>
          {team.length === 0 ? (
            <p className="text-[10px] text-muted-foreground italic">No teammates yet.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-48 overflow-y-auto border border-border rounded-lg p-2 bg-background/40">
              {team
                .filter(m => m.isActive !== false && m.status !== 'pending')
                .map(member => (
                  <label
                    key={member._id}
                    className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-xs ${
                      isAdmin ? 'cursor-pointer hover:bg-muted' : 'opacity-60'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={dealWonNotifyUsers.includes(String(member._id))}
                      onChange={() => isAdmin && toggleDealWonRecipient(member._id)}
                      disabled={!isAdmin}
                    />
                    <span className="text-foreground truncate">{member.name || member.email}</span>
                    <span className="text-[10px] text-muted-foreground/70 ml-auto capitalize">{member.role}</span>
                  </label>
                ))}
            </div>
          )}
          <p className="text-[10px] text-muted-foreground/70 mt-2">
            Recipients get an in-app notification + WhatsApp (Pro+ plans) or email fallback.
          </p>
        </div>

        {isAdmin && (
          <button
            onClick={onSave}
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary transition-colors disabled:opacity-50"
          >
            <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save Policies'}
          </button>
        )}
        {!isAdmin && (
          <p className="text-xs text-muted-foreground italic">Only owners and admins can change team policies.</p>
        )}
      </div>
    </div>
  );
}

// Accounting webhook config — separate from the n8n webhookUrl in Defaults.
// Fires HMAC-signed JSON on every invoice lifecycle event so QuickBooks /
// Xero / n8n / Zapier / custom services can stay in sync.
function AccountingWebhookSection({ org, setOrg, onSave, saving, isAdmin }) {
  const [secretVisible, setSecretVisible] = useState(false);
  const [secretCopied, setSecretCopied] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const url = org.preferences?.accountingWebhookUrl || '';
  const secret = org.preferences?.accountingWebhookSecret || '';

  const updateUrl = (val) => {
    setOrg({ ...org, preferences: { ...(org.preferences || {}), accountingWebhookUrl: val } });
  };

  const copySecret = () => {
    if (!secret) return;
    navigator.clipboard.writeText(secret);
    setSecretCopied(true);
    setTimeout(() => setSecretCopied(false), 2000);
    toast.success('Secret copied');
  };

  const regenerateSecret = async () => {
    if (!confirm('Regenerate signing secret? The current secret stops working immediately — you\'ll need to update your webhook receiver.')) return;
    setRegenerating(true);
    try {
      const { data } = await api.post('/settings/regenerate-accounting-webhook-secret');
      setOrg({ ...org, preferences: { ...(org.preferences || {}), accountingWebhookSecret: data.secret } });
      toast.success('Signing secret regenerated');
    } catch {
      toast.error('Failed to regenerate');
    } finally {
      setRegenerating(false);
    }
  };

  const [testing, setTesting] = useState(false);
  const sendTest = async () => {
    setTesting(true);
    try {
      const { data } = await api.post('/settings/test-accounting-webhook');
      if (data.success) {
        toast.success(`Receiver responded ${data.statusCode || 'OK'}`);
      } else {
        toast.error(`Test failed: ${data.error || 'unknown error'}${data.statusCode ? ` (HTTP ${data.statusCode})` : ''}`);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Test failed');
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="bg-card rounded-xl border border-border p-4 sm:p-5 space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-1">Accounting Webhook</h3>
        <p className="text-xs text-muted-foreground">
          POSTs invoice events (created · sent · paid · cancelled) to your URL — for QuickBooks, Xero, n8n, Zapier, or your own bridge.
          Each request is signed with HMAC-SHA256 in the <code className="bg-muted px-1 py-0.5 rounded text-[10px]">x-safiripro-signature</code> header.
        </p>
      </div>

      {/* "Where do I get this URL?" — practical guidance for first-time setup. */}
      <details className="rounded-lg border border-border bg-background/40 px-3 py-2 text-xs">
        <summary className="cursor-pointer font-medium text-foreground flex items-center gap-1.5">
          <Shield className="w-3.5 h-3.5 text-muted-foreground" />
          Where do I get this URL?
        </summary>
        <div className="mt-3 space-y-2 text-muted-foreground leading-relaxed">
          <p>This URL belongs to a service that <em>receives</em> SafiriPro's invoice events. Realistic options:</p>
          <ul className="space-y-1.5 pl-4 list-disc marker:text-muted-foreground/60">
            <li>
              <strong className="text-foreground">n8n</strong> (most common, self-hosted or cloud) — add a "Webhook" trigger node, copy the URL it gives you. From there chain your accounting actions (QuickBooks Online, Xero, Google Sheets, Slack, etc.).
            </li>
            <li>
              <strong className="text-foreground">Zapier</strong> or <strong className="text-foreground">Make.com</strong> — create a Zap/scenario with a "Webhooks by Zapier" / "Custom webhook" trigger. Easier setup than n8n, costs per task.
            </li>
            <li>
              <strong className="text-foreground">QuickBooks / Xero / Pastel direct</strong> — they don't accept inbound webhooks themselves. You need n8n or Zapier as middleware between SafiriPro and them.
            </li>
            <li>
              <strong className="text-foreground">webhook.site</strong> — free testing-only tool. Gives a temporary URL where you can inspect every payload. Use it to verify wiring before pointing at the real receiver.
            </li>
            <li>
              <strong className="text-foreground">Your own server</strong> — any HTTPS endpoint you control that accepts a POST and verifies the signature.
            </li>
          </ul>
          <p className="pt-1">
            Typical flow for a Kenya-based operator using QuickBooks: <strong className="text-foreground">SafiriPro → n8n webhook → n8n's QuickBooks node → invoice created in QuickBooks</strong>.
          </p>
        </div>
      </details>

      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1">Webhook URL</label>
        <div className="flex items-center gap-2">
          <input
            type="url"
            value={url}
            onChange={(e) => updateUrl(e.target.value)}
            disabled={!isAdmin}
            placeholder="https://your-receiver.com/safiripro/invoices"
            className="flex-1 min-w-0 px-3 py-2 rounded-lg bg-background border border-border text-sm focus:outline-none focus:border-primary transition-colors disabled:opacity-60"
          />
          {isAdmin && url && secret && (
            <button
              onClick={sendTest}
              disabled={testing}
              className="px-3 py-2 rounded-lg border border-border text-sm font-medium text-foreground hover:border-primary/50 disabled:opacity-50 shrink-0 inline-flex items-center gap-1.5"
              title="Fire a test event at the receiver — doesn't appear in the delivery log"
            >
              <Zap className="w-3.5 h-3.5" /> {testing ? 'Sending...' : 'Send test event'}
            </button>
          )}
        </div>
      </div>

      {secret && (
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Signing Secret</label>
          <div className="flex items-center gap-2">
            <div className="flex-1 min-w-0 font-mono text-xs bg-background px-3 py-2 rounded-lg border border-border truncate text-foreground">
              {secretVisible ? secret : '•'.repeat(Math.min(secret.length, 32))}
            </div>
            <button onClick={() => setSecretVisible(v => !v)} className="p-2 rounded-lg border border-border hover:bg-background text-muted-foreground shrink-0" title={secretVisible ? 'Hide' : 'Show'}>
              {secretVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
            <button onClick={copySecret} className="p-2 rounded-lg border border-border hover:bg-background text-muted-foreground shrink-0" title="Copy">
              {secretCopied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
          {isAdmin && (
            <button onClick={regenerateSecret} disabled={regenerating} className="mt-2 text-xs text-red-500 hover:underline disabled:opacity-50">
              {regenerating ? 'Regenerating...' : 'Regenerate signing secret'}
            </button>
          )}
        </div>
      )}

      <div className="bg-background rounded-lg p-3 border border-border space-y-3">
        <div>
          <p className="text-xs font-semibold text-foreground mb-1">Verifying the signature (Node example)</p>
          <pre className="bg-card rounded-md p-3 border border-border text-[10px] text-foreground overflow-x-auto leading-relaxed">{`import crypto from 'crypto';

const expected = 'sha256=' + crypto
  .createHmac('sha256', YOUR_SIGNING_SECRET)
  .update(rawBody)
  .digest('hex');

const provided = req.headers['x-safiripro-signature'];
const valid = crypto.timingSafeEqual(
  Buffer.from(expected),
  Buffer.from(provided)
);`}</pre>
        </div>

        <div className="border-t border-border pt-3">
          <p className="text-xs font-semibold text-foreground mb-1">Sample payload</p>
          <pre className="bg-card rounded-md p-3 border border-border text-[10px] text-foreground overflow-x-auto leading-relaxed">{`{
  "event": "invoice.paid",
  "timestamp": "2026-04-25T12:34:56.789Z",
  "organization": { "id": "...", "name": "..." },
  "invoice": {
    "id": "...",
    "number": "INV-0001",
    "status": "paid",
    "issueDate": "...",
    "dueDate": "...",
    "paidAt": "...",
    "client": { "name": "...", "email": "..." },
    "deal": { "id": "...", "title": "..." },
    "lineItems": [...],
    "subtotal": 5000,
    "taxPercent": 16,
    "taxAmount": 800,
    "total": 5800,
    "currency": "KES"
  }
}`}</pre>
        </div>
      </div>

      {isAdmin && (
        <button onClick={onSave} disabled={saving} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary disabled:opacity-50">
          <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save Webhook URL'}
        </button>
      )}
    </div>
  );
}

// Recent webhook deliveries — shown below the AccountingWebhookSection in the
// API & Webhooks tab. Operator-visible audit trail with status filter pills,
// expandable rows showing payload + error, and per-row manual retry.
function WebhookDeliveriesSection() {
  const [deliveries, setDeliveries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [expanded, setExpanded] = useState(null);
  const [retryingId, setRetryingId] = useState(null);

  const fetchDeliveries = async () => {
    try {
      const { data } = await api.get('/webhook-deliveries', { params: { limit: 100 } });
      setDeliveries(data.deliveries || []);
    } catch {
      setDeliveries([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchDeliveries(); }, []);

  const counts = useMemo(() => {
    const c = { all: deliveries.length, pending: 0, succeeded: 0, failed: 0 };
    for (const d of deliveries) c[d.status] = (c[d.status] || 0) + 1;
    return c;
  }, [deliveries]);

  const filtered = filter === 'all' ? deliveries : deliveries.filter(d => d.status === filter);

  const retry = async (id) => {
    setRetryingId(id);
    try {
      const { data } = await api.post(`/webhook-deliveries/${id}/retry`);
      setDeliveries(prev => prev.map(d => d._id === id ? data : d));
      if (data.status === 'succeeded') toast.success('Delivered');
      else if (data.status === 'pending') toast(`Retry scheduled — attempt ${data.attempts} failed (${data.lastError || 'will retry'})`);
      else toast.error(`Failed: ${data.lastError || 'unknown error'}`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Retry failed');
    } finally {
      setRetryingId(null);
    }
  };

  const fmtTime = (d) => d ? new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—';

  const FILTERS = [
    { key: 'all',       label: 'All' },
    { key: 'pending',   label: 'Pending' },
    { key: 'succeeded', label: 'Succeeded' },
    { key: 'failed',    label: 'Failed' },
  ];

  const STATUS_STYLE = {
    pending:   'bg-amber-50 text-amber-700 border-amber-200',
    succeeded: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    failed:    'bg-red-50 text-red-700 border-red-200',
  };

  return (
    <div className="bg-card rounded-xl border border-border p-4 sm:p-5 space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Recent Deliveries</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Last 100 webhook attempts. Failed deliveries retry automatically (1m, 5m, 30m, 2h, 12h).
          </p>
        </div>
        <button
          onClick={fetchDeliveries}
          className="text-xs text-muted-foreground hover:text-foreground"
          title="Refresh"
        >
          Refresh
        </button>
      </div>

      <div className="flex bg-background rounded-lg border border-border p-1 w-fit overflow-x-auto">
        {FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
              filter === f.key ? 'bg-primary text-white' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {f.label}
            {f.key !== 'all' && (
              <span className={`ml-1 text-[10px] tabular-nums ${filter === f.key ? 'opacity-80' : 'opacity-60'}`}>
                {counts[f.key] || 0}
              </span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-6 flex items-center justify-center">
          <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-6 text-center">
          <p className="text-xs text-muted-foreground">
            {deliveries.length === 0
              ? 'No deliveries yet. They\'ll show up here when invoice events fire.'
              : `No ${filter} deliveries.`}
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-border -mx-1">
          {filtered.map((d) => {
            const isOpen = expanded === d._id;
            const canRetry = d.status !== 'succeeded';
            return (
              <li key={d._id} className="px-1 py-2">
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        onClick={() => setExpanded(isOpen ? null : d._id)}
                        className="text-xs font-medium text-foreground hover:text-primary inline-flex items-center gap-1"
                      >
                        {d.event}
                        {isOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      </button>
                      <span className={`text-[10px] inline-flex items-center px-1.5 py-0.5 rounded border ${STATUS_STYLE[d.status]} font-medium uppercase tracking-wide`}>
                        {d.status}
                      </span>
                      {d.relatedInvoice && (
                        <span className="text-[10px] text-muted-foreground tabular-nums">
                          INV-{String(d.relatedInvoice.invoiceNumber).padStart(4, '0')}
                        </span>
                      )}
                      <span className="text-[10px] text-muted-foreground/70">
                        {fmtTime(d.lastAttemptAt || d.createdAt)} · attempt {d.attempts}/{d.maxAttempts}
                      </span>
                    </div>
                    {d.lastError && d.status !== 'succeeded' && (
                      <p className="text-[11px] text-red-600 mt-0.5 truncate" title={d.lastError}>⚠ {d.lastError}</p>
                    )}
                    {d.status === 'pending' && d.nextAttemptAt && (
                      <p className="text-[11px] text-amber-600 mt-0.5">
                        Next retry: {fmtTime(d.nextAttemptAt)}
                      </p>
                    )}
                    {isOpen && (
                      <div className="mt-2 p-2 rounded-md bg-background border border-border">
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">URL</p>
                        <p className="text-[11px] text-foreground break-all mb-2">{d.url}</p>
                        {d.lastResponseStatus && (
                          <>
                            <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Last response</p>
                            <p className="text-[11px] text-foreground mb-2">HTTP {d.lastResponseStatus}</p>
                          </>
                        )}
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Payload</p>
                        <pre className="text-[10px] text-foreground bg-card border border-border rounded p-2 overflow-x-auto max-h-40 overflow-y-auto">
                          {JSON.stringify(d.payload, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                  {canRetry && (
                    <button
                      onClick={() => retry(d._id)}
                      disabled={retryingId === d._id}
                      className="px-2 py-1 rounded text-[10px] font-medium text-primary hover:bg-muted disabled:opacity-50 shrink-0 inline-flex items-center gap-1"
                      title="Retry now"
                    >
                      <RotateCcw className="w-3 h-3" /> {retryingId === d._id ? 'Retrying...' : 'Retry'}
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
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
      <div className="bg-card rounded-xl border border-border p-4 sm:p-5">
        <h3 className="text-sm font-semibold text-foreground mb-1">API Key</h3>
        <p className="text-xs text-muted-foreground mb-4">
          Use this key in the <code className="bg-muted px-1 py-0.5 rounded text-[10px]">x-api-key</code> header when calling the CRM from n8n or any external tool.
        </p>
        <div className="flex items-center gap-2">
          <div className="flex-1 min-w-0 font-mono text-sm bg-background px-3 py-2.5 rounded-lg border border-border truncate text-foreground">
            {visible ? (apiKey || 'No API key generated') : '•'.repeat(32)}
          </div>
          <button onClick={() => setVisible(v => !v)} className="p-2 rounded-lg border border-border hover:bg-background transition-colors text-muted-foreground shrink-0">
            {visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
          <button onClick={copy} disabled={!apiKey} className="p-2 rounded-lg border border-border hover:bg-background transition-colors text-muted-foreground disabled:opacity-50 shrink-0">
            {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>
        <button onClick={regenerate} disabled={regenerating} className="mt-3 text-xs text-red-500 hover:underline disabled:opacity-50">
          {regenerating ? 'Regenerating...' : 'Regenerate API key'}
        </button>
      </div>

      <div className="bg-card rounded-xl border border-border p-4 sm:p-5">
        <h3 className="text-sm font-semibold text-foreground mb-3">Webhook Endpoints</h3>
        <p className="text-xs text-muted-foreground mb-4">Use these endpoints from n8n, Zapier, or any HTTP client. All requests require the <code className="bg-muted px-1 py-0.5 rounded text-[10px]">x-api-key</code> header.</p>

        <div className="bg-background rounded-lg p-3 sm:p-4 space-y-3 border border-border">
          <div>
            <p className="text-xs font-semibold text-foreground mb-1">n8n HTTP Request node setup:</p>
            <div className="space-y-1 text-xs text-muted-foreground">
              <p className="break-all">Header: <code className="text-foreground bg-muted px-1 rounded">x-api-key: {visible ? (apiKey || 'your-key') : '(click eye to reveal)'}</code></p>
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
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded mt-0.5 shrink-0 ${ep.method === 'GET' ? 'bg-green-100 text-green-700' : ep.method === 'POST' ? 'bg-blue-100 text-blue-700' : 'bg-primary/15 text-primary'}`}>
                    {ep.method}
                  </span>
                  <div className="min-w-0">
                    <code className="text-xs text-foreground break-all">{ep.path}</code>
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
