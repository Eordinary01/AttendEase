import React, { Fragment, useState } from 'react';
import { Menu, Transition } from '@headlessui/react';
import {
  Bell,
  AlertTriangle,
  AlertCircle,
  Megaphone,
  Check,
  CheckCheck,
  ChevronRight,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Badge from './ui/Badge';
import Modal from './ui/Modal';
import { useNotifications } from '../../contexts/NotificationContext';

/**
 * NotificationBell
 * Topbar notification trigger with unread badge and dropdown list
 * for System Alerts, Announcements, and Absence Escalations.
 * Powered by real-time SSE event stream via NotificationContext.
 */
export const NotificationBell = ({ role = '' }) => {
  const navigate = useNavigate();
  const [selectedAlert, setSelectedAlert] = useState(null);

  const {
    alerts = [],
    unreadCount = 0,
    isLive = false,
    loading = false,
    soundEnabled = true,
    toggleSound,
    refreshAlerts,
    markAsRead,
    markAllAsRead,
    connectionStatus,
  } = useNotifications();

  const totalCount = alerts.length;
  const hasEscalation = alerts.some(
    (a) => !a.isRead && (a.type === 'absence_escalation' || a.priority === 'urgent')
  );

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

  const handleAlertClick = (alert) => {
    const id = alert._id || alert.id;
    if (id && !alert.isRead) {
      markAsRead(id);
    }
    setSelectedAlert(alert);
  };

  const handleViewAll = () => {
    if (role === 'teacher') {
      navigate('/teacher/alerts');
    } else if (role === 'student') {
      navigate('/student/alerts');
    } else if (role === 'admin' || role === 'super_admin') {
      navigate('/admin/announcements');
    } else {
      navigate('/dashboard');
    }
  };

  return (
    <>
      <Menu as="div" className="relative inline-block text-left">
        <div>
          <Menu.Button
            className="relative p-2 rounded-xl text-ink-soft hover:bg-background hover:text-ink transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            aria-label="Open notifications"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span
                className={`absolute top-1 right-1 flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full text-[10px] font-bold text-white shadow-xs ${
                  hasEscalation ? 'bg-rose-500 animate-pulse' : 'bg-primary'
                }`}
              >
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </Menu.Button>
        </div>

        <Transition
          as={Fragment}
          enter="transition ease-out duration-150"
          enterFrom="transform opacity-0 scale-95"
          enterTo="transform opacity-100 scale-100"
          leave="transition ease-in duration-100"
          leaveFrom="transform opacity-100 scale-100"
          leaveTo="transform opacity-0 scale-95"
        >
          <Menu.Items className="absolute right-0 mt-2 w-80 sm:w-96 origin-top-right rounded-2xl bg-surface border border-line shadow-xl focus:outline-none z-50 overflow-hidden">
            {/* Header */}
            <div className="px-4 py-3 border-b border-line flex items-center justify-between bg-background/50">
              <div className="flex items-center gap-2">
                <span className="font-bold text-xs text-ink uppercase tracking-wider">
                  Notifications
                </span>
                {unreadCount > 0 ? (
                  <Badge tone={hasEscalation ? 'danger' : 'primary'} size="sm">
                    {unreadCount} Unread
                  </Badge>
                ) : totalCount > 0 ? (
                  <Badge tone="neutral" size="sm">
                    All Read
                  </Badge>
                ) : null}
              </div>

              <div className="flex items-center gap-2.5">
                {/* Audio chime toggle */}
                <button
                  type="button"
                  onClick={toggleSound}
                  title={soundEnabled ? 'Mute chime' : 'Enable chime'}
                  className="text-ink-faint hover:text-primary transition-colors p-0.5 rounded"
                >
                  {soundEnabled ? (
                    <Volume2 className="w-3.5 h-3.5 text-primary" />
                  ) : (
                    <VolumeX className="w-3.5 h-3.5 opacity-50" />
                  )}
                </button>

                {/* Mark all as read */}
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={markAllAsRead}
                    title="Mark all as read"
                    className="text-[11px] font-medium text-ink-faint hover:text-emerald-600 transition-colors flex items-center gap-0.5"
                  >
                    <CheckCheck className="w-3 h-3 text-emerald-500" />
                    <span>Read all</span>
                  </button>
                )}

                {/* Live SSE status indicator */}
                {isLive ? (
                  <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Live
                  </span>
                ) : connectionStatus === 'reconnecting' ? (
                  <span className="flex items-center gap-1 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
                    Reconnecting
                  </span>
                ) : null}

                <button
                  type="button"
                  onClick={refreshAlerts}
                  disabled={loading}
                  className="text-[11px] font-medium text-ink-faint hover:text-primary transition-colors"
                >
                  {loading ? '...' : 'Refresh'}
                </button>
              </div>
            </div>

            {/* List */}
            <div className="max-h-80 overflow-y-auto divide-y divide-line/60">
              {alerts.length > 0 ? (
                alerts.map((a) => {
                  const id = a._id || a.id;
                  const IconComponent = getAlertIcon(a);
                  const isAbsence = a.type === 'absence_escalation';
                  const isRead = Boolean(a.isRead);

                  return (
                    <div
                      key={id}
                      onClick={() => handleAlertClick(a)}
                      className={`p-3.5 transition-colors cursor-pointer group flex items-start justify-between gap-2.5 ${
                        isRead
                          ? 'bg-transparent opacity-85 hover:bg-background/80'
                          : isAbsence
                          ? 'bg-rose-500/10 hover:bg-rose-500/15'
                          : 'bg-primary/5 hover:bg-primary/10'
                      }`}
                    >
                      <div className="flex items-start gap-2.5 min-w-0 flex-1">
                        <div
                          className={`p-1.5 rounded-lg shrink-0 mt-0.5 ${
                            isAbsence
                              ? 'bg-rose-500/15 text-rose-500'
                              : a.priority === 'high'
                              ? 'bg-amber-500/15 text-amber-500'
                              : 'bg-primary/10 text-primary'
                          }`}
                        >
                          <IconComponent className="w-4 h-4" />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-1 mb-0.5">
                            <div className="flex items-center gap-1.5 min-w-0">
                              {!isRead && (
                                <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                              )}
                              <h5 className="text-xs font-bold text-ink truncate">
                                {a.title || 'System Notification'}
                              </h5>
                            </div>
                            <Badge tone={getAlertTone(a)} size="sm">
                              {isAbsence ? 'Absence' : a.priority || 'Normal'}
                            </Badge>
                          </div>

                          <p className="text-xs text-ink-soft line-clamp-2 leading-relaxed">
                            {a.message}
                          </p>

                          {a.createdAt && (
                            <span className="text-[10px] text-ink-faint mt-1 block">
                              {new Date(a.createdAt).toLocaleDateString(undefined, {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Individual Mark as Read button */}
                      {!isRead && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            markAsRead(id);
                          }}
                          title="Mark as read"
                          className="p-1 rounded-lg text-ink-faint hover:text-primary hover:bg-surface transition shrink-0 opacity-80 hover:opacity-100"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="p-8 text-center">
                  <Bell className="w-8 h-8 text-ink-faint mx-auto mb-2 opacity-50" />
                  <p className="text-xs font-semibold text-ink">No notifications</p>
                  <p className="text-[11px] text-ink-faint mt-0.5">
                    You are all caught up on announcements and alerts.
                  </p>
                </div>
              )}
            </div>

            {/* Footer Navigation */}
            <div className="p-2 border-t border-line bg-background/30 text-center">
              <button
                type="button"
                onClick={handleViewAll}
                className="w-full py-1.5 px-3 rounded-xl text-xs font-bold text-primary hover:bg-surface transition-colors flex items-center justify-center gap-1"
              >
                <span>
                  {role === 'teacher'
                    ? 'View All Broadcasts'
                    : role === 'student'
                    ? 'View All Announcements'
                    : 'Manage Announcements'}
                </span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </Menu.Items>
        </Transition>
      </Menu>

      {/* Alert Inspection Modal */}
      {selectedAlert && (
        <Modal
          isOpen={!!selectedAlert}
          onClose={() => setSelectedAlert(null)}
          title={selectedAlert.title || 'Notification Details'}
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
                Published by: <span className="font-semibold text-ink">{selectedAlert.createdBy.name}</span> ({selectedAlert.createdBy.role})
              </div>
            )}
          </div>
        </Modal>
      )}
    </>
  );
};

export default NotificationBell;
