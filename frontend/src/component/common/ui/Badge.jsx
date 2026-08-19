import React from 'react';

const tones = {
  neutral: 'bg-background text-ink-soft border-line',
  primary: 'bg-primary-soft text-primary-dark border-primary-surface',
  secondary: 'bg-secondary-soft text-secondary-dark border-secondary-surface',
  success: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  warning: 'bg-amber-50 text-amber-700 border-amber-100',
  danger: 'bg-red-50 text-red-700 border-red-100',
  info: 'bg-sky-50 text-sky-700 border-sky-100',
};

const Badge = ({ children, tone = 'neutral', dot = false, className = '' }) => {
  return (
    <span
      className={`
        inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border
        ${tones[tone] || tones.neutral}
        ${className}
      `}
    >
      {dot && <span className={`w-1.5 h-1.5 rounded-full ${dot === true ? 'bg-current' : ''}`} />}
      {children}
    </span>
  );
};

export default Badge;
