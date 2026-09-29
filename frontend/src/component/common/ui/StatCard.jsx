import React from 'react';
import { motion } from 'framer-motion';

const accentMap = {
  primary: 'bg-primary-soft text-primary border border-primary-surface',
  secondary: 'bg-secondary-soft text-secondary border border-secondary-surface',
  success: 'bg-emerald-50 text-emerald-600 border border-emerald-100',
  warning: 'bg-amber-50 text-amber-600 border border-amber-100',
  danger: 'bg-rose-50 text-rose-600 border border-rose-100',
  info: 'bg-sky-50 text-sky-600 border border-sky-100',
  neutral: 'bg-slate-100 text-slate-600 border border-slate-200/80',
};

const StatCard = ({
  label,
  value,
  icon: Icon,
  tone = 'primary',
  subtitle,
  trend,
  trendDirection = 'up',
  highlight = false,
  className = '',
}) => {
  return (
    <motion.div whileHover={{ y: -2 }} transition={{ duration: 0.15 }}>
      <div
        className={`bg-white rounded-2xl p-5 border border-slate-200/90 shadow-sm transition-all font-sans ${
          highlight ? 'ring-2 ring-primary/20 border-primary/40' : 'hover:border-primary/30'
        } ${className}`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{label}</p>
            <p className="mt-1.5 text-2xl sm:text-3xl font-black text-slate-900 tracking-tight font-mono">{value}</p>
            {subtitle && <p className="mt-1 text-xs text-slate-500 font-medium truncate">{subtitle}</p>}
            {trend && (
              <p className={`mt-2 inline-flex items-center gap-1 text-xs font-semibold ${trendDirection === 'up' ? 'text-emerald-600' : 'text-rose-600'}`}>
                {trendDirection === 'up' ? '▲' : '▼'} {trend}
              </p>
            )}
          </div>
          {Icon && (
            <div className={`shrink-0 w-11 h-11 rounded-xl flex items-center justify-center shadow-xs ${accentMap[tone] || accentMap.primary}`}>
              <Icon className="w-5 h-5" />
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default StatCard;
