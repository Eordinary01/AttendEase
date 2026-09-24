import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  GraduationCap,
  BookOpen,
  Shield,
  Users,
  X,
  Sparkles,
  Clock,
  ArrowRight,
  Loader2,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { useDemo } from '../../contexts/DemoContext';

const ROLES_CONFIG = [
  {
    role: 'student',
    title: 'Student Portal',
    badge: 'Student',
    icon: GraduationCap,
    gradient: 'from-blue-500 to-indigo-600',
    borderHover: 'hover:border-indigo-400',
    tagline: 'Track attendance, classes & leaves',
    description: 'Inspect live attendance percentages, timetable lecture schedule, subject statistics, and submit leave requests in sandbox.',
    highlights: ['Subject Analytics', 'Lecture Schedule', 'Leave Requests', 'Notification Feed']
  },
  {
    role: 'teacher',
    title: 'Faculty Portal',
    badge: 'Teacher',
    icon: BookOpen,
    gradient: 'from-purple-500 to-indigo-600',
    borderHover: 'hover:border-purple-400',
    tagline: 'Mark attendance & manage subjects',
    description: 'Take class attendance, browse student rosters, monitor subject performance, and manage academic sessions with ease.',
    highlights: ['Attendance Marking', 'Class Rosters', 'Subject Metrics', 'Batch Analytics']
  },
  {
    role: 'admin',
    title: 'Institution Admin',
    badge: 'Tenant Admin',
    icon: Shield,
    gradient: 'from-emerald-500 to-teal-600',
    borderHover: 'hover:border-emerald-400',
    tagline: 'Full institution ERP control',
    description: 'Explore campus-wide analytics, department configurations, role permissions, broadcast alerts, and system telemetry.',
    highlights: ['Campus Metrics', 'Broadcast Alerts', 'Academic Config', 'Department Insights']
  },
  {
    role: 'parent',
    title: 'Parent Portal',
    badge: 'Parent',
    icon: Users,
    gradient: 'from-amber-500 to-orange-600',
    borderHover: 'hover:border-amber-400',
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
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={closeRoleModal}
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
        />

        {/* Modal Dialog */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden z-10 my-8"
        >
          {/* Header */}
          <div className="relative px-6 sm:px-8 pt-8 pb-6 border-b border-slate-100 bg-gradient-to-b from-slate-50/80 to-white">
            <button
              onClick={closeRoleModal}
              className="absolute top-6 right-6 p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2.5 px-3 py-1 rounded-full bg-purple-50 text-purple-700 text-xs font-semibold w-fit mb-3 border border-purple-100">
              <Sparkles className="w-3.5 h-3.5 text-purple-600" />
              <span>Interactive 15-Minute Sandbox</span>
            </div>

            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Choose Your Demo Role
            </h2>
            <p className="mt-1.5 text-slate-500 text-sm sm:text-base max-w-2xl">
              Experience AttendEase from any perspective. No registration or credentials required.
              Your actions are safely simulated and isolated.
            </p>
          </div>

          {/* Role Cards Grid */}
          <div className="p-6 sm:p-8 grid sm:grid-cols-2 gap-5 max-h-[70vh] overflow-y-auto">
            {ROLES_CONFIG.map((item) => {
              const Icon = item.icon;
              const slot = slotsStatus[item.role];
              const isOccupied = slot && slot.isAvailable === false;
              const remainingMin = slot?.remainingSeconds ? Math.ceil(slot.remainingSeconds / 60) : null;

              return (
                <div
                  key={item.role}
                  className={`group relative flex flex-col justify-between p-5 sm:p-6 rounded-xl border transition-all duration-200 bg-white ${
                    isOccupied
                      ? 'border-slate-200 opacity-80 bg-slate-50/50 cursor-not-allowed'
                      : `border-slate-200 ${item.borderHover} hover:shadow-lg hover:-translate-y-0.5`
                  }`}
                >
                  <div>
                    {/* Top Row: Icon & Status Badge */}
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <div
                        className={`w-12 h-12 rounded-xl flex items-center justify-center text-white bg-gradient-to-br ${item.gradient} shadow-md group-hover:scale-105 transition-transform`}
                      >
                        <Icon className="w-6 h-6" />
                      </div>

                      {/* Availability Tag */}
                      {isOccupied ? (
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                          <Clock className="w-3 h-3 text-amber-600" />
                          <span>In Use (~{remainingMin}m left)</span>
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span>Slot Available</span>
                        </div>
                      )}
                    </div>

                    {/* Role Title & Description */}
                    <div className="mb-4">
                      <h3 className="text-lg font-bold text-slate-900 group-hover:text-purple-600 transition-colors">
                        {item.title}
                      </h3>
                      <p className="text-xs font-semibold text-purple-600 mb-1">
                        {item.tagline}
                      </p>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        {item.description}
                      </p>
                    </div>

                    {/* Highlight Pills */}
                    <div className="flex flex-wrap gap-1.5 mb-6">
                      {item.highlights.map((h) => (
                        <span
                          key={h}
                          className="text-[10px] font-medium bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md"
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
                    className={`w-full py-2.5 px-4 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all ${
                      isOccupied
                        ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                        : `bg-gradient-to-r ${item.gradient} text-white hover:opacity-95 shadow-md shadow-purple-500/10 active:scale-[0.98]`
                    }`}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Initializing Sandbox...</span>
                      </>
                    ) : isOccupied ? (
                      <>
                        <Clock className="w-4 h-4" />
                        <span>Slot Busy (Wait ~{remainingMin}m)</span>
                      </>
                    ) : (
                      <>
                        <span>Explore as {item.badge}</span>
                        <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                      </>
                    )}
                  </button>
                </div>
              );
            })}
          </div>

          {/* Footer Note */}
          <div className="px-6 sm:px-8 py-4 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-600 shrink-0" />
              <span>
                Each role session is reserved exclusively for you for 15 minutes to prevent conflicts.
              </span>
            </div>
            <button
              onClick={closeRoleModal}
              className="font-semibold text-slate-600 hover:text-slate-800 transition"
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
