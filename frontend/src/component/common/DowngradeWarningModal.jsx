// src/components/common/DowngradeWarningModal.jsx
import React, { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Frown,
  AlertTriangle,
  ArrowRight,
  ShieldAlert,
  XCircle,
  GraduationCap,
  Users,
  UserCog,
  HardDrive,
  Heart,
  Sparkles,
  RefreshCw,
  HeartCrack
} from "lucide-react";

const ZOMATO_EMOTIONAL_QUOTES = [
  "Aese mat jao chhod kar... ki dil abhi bhara nahi! 🥺",
  "Khana nahi mangwana mat mangwao... par aese downgrade karke mat jao! 💔",
  "Are you really breaking up with us? We even memorized your institution's favorite setup! 🥺",
  "Just 1 click away from breaking our heart... even our server hamster is tearing up 🐹💔",
  "Aese kaise chhod ke jaoge? We promised we'd scale to the moon together! 🚀💔",
];

const moduleLabels = {
  attendance: "Attendance Tracking",
  timetable: "Timetable & Scheduling",
  timetableManagement: "Timetable Management",
  customRoles: "Custom Roles & Permissions",
  roleManagement: "Role Management",
  examManagement: "Exam & Grading Management",
  financeManagement: "Fee & Finance Management",
  libraryManagement: "Library System",
  hrManagement: "HR & Staff Management",
  parentPortal: "Parent Portal Access",
  analytics: "Advanced Analytics & Reports",
  apiAccess: "API Access & Integrations",
  customBranding: "Custom Institution Branding",
  dataExport: "Bulk Data Export",
  bulkOperations: "Bulk Student & Teacher Imports",
  whiteLabel: "White Labeling",
  prioritySupport: "Priority 24/7 Support",
  dedicatedSupport: "Dedicated Account Manager",
};

const DowngradeWarningModal = ({
  isOpen,
  onClose,
  currentPlan,
  targetPlan,
  onConfirmDowngrade,
  isDowngrading = false,
}) => {
  // Pick a random Zomato-style emotional quote based on target plan code
  const quote = useMemo(() => {
    if (!targetPlan) return ZOMATO_EMOTIONAL_QUOTES[0];
    const idx = (targetPlan.code?.length || 0) % ZOMATO_EMOTIONAL_QUOTES.length;
    return ZOMATO_EMOTIONAL_QUOTES[idx];
  }, [targetPlan]);

  // Calculate limit reductions and lost features
  const { limitChanges, lostModules } = useMemo(() => {
    if (!currentPlan || !targetPlan) return { limitChanges: [], lostModules: [] };

    const limits = [];
    const currLimits = currentPlan.limits || {};
    const targLimits = targetPlan.limits || {};

    if (typeof targLimits.maxStudents === "number" && targLimits.maxStudents < currLimits.maxStudents) {
      limits.push({
        label: "Students",
        icon: GraduationCap,
        from: currLimits.maxStudents,
        to: targLimits.maxStudents,
      });
    }
    if (typeof targLimits.maxTeachers === "number" && targLimits.maxTeachers < currLimits.maxTeachers) {
      limits.push({
        label: "Teachers",
        icon: Users,
        from: currLimits.maxTeachers,
        to: targLimits.maxTeachers,
      });
    }
    if (typeof targLimits.maxAdmins === "number" && targLimits.maxAdmins < currLimits.maxAdmins) {
      limits.push({
        label: "Admins",
        icon: UserCog,
        from: currLimits.maxAdmins,
        to: targLimits.maxAdmins,
      });
    }
    if (typeof targLimits.maxStorageMB === "number" && targLimits.maxStorageMB < currLimits.maxStorageMB) {
      limits.push({
        label: "Storage",
        icon: HardDrive,
        from: `${(currLimits.maxStorageMB / 1024).toFixed(0)} GB`,
        to: `${(targLimits.maxStorageMB / 1024).toFixed(0)} GB`,
      });
    }

    const lost = [];
    const currMods = currentPlan.modules || {};
    const targMods = targetPlan.modules || {};

    Object.keys(currMods).forEach((key) => {
      if (currMods[key] && !targMods[key]) {
        lost.push(moduleLabels[key] || key.replace(/([A-Z])/g, " $1").trim());
      }
    });

    return { limitChanges: limits, lostModules: lost };
  }, [currentPlan, targetPlan]);

  if (!isOpen || !targetPlan) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4">
        {/* Soft Dimmed Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm"
          onClick={onClose}
        />

        {/* Floating sad tear particles effect */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          {[...Array(5)].map((_, i) => (
            <motion.div
              key={i}
              initial={{ y: -20, opacity: 0, x: `${i * 20 + 8}%` }}
              animate={{
                y: ["0vh", "100vh"],
                opacity: [0, 0.35, 0],
              }}
              transition={{
                duration: 3.5 + i,
                repeat: Infinity,
                ease: "linear",
                delay: i * 0.6,
              }}
              className="absolute text-rose-400/40 text-sm"
            >
              🥺
            </motion.div>
          ))}
        </div>

        {/* Compact White Modal Box (Zomato Card Style) */}
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 15 }}
          className="relative w-full max-w-md bg-white border border-rose-100 rounded-3xl shadow-2xl shadow-rose-950/15 text-slate-800 overflow-hidden z-10"
        >
          {/* Top Decorative Zomato Accent Stripe */}
          <div className="h-2 bg-gradient-to-r from-rose-500 via-red-500 to-rose-400" />

          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition z-10"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="p-5 sm:p-6 space-y-4">
            {/* Header Icon + Emotion Banner */}
            <div className="text-center space-y-2.5">
              <motion.div
                animate={{ rotate: [-4, 4, -4], scale: [1, 1.05, 1] }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                className="w-14 h-14 mx-auto rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center shadow-sm"
              >
                <HeartCrack className="w-7 h-7 text-rose-500" />
              </motion.div>

              <div>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-700 tracking-wide uppercase">
                  🥺 Are you really leaving?
                </span>
                <h3 className="text-xl font-extrabold text-slate-900 tracking-tight mt-1">
                  Wait... Don't Break Our Heart!
                </h3>
              </div>

              {/* Zomato Style Sad Quote Box */}
              <div className="p-3 rounded-2xl bg-rose-50/70 border border-rose-100 text-xs font-medium text-rose-900 flex items-center justify-center gap-2 text-center shadow-inner">
                <span>"{quote}"</span>
              </div>
            </div>

            {/* Feature & Limit Loss Comparison */}
            <div className="space-y-3 pt-1">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                Things you'll lose on {targetPlan.name} plan:
              </p>

              {/* Reduced Limits */}
              {limitChanges.length > 0 && (
                <div className="bg-slate-50 rounded-2xl p-3 border border-slate-100 space-y-2">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Limit Reductions
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {limitChanges.map((item, idx) => {
                      const Icon = item.icon;
                      return (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-2 rounded-xl bg-white border border-slate-200/80 text-xs"
                        >
                          <span className="flex items-center gap-1 text-slate-600 font-medium">
                            <Icon className="w-3.5 h-3.5 text-amber-500" />
                            {item.label}
                          </span>
                          <span className="font-bold text-rose-600 flex items-center gap-0.5 text-[11px]">
                            <span className="line-through text-slate-400">{item.from}</span>
                            <ArrowRight className="w-2.5 h-2.5 text-slate-400" />
                            {item.to}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Lost Modules / Features */}
              {lostModules.length > 0 && (
                <div className="bg-slate-50 rounded-2xl p-3 border border-slate-100 space-y-1.5">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Features Missed ({lostModules.length})
                  </p>
                  <div className="max-h-28 overflow-y-auto pr-1 space-y-1 custom-scrollbar">
                    {lostModules.map((featureName, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-1.5 text-xs text-rose-900 bg-rose-50 border border-rose-100 px-2.5 py-1 rounded-xl"
                      >
                        <XCircle className="w-3 h-3 text-rose-500 flex-shrink-0" />
                        <span className="font-medium">{featureName}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Zomato-Style Action Buttons */}
            <div className="space-y-2 pt-1">
              <button
                onClick={onClose}
                className="w-full py-3 px-4 rounded-2xl text-sm font-extrabold text-white bg-gradient-to-r from-rose-600 via-red-600 to-rose-500 hover:from-rose-700 hover:to-red-700 shadow-lg shadow-rose-500/25 active:scale-[0.98] transition flex items-center justify-center gap-2"
              >
                <Heart className="w-4 h-4 fill-white animate-bounce" />
                Arey Ruko! Keep My Current Plan ❤️
              </button>

              <button
                onClick={onConfirmDowngrade}
                disabled={isDowngrading}
                className="w-full py-2 px-4 rounded-xl text-xs font-semibold text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {isDowngrading ? (
                  <>
                    <RefreshCw className="w-3 h-3 animate-spin text-rose-500" /> Downgrading...
                  </>
                ) : (
                  <>No thanks, break your heart & downgrade 💔</>
                )}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default DowngradeWarningModal;
