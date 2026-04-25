import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  addMonths, subMonths, isSameDay, isSameMonth, isToday,
  format, eachDayOfInterval, differenceInDays, max, min,
} from 'date-fns';
import api from '../../utils/api';
import {
  ChevronLeft, ChevronRight, Plane, CheckSquare, Mail,
  Calendar as CalendarIcon,
} from 'lucide-react';

// Bar slotting: greedy interval scheduling so multiple travel windows in the
// same week stack into rows without overlapping. Returns the bars annotated
// with `.row` and the total `.maxRow` so the cells can reserve enough height.
function slotBars(bars) {
  const sorted = [...bars].sort((a, b) => a.startCol - b.startCol);
  const rowEnds = []; // last endCol per row
  for (const bar of sorted) {
    let placed = false;
    for (let i = 0; i < rowEnds.length; i++) {
      if (rowEnds[i] < bar.startCol) {
        bar.row = i;
        rowEnds[i] = bar.endCol;
        placed = true;
        break;
      }
    }
    if (!placed) {
      bar.row = rowEnds.length;
      rowEnds.push(bar.endCol);
    }
  }
  return { bars: sorted, rowCount: rowEnds.length };
}

// Cap how many travel-bar rows render per week before the "+N more trips" link.
// Above this, additional bars are hidden but accessible via the overflow popover.
const MAX_TRIP_ROWS = 3;

// Compute the travel-window bars that intersect a given week, with their
// column positions (0-6) within that week. Returns visible bars (capped),
// the row count for cell-height reservation, and the hidden bars for overflow.
function travelBarsForWeek(week, deals) {
  const weekStart = week[0];
  const weekEnd = week[6];
  const out = [];
  for (const d of deals) {
    const startRaw = d.travelDates?.start;
    const endRaw = d.travelDates?.end || d.travelDates?.start;
    if (!startRaw) continue;
    const start = new Date(startRaw);
    const end = new Date(endRaw);
    if (isNaN(start) || isNaN(end)) continue;
    if (end < weekStart || start > weekEnd) continue;
    const visibleStart = max([start, weekStart]);
    const visibleEnd = min([end, weekEnd]);
    out.push({
      deal: d,
      startCol: differenceInDays(visibleStart, weekStart),
      endCol: differenceInDays(visibleEnd, weekStart),
      startsBefore: start < weekStart,
      endsAfter: end > weekEnd,
    });
  }
  const slotted = slotBars(out);
  const visibleBars = slotted.bars.filter(b => b.row < MAX_TRIP_ROWS);
  const hiddenBars = slotted.bars.filter(b => b.row >= MAX_TRIP_ROWS);
  return {
    bars: visibleBars,
    rowCount: Math.min(slotted.rowCount, MAX_TRIP_ROWS),
    hiddenBars,
    allBars: slotted.bars,
  };
}

// Format a Date as a compact time tag ("9a", "2:30p"). Returns null for
// midnight, so date-only inputs (which default to 00:00) don't get a noisy "12a".
function formatTaskTime(date) {
  const d = new Date(date);
  const h = d.getHours();
  const m = d.getMinutes();
  if (h === 0 && m === 0) return null;
  const ampm = h >= 12 ? 'p' : 'a';
  const hour12 = h % 12 || 12;
  const minutes = m === 0 ? '' : `:${String(m).padStart(2, '0')}`;
  return `${hour12}${minutes}${ampm}`;
}

const PRIORITY_COLOR = {
  urgent: 'bg-red-100 text-red-700 border-red-200',
  high: 'bg-amber-100 text-amber-700 border-amber-200',
  medium: 'bg-blue-100 text-blue-700 border-blue-200',
  low: 'bg-muted text-muted-foreground border-border',
};

// Pull a stable color for a deal's travel bar from its pipeline's stage color.
function travelBarColor(deal) {
  const stages = deal.pipeline?.stages || [];
  const stage = stages.find(s => s.name === deal.stage);
  // Soft tinted background, darker text/border — matches stage hue.
  const c = stage?.color || '#6B7280';
  return { background: `${c}22`, color: c, borderColor: `${c}66` };
}

export default function CalendarView({ deals, tasks }) {
  const navigate = useNavigate();
  const [cursor, setCursor] = useState(new Date());
  const [scheduledMessages, setScheduledMessages] = useState([]);
  const [layers, setLayers] = useState({ travel: true, tasks: true, messages: true });
  const [overflowCell, setOverflowCell] = useState(null);
  const [tripsOverflow, setTripsOverflow] = useState(null); // { weekStart, bars }

  const monthStart = startOfMonth(cursor);
  const monthEnd = endOfMonth(cursor);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });

  // Fetch scheduled messages whenever the visible month changes.
  useEffect(() => {
    api.get('/scheduled-messages', {
      params: { from: gridStart.toISOString(), to: gridEnd.toISOString() },
    })
      .then(({ data }) => setScheduledMessages(data.messages || []))
      .catch(() => setScheduledMessages([]));
  }, [cursor]);

  const days = useMemo(() => eachDayOfInterval({ start: gridStart, end: gridEnd }), [cursor]);
  const weeks = useMemo(() => {
    const out = [];
    for (let i = 0; i < days.length; i += 7) out.push(days.slice(i, i + 7));
    return out;
  }, [days]);

  // Bucket tasks and messages by day for fast lookup.
  const tasksByDay = useMemo(() => {
    const map = new Map();
    for (const t of tasks) {
      if (!t.dueDate) continue;
      if (t.status === 'cancelled') continue;
      const key = format(new Date(t.dueDate), 'yyyy-MM-dd');
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(t);
    }
    return map;
  }, [tasks]);

  const messagesByDay = useMemo(() => {
    const map = new Map();
    for (const m of scheduledMessages) {
      if (!m.sendAt) continue;
      const key = format(new Date(m.sendAt), 'yyyy-MM-dd');
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(m);
    }
    return map;
  }, [scheduledMessages]);

  // Cap how many task chips render per cell before the +N more overflow.
  const MAX_TASKS_PER_CELL = 2;

  const goToDeal = (dealId) => navigate(`/crm/deals/${dealId}`);

  const toggleLayer = (key) => setLayers(l => ({ ...l, [key]: !l[key] }));

  return (
    <div className="bg-white rounded-xl border border-sand-200 overflow-hidden">
      {/* Header — month nav + layer toggles */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 border-b border-sand-100">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCursor(subMonths(cursor, 1))}
            className="p-1.5 rounded-md text-sand-500 hover:bg-sand-100"
            aria-label="Previous month"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <h3 className="text-sm font-semibold text-slate-brand min-w-40 text-center">
            {format(cursor, 'MMMM yyyy')}
          </h3>
          <button
            onClick={() => setCursor(addMonths(cursor, 1))}
            className="p-1.5 rounded-md text-sand-500 hover:bg-sand-100"
            aria-label="Next month"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <button
            onClick={() => setCursor(new Date())}
            className="ml-2 px-2.5 py-1 rounded-md text-xs font-medium text-sand-600 hover:bg-sand-100 border border-sand-200"
          >
            Today
          </button>
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          <LayerToggle active={layers.travel} onClick={() => toggleLayer('travel')} icon={Plane} label="Trips" color="emerald" />
          <LayerToggle active={layers.tasks} onClick={() => toggleLayer('tasks')} icon={CheckSquare} label="Tasks" color="blue" />
          <LayerToggle active={layers.messages} onClick={() => toggleLayer('messages')} icon={Mail} label="Messages" color="amber" />
        </div>
      </div>

      {/* Weekday header */}
      <div className="grid grid-cols-7 border-b border-sand-100 bg-sand-50">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
          <div key={d} className="px-2 py-1.5 text-[10px] font-medium uppercase tracking-wide text-sand-500 text-center">
            {d}
          </div>
        ))}
      </div>

      {/* Weeks */}
      {weeks.map((week, wi) => {
        const { bars, rowCount, hiddenBars, allBars } = layers.travel
          ? travelBarsForWeek(week, deals)
          : { bars: [], rowCount: 0, hiddenBars: [], allBars: [] };
        const hiddenTrips = hiddenBars.length;
        const barAreaHeight = rowCount > 0 ? rowCount * 18 + (hiddenTrips > 0 ? 18 : 4) : 0;

        return (
          <div key={wi} className="relative grid grid-cols-7 border-b border-sand-100 last:border-b-0">
            {/* Day cells */}
            {week.map((day) => {
              const key = format(day, 'yyyy-MM-dd');
              const inMonth = isSameMonth(day, cursor);
              const today = isToday(day);
              const dayTasks = layers.tasks ? (tasksByDay.get(key) || []) : [];
              const dayMessages = layers.messages ? (messagesByDay.get(key) || []) : [];
              const visibleTasks = dayTasks.slice(0, MAX_TASKS_PER_CELL);
              const overflowCount = Math.max(0, dayTasks.length - MAX_TASKS_PER_CELL);

              return (
                <div
                  key={key}
                  className={`min-h-27.5 border-r border-sand-100 last:border-r-0 p-1 ${
                    inMonth ? 'bg-white' : 'bg-sand-50/50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-0.5">
                    <span className={`text-[11px] font-medium ${
                      today
                        ? 'inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-brand text-white'
                        : inMonth ? 'text-slate-brand' : 'text-sand-300'
                    }`}>
                      {format(day, 'd')}
                    </span>
                    {dayMessages.length > 0 && (
                      <span className="inline-flex items-center gap-0.5 text-[9px] text-amber-600" title={`${dayMessages.length} scheduled message${dayMessages.length > 1 ? 's' : ''}`}>
                        <Mail className="w-2.5 h-2.5" />
                        {dayMessages.length > 1 && dayMessages.length}
                      </span>
                    )}
                  </div>

                  {/* Reserved space for travel bars overlay */}
                  {barAreaHeight > 0 && <div style={{ height: barAreaHeight }} />}

                  {/* Tasks */}
                  <div className="space-y-0.5">
                    {visibleTasks.map((task) => {
                      const time = formatTaskTime(task.dueDate);
                      return (
                        <button
                          key={task._id}
                          onClick={() => task.deal?._id && goToDeal(task.deal._id)}
                          className={`w-full text-left text-[10px] px-1 py-0.5 rounded border truncate ${PRIORITY_COLOR[task.priority] || PRIORITY_COLOR.medium} ${task.deal?._id ? 'hover:opacity-80 cursor-pointer' : 'cursor-default'} ${task.status === 'done' ? 'line-through opacity-60' : ''}`}
                          title={`${time ? time + ' · ' : ''}${task.title}`}
                        >
                          {time && <span className="opacity-70 mr-1">{time}</span>}
                          {task.title}
                        </button>
                      );
                    })}
                    {overflowCount > 0 && (
                      <button
                        onClick={() => setOverflowCell({ day, tasks: dayTasks, messages: dayMessages })}
                        className="text-[10px] text-sand-500 hover:text-slate-brand hover:underline px-1"
                      >
                        +{overflowCount} more
                      </button>
                    )}
                  </div>
                </div>
              );
            })}

            {/* "+N more trips" link when this week has more travel bars than
                MAX_TRIP_ROWS. Positioned in the row just below the visible bars. */}
            {hiddenTrips > 0 && (
              <button
                onClick={() => setTripsOverflow({ weekStart: week[0], bars: allBars })}
                className="absolute right-1 text-[10px] font-medium text-emerald-700 hover:underline px-1.5 py-0.5 rounded bg-emerald-50/90 border border-emerald-200"
                style={{ top: 24 + MAX_TRIP_ROWS * 18 - 1 }}
              >
                +{hiddenTrips} more {hiddenTrips === 1 ? 'trip' : 'trips'}
              </button>
            )}

            {/* Travel bars overlaid on the week (positioned absolutely so they
                span across day cells with continuous bars). */}
            {bars.map((bar, i) => {
              const colSpan = bar.endCol - bar.startCol + 1;
              const colors = travelBarColor(bar.deal);
              return (
                <button
                  key={`${bar.deal._id}-${wi}-${i}`}
                  onClick={() => goToDeal(bar.deal._id)}
                  className="absolute text-[10px] font-medium px-1.5 py-0.5 truncate text-left hover:opacity-90 transition-opacity"
                  style={{
                    left: `calc(${(bar.startCol / 7) * 100}% + 2px)`,
                    width: `calc(${(colSpan / 7) * 100}% - 4px)`,
                    top: 24 + bar.row * 18,
                    height: 16,
                    background: colors.background,
                    color: colors.color,
                    border: `1px solid ${colors.borderColor}`,
                    borderTopLeftRadius: bar.startsBefore ? 0 : 4,
                    borderBottomLeftRadius: bar.startsBefore ? 0 : 4,
                    borderTopRightRadius: bar.endsAfter ? 0 : 4,
                    borderBottomRightRadius: bar.endsAfter ? 0 : 4,
                  }}
                  title={`${bar.deal.title} (${format(new Date(bar.deal.travelDates.start), 'MMM d')} – ${format(new Date(bar.deal.travelDates.end), 'MMM d')})`}
                >
                  <Plane className="w-2.5 h-2.5 inline mr-1" />
                  {bar.deal.title}
                </button>
              );
            })}
          </div>
        );
      })}

      {/* Day-overflow popover (tasks + messages on a single day) */}
      {overflowCell && (
        <OverflowDialog cell={overflowCell} onClose={() => setOverflowCell(null)} onTaskClick={(t) => { setOverflowCell(null); t.deal?._id && goToDeal(t.deal._id); }} />
      )}

      {/* Trips-overflow popover (all travel windows in a week) */}
      {tripsOverflow && (
        <TripsOverflowDialog
          weekStart={tripsOverflow.weekStart}
          bars={tripsOverflow.bars}
          onClose={() => setTripsOverflow(null)}
          onTripClick={(d) => { setTripsOverflow(null); goToDeal(d._id); }}
        />
      )}
    </div>
  );
}

function LayerToggle({ active, onClick, icon: Icon, label, color }) {
  const colorMap = {
    emerald: active ? 'bg-emerald-100 text-emerald-700 border-emerald-300' : 'border-sand-200 text-sand-400',
    blue: active ? 'bg-blue-100 text-blue-700 border-blue-300' : 'border-sand-200 text-sand-400',
    amber: active ? 'bg-amber-100 text-amber-700 border-amber-300' : 'border-sand-200 text-sand-400',
  };
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium border transition-colors ${colorMap[color]}`}
    >
      <Icon className="w-3 h-3" /> {label}
    </button>
  );
}

function OverflowDialog({ cell, onClose, onTaskClick }) {
  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-sm max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-3 border-b border-sand-100 flex items-center gap-2">
          <CalendarIcon className="w-4 h-4 text-sand-500" />
          <h4 className="text-sm font-semibold text-slate-brand">{format(cell.day, 'EEEE, MMMM d')}</h4>
        </div>
        <div className="p-3 space-y-1.5">
          {cell.tasks.length === 0 && (
            <p className="text-xs text-sand-400 text-center py-3">No tasks</p>
          )}
          {cell.tasks.map((task) => {
            const time = formatTaskTime(task.dueDate);
            return (
              <button
                key={task._id}
                onClick={() => onTaskClick(task)}
                className={`w-full text-left text-xs px-2 py-1.5 rounded border ${PRIORITY_COLOR[task.priority] || PRIORITY_COLOR.medium} ${task.deal?._id ? 'hover:opacity-80 cursor-pointer' : 'cursor-default'} ${task.status === 'done' ? 'line-through opacity-60' : ''}`}
              >
                <div className="font-medium">
                  {time && <span className="opacity-70 mr-1.5">{time}</span>}
                  {task.title}
                </div>
                {task.deal && <div className="text-[10px] opacity-70 mt-0.5">{task.deal.title}</div>}
              </button>
            );
          })}
          {cell.messages?.length > 0 && (
            <>
              <div className="text-[10px] uppercase tracking-wide text-sand-400 mt-2 px-1">Scheduled messages</div>
              {cell.messages.map((msg) => {
                const time = formatTaskTime(msg.sendAt);
                return (
                  <div key={msg._id} className="text-xs px-2 py-1.5 rounded border border-amber-200 bg-amber-50 text-amber-700">
                    <div className="font-medium truncate">
                      {time && <span className="opacity-70 mr-1.5">{time}</span>}
                      {msg.subject || '(no subject)'}
                    </div>
                    {msg.deal && <div className="text-[10px] opacity-70 mt-0.5">{msg.deal.title}</div>}
                  </div>
                );
              })}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function TripsOverflowDialog({ weekStart, bars, onClose, onTripClick }) {
  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-3 border-b border-sand-100 flex items-center gap-2">
          <Plane className="w-4 h-4 text-emerald-600" />
          <h4 className="text-sm font-semibold text-slate-brand">
            Trips · week of {format(weekStart, 'MMM d')}
          </h4>
        </div>
        <div className="p-3 space-y-1.5">
          {bars.length === 0 && (
            <p className="text-xs text-sand-400 text-center py-3">No trips this week</p>
          )}
          {bars.map((bar) => {
            const colors = travelBarColor(bar.deal);
            const start = new Date(bar.deal.travelDates.start);
            const end = new Date(bar.deal.travelDates.end);
            return (
              <button
                key={bar.deal._id}
                onClick={() => onTripClick(bar.deal)}
                className="w-full text-left text-xs px-2 py-2 rounded border hover:opacity-80 cursor-pointer"
                style={{ background: colors.background, color: colors.color, borderColor: colors.borderColor }}
              >
                <div className="font-medium truncate flex items-center gap-1.5">
                  <Plane className="w-3 h-3 shrink-0" />
                  {bar.deal.title}
                </div>
                <div className="text-[10px] opacity-80 mt-0.5">
                  {format(start, 'MMM d')} – {format(end, 'MMM d, yyyy')}
                  {bar.deal.contact && ` · ${bar.deal.contact.firstName || ''} ${bar.deal.contact.lastName || ''}`.trim()}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
