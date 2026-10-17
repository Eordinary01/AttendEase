import React from 'react';

export const UniversalSpinner = ({
  size = 'md',
  label = 'Loading...',
  className = '',
  spinnerClassName = '',
}) => {
  const sizeMap = {
    sm: 'w-5 h-5 border-2',
    md: 'w-7 h-7 border-2',
    lg: 'w-10 h-10 border-2',
    xl: 'w-12 h-12 border-[3px]',
  };

  const spinnerSize = sizeMap[size] || sizeMap.md;

  return (
    <div className={`flex flex-col items-center justify-center gap-2 py-8 ${className}`}>
      <div
        className={`rounded-full border-line-strong border-t-primary animate-spin ${spinnerSize} ${spinnerClassName}`}
        role="status"
        aria-label={label || 'Loading'}
      />
      {label && <p className="text-xs font-medium text-ink-muted animate-pulse">{label}</p>}
    </div>
  );
};

export default UniversalSpinner;
