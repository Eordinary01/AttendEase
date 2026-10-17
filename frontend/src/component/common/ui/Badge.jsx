import React from 'react';

const tones = {
  neutral: 'bg-surface-subtle border-line text-ink-muted',
  primary: 'bg-primary-soft border-primary/25 text-primary-ink',
  secondary: 'bg-secondary-soft border-secondary/25 text-secondary',
  success: 'bg-status-success-bg border-status-success-border text-status-success-text',
  warning: 'bg-status-warning-bg border-status-warning-border text-status-warning-text',
  danger: 'bg-status-error-bg border-status-error-border text-status-error-text',
  error: 'bg-status-error-bg border-status-error-border text-status-error-text',
  info: 'bg-status-info-bg border-status-info-border text-status-info-text',
};

const Badge = ({ children, tone = 'neutral', dot = true, icon: Icon, className = '' }) => {
  return (
    <span
      className={`
        inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-semibold uppercase tracking-wider border
        ${tones[tone] || tones.neutral}
        ${className}
      `}
    >
      {Icon ? (
        <Icon className="w-3 h-3 flex-shrink-0" />
      ) : dot ? (
        <span className="w-1.5 h-1.5 rounded-sm bg-current flex-shrink-0 opacity-80" aria-hidden="true" />
      ) : null}
      <span>{children}</span>
    </span>
  );
};

export default Badge;

