import { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { formatCurrency, formatDate, getInitials } from '../utils/helpers';
import { safeHref } from '../utils/safeUrl';
import toast from 'react-hot-toast';
import {
  ArrowLeft, MapPin, Calendar, Users as UsersIcon, DollarSign,
  FileText, Clock, Plus, CheckCircle2, Circle, Send, Eye,
  Sparkles, Mail, Edit3, Save, Upload, Paperclip, Trash2,
} from 'lucide-react';
import ConfirmDialog from '../components/shared/ConfirmDialog';
import ScheduledMessagesPanel from '../components/crm/ScheduledMessagesPanel';
import InvoicesPanel from '../components/crm/InvoicesPanel';
import VouchersPanel from '../components/crm/VouchersPanel';
import SendEmailModal from '../components/crm/SendEmailModal';

export default function DealDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [deal, setDeal] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [quotes, setQuotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showSendEmail, setShowSendEmail] = useState(false);

  const fetchDeal = async () => {
    try {
      const { data } = await api.get(`/crm/deals/${id}`);
      setDeal(data.deal);
      setTasks(data.tasks);
      setQuotes(data.quotes || []);
    } catch {
      toast.error('Deal not found');
      navigate('/crm');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchDeal(); }, [id]);

  if (loading || !deal) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const readiness = [
    { key: 'destination', label: 'Destination', value: deal.destination, ready: !!deal.destination, icon: MapPin },
    { key: 'dates', label: 'Travel Dates', value: deal.travelDates?.start ? `${formatDate(deal.travelDates.start)} - ${formatDate(deal.travelDates.end)}` : null, ready: !!deal.travelDates?.start, icon: Calendar },
    { key: 'group', label: 'Group Size', value: deal.groupSize > 0 ? `${deal.groupSize} travelers` : null, ready: deal.groupSize > 0, icon: UsersIcon },
    { key: 'budget', label: 'Budget', value: deal.budget > 0 ? formatCurrency(deal.budget, deal.budgetCurrency) : null, ready: deal.budget > 0, icon: DollarSign },
  ];

  const allReady = readiness.every(r => r.ready);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Back */}
      <Link to="/crm" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to CRM
      </Link>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl sm:text-2xl font-bold text-foreground" style={{ fontFamily: 'Playfair Display, serif' }}>
            {deal.title}
          </h1>
          <div className="flex items-center gap-2 sm:gap-3 mt-1 flex-wrap">
            <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-foreground">{deal.stage}</span>
            {deal.contact && (
              <span className="text-xs sm:text-sm text-muted-foreground truncate">
                {deal.contact.firstName} {deal.contact.lastName}
                {deal.contact.email && ` · ${deal.contact.email}`}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto shrink-0">
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-lg border border-border text-sm text-muted-foreground hover:text-red-500 hover:border-red-200 transition-colors"
          >
            <Trash2 className="w-4 h-4" /> Archive
          </button>
          <button
            onClick={() => setShowSendEmail(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-lg border border-border text-sm text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors"
          >
            <Mail className="w-4 h-4" /> Send email
          </button>
          {allReady && (
            <Link
              to={`/quotes/new?deal=${deal._id}`}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary transition-colors animate-scale-in"
            >
              <FileText className="w-4 h-4" /> Generate Quote
            </Link>
          )}
        </div>
      </div>

      {showDeleteConfirm && (
        <ConfirmDialog
          title="Archive this deal?"
          message={`"${deal.title}" will be archived and hidden from your pipeline. You can restore it later if needed.`}
          confirmLabel="Archive Deal"
          onConfirm={async () => {
            await api.delete(`/crm/deals/${deal._id}`);
            toast.success('Deal archived');
            navigate('/crm');
          }}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}
      {showSendEmail && (
        <SendEmailModal
          deal={deal}
          onClose={() => setShowSendEmail(false)}
          onSent={() => { setShowSendEmail(false); fetchDeal(); }}
        />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main column */}
        <div className="lg:col-span-2 space-y-4">
          {/* Quote Readiness */}
          <div className="bg-card rounded-xl border border-border p-4 sm:p-5">
            <h3 className="text-sm font-semibold text-foreground mb-4">Quote Readiness</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {readiness.map(({ key, label, value, ready, icon: Icon }) => (
                <div key={key} className={`flex items-start gap-3 p-3 rounded-lg border ${ready ? 'border-green-200 bg-green-50/50' : 'border-border bg-background'}`}>
                  <div className={`mt-0.5 ${ready ? 'text-green-500' : 'text-muted-foreground/40'}`}>
                    {ready ? <CheckCircle2 className="w-5 h-5" /> : <Circle className="w-5 h-5" />}
                  </div>
                  <div>
                    <p className={`text-sm font-medium ${ready ? 'text-green-800' : 'text-muted-foreground'}`}>{label}</p>
                    <p className={`text-xs mt-0.5 ${ready ? 'text-green-600' : 'text-muted-foreground/70'}`}>
                      {value || 'Not set'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            {!allReady && (
              <p className="text-xs text-muted-foreground mt-3">Complete all fields above to enable quote generation.</p>
            )}
          </div>

          {/* Notes — dedicated section */}
          <NotesSection dealId={deal._id} notes={deal.notes || []} onUpdated={fetchDeal} />

          {/* Scheduled messages — pre-trip / post-trip outreach to the client */}
          <ScheduledMessagesPanel deal={deal} />

          {/* Invoices — generate / download / track payment for this deal */}
          <InvoicesPanel deal={deal} />

          {/* Hotel vouchers — issue check-in vouchers for confirmed bookings */}
          <VouchersPanel deal={deal} />

          {/* Activity Timeline — auto events only */}
          <div className="bg-card rounded-xl border border-border p-4 sm:p-5">
            <h3 className="text-sm font-semibold text-foreground mb-4">Activity Timeline</h3>
            {deal.activities?.length > 0 ? (
              <div className="space-y-3">
                {[...deal.activities].reverse().map((act, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-xs flex-shrink-0 mt-0.5 ${
                      act.type === 'stage_change' ? 'bg-blue-500' :
                      act.type === 'quote_sent' ? 'bg-amber-500' :
                      act.type === 'quote_viewed' ? 'bg-green-500' :
                      'bg-muted-foreground/40'
                    }`}>
                      {act.type === 'stage_change' ? '→' :
                       act.type === 'quote_sent' ? <Send className="w-3 h-3" /> :
                       act.type === 'quote_viewed' ? <Eye className="w-3 h-3" /> : '•'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-foreground break-words">{act.description}</p>
                      <p className="text-xs text-muted-foreground/70">{formatDate(act.createdAt)}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground/70 text-center py-4">No activity yet</p>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* AI Summary */}
          <AISummaryCard deal={deal} />

          {/* Deal Info — inline editable */}
          <DealInfoCard deal={deal} onUpdated={fetchDeal} />

          {/* Linked quotes */}
          <div className="bg-card rounded-xl border border-border p-4 sm:p-5">
            <div className="flex items-center justify-between gap-2 mb-3">
              <h3 className="text-sm font-semibold text-foreground">Quotes</h3>
              <Link
                to={`/quotes/new?deal=${deal._id}`}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium text-primary hover:bg-primary/10 transition-colors"
              >
                <FileText className="w-3 h-3" /> New quote
              </Link>
            </div>
            {quotes.length > 0 ? (
              quotes.map((q) => (
                <Link key={q._id} to={`/quotes/${q._id}`} className="flex items-center justify-between gap-2 py-2 border-b border-border last:border-0 hover:bg-background -mx-2 px-2 rounded transition-colors">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">{q.title}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      #{q.quoteNumber}{q.version > 1 ? ` v${q.version}` : ''} · {q.status}
                    </p>
                  </div>
                  {q.pricing?.totalPrice > 0 && (
                    <span className="text-xs font-medium text-foreground tabular-nums shrink-0">
                      {q.pricing.currency} {Math.round(q.pricing.totalPrice).toLocaleString()}
                    </span>
                  )}
                </Link>
              ))
            ) : (
              <p className="text-xs text-muted-foreground/70 text-center py-2">No quotes yet — click "New quote" to start one.</p>
            )}
          </div>

          {/* Tasks */}
          <div className="bg-card rounded-xl border border-border p-4 sm:p-5">
            <h3 className="text-sm font-semibold text-foreground mb-3">Tasks</h3>
            {tasks.length > 0 ? (
              tasks.map((t) => (
                <div key={t._id} className="flex items-center gap-2 py-2 border-b border-border last:border-0">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${t.status === 'done' ? 'bg-green-500' : 'bg-border'}`} />
                  <p className={`text-sm truncate ${t.status === 'done' ? 'text-muted-foreground/70 line-through' : 'text-foreground'}`}>{t.title}</p>
                </div>
              ))
            ) : (
              <p className="text-xs text-muted-foreground/70 text-center py-2">No tasks</p>
            )}
          </div>

          {/* File Attachments */}
          <DealAttachments dealId={deal._id} attachments={deal.attachments || []} onUpdated={fetchDeal} />
        </div>
      </div>
    </div>
  );
}

// ─── AI Summary Card ────────────────────────────

function AISummaryCard({ deal }) {
  const [summary, setSummary] = useState('');
  const [loading, setLoading] = useState(false);
  const [emailDraft, setEmailDraft] = useState('');
  const [emailLoading, setEmailLoading] = useState(false);
  const [showEmail, setShowEmail] = useState(false);

  const getSummary = async () => {
    setLoading(true);
    try {
      const { data } = await api.post('/ai/deal-summary', {
        deal: {
          title: deal.title,
          stage: deal.stage,
          contactName: deal.contact ? `${deal.contact.firstName} ${deal.contact.lastName}` : '',
          destination: deal.destination,
          dates: deal.travelDates?.start ? formatDate(deal.travelDates.start) : '',
          groupSize: deal.groupSize,
          budget: deal.budget,
        },
        activities: deal.activities?.slice(0, 5).map(a => a.description) || [],
        quotes: deal.quotes?.length || 0,
      });
      setSummary(data.summary);
    } catch {
      toast.error('AI summary failed');
    } finally {
      setLoading(false);
    }
  };

  const draftEmail = async (type) => {
    setEmailLoading(true);
    setShowEmail(true);
    try {
      const { data } = await api.post('/ai/draft-email', {
        type,
        context: `Deal: ${deal.title}, Stage: ${deal.stage}, Destination: ${deal.destination || 'TBD'}`,
        recipientName: deal.contact ? `${deal.contact.firstName}` : '',
        senderName: '',
        companyName: '',
      });
      setEmailDraft(data.email);
    } catch {
      toast.error('Email draft failed');
    } finally {
      setEmailLoading(false);
    }
  };

  return (
    <div className="bg-card rounded-xl border border-border p-4 sm:p-5">
      <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-1.5">
        <Sparkles className="w-4 h-4 text-primary" /> AI Assistant
      </h3>

      {summary ? (
        <p className="text-xs text-muted-foreground leading-relaxed mb-3 p-2 bg-primary/10 rounded-lg border border-amber-100">{summary}</p>
      ) : (
        <button
          onClick={getSummary}
          disabled={loading}
          className="w-full mb-3 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-gradient-to-r from-amber-50 to-orange-50 border border-primary/30 text-xs text-primary font-medium hover:from-amber-100 hover:to-orange-100 disabled:opacity-50 transition-all"
        >
          <Sparkles className="w-3.5 h-3.5" /> {loading ? 'Analyzing...' : 'Get AI Summary'}
        </button>
      )}

      <div className="flex gap-1.5 flex-wrap">
        <button onClick={() => draftEmail('follow_up')} className="flex-1 px-2 py-1.5 rounded-md border border-border text-[10px] text-muted-foreground font-medium hover:border-primary/50 transition-colors whitespace-nowrap">
          <Mail className="w-3 h-3 inline mr-1" />Follow-up
        </button>
        <button onClick={() => draftEmail('quote_send')} className="flex-1 px-2 py-1.5 rounded-md border border-border text-[10px] text-muted-foreground font-medium hover:border-primary/50 transition-colors whitespace-nowrap">
          <Send className="w-3 h-3 inline mr-1" />Quote Email
        </button>
      </div>

      {showEmail && (
        <div className="mt-3 animate-scale-in">
          {emailLoading ? (
            <div className="flex items-center justify-center py-4">
              <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <>
              <textarea
                value={emailDraft}
                onChange={(e) => setEmailDraft(e.target.value)}
                rows={6}
                className="w-full px-3 py-2 rounded-lg bg-background border border-border text-xs text-foreground focus:outline-none focus:border-primary resize-none"
              />
              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => { navigator.clipboard.writeText(emailDraft); toast.success('Copied!'); }}
                  className="flex-1 px-3 py-1.5 rounded-md bg-primary text-white text-xs font-medium hover:bg-primary transition-colors"
                >
                  Copy Email
                </button>
                <button onClick={() => setShowEmail(false)} className="px-3 py-1.5 rounded-md text-xs text-muted-foreground hover:bg-muted">
                  Close
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Deal Info Card — inline editing ────────────

function DealInfoCard({ deal, onUpdated }) {
  const [editing, setEditing] = useState(false);
  const [team, setTeam] = useState([]);
  const [form, setForm] = useState({
    destination: deal.destination || '',
    arrivalCity: deal.arrivalCity || '',
    tripType: deal.tripType || '',
    tripDuration: deal.tripDuration || '',
    groupSize: deal.groupSize || '',
    budget: deal.budget || '',
    budgetCurrency: deal.budgetCurrency || 'USD',
    startDate: deal.travelDates?.start?.split('T')[0] || '',
    endDate: deal.travelDates?.end?.split('T')[0] || '',
    specialRequests: deal.specialRequests || '',
    leadSource: deal.leadSource || '',
    expectedCloseDate: deal.expectedCloseDate?.split('T')[0] || '',
    value: deal.value || '',
    assignedTo: deal.assignedTo?._id || deal.assignedTo || '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/settings/team').then(({ data }) => setTeam(data.members)).catch(() => {});
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put(`/crm/deals/${deal._id}`, {
        destination: form.destination, arrivalCity: form.arrivalCity, tripType: form.tripType,
        tripDuration: parseInt(form.tripDuration) || 0, groupSize: parseInt(form.groupSize) || 0,
        budget: parseFloat(form.budget) || 0, budgetCurrency: form.budgetCurrency,
        travelDates: { start: form.startDate || null, end: form.endDate || null },
        specialRequests: form.specialRequests, leadSource: form.leadSource,
        expectedCloseDate: form.expectedCloseDate || null, value: parseFloat(form.value) || 0,
        assignedTo: form.assignedTo || null,
      });
      toast.success('Updated');
      setEditing(false);
      onUpdated();
    } catch (err) { toast.error('Update failed'); }
    finally { setSaving(false); }
  };

  const inputCls = 'w-full px-2 py-1.5 rounded-md bg-background border border-border text-xs focus:outline-none focus:border-primary';
  const Row = ({ label, value }) => (
    <div className="flex justify-between gap-2 py-1">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className="text-foreground font-medium text-right truncate min-w-0">{value || '\u2014'}</span>
    </div>
  );

  const tripTypeLabels = { safari: 'Safari', beach: 'Beach Holiday', honeymoon: 'Honeymoon', family: 'Family Trip', corporate: 'Corporate', adventure: 'Adventure', cultural: 'Cultural', mixed: 'Mixed' };
  const leadLabels = { website: 'Website', referral: 'Referral', repeat: 'Repeat Client', travel_agent: 'Travel Agent', social: 'Social Media', email: 'Email', phone: 'Phone', walk_in: 'Walk-in', other: 'Other' };

  return (
    <div className="bg-card rounded-xl border border-border p-4 sm:p-5">
      <div className="flex items-center justify-between mb-3 gap-3">
        <h3 className="text-sm font-semibold text-foreground">Deal Info</h3>
        <button onClick={() => editing ? handleSave() : setEditing(true)} disabled={saving} className="text-xs text-primary hover:underline flex items-center gap-1 shrink-0">
          {editing ? <><Save className="w-3 h-3" /> {saving ? 'Saving...' : 'Save'}</> : <><Edit3 className="w-3 h-3" /> Edit</>}
        </button>
      </div>

      {editing ? (
        <div className="space-y-2">
          <div><label className="block text-[10px] text-muted-foreground mb-0.5">Destination</label><input type="text" value={form.destination} onChange={e => setForm({...form, destination: e.target.value})} className={inputCls} /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="block text-[10px] text-muted-foreground mb-0.5">Arrival City</label><input type="text" value={form.arrivalCity} onChange={e => setForm({...form, arrivalCity: e.target.value})} className={inputCls} placeholder="Nairobi" /></div>
            <div><label className="block text-[10px] text-muted-foreground mb-0.5">Trip Type</label>
              <select value={form.tripType} onChange={e => setForm({...form, tripType: e.target.value})} className={inputCls}>
                <option value="">—</option>
                {Object.entries(tripTypeLabels).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="block text-[10px] text-muted-foreground mb-0.5">Duration (nights)</label><input type="number" value={form.tripDuration} onChange={e => setForm({...form, tripDuration: e.target.value})} className={inputCls} /></div>
            <div><label className="block text-[10px] text-muted-foreground mb-0.5">Group Size</label><input type="number" value={form.groupSize} onChange={e => setForm({...form, groupSize: e.target.value})} className={inputCls} /></div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="block text-[10px] text-muted-foreground mb-0.5">Budget</label><input type="number" value={form.budget} onChange={e => setForm({...form, budget: e.target.value})} className={inputCls} /></div>
            <div><label className="block text-[10px] text-muted-foreground mb-0.5">Deal Value</label><input type="number" value={form.value} onChange={e => setForm({...form, value: e.target.value})} className={inputCls} /></div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="block text-[10px] text-muted-foreground mb-0.5">Start Date</label><input type="date" value={form.startDate} onChange={e => setForm({...form, startDate: e.target.value})} className={inputCls} /></div>
            <div><label className="block text-[10px] text-muted-foreground mb-0.5">End Date</label><input type="date" value={form.endDate} onChange={e => setForm({...form, endDate: e.target.value})} className={inputCls} /></div>
          </div>
          <div><label className="block text-[10px] text-muted-foreground mb-0.5">Special Requests</label><textarea rows={2} value={form.specialRequests} onChange={e => setForm({...form, specialRequests: e.target.value})} className={`${inputCls} resize-none`} /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="block text-[10px] text-muted-foreground mb-0.5">Lead Source</label>
              <select value={form.leadSource} onChange={e => setForm({...form, leadSource: e.target.value})} className={inputCls}>
                <option value="">—</option>
                {Object.entries(leadLabels).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div><label className="block text-[10px] text-muted-foreground mb-0.5">Expected Close</label><input type="date" value={form.expectedCloseDate} onChange={e => setForm({...form, expectedCloseDate: e.target.value})} className={inputCls} /></div>
          </div>
          <div>
            <label className="block text-[10px] text-muted-foreground mb-0.5">Assigned To</label>
            <select value={form.assignedTo} onChange={e => setForm({...form, assignedTo: e.target.value})} className={inputCls}>
              <option value="">Unassigned</option>
              {team.map(m => <option key={m._id} value={m._id}>{m.name}</option>)}
            </select>
          </div>
          <button onClick={() => setEditing(false)} className="text-xs text-muted-foreground/70 hover:text-muted-foreground">Cancel</button>
        </div>
      ) : (
        <div className="text-xs divide-y divide-border/60">
          <Row label="Assigned To" value={deal.assignedTo?.name} />
          <Row label="Destination" value={deal.destination} />
          <Row label="Arrival City" value={deal.arrivalCity} />
          <Row label="Trip Type" value={tripTypeLabels[deal.tripType]} />
          <Row label="Duration" value={deal.tripDuration ? `${deal.tripDuration} nights` : null} />
          <Row label="Group Size" value={deal.groupSize ? `${deal.groupSize} travelers` : null} />
          <Row label="Budget" value={deal.budget ? formatCurrency(deal.budget, deal.budgetCurrency) : null} />
          <Row label="Deal Value" value={deal.value ? formatCurrency(deal.value, deal.currency) : null} />
          <Row label="Dates" value={deal.travelDates?.start ? `${formatDate(deal.travelDates.start)}${deal.travelDates?.end ? ' \u2192 ' + formatDate(deal.travelDates.end) : ''}` : null} />
          <Row label="Lead Source" value={leadLabels[deal.leadSource]} />
          <Row label="Expected Close" value={deal.expectedCloseDate ? formatDate(deal.expectedCloseDate) : null} />
          {deal.interests?.length > 0 && (
            <div className="py-1.5">
              <span className="text-muted-foreground block mb-1">Interests</span>
              <div className="flex flex-wrap gap-1">
                {deal.interests.map((interest, idx) => <span key={idx} className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded capitalize">{interest}</span>)}
              </div>
            </div>
          )}
          {deal.specialRequests && (
            <div className="py-1.5">
              <span className="text-muted-foreground block mb-1">Special Requests</span>
              <p className="text-foreground leading-relaxed">{deal.specialRequests}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function NotesSection({ dealId, notes, onUpdated }) {
  const [text, setText] = useState('');
  const [adding, setAdding] = useState(false);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    setAdding(true);
    try {
      await api.post(`/crm/deals/${dealId}/notes`, { text: text.trim() });
      setText('');
      onUpdated();
    } catch (err) { toast.error('Failed to add note'); }
    finally { setAdding(false); }
  };

  const handleDelete = async (noteId) => {
    try { await api.delete(`/crm/deals/${dealId}/notes/${noteId}`); onUpdated(); }
    catch (err) { toast.error('Delete failed'); }
  };

  const handlePin = async (noteId) => {
    try { await api.put(`/crm/deals/${dealId}/notes/${noteId}`); onUpdated(); }
    catch (err) { toast.error('Pin failed'); }
  };

  const sorted = [...notes].sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    return new Date(b.createdAt) - new Date(a.createdAt);
  });

  return (
    <div className="bg-card rounded-xl border border-border p-4 sm:p-5">
      <h3 className="text-sm font-semibold text-foreground mb-3">Notes</h3>
      <form onSubmit={handleAdd} className="flex gap-2 mb-4">
        <input type="text" value={text} onChange={(e) => setText(e.target.value)} placeholder="Add a note..." className="flex-1 min-w-0 px-3 py-2 rounded-lg bg-background border border-border text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:border-primary transition-colors" />
        <button type="submit" disabled={adding || !text.trim()} className="px-3 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary transition-colors disabled:opacity-50 shrink-0">
          {adding ? '...' : 'Add'}
        </button>
      </form>
      {sorted.length > 0 ? (
        <div className="space-y-2">
          {sorted.map((note, idx) => (
            <div key={note._id || `note-${idx}`} className={`p-3 rounded-lg border group ${note.isPinned ? 'border-primary/30 bg-primary/10/30' : 'border-border bg-background/50'}`}>
              <p className="text-sm text-foreground leading-relaxed break-words">{note.text}</p>
              <div className="flex items-center justify-between mt-2 gap-2 flex-wrap">
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground/70 flex-wrap min-w-0">
                  {note.createdBy?.name && <span className="truncate">{note.createdBy.name}</span>}
                  <span>{formatDate(note.createdAt)}</span>
                  {note.isPinned && <span className="text-primary font-medium">Pinned</span>}
                </div>
                <div className="flex gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity shrink-0">
                  <button onClick={() => handlePin(note._id)} className="text-[10px] text-muted-foreground/70 hover:text-primary px-1">{note.isPinned ? 'Unpin' : 'Pin'}</button>
                  <button onClick={() => handleDelete(note._id)} className="text-[10px] text-muted-foreground/70 hover:text-red-500 px-1">Delete</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground/70 text-center py-2">No notes yet</p>
      )}
    </div>
  );
}

function DealAttachments({ dealId, attachments, onUpdated }) {
  const fileRef = useRef();
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('entityType', 'deal');
      formData.append('entityId', dealId);
      await api.post('/uploads/attachment', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success('File uploaded');
      onUpdated();
    } catch {
      toast.error('Upload failed');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleDelete = async (fileUrl) => {
    try {
      await api.delete('/uploads/attachment', {
        data: { entityType: 'deal', entityId: dealId, fileUrl },
      });
      toast.success('Removed');
      onUpdated();
    } catch {
      toast.error('Delete failed');
    }
  };

  return (
    <div className="bg-card rounded-xl border border-border p-4 sm:p-5">
      <div className="flex items-center justify-between mb-3 gap-3">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
          <Paperclip className="w-3.5 h-3.5 text-muted-foreground/70" /> Files
        </h3>
        <input type="file" ref={fileRef} onChange={handleUpload} className="hidden" />
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="text-xs text-primary hover:underline flex items-center gap-0.5 disabled:opacity-50 shrink-0"
        >
          <Upload className="w-3 h-3" /> {uploading ? 'Uploading...' : 'Upload'}
        </button>
      </div>
      {attachments.length > 0 ? (
        <div className="space-y-1.5">
          {attachments.map((att, i) => (
            <div key={i} className="flex items-center justify-between gap-2 py-1.5 px-2 rounded-md hover:bg-background group">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <FileText className="w-3.5 h-3.5 text-muted-foreground/70 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <a href={safeHref(att.url)} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-foreground hover:text-primary truncate block">{att.name}</a>
                  <p className="text-[10px] text-muted-foreground/70">{formatDate(att.uploadedAt)}</p>
                </div>
              </div>
              <button onClick={() => handleDelete(att.url)} className="p-1 rounded text-muted-foreground/40 hover:text-red-500 sm:opacity-0 sm:group-hover:opacity-100 transition-all shrink-0">
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground/70 text-center py-2">No files attached</p>
      )}
    </div>
  );
}
