import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../utils/api';
import { Bell, Check, FileText, Users, CheckSquare, Eye, X } from 'lucide-react';

const typeIcons = {
  deal_created: Users,
  deal_stage_changed: Users,
  quote_viewed: Eye,
  task_assigned: CheckSquare,
  task_overdue: CheckSquare,
  system: Bell,
};

const typeColors = {
  deal_created: 'bg-blue-100 text-blue-600',
  deal_stage_changed: 'bg-purple-100 text-purple-600',
  quote_viewed: 'bg-primary/15 text-primary',
  task_assigned: 'bg-green-100 text-green-600',
  task_overdue: 'bg-red-100 text-red-600',
  system: 'bg-muted text-muted-foreground',
};

export default function NotificationBell({ variant = 'sidebar' }) {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();

  const fetchNotifications = async () => {
    try {
      const { data } = await api.get('/notifications');
      setNotifications(data.notifications);
      setUnreadCount(data.unreadCount);
    } catch {
      // silent
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000); // poll every 30s
    return () => clearInterval(interval);
  }, []);

  // Close on click outside
  useEffect(() => {
    const handleClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const markAllRead = async () => {
    try {
      await api.put('/notifications/read-all');
      setNotifications(notifications.map(n => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch {
      // silent
    }
  };

  const handleClick = async (notif) => {
    // Mark as read
    if (!notif.isRead) {
      try {
        await api.put(`/notifications/${notif._id}/read`);
        setNotifications(notifications.map(n => n._id === notif._id ? { ...n, isRead: true } : n));
        setUnreadCount(Math.max(0, unreadCount - 1));
      } catch { /* silent */ }
    }

    // Navigate to entity
    if (notif.entityType === 'deal' && notif.entityId) {
      navigate(`/crm/deals/${notif.entityId}`);
    } else if (notif.entityType === 'quote' && notif.entityId) {
      navigate(`/quotes/${notif.entityId}`);
    } else if (notif.entityType === 'contact' && notif.entityId) {
      navigate(`/crm/contacts/${notif.entityId}`);
    }
    setOpen(false);
  };

  const timeAgo = (date) => {
    const seconds = Math.floor((new Date() - new Date(date)) / 1000);
    if (seconds < 60) return 'now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
    return `${Math.floor(seconds / 86400)}d`;
  };

  const isTopbar = variant === 'topbar';
  const buttonCls = isTopbar
    ? 'relative p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors'
    : 'relative p-1.5 rounded-md text-white/50 hover:text-white hover:bg-card/10 transition-colors';
  const bellSize = isTopbar ? 'w-5 h-5' : 'w-4 h-4';
  const dropdownPosCls = isTopbar
    ? 'fixed right-3 top-14 w-[calc(100vw-1.5rem)] max-w-sm'
    : 'absolute left-full ml-2 bottom-0 w-80';

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={buttonCls}
      >
        <Bell className={bellSize} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className={`${dropdownPosCls} bg-card rounded-xl shadow-xl border border-border overflow-hidden z-50 animate-scale-in`}>
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <h3 className="text-sm font-semibold text-foreground">Notifications</h3>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button onClick={markAllRead} className="text-[10px] text-primary hover:underline">
                  Mark all read
                </button>
              )}
              <button onClick={() => setOpen(false)} className="p-1 rounded hover:bg-muted text-muted-foreground/70">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="py-8 text-center">
                <Bell className="w-6 h-6 text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-xs text-muted-foreground/70">No notifications yet</p>
              </div>
            ) : (
              notifications.map((notif) => {
                const Icon = typeIcons[notif.type] || Bell;
                const colorCls = typeColors[notif.type] || typeColors.system;
                return (
                  <button
                    key={notif._id}
                    onClick={() => handleClick(notif)}
                    className={`w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-background transition-colors border-b border-border/60 ${
                      !notif.isRead ? 'bg-primary/10/30' : ''
                    }`}
                  >
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${colorCls}`}>
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs leading-snug ${!notif.isRead ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>
                        {notif.title}
                      </p>
                      {notif.message && (
                        <p className="text-[10px] text-muted-foreground/70 mt-0.5 truncate">{notif.message}</p>
                      )}
                    </div>
                    <span className="text-[10px] text-muted-foreground/70 flex-shrink-0">{timeAgo(notif.createdAt)}</span>
                    {!notif.isRead && (
                      <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0 mt-1" />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
