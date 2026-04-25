import { useState, useRef, useEffect } from 'react';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import { X, Move, UserCheck, Trash2, ChevronUp } from 'lucide-react';

// Floating action bar that appears when one or more deals are selected on the
// kanban. Bulk operations fan out as parallel per-deal API calls so existing
// permission/notification logic runs unchanged. Failures are reported per-batch.
export default function BulkActionsBar({
  selectedIds,
  pipeline,
  team = [],
  onClear,
  onComplete,
}) {
  const [processing, setProcessing] = useState(false);
  const [openMenu, setOpenMenu] = useState(null); // 'stage' | 'assign' | null
  const [confirmDelete, setConfirmDelete] = useState(false);
  const menuRef = useRef(null);

  const count = selectedIds.size;
  const ids = [...selectedIds];

  // Close menu on outside click.
  useEffect(() => {
    const handle = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setOpenMenu(null);
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  // Run a per-id API call in parallel and surface succeed/fail counts.
  const runBatch = async (actionLabel, fn) => {
    setProcessing(true);
    setOpenMenu(null);
    try {
      const results = await Promise.allSettled(ids.map(fn));
      const failures = results
        .map((r, i) => ({ r, id: ids[i] }))
        .filter(x => x.r.status === 'rejected');
      const succeeded = ids.length - failures.length;
      if (failures.length === 0) {
        toast.success(`${actionLabel} ${succeeded} ${succeeded === 1 ? 'deal' : 'deals'}`);
      } else if (succeeded === 0) {
        const msg = failures[0].r.reason?.response?.data?.message || 'all calls failed';
        toast.error(`Failed: ${msg}`);
      } else {
        const msg = failures[0].r.reason?.response?.data?.message || 'permission denied';
        toast.error(`${succeeded} ${actionLabel.toLowerCase()}d, ${failures.length} failed (${msg})`);
      }
      onComplete?.();
      onClear?.();
    } finally {
      setProcessing(false);
    }
  };

  const handleMoveToStage = (stageName) =>
    runBatch('Moved', (id) => api.put(`/crm/deals/${id}`, { stage: stageName }));

  const handleReassign = (userId) =>
    runBatch('Reassigned', (id) => api.put(`/crm/deals/${id}`, { assignedTo: userId }));

  const handleDelete = () =>
    runBatch('Archived', (id) => api.delete(`/crm/deals/${id}`));

  const stages = (pipeline?.stages || []).slice().sort((a, b) => a.order - b.order);
  const activeTeam = team.filter(m => m.isActive !== false && m.status !== 'pending');

  return (
    <div className="fixed bottom-20 lg:bottom-6 left-1/2 -translate-x-1/2 z-40 animate-scale-in" ref={menuRef}>
      <div className="bg-slate-brand text-white shadow-2xl rounded-xl px-2 py-2 flex items-center gap-1 max-w-[calc(100vw-2rem)]">
        {/* Count + clear */}
        <div className="flex items-center gap-2 px-3">
          <span className="text-sm font-semibold tabular-nums">{count}</span>
          <span className="text-xs text-white/70 hidden sm:inline">{count === 1 ? 'deal' : 'deals'} selected</span>
        </div>

        <div className="w-px h-6 bg-white/20" />

        {/* Move to stage */}
        <div className="relative">
          <button
            onClick={() => setOpenMenu(openMenu === 'stage' ? null : 'stage')}
            disabled={processing}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium hover:bg-white/10 disabled:opacity-50"
          >
            <Move className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Move to</span> <ChevronUp className="w-3 h-3 opacity-70" />
          </button>
          {openMenu === 'stage' && (
            <div className="absolute bottom-full mb-2 left-0 bg-white text-slate-brand rounded-lg shadow-2xl border border-sand-200 py-1 min-w-44 max-h-64 overflow-y-auto">
              {stages.map((s) => (
                <button
                  key={s.name}
                  onClick={() => handleMoveToStage(s.name)}
                  className="w-full text-left px-3 py-1.5 text-xs hover:bg-sand-50 flex items-center gap-2"
                >
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                  <span className="truncate">{s.name}</span>
                  {s.type === 'won' && <span className="ml-auto text-[9px] px-1 rounded bg-emerald-100 text-emerald-700 uppercase">Won</span>}
                  {s.type === 'lost' && <span className="ml-auto text-[9px] px-1 rounded bg-red-100 text-red-700 uppercase">Lost</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Reassign */}
        <div className="relative">
          <button
            onClick={() => setOpenMenu(openMenu === 'assign' ? null : 'assign')}
            disabled={processing}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium hover:bg-white/10 disabled:opacity-50"
          >
            <UserCheck className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Reassign</span> <ChevronUp className="w-3 h-3 opacity-70" />
          </button>
          {openMenu === 'assign' && (
            <div className="absolute bottom-full mb-2 left-0 bg-white text-slate-brand rounded-lg shadow-2xl border border-sand-200 py-1 min-w-48 max-h-64 overflow-y-auto">
              {activeTeam.length === 0 ? (
                <p className="px-3 py-2 text-xs text-sand-400">No teammates</p>
              ) : (
                activeTeam.map((m) => (
                  <button
                    key={m._id}
                    onClick={() => handleReassign(m._id)}
                    className="w-full text-left px-3 py-1.5 text-xs hover:bg-sand-50 flex items-center gap-2"
                  >
                    <span className="truncate">{m.name || m.email}</span>
                    <span className="ml-auto text-[9px] text-sand-400 capitalize">{m.role}</span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {/* Delete */}
        <button
          onClick={() => setConfirmDelete(true)}
          disabled={processing}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium hover:bg-red-500/20 text-red-200 hover:text-red-100 disabled:opacity-50"
        >
          <Trash2 className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Archive</span>
        </button>

        <div className="w-px h-6 bg-white/20" />

        <button
          onClick={onClear}
          disabled={processing}
          className="p-1.5 rounded-md hover:bg-white/10 disabled:opacity-50"
          title="Clear selection"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Delete confirmation */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setConfirmDelete(false)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-5" onClick={(e) => e.stopPropagation()}>
            <h4 className="text-sm font-semibold text-slate-brand mb-1">Archive {count} {count === 1 ? 'deal' : 'deals'}?</h4>
            <p className="text-xs text-sand-500 mb-4">
              They'll be hidden from your pipeline. Anything you don't have permission to archive will be skipped.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmDelete(false)}
                className="px-4 py-2 rounded-lg text-sm text-sand-500 hover:bg-sand-50"
              >
                Cancel
              </button>
              <button
                onClick={() => { setConfirmDelete(false); handleDelete(); }}
                className="px-4 py-2 rounded-lg bg-red-500 text-white text-sm font-medium hover:bg-red-600"
              >
                Archive
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
