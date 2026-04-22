import { X } from 'lucide-react';
import { createPortal } from 'react-dom';
import { useEffect } from 'react';

export default function Modal({ title, onClose, children, wide, xwide, persistent }) {
  const sizeCls = xwide ? 'max-w-5xl' : wide ? 'max-w-2xl' : 'max-w-md';

  // `persistent`: disables backdrop-click dismissal. Set on data-entry modals
  // where an accidental misclick would trash in-progress work. Users close
  // via the X button, Cancel, or Escape instead.
  const handleBackdrop = persistent ? undefined : onClose;

  // Escape always closes, regardless of `persistent`. Pressing Esc is an
  // explicit intentional gesture — unlike a stray click — so it's a safe exit.
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Portal to document.body so no ancestor with `transform`/`filter`/etc
  // can scope our `position: fixed` overlay to a subtree (e.g. page roots
  // using `animate-fade-in`, which persists a transform and would otherwise
  // confine the backdrop to the main content column).
  return createPortal(
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 overflow-y-auto"
      onClick={handleBackdrop}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`bg-card rounded-xl shadow-xl w-full animate-scale-in flex flex-col max-h-[calc(100vh-2rem)] my-auto ${sizeCls}`}
      >
        <div className="flex items-center justify-between gap-2 px-4 sm:px-5 py-3 sm:py-4 border-b border-border shrink-0">
          <h3 className="text-base font-semibold text-foreground min-w-0 flex-1 truncate">{title}</h3>
          <button onClick={onClose} className="p-2 -mr-1 rounded-md hover:bg-muted text-muted-foreground/70 transition-colors shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-4 sm:p-5 overflow-y-auto">{children}</div>
      </div>
    </div>,
    document.body
  );
}
