import { X } from 'lucide-react';

export default function Modal({ title, onClose, children, wide }) {
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center p-4 pt-[5vh] sm:pt-[10vh] overflow-y-auto" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className={`bg-card rounded-xl shadow-xl w-full animate-scale-in flex flex-col max-h-[calc(100vh-2rem)] sm:max-h-[90vh] ${wide ? 'max-w-2xl' : 'max-w-md'}`}
      >
        <div className="flex items-center justify-between gap-2 px-4 sm:px-5 py-3 sm:py-4 border-b border-border shrink-0">
          <h3 className="text-base font-semibold text-foreground min-w-0 flex-1 truncate">{title}</h3>
          <button onClick={onClose} className="p-2 -mr-1 rounded-md hover:bg-muted text-muted-foreground/70 transition-colors shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-4 sm:p-5 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
