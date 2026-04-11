import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import { formatCurrency, formatDate, getInitials } from '../utils/helpers';
import toast from 'react-hot-toast';
import CSVImportModal from '../components/crm/CSVImportModal';
import DealModal from '../components/crm/DealModal';
import ContactModal from '../components/crm/ContactModal';
import TaskModal from '../components/crm/TaskModal';
import {
  Users, Kanban, CheckSquare, Plus, Search, X, Mail, Phone,
  MapPin, Calendar, DollarSign, ArrowRight, Clock, MoreHorizontal, Upload,
  ChevronDown, Edit2, Trash2, AlertCircle,
} from 'lucide-react';

const CRM_TABS = [
  { id: 'pipeline', label: 'Pipeline', icon: Kanban },
  { id: 'contacts', label: 'Contacts', icon: Users },
  { id: 'tasks', label: 'Tasks', icon: CheckSquare },
];

export default function CRMPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'owner' || user?.role === 'admin';
  const [tab, setTab] = useState('pipeline');
  const [contacts, setContacts] = useState([]);
  const [deals, setDeals] = useState([]);
  const [pipelines, setPipelines] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showAddDeal, setShowAddDeal] = useState(false);
  const [showAddContact, setShowAddContact] = useState(false);
  const [showCSVImport, setShowCSVImport] = useState(false);
  const [showAddTask, setShowAddTask] = useState(false);
  const [editTask, setEditTask] = useState(null);
  const [expandedTask, setExpandedTask] = useState(null);
  const [deleteTaskId, setDeleteTaskId] = useState(null);
  const [team, setTeam] = useState([]);
  // Filters
  const [filterAssignee, setFilterAssignee] = useState(isAdmin ? 'all' : 'mine');
  const [filterStage, setFilterStage] = useState('all');
  const [filterSource, setFilterSource] = useState('all');
  const navigate = useNavigate();

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [c, d, p, t, tm] = await Promise.all([
        api.get('/crm/contacts'),
        api.get('/crm/deals'),
        api.get('/crm/pipelines'),
        api.get('/crm/tasks'),
        api.get('/settings/team'),
      ]);
      setContacts(c.data.contacts);
      setDeals(d.data.deals);
      setPipelines(p.data.pipelines);
      setTasks(t.data.tasks);
      setTeam(tm.data.members);
    } catch (err) {
      toast.error('Failed to load CRM data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  const [selectedPipelineId, setSelectedPipelineId] = useState(null);
  const activePipeline = selectedPipelineId
    ? pipelines.find(p => p._id === selectedPipelineId)
    : pipelines.find(p => p.isDefault) || pipelines[0];

  // Apply filters
  const filteredContacts = contacts.filter(c => {
    if (filterAssignee === 'mine' && c.assignedTo?._id !== user?._id && c.assignedTo !== user?._id) return false;
    if (filterAssignee !== 'all' && filterAssignee !== 'mine' && c.assignedTo?._id !== filterAssignee) return false;
    if (search && !`${c.firstName} ${c.lastName} ${c.email} ${c.company}`.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const filteredDeals = deals.filter(d => {
    if (filterAssignee === 'mine' && d.assignedTo?._id !== user?._id && d.assignedTo !== user?._id) return false;
    if (filterAssignee !== 'all' && filterAssignee !== 'mine' && d.assignedTo?._id !== filterAssignee) return false;
    if (filterStage !== 'all' && d.stage !== filterStage) return false;
    if (filterSource !== 'all' && d.leadSource !== filterSource) return false;
    return true;
  });

  const filteredTasks = tasks.filter(t => {
    if (filterAssignee === 'mine' && t.assignedTo?._id !== user?._id && t.assignedTo !== user?._id) return false;
    if (filterAssignee !== 'all' && filterAssignee !== 'mine' && t.assignedTo?._id !== filterAssignee) return false;
    return true;
  });

  const selectCls = 'px-2 py-1.5 rounded-md bg-white border border-sand-200 text-xs text-sand-600 focus:outline-none focus:border-amber-brand';

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-brand" style={{ fontFamily: 'Playfair Display, serif' }}>CRM</h1>
          <p className="text-sm text-sand-500 mt-0.5">
            {contacts.length} contacts · {deals.filter(d => !['Won','Lost'].includes(d.stage)).length} active deals
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowCSVImport(true)} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white border border-sand-200 text-slate-brand text-sm font-medium hover:border-sand-300 transition-colors">
            <Upload className="w-4 h-4" /> Import CSV
          </button>
          <button onClick={() => setShowAddContact(true)} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white border border-sand-200 text-slate-brand text-sm font-medium hover:border-sand-300 transition-colors">
            <Plus className="w-4 h-4" /> Contact
          </button>
          <button onClick={() => setShowAddDeal(true)} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-brand text-white text-sm font-medium hover:bg-amber-700 transition-colors">
            <Plus className="w-4 h-4" /> Deal
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex bg-white rounded-lg border border-sand-200 p-1 w-fit">
          {CRM_TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                tab === id ? 'bg-amber-brand text-white' : 'text-sand-500 hover:text-slate-brand'
              }`}
            >
              <Icon className="w-4 h-4" /> {label}
            </button>
          ))}
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          <select value={filterAssignee} onChange={e => setFilterAssignee(e.target.value)} className={selectCls}>
            <option value="all">All team</option>
            <option value="mine">My items</option>
            {team?.map(m => <option key={m._id} value={m._id}>{m.name}</option>)}
          </select>
          {tab === 'pipeline' && (
            <select value={filterStage} onChange={e => setFilterStage(e.target.value)} className={selectCls}>
              <option value="all">All stages</option>
              {activePipeline?.stages?.sort((a,b) => a.order - b.order).map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
            </select>
          )}
          {tab === 'pipeline' && (
            <select value={filterSource} onChange={e => setFilterSource(e.target.value)} className={selectCls}>
              <option value="all">All sources</option>
              <option value="website">Website</option>
              <option value="referral">Referral</option>
              <option value="repeat">Repeat</option>
              <option value="travel_agent">Travel Agent</option>
              <option value="social">Social</option>
              <option value="email">Email</option>
              <option value="phone">Phone</option>
            </select>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-6 h-6 border-2 border-amber-brand border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* PIPELINE VIEW */}
          {tab === 'pipeline' && (
            <>
              {/* Pipeline selector */}
              {pipelines.length > 0 && (
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {pipelines.map((p) => (
                      <button
                        key={p._id}
                        onClick={() => setSelectedPipelineId(p._id)}
                        className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                          activePipeline?._id === p._id
                            ? 'bg-slate-brand text-white'
                            : 'bg-sand-100 text-sand-600 hover:bg-sand-200'
                        }`}
                      >
                        {p.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {activePipeline && (
                <PipelineKanban
                  pipeline={activePipeline}
                  deals={filteredDeals.filter(d => d.pipeline?._id === activePipeline._id || d.pipeline === activePipeline._id)}
                  onDealMoved={(dealId, newStage) => {
                    // Optimistic update — move card instantly
                    setDeals(prev => prev.map(d =>
                      d._id === dealId ? { ...d, stage: newStage } : d
                    ));
                    // Sync in background
                    api.put(`/crm/deals/${dealId}`, { stage: newStage })
                      .catch((err) => {
                        toast.error('Move failed — reverting');
                        fetchAll(); // Revert on failure
                      });
                  }}
                />
              )}
            </>
          )}

          {/* CONTACTS VIEW */}
          {tab === 'contacts' && (
            <div className="space-y-3">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-sand-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search contacts..."
                  className="w-full pl-9 pr-3 py-2 rounded-lg bg-white border border-sand-200 text-sm focus:outline-none focus:border-amber-brand transition-colors"
                />
              </div>
              <div className="bg-white rounded-xl border border-sand-200 divide-y divide-sand-100">
                {filteredContacts.map((contact) => (
                  <Link key={contact._id} to={`/crm/contacts/${contact._id}`} className="flex items-center justify-between px-4 py-3 hover:bg-sand-50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-sand-200 text-sand-600 flex items-center justify-center text-xs font-semibold">
                        {getInitials(`${contact.firstName} ${contact.lastName}`)}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-brand">{contact.firstName} {contact.lastName}</p>
                        <p className="text-xs text-sand-500">
                          {contact.company && `${contact.company} · `}
                          {contact.email}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {contact.phone && (
                        <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); window.location.href = `tel:${contact.phone}`; }} className="p-1.5 rounded-md hover:bg-sand-100 text-sand-400">
                          <Phone className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {contact.email && (
                        <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); window.location.href = `mailto:${contact.email}`; }} className="p-1.5 rounded-md hover:bg-sand-100 text-sand-400">
                          <Mail className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <span className="text-xs text-sand-400">{formatDate(contact.createdAt)}</span>
                    </div>
                  </Link>
                ))}
                {contacts.length === 0 && (
                  <div className="py-12 text-center">
                    <p className="text-sm text-sand-400">No contacts yet</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TASKS VIEW */}
          {tab === 'tasks' && (
            <TasksView
              tasks={filteredTasks}
              userId={user?._id}
              expandedTask={expandedTask}
              setExpandedTask={setExpandedTask}
              deleteTaskId={deleteTaskId}
              setDeleteTaskId={setDeleteTaskId}
              setEditTask={setEditTask}
              setShowAddTask={setShowAddTask}
              fetchAll={fetchAll}
            />
          )}
        </>
      )}

      {/* Add Contact Modal */}
      {showAddContact && (
        <ContactModal
          team={team}
          onClose={() => setShowAddContact(false)}
          onSaved={fetchAll}
        />
      )}

      {/* Add Deal Modal */}
      {showAddDeal && (
        <DealModal
          pipelines={pipelines}
          contacts={contacts}
          team={team}
          onClose={() => setShowAddDeal(false)}
          onSaved={fetchAll}
        />
      )}

      {/* Add/Edit Task Modal */}
      {showAddTask && (
        <TaskModal
          task={editTask}
          deals={deals}
          team={team}
          onClose={() => { setShowAddTask(false); setEditTask(null); }}
          onSaved={fetchAll}
        />
      )}

      {/* CSV Import Modal */}
      {showCSVImport && (
        <CSVImportModal
          onClose={() => setShowCSVImport(false)}
          onImported={fetchAll}
        />
      )}
    </div>
  );
}

// ─── PIPELINE KANBAN with drag-and-drop ──────────

function PipelineKanban({ pipeline, deals, onDealMoved }) {
  const [draggedDeal, setDraggedDeal] = useState(null);
  const [dragOverStage, setDragOverStage] = useState(null);
  const navigate = useNavigate();

  const handleDragStart = (e, deal) => {
    setDraggedDeal(deal);
    e.dataTransfer.effectAllowed = 'move';
    // Make the drag image slightly transparent
    e.currentTarget.style.opacity = '0.5';
  };

  const handleDragEnd = (e) => {
    e.currentTarget.style.opacity = '1';
    setDraggedDeal(null);
    setDragOverStage(null);
  };

  const handleDragOver = (e, stageName) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverStage(stageName);
  };

  const handleDragLeave = () => {
    setDragOverStage(null);
  };

  const handleDrop = (e, stageName) => {
    e.preventDefault();
    setDragOverStage(null);
    if (draggedDeal && draggedDeal.stage !== stageName) {
      onDealMoved(draggedDeal._id, stageName);
    }
    setDraggedDeal(null);
  };

  return (
    <div className="overflow-x-auto -mx-4 lg:-mx-8 px-4 lg:px-8">
      <div className="flex gap-4 min-w-max pb-4">
        {pipeline.stages
          .sort((a, b) => a.order - b.order)
          .map((stage) => {
            const stageDeals = deals.filter(d => d.stage === stage.name);
            const stageValue = stageDeals.reduce((s, d) => s + (d.value || 0), 0);
            const isDragOver = dragOverStage === stage.name;

            return (
              <div
                key={stage.name}
                className="w-72 flex-shrink-0"
                onDragOver={(e) => handleDragOver(e, stage.name)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, stage.name)}
              >
                <div className="flex items-center justify-between mb-3 px-1">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: stage.color }} />
                    <span className="text-xs font-semibold text-slate-brand uppercase tracking-wide">{stage.name}</span>
                    <span className="text-xs text-sand-400 bg-sand-100 px-1.5 py-0.5 rounded-full">{stageDeals.length}</span>
                  </div>
                  {stageValue > 0 && (
                    <span className="text-xs text-sand-500">{formatCurrency(stageValue)}</span>
                  )}
                </div>

                <div
                  className={`space-y-2 min-h-[80px] rounded-lg p-1 transition-colors ${
                    isDragOver ? 'bg-amber-50 border-2 border-dashed border-amber-300' : 'border-2 border-transparent'
                  }`}
                >
                  {stageDeals.map((deal) => (
                    <div
                      key={deal._id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, deal)}
                      onDragEnd={handleDragEnd}
                      onClick={() => navigate(`/crm/deals/${deal._id}`)}
                      className="bg-white rounded-lg border border-sand-200 p-3 hover:border-sand-300 hover:shadow-sm transition-all cursor-grab active:cursor-grabbing group"
                    >
                      <p className="text-sm font-medium text-slate-brand mb-1">{deal.title}</p>
                      {deal.contact && (
                        <p className="text-xs text-sand-500 mb-2">{deal.contact.firstName} {deal.contact.lastName}</p>
                      )}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {deal.destination && (
                            <span className="text-xs bg-sand-100 text-sand-600 px-1.5 py-0.5 rounded">{deal.destination}</span>
                          )}
                        </div>
                        {deal.value > 0 && (
                          <span className="text-xs font-semibold text-slate-brand">{formatCurrency(deal.value)}</span>
                        )}
                      </div>
                      <div className="mt-2 flex items-center gap-1">
                        {['destination', 'dates', 'group', 'budget'].map((field) => {
                          const ready = field === 'destination' ? !!deal.destination :
                            field === 'dates' ? !!deal.travelDates?.start :
                            field === 'group' ? deal.groupSize > 0 :
                            deal.budget > 0;
                          return (
                            <div key={field} className={`w-1.5 h-1.5 rounded-full ${ready ? 'bg-green-500' : 'bg-sand-200'}`} title={`${field}: ${ready ? 'set' : 'missing'}`} />
                          );
                        })}
                        {deal.isQuoteReady && (
                          <span className="text-[10px] text-green-600 font-medium ml-1">Ready for quote</span>
                        )}
                      </div>
                    </div>
                  ))}

                  {stageDeals.length === 0 && !isDragOver && (
                    <div className="py-6 text-center">
                      <p className="text-[10px] text-sand-300">Drop deals here</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
}

function isOverdue(dueDate) {
  if (!dueDate) return false;
  return new Date(dueDate) < new Date() ;
}

function isToday(dueDate) {
  if (!dueDate) return false;
  const d = new Date(dueDate);
  const now = new Date();
  return d.toDateString() === now.toDateString();
}

function formatDateTime(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const date = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  return `${date}, ${time}`;
}

function dueDateColor(task) {
  if (task.status === 'done') return 'text-sand-400';
  if (!task.dueDate) return 'text-sand-400';
  if (isOverdue(task.dueDate)) return 'text-red-500';
  if (isToday(task.dueDate)) return 'text-amber-600';
  return 'text-sand-500';
}

function TasksView({ tasks, userId, expandedTask, setExpandedTask, deleteTaskId, setDeleteTaskId, setEditTask, setShowAddTask, fetchAll }) {
  const [taskTab, setTaskTab] = useState('pending');

  const now = new Date();
  const pending = tasks.filter(t => t.status !== 'done' && t.status !== 'cancelled');
  const overdue = pending.filter(t => t.dueDate && new Date(t.dueDate) < now);
  const completed = tasks.filter(t => t.status === 'done');

  const displayed = taskTab === 'pending' ? pending
    : taskTab === 'overdue' ? overdue
    : taskTab === 'completed' ? completed
    : tasks;

  const tabs = [
    { id: 'pending', label: 'Pending', count: pending.length, color: 'text-slate-brand' },
    { id: 'overdue', label: 'Overdue', count: overdue.length, color: overdue.length > 0 ? 'text-red-500' : 'text-sand-400' },
    { id: 'completed', label: 'Completed', count: completed.length, color: 'text-green-600' },
    { id: 'all', label: 'All', count: tasks.length, color: 'text-sand-500' },
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 bg-white rounded-lg border border-sand-200 p-0.5">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTaskTab(t.id)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                taskTab === t.id ? 'bg-sand-100 text-slate-brand' : 'text-sand-400 hover:text-sand-600'
              }`}
            >
              {t.label}
              <span className={`text-[10px] font-semibold ${taskTab === t.id ? t.color : 'text-sand-400'} ${
                t.id === 'overdue' && t.count > 0 ? 'bg-red-100 text-red-500 px-1.5 py-0.5 rounded-full' : ''
              }`}>
                {t.count}
              </span>
            </button>
          ))}
        </div>
        <button onClick={() => { setEditTask(null); setShowAddTask(true); }} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-brand text-white text-xs font-medium hover:bg-amber-700 transition-colors">
          <Plus className="w-3.5 h-3.5" /> Add Task
        </button>
      </div>

      {displayed.length === 0 ? (
        <div className="bg-white rounded-xl border border-sand-200 p-12 text-center">
          <CheckSquare className="w-8 h-8 text-sand-300 mx-auto mb-2" />
          <p className="text-sm font-medium text-slate-brand">
            {taskTab === 'overdue' ? 'No overdue tasks' : taskTab === 'completed' ? 'No completed tasks' : 'No tasks'}
          </p>
          {taskTab === 'pending' && (
            <button onClick={() => { setEditTask(null); setShowAddTask(true); }} className="text-xs text-amber-brand hover:underline mt-2">Create a task</button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-sand-200 divide-y divide-sand-100">
          {displayed.map((task) => {
            const isExpanded = expandedTask === task._id;
            const overdueTask = task.status !== 'done' && isOverdue(task.dueDate);
            return (
              <div key={task._id} className={overdueTask ? 'bg-red-50/30' : ''}>
                <div className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-sand-50/50 transition-colors" onClick={() => setExpandedTask(isExpanded ? null : task._id)}>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        api.put(`/crm/tasks/${task._id}`, { status: task.status === 'done' ? 'todo' : 'done' }).then(fetchAll);
                      }}
                      className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors flex-shrink-0 ${
                        task.status === 'done' ? 'bg-green-500 border-green-500' : overdueTask ? 'border-red-300 hover:border-red-500' : 'border-sand-300 hover:border-amber-brand'
                      }`}
                    >
                      {task.status === 'done' && <span className="text-white text-xs">✓</span>}
                    </button>
                    <div>
                      <p className={`text-sm font-medium ${task.status === 'done' ? 'text-sand-400 line-through' : 'text-slate-brand'}`}>{task.title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {task.deal && <span className="text-[10px] text-sand-500">{task.deal.title}</span>}
                        {task.assignedTo && (
                          <span className="text-[10px] text-sand-400 flex items-center gap-0.5">
                            <span className="w-3.5 h-3.5 rounded-full bg-sand-200 text-sand-600 flex items-center justify-center text-[7px] font-semibold">{getInitials(task.assignedTo.name)}</span>
                            {task.assignedTo.name}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      task.priority === 'urgent' ? 'bg-red-100 text-red-600' :
                      task.priority === 'high' ? 'bg-orange-100 text-orange-600' :
                      task.priority === 'medium' ? 'bg-blue-100 text-blue-600' :
                      'bg-gray-100 text-gray-500'
                    }`}>{task.priority}</span>
                    {task.dueDate && (
                      <span className={`text-xs flex items-center gap-1 ${dueDateColor(task)}`}>
                        {overdueTask && <AlertCircle className="w-3 h-3" />}
                        <Clock className="w-3 h-3" /> {formatDateTime(task.dueDate)}
                      </span>
                    )}
                    <ChevronDown className={`w-3.5 h-3.5 text-sand-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                  </div>
                </div>

                {isExpanded && (
                  <div className="px-4 pb-3 pt-0 border-t border-sand-50 bg-sand-50/30">
                    <div className="pl-8 space-y-2 py-2">
                      {task.description && <p className="text-xs text-sand-600 leading-relaxed">{task.description}</p>}
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-sand-500">
                        <span>Status: <span className="font-medium text-slate-brand">{task.status.replace('_', ' ')}</span></span>
                        {task.dueDate && <span>Due: <span className={`font-medium ${dueDateColor(task)}`}>{formatDateTime(task.dueDate)}</span></span>}
                        {task.assignedTo && <span>Assigned: <span className="font-medium text-slate-brand">{task.assignedTo.name}</span></span>}
                        {task.deal && <span>Deal: <Link to={`/crm/deals/${task.deal._id}`} className="font-medium text-amber-brand hover:underline">{task.deal.title}</Link></span>}
                        <span>Created: {formatDate(task.createdAt)}</span>
                        {task.completedAt && <span>Completed: {formatDate(task.completedAt)}</span>}
                      </div>
                      <div className="flex gap-2 pt-1">
                        <button onClick={() => { setEditTask(task); setShowAddTask(true); }} className="text-[10px] text-amber-brand hover:underline flex items-center gap-0.5">
                          <Edit2 className="w-3 h-3" /> Edit
                        </button>
                        {deleteTaskId === task._id ? (
                          <span className="flex items-center gap-1 text-[10px]">
                            <span className="text-red-500">Sure?</span>
                            <button onClick={async () => { await api.delete(`/crm/tasks/${task._id}`); toast.success('Deleted'); setDeleteTaskId(null); fetchAll(); }} className="text-red-500 font-semibold hover:underline">Yes</button>
                            <button onClick={() => setDeleteTaskId(null)} className="text-sand-400 hover:underline">No</button>
                          </span>
                        ) : (
                          <button onClick={() => setDeleteTaskId(task._id)} className="text-[10px] text-red-400 hover:underline flex items-center gap-0.5">
                            <Trash2 className="w-3 h-3" /> Delete
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}