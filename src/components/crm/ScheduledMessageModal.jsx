import { useState, useMemo } from 'react';
import { renderMarkdownSafe } from '../../utils/sanitizeMarkdown';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { X, Sparkles, Save, Clock, Eye, Edit3 } from 'lucide-react';

// Mirrors server-side setLocalTimeOfDay. Returns the UTC instant for a given
// calendar date at hour:minute local time in an IANA timezone.
function setLocalTimeOfDay(date, hour, minute, timezone) {
  const dateStr = date.toLocaleDateString('en-CA', { timeZone: timezone });
  const [year, month, day] = dateStr.split('-').map(Number);
  const candidateUtc = Date.UTC(year, month - 1, day, hour, minute, 0);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  }).formatToParts(new Date(candidateUtc)).reduce((a, p) => { a[p.type] = p.value; return a; }, {});
  const displayedAsUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour) === 24 ? 0 : Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  const tzOffsetMs = displayedAsUtc - candidateUtc;
  return new Date(candidateUtc - tzOffsetMs);
}

// Compute the preview send date locally so the operator sees what they're
// scheduling before they save. Mirrors server-side computeSendAt() including
// the "send at 9am local" standardization for relative modes.
function computeSendAtPreview(timing, deal, hour, timezone) {
  if (!timing?.mode) return null;
  const days = Math.max(0, Number(timing.offsetDays) || 0);
  const ms = days * 24 * 60 * 60 * 1000;
  if (timing.mode === 'absolute') {
    return timing.absoluteDate ? new Date(timing.absoluteDate) : null;
  }
  if (timing.mode === 'before_travel_start') {
    if (!deal.travelDates?.start) return null;
    const baseDate = new Date(new Date(deal.travelDates.start).getTime() - ms);
    return setLocalTimeOfDay(baseDate, hour, 0, timezone);
  }
  if (timing.mode === 'after_travel_end') {
    if (!deal.travelDates?.end) return null;
    const baseDate = new Date(new Date(deal.travelDates.end).getTime() + ms);
    return setLocalTimeOfDay(baseDate, hour, 0, timezone);
  }
  return null;
}

const KIND_OPTIONS = [
  { value: 'general', label: 'General touch-base' },
  { value: 'welcome', label: 'Welcome (just booked)' },
  { value: 'packing', label: 'Packing tips' },
  { value: 'pickup', label: 'Pickup confirmation' },
  { value: 'review', label: 'Post-trip review request' },
  { value: 'followup', label: 'Post-trip follow-up' },
];

export default function ScheduledMessageModal({ deal, message, onClose, onSaved }) {
  const { organization } = useAuth();
  const sendHour = organization?.preferences?.scheduledMessageHour ?? 9;
  const sendTimezone = organization?.preferences?.scheduledMessageTimezone || 'Africa/Nairobi';

  const isEdit = !!message;
  const [subject, setSubject] = useState(message?.subject || '');
  const [body, setBody] = useState(message?.body || '');
  const [previewMode, setPreviewMode] = useState(false);
  const [timingMode, setTimingMode] = useState(message?.timing?.mode || 'before_travel_start');
  const [offsetDays, setOffsetDays] = useState(message?.timing?.offsetDays ?? 14);
  const [absoluteDate, setAbsoluteDate] = useState(
    message?.timing?.absoluteDate
      ? new Date(message.timing.absoluteDate).toISOString().slice(0, 10)
      : ''
  );
  const [saving, setSaving] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [kind, setKind] = useState('general');
  const [draftNotes, setDraftNotes] = useState('');

  const timing = {
    mode: timingMode,
    offsetDays: Number(offsetDays) || 0,
    absoluteDate: timingMode === 'absolute' && absoluteDate ? new Date(absoluteDate) : undefined,
  };

  const sendAtPreview = useMemo(
    () => computeSendAtPreview(timing, deal, sendHour, sendTimezone),
    [timingMode, offsetDays, absoluteDate, deal, sendHour, sendTimezone],
  );
  const sendAtIsPast = sendAtPreview && sendAtPreview < new Date();
  const renderedBody = useMemo(() => renderMarkdownSafe(body), [body]);

  const handleAiDraft = async () => {
    setDrafting(true);
    try {
      const { data } = await api.post('/ai/draft-scheduled-message', {
        dealId: deal._id,
        kind,
        notes: draftNotes,
      });
      if (data.subject) setSubject(data.subject);
      if (data.body) setBody(data.body);
      toast.success('Draft generated — edit before scheduling');
    } catch (err) {
      toast.error(err.response?.data?.message || 'AI draft failed');
    } finally {
      setDrafting(false);
    }
  };

  const handleSave = async () => {
    if (!body.trim()) {
      toast.error('Message body is required');
      return;
    }
    if (timingMode === 'absolute' && !absoluteDate) {
      toast.error('Pick a date for absolute timing');
      return;
    }
    if (timingMode !== 'absolute' && !sendAtPreview) {
      toast.error('Set the deal travel dates first, or choose absolute timing');
      return;
    }
    setSaving(true);
    try {
      const payload = { deal: deal._id, subject, body, timing, channel: 'email' };
      if (isEdit) {
        const { data } = await api.put(`/scheduled-messages/${message._id}`, payload);
        toast.success('Message updated');
        onSaved?.(data);
      } else {
        const { data } = await api.post('/scheduled-messages', payload);
        toast.success('Message scheduled');
        onSaved?.(data);
      }
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const inputCls = 'w-full px-3 py-2 rounded-lg bg-background border border-border text-sm text-foreground focus:outline-none focus:border-primary transition-colors';
  const recipient = deal.contact?.email
    ? `${deal.contact.firstName || ''} ${deal.contact.lastName || ''} <${deal.contact.email}>`.trim()
    : null;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50 animate-fade-in" onClick={onClose}>
      <div
        className="bg-card rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-border flex items-center justify-between sticky top-0 bg-card z-10">
          <div>
            <h3 className="text-base font-semibold text-foreground">
              {isEdit ? 'Edit scheduled message' : 'Schedule a message'}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {recipient ? `Will send to ${recipient}` : 'No client email on this deal — add one before scheduling.'}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md text-muted-foreground hover:bg-muted">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* AI draft helper */}
          <div className="p-3 rounded-lg bg-gradient-to-r from-amber-50 to-orange-50 border border-primary/30 space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <p className="text-xs font-semibold text-primary flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" /> Draft with AI (3 credits)
              </p>
              <select
                value={kind}
                onChange={(e) => setKind(e.target.value)}
                className="text-xs px-2 py-1 rounded-md border border-border bg-card focus:outline-none"
              >
                {KIND_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <input
              type="text"
              value={draftNotes}
              onChange={(e) => setDraftNotes(e.target.value)}
              placeholder="Optional: anything specific to mention (e.g. 'remind them to bring rain gear')"
              className="w-full px-3 py-1.5 rounded-md bg-card border border-border text-xs focus:outline-none focus:border-primary"
            />
            <button
              onClick={handleAiDraft}
              disabled={drafting}
              className="w-full px-3 py-2 rounded-md bg-primary text-white text-xs font-medium hover:bg-primary disabled:opacity-50 transition-colors"
            >
              {drafting ? 'Drafting...' : (subject || body ? 'Re-draft' : 'Generate draft')}
            </button>
          </div>

          {/* Subject */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Subject</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. Packing tips for your Maasai Mara trip"
              className={inputCls}
            />
          </div>

          {/* Body */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-medium text-muted-foreground">Message body</label>
              <button
                type="button"
                onClick={() => setPreviewMode(!previewMode)}
                className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
              >
                {previewMode ? <><Edit3 className="w-3 h-3" /> Edit</> : <><Eye className="w-3 h-3" /> Preview</>}
              </button>
            </div>
            {previewMode ? (
              <div
                className={`${inputCls} min-h-[260px] prose prose-sm max-w-none`}
                style={{ height: 'auto' }}
                dangerouslySetInnerHTML={{ __html: renderedBody || '<p class="text-muted-foreground italic">Nothing to preview yet.</p>' }}
              />
            ) : (
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={10}
                placeholder="Write your message — the AI draft is editable."
                className={`${inputCls} resize-none font-sans`}
              />
            )}
            <p className="text-[10px] text-muted-foreground/70 mt-1">
              Markdown supported: <code>**bold**</code>, <code>*italic*</code>, <code>- bullet</code>, <code>[link text](url)</code>. Blank line = new paragraph.
            </p>
          </div>

          {/* Timing */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-2">When to send</label>
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  checked={timingMode === 'before_travel_start'}
                  onChange={() => setTimingMode('before_travel_start')}
                />
                <span className="text-sm text-foreground flex items-center gap-2 flex-wrap">
                  <input
                    type="number"
                    min={0}
                    value={timingMode === 'before_travel_start' ? offsetDays : 14}
                    onChange={(e) => { setTimingMode('before_travel_start'); setOffsetDays(e.target.value); }}
                    className="w-16 px-2 py-1 rounded-md bg-background border border-border text-sm focus:outline-none focus:border-primary"
                  />
                  days <strong>before</strong> travel start
                </span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  checked={timingMode === 'after_travel_end'}
                  onChange={() => setTimingMode('after_travel_end')}
                />
                <span className="text-sm text-foreground flex items-center gap-2 flex-wrap">
                  <input
                    type="number"
                    min={0}
                    value={timingMode === 'after_travel_end' ? offsetDays : 1}
                    onChange={(e) => { setTimingMode('after_travel_end'); setOffsetDays(e.target.value); }}
                    className="w-16 px-2 py-1 rounded-md bg-background border border-border text-sm focus:outline-none focus:border-primary"
                  />
                  days <strong>after</strong> travel end
                </span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  checked={timingMode === 'absolute'}
                  onChange={() => setTimingMode('absolute')}
                />
                <span className="text-sm text-foreground flex items-center gap-2">
                  On a specific date:
                  <input
                    type="date"
                    value={absoluteDate}
                    onChange={(e) => { setTimingMode('absolute'); setAbsoluteDate(e.target.value); }}
                    className="px-2 py-1 rounded-md bg-background border border-border text-sm focus:outline-none focus:border-primary"
                  />
                </span>
              </label>
            </div>

            {/* Computed preview */}
            <div className={`mt-3 p-2 rounded-md text-xs flex items-center gap-2 ${
              !sendAtPreview ? 'bg-muted text-muted-foreground' :
              sendAtIsPast ? 'bg-amber-50 text-amber-700 border border-amber-200' :
              'bg-emerald-50 text-emerald-700 border border-emerald-200'
            }`}>
              <Clock className="w-3.5 h-3.5 shrink-0" />
              {!sendAtPreview && (
                timingMode === 'absolute'
                  ? 'Pick a date above'
                  : `Travel ${timingMode === 'before_travel_start' ? 'start' : 'end'} date isn't set on this deal yet`
              )}
              {sendAtPreview && (
                <span>
                  Will send: <strong>{sendAtPreview.toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}</strong>
                  {sendAtIsPast && <span className="ml-1">(in the past — will be flagged overdue)</span>}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="px-5 py-3 border-t border-border flex items-center justify-end gap-2 sticky bottom-0 bg-card">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:bg-muted">Cancel</button>
          <button
            onClick={handleSave}
            disabled={saving || !recipient}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary disabled:opacity-50"
            title={!recipient ? 'Add a contact email to this deal first' : undefined}
          >
            <Save className="w-4 h-4" /> {saving ? 'Saving...' : isEdit ? 'Update' : 'Schedule'}
          </button>
        </div>
      </div>
    </div>
  );
}
