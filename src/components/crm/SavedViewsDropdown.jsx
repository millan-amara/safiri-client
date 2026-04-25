import { useState, useRef, useEffect } from 'react';
import { Bookmark, Plus, Check, Edit2, Trash2, RotateCcw, ChevronDown } from 'lucide-react';

// Compact dropdown for managing per-user saved pipeline views.
// Owner of state lives in the parent (CRMPage) — this component is presentational
// + delegates all mutations through callbacks. Keeps filter logic in one place.
export default function SavedViewsDropdown({
  views,
  activeViewId,
  hasUnsavedChanges,
  onApply,
  onClear,
  onSaveAs,
  onUpdate,
  onRename,
  onDelete,
}) {
  const [open, setOpen] = useState(false);
  const [saveMode, setSaveMode] = useState(false);
  const [renaming, setRenaming] = useState(null); // viewId being renamed
  const [name, setName] = useState('');
  const ref = useRef(null);

  const activeView = views.find(v => v._id === activeViewId);

  useEffect(() => {
    const handle = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
        setSaveMode(false);
        setRenaming(null);
      }
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  const closeAll = () => {
    setOpen(false);
    setSaveMode(false);
    setRenaming(null);
    setName('');
  };

  const handleSaveAs = () => {
    if (!name.trim()) return;
    onSaveAs(name.trim());
    closeAll();
  };

  const handleRename = (viewId) => {
    if (!name.trim()) { setRenaming(null); return; }
    onRename(viewId, name.trim());
    setRenaming(null);
    setName('');
  };

  const label = activeView
    ? `${activeView.name}${hasUnsavedChanges ? ' • modified' : ''}`
    : 'All deals';

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-white border border-sand-200 text-xs text-sand-600 hover:border-sand-300 max-w-[200px]"
        title={label}
      >
        <Bookmark className={`w-3.5 h-3.5 shrink-0 ${activeView ? 'text-amber-brand fill-amber-brand' : 'text-sand-400'}`} />
        <span className="truncate">{label}</span>
        <ChevronDown className="w-3 h-3 opacity-50 shrink-0" />
      </button>

      {open && (
        <div className="absolute right-0 mt-1 z-30 bg-white rounded-lg shadow-2xl border border-sand-200 py-1 min-w-64 max-w-80 max-h-96 overflow-y-auto">
          {/* "All deals" — clears active view + resets filters */}
          <button
            onClick={() => { onClear(); closeAll(); }}
            className="w-full text-left px-3 py-1.5 text-xs hover:bg-sand-50 flex items-center gap-2"
          >
            <span className="w-3.5 h-3.5 shrink-0">
              {!activeView && <Check className="w-3.5 h-3.5 text-amber-brand" />}
            </span>
            <span className="text-slate-brand">All deals</span>
            <span className="text-[10px] text-sand-400 ml-auto">defaults</span>
          </button>

          {views.length > 0 && <div className="my-1 border-t border-sand-100" />}

          {views.map((view) => {
            const isActive = view._id === activeViewId;
            const isRenamingThis = renaming === view._id;
            return (
              <div key={view._id} className="group flex items-center gap-1 px-1">
                {isRenamingThis ? (
                  <div className="flex-1 flex items-center gap-1 px-2 py-1.5">
                    <input
                      autoFocus
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleRename(view._id);
                        if (e.key === 'Escape') { setRenaming(null); setName(''); }
                      }}
                      className="flex-1 min-w-0 px-2 py-1 rounded border border-sand-200 text-xs focus:outline-none focus:border-amber-brand"
                    />
                    <button onClick={() => handleRename(view._id)} className="text-[10px] text-amber-brand font-medium hover:underline">Save</button>
                  </div>
                ) : (
                  <>
                    <button
                      onClick={() => { onApply(view); closeAll(); }}
                      className="flex-1 text-left px-2 py-1.5 text-xs hover:bg-sand-50 rounded flex items-center gap-2 min-w-0"
                    >
                      <span className="w-3.5 h-3.5 shrink-0">
                        {isActive && <Check className="w-3.5 h-3.5 text-amber-brand" />}
                      </span>
                      <span className="text-slate-brand truncate">{view.name}</span>
                    </button>
                    <button
                      onClick={() => { setRenaming(view._id); setName(view.name); }}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded text-sand-400 hover:text-slate-brand hover:bg-sand-100"
                      title="Rename"
                    >
                      <Edit2 className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`Delete "${view.name}"?`)) {
                          onDelete(view._id);
                        }
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded text-sand-400 hover:text-red-500 hover:bg-sand-100"
                      title="Delete"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </>
                )}
              </div>
            );
          })}

          <div className="my-1 border-t border-sand-100" />

          {/* Update current view (only when a view is active and filters have diverged) */}
          {activeView && hasUnsavedChanges && (
            <button
              onClick={() => { onUpdate(); closeAll(); }}
              className="w-full text-left px-3 py-1.5 text-xs hover:bg-sand-50 flex items-center gap-2 text-amber-brand font-medium"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Update "{activeView.name}"
            </button>
          )}

          {/* Save current view as... */}
          {saveMode ? (
            <div className="flex items-center gap-1 px-2 py-1.5">
              <input
                autoFocus
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveAs();
                  if (e.key === 'Escape') { setSaveMode(false); setName(''); }
                }}
                placeholder="View name"
                className="flex-1 min-w-0 px-2 py-1 rounded border border-sand-200 text-xs focus:outline-none focus:border-amber-brand"
              />
              <button onClick={handleSaveAs} className="text-[10px] text-amber-brand font-medium hover:underline">Save</button>
              <button onClick={() => { setSaveMode(false); setName(''); }} className="text-[10px] text-sand-400 hover:underline">Cancel</button>
            </div>
          ) : (
            <button
              onClick={() => setSaveMode(true)}
              className="w-full text-left px-3 py-1.5 text-xs hover:bg-sand-50 flex items-center gap-2 text-slate-brand"
            >
              <Plus className="w-3.5 h-3.5" />
              Save current view as...
            </button>
          )}
        </div>
      )}
    </div>
  );
}
