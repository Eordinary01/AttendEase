import React from 'react';
import Progress from './Progress';
import Badge from './Badge';

export default function StatValue({
  value,
  label,
  subtitle,
  progress,
  progressColor = 'primary',
  status,
  variant = 'compact',
  accent = false,
  className = '',
}) {
  const isHero = variant === 'hero';

  return (
    <div className={`space-y-1.5 ${className}`}>
      {label && (
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">
            {label}
          </span>
          {status && (
            <Badge tone={status.tone || 'primary'} size="sm">
              {status.text}
            </Badge>
          )}
        </div>
      )}

      <div className="flex items-baseline gap-2">
        <span
          className={`font-black tracking-tight text-ink ${
            isHero ? 'text-4xl' : 'text-2xl'
          }`}
        >
          {value}
        </span>
        {subtitle && (
          <span className="text-xs font-medium text-ink-soft">{subtitle}</span>
        )}
      </div>

      {typeof progress === 'number' && (
        <div className="pt-1">
          <Progress
            value={progress}
            color={progressColor}
            size={isHero ? 'md' : 'sm'}
            gradient
          />
        </div>
      )}
    </div>
  );
}
