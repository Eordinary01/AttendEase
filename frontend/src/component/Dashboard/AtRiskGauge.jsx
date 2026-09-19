import React from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, AlertTriangle, AlertOctagon, HelpCircle, ArrowUpRight, TrendingUp } from 'lucide-react';
import Badge from '../common/ui/Badge';

/**
 * AtRiskGauge
 * Circular/linear compliance gauge and deficit trajectory early-warning widget.
 *
 * Props:
 * - riskLevel: 'good' | 'warning' | 'critical' | 'no-data'
 * - attendancePercentage: number (0-100)
 * - classesRequired: number
 * - remainingClasses: number
 * - alertMessage: string
 * - isMathematicallyImpossible: boolean
 * - compact: boolean
 * - onActionClick: function (optional)
 */
export const AtRiskGauge = ({
  riskLevel = 'good',
  attendancePercentage = 0,
  classesRequired = 0,
  remainingClasses = 0,
  alertMessage = '',
  isMathematicallyImpossible = false,
  compact = false,
  onActionClick = null,
}) => {
  const percentage = Math.max(0, Math.min(100, Number(attendancePercentage) || 0));

  const config = {
    good: {
      tone: 'success',
      label: 'Good Standing',
      stroke: '#10b981', // emerald-500
      bg: 'bg-emerald-500/10',
      border: 'border-emerald-500/20',
      text: 'text-emerald-500',
      icon: CheckCircle2,
      defaultMsg: '✅ GOOD: Attendance is excellent. Keep it up!',
    },
    warning: {
      tone: 'warning',
      label: 'At Risk (Warning)',
      stroke: '#f59e0b', // amber-500
      bg: 'bg-amber-500/10',
      border: 'border-amber-500/20',
      text: 'text-amber-500',
      icon: AlertTriangle,
      defaultMsg: `⚠️ WARNING: Needs ${classesRequired} consecutive classes to reach 75%`,
    },
    critical: {
      tone: 'danger',
      label: isMathematicallyImpossible ? 'Critical (Impossible)' : 'Critical Risk',
      stroke: '#ef4444', // red-500
      bg: 'bg-rose-500/10',
      border: 'border-rose-500/20',
      text: 'text-rose-500',
      icon: AlertOctagon,
      defaultMsg: isMathematicallyImpossible
        ? '🔴 CRITICAL: Mathematically impossible to reach 75% before semester end without medical condonation waiver'
        : '🔴 CRITICAL: Attendance is severely low. Immediate intervention required.',
    },
    'no-data': {
      tone: 'neutral',
      label: 'No Data Recorded',
      stroke: '#94a3b8',
      bg: 'bg-ink-faint/10',
      border: 'border-line',
      text: 'text-ink-soft',
      icon: HelpCircle,
      defaultMsg: 'No class attendance records found for this period.',
    },
  }[riskLevel] || {
    tone: 'neutral',
    label: 'Normal',
    stroke: '#94a3b8',
    bg: 'bg-ink-faint/10',
    border: 'border-line',
    text: 'text-ink-soft',
    icon: HelpCircle,
    defaultMsg: alertMessage || '',
  };

  const IconComponent = config.icon;
  const displayMsg = alertMessage || config.defaultMsg;

  // SVG circular dimensions
  const radius = 38;
  const strokeWidth = 7;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  if (compact) {
    return (
      <div className={`p-4 rounded-2xl border ${config.border} ${config.bg} flex items-center justify-between gap-3 transition-all`}>
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative w-12 h-12 shrink-0 flex items-center justify-center">
            <svg className="w-12 h-12 -rotate-90 transform" viewBox="0 0 96 96">
              <circle
                cx="48"
                cy="48"
                r={radius}
                className="stroke-line/50"
                strokeWidth={strokeWidth}
                fill="transparent"
              />
              <motion.circle
                cx="48"
                cy="48"
                r={radius}
                stroke={config.stroke}
                strokeWidth={strokeWidth}
                strokeDasharray={circumference}
                initial={{ strokeDashoffset: circumference }}
                animate={{ strokeDashoffset }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
                strokeLinecap="round"
                fill="transparent"
              />
            </svg>
            <span className="absolute text-xs font-bold font-mono text-ink">
              {Math.round(percentage)}%
            </span>
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <Badge tone={config.tone} size="sm">{config.label}</Badge>
              {classesRequired > 0 && (
                <span className="text-[11px] font-bold text-amber-500 font-mono">
                  +{classesRequired} needed
                </span>
              )}
            </div>
            <p className="text-xs text-ink-soft truncate mt-0.5" title={displayMsg}>
              {displayMsg}
            </p>
          </div>
        </div>

        {onActionClick && (
          <button
            type="button"
            onClick={onActionClick}
            className="p-1.5 rounded-lg text-ink-soft hover:text-ink hover:bg-surface transition-colors shrink-0"
            title="View Details"
          >
            <ArrowUpRight className="w-4 h-4" />
          </button>
        )}
      </div>
    );
  }

  return (
    <div className={`p-5 rounded-2xl border ${config.border} ${config.bg} backdrop-blur-sm relative overflow-hidden transition-all shadow-sm`}>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
        {/* Left Side: Circular Gauge and Stats */}
        <div className="flex items-center gap-4">
          <div className="relative w-24 h-24 shrink-0 flex items-center justify-center">
            <svg className="w-24 h-24 -rotate-90 transform" viewBox="0 0 96 96">
              <circle
                cx="48"
                cy="48"
                r={radius}
                className="stroke-line/50"
                strokeWidth={strokeWidth}
                fill="transparent"
              />
              <motion.circle
                cx="48"
                cy="48"
                r={radius}
                stroke={config.stroke}
                strokeWidth={strokeWidth}
                strokeDasharray={circumference}
                initial={{ strokeDashoffset: circumference }}
                animate={{ strokeDashoffset }}
                transition={{ duration: 1, ease: 'easeOut' }}
                strokeLinecap="round"
                fill="transparent"
              />
            </svg>
            <div className="absolute flex flex-col items-center justify-center">
              <span className="text-lg font-black font-mono text-ink tracking-tight">
                {percentage.toFixed(1)}%
              </span>
              <span className="text-[9px] font-semibold text-ink-faint uppercase tracking-wider">
                Overall
              </span>
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Badge tone={config.tone} size="md">
                <IconComponent className="w-3.5 h-3.5 mr-1 inline-block" />
                {config.label}
              </Badge>
              <span className="text-xs text-ink-faint font-medium">
                (75% Target Threshold)
              </span>
            </div>
            <h4 className="text-sm font-bold text-ink">
              75% Attendance Deficit Trajectory
            </h4>
            <div className="flex flex-wrap items-center gap-3 pt-1 text-xs">
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface border border-line">
                <span className="text-ink-faint font-medium">Consecutive Needed:</span>
                <span className={`font-bold font-mono ${classesRequired > 0 ? 'text-amber-500' : 'text-emerald-500'}`}>
                  {classesRequired} classes
                </span>
              </div>
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface border border-line">
                <span className="text-ink-faint font-medium">Est. Remaining:</span>
                <span className="font-bold font-mono text-ink">
                  {remainingClasses} classes
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side / Callout button */}
        {onActionClick && (
          <button
            type="button"
            onClick={onActionClick}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-primary bg-surface border border-primary/20 hover:bg-primary hover:text-white transition-all shadow-xs shrink-0 self-end sm:self-center"
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Attendance Recovery Plan</span>
          </button>
        )}
      </div>

      {/* Alert Status Banner */}
      <div className="mt-4 pt-3.5 border-t border-line/40 flex items-start gap-2.5">
        <IconComponent className={`w-4 h-4 shrink-0 mt-0.5 ${config.text}`} />
        <p className={`text-xs font-semibold leading-relaxed ${config.text}`}>
          {displayMsg}
        </p>
      </div>
    </div>
  );
};

export default AtRiskGauge;
