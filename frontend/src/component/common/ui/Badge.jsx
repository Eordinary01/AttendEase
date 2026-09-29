import React from 'react';

const tones = {
  neutral: 'bg-slate-100 text-slate-600 border-slate-200/80',
  primary: 'bg-primary-soft text-primary-dark border-primary-surface',
  secondary: 'bg-secondary-soft text-secondary-dark border-secondary-surface',
  success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  live: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  warning: 'bg-amber-50 text-amber-700 border-amber-200',
  danger: 'bg-rose-50 text-rose-700 border-rose-200',
  critical: 'bg-rose-50 text-rose-700 border-rose-200',
  info: 'bg-sky-50 text-sky-700 border-sky-200',
};

const Badge = ({ children, tone = 'neutral', dot = false, pulse = false, className = '' }) => {
  const isPulse = pulse || tone === 'live';
  return (
    <span
      className={`
        inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border
        ${tones[tone] || tones.neutral}
        ${className}
      `}
    >
      {(dot || isPulse) && (
        <span className={`w-1.5 h-1.5 rounded-full bg-current ${isPulse ? 'animate-pulse' : ''}`} />
      )}
      {children}
    </span>
  );
};

export default Badge;
