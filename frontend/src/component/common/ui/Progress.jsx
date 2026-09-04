import React from 'react';

const COLOR_MAP = {
  primary: 'bg-gradient-to-r from-primary to-primary/75',
  green: 'bg-emerald-500',
  red: 'bg-rose-500',
  amber: 'bg-amber-500',
  sky: 'bg-sky-500',
};

export default function Progress({
  value = 0,
  color = 'primary',
  size = 'md',
  showLabel = false,
  gradient = true,
  className = '',
}) {
  const clampedValue = Math.min(100, Math.max(0, Number(value) || 0));
  const heightClass = size === 'sm' ? 'h-1.5' : size === 'lg' ? 'h-3' : 'h-2.5';
  
  let fillStyle = COLOR_MAP[color] || COLOR_MAP.primary;
  if (!gradient && color === 'primary') {
    fillStyle = 'bg-primary';
  }

  return (
    <div className={`flex items-center gap-2.5 w-full ${className}`}>
      <div className={`flex-1 bg-line/60 rounded-full overflow-hidden ${heightClass}`}>
        <div
          className={`h-full rounded-full transition-all duration-500 ease-out ${fillStyle}`}
          style={{ width: `${clampedValue}%` }}
        />
      </div>
      {showLabel && (
        <span className="text-[11px] font-semibold text-ink-soft shrink-0">
          {Math.round(clampedValue)}%
        </span>
      )}
    </div>
  );
}
