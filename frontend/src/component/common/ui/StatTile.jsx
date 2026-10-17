import React from 'react';
import Badge from './Badge';
import Progress from './Progress';

const StatTile = ({
  label,
  value,
  subtitle,
  icon: Icon,
  trend,
  trendDirection = 'up',
  status,
  progress,
  progressColor = 'primary',
  className = '',
  highlight = false,
  onClick,
}) => {
  const isPositive = trendDirection === 'up' || (typeof trend === 'string' && trend.startsWith('+'));
  const trendTone = isPositive ? 'text-status-success-text' : 'text-status-error-text';
  const trendSymbol = isPositive ? '↑' : '↓';

  return (
    <div
      onClick={onClick}
      className={`
        bg-surface rounded-lg border p-4 transition-all duration-150
        ${highlight ? 'border-primary ring-1 ring-primary/20 bg-primary-soft/10' : 'border-line hover:border-primary/35 hover:shadow-xs'}
        ${onClick ? 'cursor-pointer hover:bg-surface-alt' : ''}
        ${className}
      `}
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted truncate">
          {label}
        </span>
        {status ? (
          <Badge tone={status.tone || 'primary'}>
            {status.text || status}
          </Badge>
        ) : Icon ? (
          <div className="w-7 h-7 rounded bg-primary-soft/60 border border-primary/20 flex items-center justify-center text-primary flex-shrink-0">
            <Icon className="w-3.5 h-3.5" />
          </div>
        ) : null}
      </div>

      <div className="flex items-baseline gap-2">
        <div className="text-2xl font-semibold tracking-tight text-ink font-mono tnum">
          {value !== undefined && value !== null ? value : '—'}
        </div>
        {subtitle && (
          <span className="text-xs text-ink-muted truncate">
            {subtitle}
          </span>
        )}
      </div>

      {trend && (
        <div className="mt-2 flex items-center gap-1.5 text-xs">
          <span className={`font-semibold font-mono tnum ${trendTone}`}>
            {trendSymbol} {trend}
          </span>
          <span className="text-ink-disabled text-[11px]">vs prior cycle</span>
        </div>
      )}

      {typeof progress === 'number' && (
        <div className="mt-2.5">
          <Progress value={progress} color={progressColor} />
        </div>
      )}
    </div>
  );
};

export default StatTile;
