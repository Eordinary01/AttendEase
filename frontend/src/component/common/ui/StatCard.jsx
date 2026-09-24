import React from 'react';
import { motion } from 'framer-motion';
import Card from './Card';

const accentMap = {
  primary: 'bg-primary text-white',
  secondary: 'bg-secondary text-white',
  success: 'bg-emerald-500 text-white',
  warning: 'bg-amber-500 text-white',
  danger: 'bg-red-500 text-white',
  info: 'bg-sky-500 text-white',
  neutral: 'bg-background text-ink-soft',
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
    <motion.div whileHover={{ y: -2 }}>
      <Card
        className={`p-5 rounded-2xl transition-all ${
          highlight
            ? 'border-line/70 shadow-sm bg-surface ring-1 ring-primary/10'
            : 'border-line/50 bg-surface'
        } ${className}`}
      >
        <div className="flex items-start justify-between">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-wider text-ink-faint">{label}</p>
            <p className="mt-1.5 text-3xl font-black text-ink tracking-tight">{value}</p>
            {subtitle && <p className="mt-1 text-xs text-ink-soft truncate">{subtitle}</p>}
            {trend && (
              <p className={`mt-2 inline-flex items-center gap-1 text-xs font-semibold ${trendDirection === 'up' ? 'text-emerald-600' : 'text-rose-600'}`}>
                {trendDirection === 'up' ? '▲' : '▼'} {trend}
              </p>
            )}
          </div>
          {Icon && (
            <div className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${accentMap[tone] || accentMap.primary}`}>
              <Icon className="w-5 h-5" />
            </div>
          )}
        </div>
      </Card>
    </motion.div>
  );
};

export default StatCard;
