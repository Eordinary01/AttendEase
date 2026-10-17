import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  GraduationCap,
  BookOpen,
  Shield,
  Users,
  X,
  Clock,
  ArrowRight,
  Loader2,
  CheckCircle2,
  Lock
} from 'lucide-react';
import { useDemo } from '../../contexts/DemoContext';

const ROLES_CONFIG = [
  {
    role: 'student',
    title: 'Student Portal',
    badge: 'Student',
    icon: GraduationCap,
    tagline: 'Track attendance, classes & leaves',
    description: 'Inspect live attendance percentages, timetable lecture schedule, subject statistics, and submit leave requests in sandbox.',
    highlights: ['Subject Analytics', 'Lecture Schedule', 'Leave Requests', 'Notification Feed']
  },
  {
    role: 'teacher',
    title: 'Faculty Portal',
    badge: 'Teacher',
    icon: BookOpen,
    tagline: 'Mark attendance & manage subjects',
    description: 'Take class attendance, browse student rosters, monitor subject performance, and manage academic sessions with ease.',
    highlights: ['Attendance Marking', 'Class Rosters', 'Subject Metrics', 'Batch Analytics']
  },
  {
    role: 'admin',
    title: 'Institution Admin',
    badge: 'Tenant Admin',
    icon: Shield,
    tagline: 'Full institution ERP control',
    description: 'Explore campus-wide analytics, department configurations, role permissions, broadcast alerts, and system telemetry.',
    highlights: ['Campus Metrics', 'Broadcast Alerts', 'Academic Config', 'Department Insights']
  },
  {
    role: 'parent',
    title: 'Parent Portal',
    badge: 'Parent',
    icon: Users,
    tagline: 'Monitor ward attendance & progress',
    description: 'Real-time visibility into your child’s attendance records, timetable, academic calendar, and fee breakdown.',
    highlights: ['Ward Attendance', 'Academic Calendar', 'Fee Records', 'Daily Summaries']
  }
];

export const RoleSelectorModal = () => {
  const {
    isModalOpen,
    closeRoleModal,
    slotsStatus,
    fetchSlotStatus,
    claimDemoRole,
    loading
  } = useDemo();

  useEffect(() => {
    if (isModalOpen) {
      fetchSlotStatus();
      const interval = setInterval(fetchSlotStatus, 5000);
      return () => clearInterval(interval);
    }
  }, [isModalOpen, fetchSlotStatus]);

  if (!isModalOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
        {/* Solid Scrim (No ambient blur) */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={closeRoleModal}
          className="fixed inset-0 bg-[#111827]/40 transition-opacity"
        />

        {/* Modal Dialog */}
        <motion.div
          initial={{ opacity: 0, scale: 0.98, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.98, y: 10 }}
          transition={{ duration: 0.15, ease: 'easeOut' }}
          className="relative w-full max-w-4xl bg-surface rounded-panel shadow-level4 border border-line overflow-hidden z-10 my-8 text-ink"
        >
          {/* Header */}
          <div className="relative px-6 sm:px-8 pt-6 pb-5 border-b border-line bg-surface">
            <button
              onClick={closeRoleModal}
              className="absolute top-5 right-5 p-1.5 text-ink-muted hover:text-ink rounded hover:bg-surface-subtle transition-colors focus:outline-none focus:ring-1 focus:ring-primary"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 px-2.5 py-0.5 rounded bg-primary/10 text-primary text-[11px] font-mono uppercase tracking-wider font-semibold w-fit mb-2 border border-primary/20">
              <Clock className="w-3.5 h-3.5" />
              <span>15-Minute Isolated Session</span>
            </div>

            <h2 className="text-xl sm:text-2xl font-bold text-ink tracking-tight">
              Choose Academic Role to Explore
            </h2>
            <p className="mt-1 text-ink-muted text-xs sm:text-sm max-w-2xl">
              Experience AttendEase from any institutional perspective. No registration required.
              Operations are safely simulated in a dedicated sandbox session.
            </p>
          </div>

          {/* Role Cards Grid */}
          <div className="p-6 sm:p-8 grid sm:grid-cols-2 gap-4 max-h-[70vh] overflow-y-auto bg-background">
            {ROLES_CONFIG.map((item) => {
              const Icon = item.icon;
              const slot = slotsStatus[item.role];
              const isOccupied = slot && slot.isAvailable === false;
              const remainingMin = slot?.remainingSeconds ? Math.ceil(slot.remainingSeconds / 60) : null;

              return (
                <div
                  key={item.role}
                  className={`flex flex-col justify-between p-5 rounded-panel border bg-surface transition-all ${
                    isOccupied
                      ? 'border-line opacity-75 bg-surface-subtle cursor-not-allowed'
                      : 'border-line hover:border-primary/50 shadow-xs'
                  }`}
                >
                  <div>
                    {/* Top Row: Icon & Status Badge */}
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="w-10 h-10 rounded border border-line bg-surface-subtle flex items-center justify-center text-primary">
                        <Icon className="w-5 h-5" />
                      </div>

                      {/* Availability Tag */}
                      {isOccupied ? (
                        <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium bg-status-warning-bg text-status-warning-text border border-status-warning-border">
                          <Clock className="w-3 h-3 text-status-warning-text" />
                          <span className="font-mono tnum">In Use (~{remainingMin}m left)</span>
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium bg-status-success-bg text-status-success-text border border-status-success-border">
                          <CheckCircle2 className="w-3 h-3 text-status-success-text" />
                          <span>Slot Available</span>
                        </div>
                      )}
                    </div>

                    {/* Role Title & Description */}
                    <div className="mb-3">
                      <h3 className="text-base font-bold text-ink">
                        {item.title}
                      </h3>
                      <p className="text-xs font-medium text-primary mb-1">
                        {item.tagline}
                      </p>
                      <p className="text-xs text-ink-muted leading-relaxed">
                        {item.description}
                      </p>
                    </div>

                    {/* Highlight Pills */}
                    <div className="flex flex-wrap gap-1.5 mb-5">
                      {item.highlights.map((h) => (
                        <span
                          key={h}
                          className="text-[10px] font-medium bg-surface-subtle text-ink-muted border border-line px-2 py-0.5 rounded font-mono"
                        >
                          {h}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Action Button */}
                  <button
                    disabled={isOccupied || loading}
                    onClick={() => claimDemoRole(item.role)}
                    className={`w-full py-2 px-3 rounded font-medium text-xs flex items-center justify-center gap-2 transition-colors ${
                      isOccupied
                        ? 'bg-surface-subtle border border-line text-ink-muted cursor-not-allowed'
                        : 'bg-primary hover:bg-[#115E59] text-white border border-primary shadow-xs focus:outline-none focus:ring-1 focus:ring-primary'
                    }`}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Initializing Sandbox...</span>
                      </>
                    ) : isOccupied ? (
                      <>
                        <Lock className="w-3.5 h-3.5" />
                        <span className="font-mono tnum">Slot Busy (~{remainingMin}m)</span>
                      </>
                    ) : (
                      <>
                        <span>Explore as {item.badge}</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </>
                    )}
                  </button>
                </div>
              );
            })}
          </div>

          {/* Footer Note */}
          <div className="px-6 sm:px-8 py-3 bg-surface border-t border-line flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-ink-muted">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-primary inline-block"></span>
              <span>
                Each role session is reserved exclusively for you for 15 minutes to guarantee transactional consistency.
              </span>
            </div>
            <button
              onClick={closeRoleModal}
              className="font-medium text-ink-muted hover:text-ink transition-colors"
            >
              Cancel
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default RoleSelectorModal;
