import React, { useState, useMemo } from 'react';
import {
  Megaphone,
  AlertTriangle,
  AlertCircle,
  Search,
  CheckCheck,
  Check,
  Radio,
  Filter,
  Calendar,
} from 'lucide-react';
import DashboardHeader from '../common/ui/DashboardHeader';
import Card from '../common/ui/Card';
import Badge from '../common/ui/Badge';
import Button from '../common/ui/Button';
import EmptyState from '../common/ui/EmptyState';
import Modal from '../common/ui/Modal';
import { useNotifications } from '../../contexts/NotificationContext';
import { formatDateDMY } from '../../utils/dateUtils';

const StudentAlerts = () => {
  const {
    alerts = [],
    unreadCount = 0,
    isLive = false,
    loading = false,
    markAsRead,
    markAllAsRead,
    refreshAlerts,
  } = useNotifications();

  const [search, setSearch] = useState('');
  const [filterPriority, setFilterPriority] = useState('all');
  const [filterRead, setFilterRead] = useState('all'); // all, unread, read
  const [selectedAlert, setSelectedAlert] = useState(null);

  const filteredAlerts = useMemo(() => {
    return alerts.filter((a) => {
      // Search
      const text = `${a.title || ''} ${a.message || ''}`.toLowerCase();
      if (search.trim() && !text.includes(search.toLowerCase().trim())) {
        return false;
      }
      // Priority
      if (filterPriority !== 'all' && a.priority !== filterPriority) {
        return false;
      }
      // Read state
      if (filterRead === 'unread' && a.isRead) {
        return false;
      }
      if (filterRead === 'read' && !a.isRead) {
        return false;
      }
      return true;
    });
  }, [alerts, search, filterPriority, filterRead]);

  const getAlertTone = (alert) => {
    if (alert.priority === 'urgent' || alert.type === 'absence_escalation') return 'danger';
    if (alert.priority === 'high') return 'warning';
    return 'primary';
  };

  const getAlertIcon = (alert) => {
    if (alert.type === 'absence_escalation') return AlertTriangle;
    if (alert.priority === 'urgent' || alert.priority === 'high') return AlertCircle;
    return Megaphone;
  };

  const handleOpenAlert = (alert) => {
    const id = alert._id || alert.id;
    if (id && !alert.isRead) {
      markAsRead(id);
    }
    setSelectedAlert(alert);
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Page Header */}
      <DashboardHeader
        title="Institutional Notices & Circulars"
        subtitle="Stay informed with official broadcasts, academic alerts, and administrative announcements in real time."
        action={
          <div className="flex items-center gap-2">
            {isLive && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-xs font-semibold">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Live Stream Active
              </span>
            )}
            {unreadCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={markAllAsRead}
                className="flex items-center gap-1.5 text-xs"
              >
                <CheckCheck className="w-3.5 h-3.5 text-emerald-500" />
                Mark All Read
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={refreshAlerts}
              disabled={loading}
              className="text-xs"
            >
              {loading ? 'Refreshing...' : 'Refresh'}
            </Button>
          </div>
        }
      />

      {/* Filter & Search Bar */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-ink-faint absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search announcements by keyword or title..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl bg-background border border-line text-xs text-ink focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <select
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value)}
              className="px-3 py-2 rounded-xl bg-background border border-line text-xs text-ink focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="all">All Priorities</option>
              <option value="urgent">Urgent</option>
              <option value="high">High</option>
              <option value="normal">Normal</option>
              <option value="low">Low</option>
            </select>

            <select
              value={filterRead}
              onChange={(e) => setFilterRead(e.target.value)}
              className="px-3 py-2 rounded-xl bg-background border border-line text-xs text-ink focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="all">All Status</option>
              <option value="unread">Unread Only</option>
              <option value="read">Read Only</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Alerts Grid */}
      {filteredAlerts.length === 0 ? (
        <EmptyState
          icon={<Megaphone className="w-8 h-8 text-primary" />}
          title={search || filterPriority !== 'all' ? 'No matching notices' : 'No announcements'}
          description={
            search || filterPriority !== 'all'
              ? 'Try changing your search query or adjusting your filters.'
              : 'Institutional notices and circulars will be published here in real time.'
          }
          className="py-12"
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredAlerts.map((alert) => {
            const id = alert._id || alert.id;
            const IconComponent = getAlertIcon(alert);
            const isAbsence = alert.type === 'absence_escalation';
            const isRead = Boolean(alert.isRead);

            return (
              <Card
                key={id}
                onClick={() => handleOpenAlert(alert)}
                className={`p-5 cursor-pointer transition-all duration-150 hover:shadow-md hover:border-primary/40 relative flex flex-col justify-between space-y-3 ${
                  !isRead ? 'border-primary/40 bg-primary/[0.02]' : 'opacity-90'
                }`}
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className={`p-2 rounded-xl shrink-0 ${
                          isAbsence
                            ? 'bg-rose-500/15 text-rose-500'
                            : alert.priority === 'high'
                            ? 'bg-amber-500/15 text-amber-500'
                            : 'bg-primary/10 text-primary'
                        }`}
                      >
                        <IconComponent className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          {!isRead && (
                            <span className="w-2 h-2 rounded-full bg-primary shrink-0" />
                          )}
                          <h4 className="text-sm font-bold text-ink truncate">
                            {alert.title || 'Institution Announcement'}
                          </h4>
                        </div>
                      </div>
                    </div>

                    <Badge tone={getAlertTone(alert)} size="sm">
                      {isAbsence ? 'Absence' : alert.priority || 'Normal'}
                    </Badge>
                  </div>

                  <p className="text-xs text-ink-soft line-clamp-3 leading-relaxed">
                    {alert.message}
                  </p>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-line/50 text-[11px] text-ink-faint">
                  <div className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    <span>
                      {alert.createdAt
                        ? formatDateDMY(alert.createdAt)
                        : 'Recent'}
                    </span>
                  </div>

                  {!isRead && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        markAsRead(id);
                      }}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline"
                    >
                      <Check className="w-3 h-3" />
                      Mark as read
                    </button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Notice Inspection Modal */}
      {selectedAlert && (
        <Modal
          isOpen={!!selectedAlert}
          onClose={() => setSelectedAlert(null)}
          title={selectedAlert.title || 'Notice Details'}
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2 pb-2 border-b border-line/60">
              <Badge tone={getAlertTone(selectedAlert)} size="md">
                {selectedAlert.type === 'absence_escalation'
                  ? 'Absence Escalation'
                  : selectedAlert.priority?.toUpperCase() || 'NORMAL'}
              </Badge>
              {selectedAlert.createdAt && (
                <span className="text-xs text-ink-faint">
                  {new Date(selectedAlert.createdAt).toLocaleString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              )}
            </div>

            <div className="p-4 bg-background rounded-2xl border border-line text-xs text-ink leading-relaxed whitespace-pre-wrap">
              {selectedAlert.message}
            </div>

            {selectedAlert.createdBy && (
              <div className="text-[11px] text-ink-faint">
                Issued by:{' '}
                <span className="font-semibold text-ink">
                  {selectedAlert.createdBy.name}
                </span>{' '}
                ({selectedAlert.createdBy.role})
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
};

export default StudentAlerts;
