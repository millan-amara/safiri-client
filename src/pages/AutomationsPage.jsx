import { useState, useEffect } from 'react';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { formatDate, getInitials } from '../utils/helpers';
import {
  Zap, Plus, ToggleLeft, ToggleRight, Trash2, Play, Clock,
  Search, CheckCircle2, AlertCircle,
} from 'lucide-react';

const TRIGGER_LABELS = {
  'deal.stage_changed': '🚀 Deal moves to a new stage',
  'deal.created': '✨ New deal is created',
  'deal.won': '🏆 Deal is marked as won',
  'deal.lost': '💔 Deal is marked as lost',
  'contact.created': '👤 New contact is added',
  'task.assigned': '📌 Task is assigned',
  'task.overdue': '⏰ Task becomes overdue',
  'deal.inactive': '❄️ Deal goes cold (no activity)',
  'quote.viewed': '👁️ Client views a quote',
  'quote.sent': '📤 Quote is sent',
};

const ACTION_LABELS = {
  send_email: '✉️ Send email',
  send_notification: '🔔 In-app notification',
  send_whatsapp: '💬 Send WhatsApp message',
  send_webhook: '🔗 Send to n8n / webhook',
  create_task: '✅ Create task',
  create_deal: '💼 Open new deal',
  assign_to_user: '👤 Assign to team member',
  add_tag: '🏷️ Add tag to contact',
};

const CATEGORY_INFO = {
  core: { icon: '✨', title: 'Essential', desc: 'Recommended for every business' },
  deals: { icon: '💼', title: 'Deals', desc: 'Keep your pipeline moving' },
  tasks: { icon: '✅', title: 'Tasks', desc: 'Never miss a follow-up' },
  advanced: { icon: '🔗', title: 'Advanced', desc: 'n8n webhooks and integrations' },
};

export default function AutomationsPage() {
  const [automations, setAutomations] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [team, setTeam] = useState([]);
  const [pipelines, setPipelines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('my');
  const [showBuilder, setShowBuilder] = useState(false);
  const [activateTemplate, setActivateTemplate] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  const fetchAll = async () => {
    try {
      const [autoRes, templateRes, teamRes, pipeRes] = await Promise.all([
        api.get('/automations'),
        api.get('/automations/templates'),
        api.get('/settings/team'),
        api.get('/crm/pipelines'),
      ]);
      setAutomations(autoRes.data.automations);
      setTemplates(templateRes.data.templates);
      setTeam(teamRes.data.members);
      setPipelines(pipeRes.data.pipelines);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchAll(); }, []);

  const toggleAuto = async (id) => {
    try {
      await api.patch(`/automations/${id}/toggle`);
      fetchAll();
    } catch (err) { toast.error('Toggle failed'); }
  };

  const deleteAuto = async (id) => {
    try {
      await api.delete(`/automations/${id}`);
      toast.success('Automation deleted');
      fetchAll();
    } catch (err) { toast.error('Delete failed'); }
  };

  const filteredTemplates = templates.filter(t => {
    if (selectedCategory !== 'all' && t.category !== selectedCategory) return false;
    if (searchQuery && !t.name.toLowerCase().includes(searchQuery.toLowerCase()) && !t.description.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const activeTemplateIds = automations.filter(a => a.isActive && a.templateId).map(a => a.templateId);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground" style={{ fontFamily: 'Playfair Display, serif' }}>Automations</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Automate your workflow so nothing slips through</p>
        </div>
        <button onClick={() => setShowBuilder(true)} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary transition-colors">
          <Plus className="w-4 h-4" /> Custom Automation
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {[
          { id: 'my', label: 'My Automations', count: automations.length },
          { id: 'templates', label: 'Templates', count: templates.length },
        ].map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors relative ${activeTab === t.id ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}>
            {t.label}
            {t.count > 0 && <span className={`ml-1.5 px-1.5 py-0.5 text-xs rounded-full ${activeTab === t.id ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'}`}>{t.count}</span>}
            {activeTab === t.id && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" />}
          </button>
        ))}
      </div>

      {/* My Automations */}
      {activeTab === 'my' && (
        automations.length === 0 ? (
          <div className="bg-card rounded-xl border border-border p-16 text-center">
            <Zap className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-base font-medium text-foreground">No automations yet</p>
            <p className="text-sm text-muted-foreground/70 mt-1 mb-4">Use a template or build a custom automation</p>
            <button onClick={() => setActiveTab('templates')} className="text-sm text-primary hover:underline">Browse templates</button>
          </div>
        ) : (
          <div className="space-y-3">
            {automations.map(auto => (
              <div key={auto._id} className="bg-card rounded-xl border border-border p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${auto.isActive ? 'bg-green-50' : 'bg-muted'}`}>
                      <Zap className={`w-5 h-5 ${auto.isActive ? 'text-green-600' : 'text-muted-foreground/70'}`} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-foreground truncate">{auto.name}</p>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex items-center gap-0.5 ${auto.isActive ? 'bg-green-100 text-green-700' : 'bg-muted text-muted-foreground'}`}>
                          {auto.isActive ? <><CheckCircle2 className="w-3 h-3" /> Active</> : 'Paused'}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">When: {TRIGGER_LABELS[auto.trigger?.type] || auto.trigger?.type}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {auto.actions?.map((a, i) => <span key={i} className="text-[10px] bg-background text-muted-foreground px-1.5 py-0.5 rounded border border-border">{ACTION_LABELS[a.type]}</span>)}
                      </div>
                      <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground/70">
                        {auto.runCount > 0 && <span className="flex items-center gap-1"><Play className="w-3 h-3" />{auto.runCount} runs</span>}
                        {auto.lastRunAt && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{formatDate(auto.lastRunAt)}</span>}
                        {auto.lastRunStatus && <span className={`px-1.5 py-0.5 rounded text-[10px] ${auto.lastRunStatus === 'success' ? 'bg-green-50 text-green-600' : auto.lastRunStatus === 'failed' ? 'bg-red-50 text-red-500' : 'bg-primary/10 text-amber-600'}`}>{auto.lastRunStatus}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => toggleAuto(auto._id)} className="p-2 rounded-lg hover:bg-muted transition-colors">
                      {auto.isActive ? <ToggleRight className="w-6 h-6 text-green-500" /> : <ToggleLeft className="w-6 h-6 text-muted-foreground/70" />}
                    </button>
                    <button onClick={() => deleteAuto(auto._id)} className="p-2 rounded-lg hover:bg-red-50 text-muted-foreground/70 hover:text-red-500 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* Templates */}
      {activeTab === 'templates' && (
        <div className="space-y-5">
          <div className="flex gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/70" />
              <input placeholder="Search templates..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-lg border border-border bg-card text-sm focus:outline-none focus:border-primary" />
            </div>
            <div className="flex gap-1">
              {[{ id: 'all', label: 'All' }, ...Object.entries(CATEGORY_INFO).map(([id, info]) => ({ id, label: `${info.icon} ${info.title}` }))].map(cat => (
                <button key={cat.id} onClick={() => setSelectedCategory(cat.id)}
                  className={`px-3 py-1.5 text-xs rounded-full transition-colors whitespace-nowrap ${selectedCategory === cat.id ? 'bg-primary text-white' : 'bg-muted text-muted-foreground hover:bg-muted'}`}>
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {['core', 'deals', 'tasks', 'advanced'].map(category => {
            const catTemplates = filteredTemplates.filter(t => t.category === category);
            if (catTemplates.length === 0) return null;
            const info = CATEGORY_INFO[category];
            return (
              <div key={category} className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{info.icon}</span>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{info.title}</p>
                    <p className="text-xs text-muted-foreground/70">{info.desc}</p>
                  </div>
                </div>
                {catTemplates.map(template => {
                  const isActive = activeTemplateIds.includes(template.id);
                  return (
                    <div key={template.id} className={`bg-card rounded-xl border p-4 transition-all ${isActive ? 'border-green-200 bg-green-50/20' : 'border-border hover:border-border'}`}>
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center text-xl flex-shrink-0">{template.icon}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-medium text-foreground">{template.name}</p>
                            {isActive && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 font-medium flex items-center gap-0.5"><CheckCircle2 className="w-2.5 h-2.5" /> Active</span>}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">{template.description}</p>
                          <div className="flex flex-col gap-1 mt-2">
                            <div className="flex items-center gap-1.5 text-xs">
                              <span className="text-muted-foreground/70 w-10">When:</span>
                              <span className="bg-muted text-muted-foreground px-1.5 py-0.5 rounded">{TRIGGER_LABELS[template.trigger.type]}</span>
                            </div>
                            <div className="flex items-start gap-1.5 text-xs">
                              <span className="text-muted-foreground/70 w-10 mt-0.5">Then:</span>
                              <div className="flex gap-1 flex-wrap">
                                {template.actions.map((a, i) => <span key={i} className="bg-background text-muted-foreground px-1.5 py-0.5 rounded border border-border">{ACTION_LABELS[a.type]}</span>)}
                              </div>
                            </div>
                          </div>
                        </div>
                        <button onClick={() => setActivateTemplate(template)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex-shrink-0 ${isActive ? 'border border-border text-muted-foreground hover:bg-muted' : 'bg-primary text-white hover:bg-primary'}`}>
                          {isActive ? 'Add another' : 'Use'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}

      {/* Activate Template Modal */}
      {activateTemplate && (
        <ActivateModal template={activateTemplate} team={team} pipelines={pipelines}
          onClose={() => setActivateTemplate(null)}
          onActivated={() => { setActivateTemplate(null); setActiveTab('my'); fetchAll(); toast.success('Automation activated!'); }}
        />
      )}

      {/* Custom Builder Modal */}
      {showBuilder && (
        <BuilderModal team={team} pipelines={pipelines}
          onClose={() => setShowBuilder(false)}
          onCreated={() => { setShowBuilder(false); fetchAll(); toast.success('Automation created!'); }}
        />
      )}
    </div>
  );
}

// ─── Activate Template Modal ────────────────────

function ActivateModal({ template, team, pipelines, onClose, onActivated }) {
  const [name, setName] = useState(template.name);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [assignUserId, setAssignUserId] = useState('');
  const [filterPipelineId, setFilterPipelineId] = useState('');
  const [dealPipelineId, setDealPipelineId] = useState('');
  const [stageId, setStageId] = useState('');
  const [toStage, setToStage] = useState('');
  const [saving, setSaving] = useState(false);

  const needsWebhook = template.actions.some(a => a.type === 'send_webhook');
  const needsAssignUser = template.actions.some(a => a.type === 'assign_to_user');
  const needsDealConfig = template.actions.some(a => a.type === 'create_deal');
  const needsStageFilter = template.trigger.type === 'deal.stage_changed';
  const filterPipeline = pipelines.find(p => p._id === filterPipelineId);
  const dealPipeline = pipelines.find(p => p._id === dealPipelineId);
  const inputCls = 'w-full px-3 py-2 rounded-lg bg-background border border-border text-sm text-foreground focus:outline-none focus:border-primary transition-colors';

  const handleActivate = async () => {
    setSaving(true);
    try {
      const actions = template.actions.map(a => {
        if (a.type === 'send_webhook') return { ...a, config: { ...a.config, url: webhookUrl } };
        if (a.type === 'assign_to_user') return { ...a, config: { ...a.config, userId: assignUserId } };
        if (a.type === 'create_deal') return { ...a, config: { ...a.config, pipelineId: dealPipelineId, stageId } };
        return a;
      });
      const trigger = { ...template.trigger };
      if (needsStageFilter) {
        const cfg = { ...(trigger.config || {}) };
        if (toStage) cfg.toStage = toStage;
        if (filterPipelineId) cfg.pipelineId = filterPipelineId;
        trigger.config = cfg;
      }
      await api.post('/automations', { templateId: template.id, name, actions, trigger });
      onActivated();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="bg-card rounded-xl shadow-xl w-full max-w-md animate-scale-in">
        <div className="px-5 py-4 border-b border-border"><h3 className="text-base font-semibold text-foreground">Activate: {template.name}</h3></div>
        <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
          <div className="bg-background rounded-lg p-3 border border-border">
            <div className="text-xs space-y-1">
              <p><span className="text-muted-foreground/70">When:</span> {TRIGGER_LABELS[template.trigger.type]}</p>
              {template.actions.map((a, i) => <p key={i}><span className="text-muted-foreground/70">Then:</span> {ACTION_LABELS[a.type]}</p>)}
            </div>
          </div>
          <div><label className="block text-xs font-medium text-muted-foreground mb-1">Automation name</label><input type="text" value={name} onChange={e => setName(e.target.value)} className={inputCls} /></div>
          {needsStageFilter && (<>
            <div><label className="block text-xs font-medium text-muted-foreground mb-1">Pipeline</label><select value={filterPipelineId} onChange={e => { setFilterPipelineId(e.target.value); setToStage(''); }} className={inputCls}><option value="">Any pipeline</option>{pipelines.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}</select></div>
            {filterPipeline && <div><label className="block text-xs font-medium text-muted-foreground mb-1">Fire when deal moves to</label><select value={toStage} onChange={e => setToStage(e.target.value)} className={inputCls}><option value="">Any stage</option>{filterPipeline.stages.sort((a,b) => a.order - b.order).map(s => <option key={s.name} value={s.name}>{s.name}</option>)}</select></div>}
          </>)}
          {needsWebhook && <div><label className="block text-xs font-medium text-muted-foreground mb-1">Webhook URL *</label><input type="url" value={webhookUrl} onChange={e => setWebhookUrl(e.target.value)} className={inputCls} placeholder="https://your-n8n.com/webhook/..." /></div>}
          {needsAssignUser && <div><label className="block text-xs font-medium text-muted-foreground mb-1">Assign to *</label><select value={assignUserId} onChange={e => setAssignUserId(e.target.value)} className={inputCls}><option value="">Select...</option>{team.map(m => <option key={m._id} value={m._id}>{m.name}</option>)}</select></div>}
          {needsDealConfig && (<>
            <div><label className="block text-xs font-medium text-muted-foreground mb-1">Pipeline *</label><select value={dealPipelineId} onChange={e => { setDealPipelineId(e.target.value); setStageId(''); }} className={inputCls}><option value="">Select...</option>{pipelines.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}</select></div>
            {dealPipeline && <div><label className="block text-xs font-medium text-muted-foreground mb-1">Starting stage *</label><select value={stageId} onChange={e => setStageId(e.target.value)} className={inputCls}><option value="">Select...</option>{dealPipeline.stages.sort((a,b) => a.order - b.order).map(s => <option key={s.name} value={s.name}>{s.name}</option>)}</select></div>}
          </>)}
        </div>
        <div className="flex gap-2 px-5 py-4 border-t border-border">
          <button onClick={onClose} className="flex-1 px-4 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:bg-background">Cancel</button>
          <button onClick={handleActivate} disabled={saving || !name.trim() || (needsWebhook && !webhookUrl) || (needsAssignUser && !assignUserId)} className="flex-1 px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary disabled:opacity-50">{saving ? 'Activating...' : 'Activate'}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Custom Builder Modal ───────────────────────

const ACTION_DEFAULTS = {
  send_email: { to: 'assigned_user', subject: '', body: '' },
  send_notification: { message: '', targetUser: 'assigned_user' },
  send_whatsapp: { whatsappTo: 'contact', whatsappMessage: '' },
  send_webhook: { url: '', method: 'POST', payload: 'full_context' },
  create_task: { taskTitle: '', taskPriority: 'medium', taskDueDays: 1, assignTo: 'same_as_contact' },
  create_deal: { dealTitle: '', pipelineId: '', stageId: '', assignDealTo: 'same_as_contact' },
  assign_to_user: { userId: '' },
  add_tag: { tag: '' },
};

function BuilderModal({ team, pipelines, onClose, onCreated }) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ name: '', triggerType: 'contact.created', inactiveDays: 3, toStage: '', pipelineId: '', actionType: 'create_task', actionConfig: { ...ACTION_DEFAULTS.create_task } });
  const [saving, setSaving] = useState(false);
  const inputCls = 'w-full px-3 py-2 rounded-lg bg-background border border-border text-sm text-foreground focus:outline-none focus:border-primary transition-colors';
  const selectedPipeline = pipelines.find(p => p._id === form.pipelineId);
  const triggerHasDeal = ['deal.stage_changed', 'deal.created', 'deal.won', 'deal.lost', 'deal.inactive', 'quote.viewed', 'quote.sent'].includes(form.triggerType);
  const setActionType = (t) => setForm(f => ({ ...f, actionType: t, actionConfig: { ...(ACTION_DEFAULTS[t] || {}) } }));

  const handleCreate = async () => {
    setSaving(true);
    try {
      const triggerConfig = {};
      if (form.triggerType === 'deal.inactive') triggerConfig.inactiveDays = parseInt(form.inactiveDays);
      if (form.triggerType === 'deal.stage_changed') {
        if (form.toStage) triggerConfig.toStage = form.toStage;
        if (form.pipelineId) triggerConfig.pipelineId = form.pipelineId;
      }
      await api.post('/automations', { name: form.name, trigger: { type: form.triggerType, config: triggerConfig }, actions: [{ type: form.actionType, config: form.actionConfig }] });
      onCreated();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="bg-card rounded-xl shadow-xl w-full max-w-lg animate-scale-in">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h3 className="text-base font-semibold text-foreground">Build Custom Automation</h3>
          <div className="flex items-center gap-1 text-xs text-muted-foreground/70">
            {['Trigger', 'Action', 'Review'].map((label, i) => (
              <span key={i} className="flex items-center gap-1">
                {i > 0 && <span>→</span>}
                <span className={`px-2 py-0.5 rounded-full ${step === i + 1 ? 'bg-primary text-white' : step > i + 1 ? 'bg-green-100 text-green-700' : 'bg-muted'}`}>{label}</span>
              </span>
            ))}
          </div>
        </div>
        <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
          {step === 1 && (<>
            <div><label className="block text-xs font-medium text-muted-foreground mb-1">Name *</label><input type="text" value={form.name} onChange={e => setForm({...form, name: e.target.value})} className={inputCls} placeholder="e.g. Notify on new lead" /></div>
            <div><label className="block text-xs font-medium text-muted-foreground mb-2">When this happens:</label>
              <div className="space-y-1">{Object.entries(TRIGGER_LABELS).map(([v, l]) => (
                <button key={v} type="button" onClick={() => setForm({...form, triggerType: v})} className={`w-full p-2.5 rounded-lg border text-left text-xs transition-all ${form.triggerType === v ? 'border-primary bg-primary/10/50 font-medium text-foreground' : 'border-border text-muted-foreground hover:border-border'}`}>{l}</button>
              ))}</div>
              {form.triggerType === 'deal.inactive' && <div className="mt-2"><label className="block text-[10px] text-muted-foreground mb-0.5">Days inactive</label><input type="number" min={1} value={form.inactiveDays} onChange={e => setForm({...form, inactiveDays: e.target.value})} className={inputCls} /></div>}
              {form.triggerType === 'deal.stage_changed' && (<div className="mt-2 space-y-2">
                <div><label className="block text-[10px] text-muted-foreground mb-0.5">Pipeline</label><select value={form.pipelineId} onChange={e => setForm({...form, pipelineId: e.target.value, toStage: ''})} className={inputCls}><option value="">Select...</option>{pipelines.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}</select></div>
                {selectedPipeline && <div><label className="block text-[10px] text-muted-foreground mb-0.5">Stage</label><select value={form.toStage} onChange={e => setForm({...form, toStage: e.target.value})} className={inputCls}><option value="">Any</option>{selectedPipeline.stages.sort((a,b) => a.order - b.order).map(s => <option key={s.name} value={s.name}>{s.name}</option>)}</select></div>}
              </div>)}
            </div>
          </>)}
          {step === 2 && (<>
            <div><label className="block text-xs font-medium text-muted-foreground mb-2">Then do this:</label>
              <div className="space-y-1 mb-3">{Object.entries(ACTION_LABELS).map(([v, l]) => (
                <button key={v} type="button" onClick={() => setActionType(v)} className={`w-full p-2.5 rounded-lg border text-left text-xs transition-all ${form.actionType === v ? 'border-primary bg-primary/10/50 font-medium text-foreground' : 'border-border text-muted-foreground hover:border-border'}`}>{l}</button>
              ))}</div>
            </div>
            <div className="border-t border-border pt-3">
              {form.actionType === 'create_task' && (<div className="space-y-2">
                <div><label className="block text-[10px] text-muted-foreground mb-0.5">Task title</label><input type="text" value={form.actionConfig.taskTitle || ''} onChange={e => setForm({...form, actionConfig: {...form.actionConfig, taskTitle: e.target.value}})} className={inputCls} placeholder="Follow up: {{deal.title}}" /></div>
                <div className="grid grid-cols-2 gap-2">
                  <div><label className="block text-[10px] text-muted-foreground mb-0.5">Priority</label><select value={form.actionConfig.taskPriority || 'medium'} onChange={e => setForm({...form, actionConfig: {...form.actionConfig, taskPriority: e.target.value}})} className={inputCls}><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select></div>
                  <div><label className="block text-[10px] text-muted-foreground mb-0.5">Due in (days)</label><input type="number" min={0} value={form.actionConfig.taskDueDays ?? 1} onChange={e => setForm({...form, actionConfig: {...form.actionConfig, taskDueDays: parseInt(e.target.value)}})} className={inputCls} /></div>
                </div>
                <div><label className="block text-[10px] text-muted-foreground mb-0.5">Assign to</label><select value={form.actionConfig.assignTo || (triggerHasDeal ? 'same_as_deal' : 'same_as_contact')} onChange={e => setForm({...form, actionConfig: {...form.actionConfig, assignTo: e.target.value}})} className={inputCls}>{triggerHasDeal && <option value="same_as_deal">Deal owner</option>}<option value="same_as_contact">Contact owner</option>{team.map(m => <option key={m._id} value={m._id}>{m.name}</option>)}</select></div>
              </div>)}
              {form.actionType === 'send_email' && (<div className="space-y-2">
                <div><label className="block text-[10px] text-muted-foreground mb-0.5">Send to</label><select value={form.actionConfig.to || 'assigned_user'} onChange={e => setForm({...form, actionConfig: {...form.actionConfig, to: e.target.value}})} className={inputCls}><option value="assigned_user">Assigned rep</option><option value="contact">Contact</option></select></div>
                <div><label className="block text-[10px] text-muted-foreground mb-0.5">Subject</label><input type="text" value={form.actionConfig.subject || ''} onChange={e => setForm({...form, actionConfig: {...form.actionConfig, subject: e.target.value}})} className={inputCls} /></div>
                <div><label className="block text-[10px] text-muted-foreground mb-0.5">Body</label><textarea rows={3} value={form.actionConfig.body || ''} onChange={e => setForm({...form, actionConfig: {...form.actionConfig, body: e.target.value}})} className={`${inputCls} resize-none`} /></div>
              </div>)}
              {form.actionType === 'send_webhook' && <div><label className="block text-[10px] text-muted-foreground mb-0.5">Webhook URL</label><input type="url" value={form.actionConfig.url || ''} onChange={e => setForm({...form, actionConfig: {...form.actionConfig, url: e.target.value}})} className={inputCls} placeholder="https://..." /></div>}
              {form.actionType === 'send_whatsapp' && (<div className="space-y-2">
                <div><label className="block text-[10px] text-muted-foreground mb-0.5">Send to</label><select value={form.actionConfig.whatsappTo || 'contact'} onChange={e => setForm({...form, actionConfig: {...form.actionConfig, whatsappTo: e.target.value}})} className={inputCls}><option value="contact">Contact</option><option value="assigned_user">Assigned rep</option></select></div>
                <div><label className="block text-[10px] text-muted-foreground mb-0.5">Message</label><textarea rows={3} value={form.actionConfig.whatsappMessage || ''} onChange={e => setForm({...form, actionConfig: {...form.actionConfig, whatsappMessage: e.target.value}})} className={`${inputCls} resize-none`} placeholder="Hi {{contact.firstName}}, thanks for reaching out!" /></div>
                <p className="text-[10px] text-muted-foreground/70">You can use {'{{contact.firstName}}'}, {'{{deal.title}}'} etc.</p>
              </div>)}
              {form.actionType === 'send_notification' && (<div className="space-y-2">
                <div><label className="block text-[10px] text-muted-foreground mb-0.5">Message</label><input type="text" value={form.actionConfig.message || ''} onChange={e => setForm({...form, actionConfig: {...form.actionConfig, message: e.target.value}})} className={inputCls} /></div>
                <div><label className="block text-[10px] text-muted-foreground mb-0.5">Notify</label><select value={form.actionConfig.targetUser || 'assigned_user'} onChange={e => setForm({...form, actionConfig: {...form.actionConfig, targetUser: e.target.value}})} className={inputCls}><option value="assigned_user">Assigned rep</option><option value="creator">Creator</option></select></div>
              </div>)}
              {form.actionType === 'assign_to_user' && <div><label className="block text-[10px] text-muted-foreground mb-0.5">Assign to</label><select value={form.actionConfig.userId || ''} onChange={e => setForm({...form, actionConfig: {...form.actionConfig, userId: e.target.value}})} className={inputCls}><option value="">Select...</option>{team.map(m => <option key={m._id} value={m._id}>{m.name}</option>)}</select></div>}
              {form.actionType === 'add_tag' && <div><label className="block text-[10px] text-muted-foreground mb-0.5">Tag</label><input type="text" value={form.actionConfig.tag || ''} onChange={e => setForm({...form, actionConfig: {...form.actionConfig, tag: e.target.value}})} className={inputCls} placeholder="e.g. vip" /></div>}
              {form.actionType === 'create_deal' && (() => {
                const actionPipeline = pipelines.find(p => p._id === form.actionConfig.pipelineId)
                  || pipelines.find(p => p.isDefault)
                  || pipelines[0];
                return (<div className="space-y-2">
                  <div><label className="block text-[10px] text-muted-foreground mb-0.5">Deal title</label><input type="text" value={form.actionConfig.dealTitle || ''} onChange={e => setForm({...form, actionConfig: {...form.actionConfig, dealTitle: e.target.value}})} className={inputCls} placeholder="New deal: {{contact.firstName}} {{contact.lastName}}" /></div>
                  <div><label className="block text-[10px] text-muted-foreground mb-0.5">Pipeline</label><select value={form.actionConfig.pipelineId || ''} onChange={e => setForm({...form, actionConfig: {...form.actionConfig, pipelineId: e.target.value, stageId: ''}})} className={inputCls}><option value="">Default pipeline</option>{pipelines.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}</select></div>
                  {actionPipeline && <div><label className="block text-[10px] text-muted-foreground mb-0.5">Starting stage</label><select value={form.actionConfig.stageId || ''} onChange={e => setForm({...form, actionConfig: {...form.actionConfig, stageId: e.target.value}})} className={inputCls}><option value="">First stage</option>{actionPipeline.stages.sort((a,b) => a.order - b.order).map(s => <option key={s.name} value={s.name}>{s.name}</option>)}</select></div>}
                  <div><label className="block text-[10px] text-muted-foreground mb-0.5">Assign deal to</label><select value={form.actionConfig.assignDealTo || 'same_as_contact'} onChange={e => setForm({...form, actionConfig: {...form.actionConfig, assignDealTo: e.target.value}})} className={inputCls}><option value="same_as_contact">Contact owner</option>{team.map(m => <option key={m._id} value={m._id}>{m.name}</option>)}</select></div>
                </div>);
              })()}
            </div>
          </>)}
          {step === 3 && (
            <div className="bg-background rounded-lg p-4 border border-border space-y-2">
              <p className="text-sm font-semibold text-foreground">{form.name}</p>
              <p className="text-xs"><span className="text-muted-foreground/70">When:</span> {TRIGGER_LABELS[form.triggerType]}{form.toStage ? ` → ${form.toStage}` : ''}</p>
              <p className="text-xs"><span className="text-muted-foreground/70">Then:</span> {ACTION_LABELS[form.actionType]}</p>
            </div>
          )}
        </div>
        <div className="flex gap-2 px-5 py-4 border-t border-border">
          {step > 1 && <button onClick={() => setStep(s => s - 1)} className="px-4 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:bg-background">Back</button>}
          <div className="flex-1" />
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:bg-background">Cancel</button>
          {step < 3 ? (
            <button onClick={() => setStep(s => s + 1)} disabled={step === 1 && !form.name.trim()} className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary disabled:opacity-50">Continue</button>
          ) : (
            <button onClick={handleCreate} disabled={saving} className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary disabled:opacity-50">{saving ? 'Creating...' : 'Create'}</button>
          )}
        </div>
      </div>
    </div>
  );
}
