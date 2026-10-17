import React from 'react';

const sizeStyles = {
  sm: 'h-7 px-2.5 text-xs gap-1.5',
  md: 'h-9 px-3.5 text-sm gap-2',
  lg: 'h-10 px-4 text-sm gap-2',
};

const variantStyles = {
  primary: 'bg-primary text-on-primary border border-primary hover:bg-primary-hover active:bg-primary-active focus-visible:ring-primary',
  secondary: 'bg-secondary text-on-secondary border border-secondary hover:opacity-90 focus-visible:ring-secondary',
  outline: 'bg-surface text-ink border border-line hover:bg-primary-soft/30 hover:border-primary/40 hover:text-primary active:bg-primary-soft/50 focus-visible:ring-primary',
  ghost: 'bg-transparent text-ink-muted hover:bg-primary-soft/30 hover:text-primary focus-visible:ring-primary',
  subtle: 'bg-primary-soft text-primary-ink border border-primary-surface hover:bg-primary-surface focus-visible:ring-primary',
  danger: 'bg-status-error-text text-white border border-status-error-text hover:opacity-90 focus-visible:ring-status-error-text',
  dangerSubtle: 'bg-status-error-bg text-status-error-text border border-status-error-border hover:opacity-90 focus-visible:ring-status-error-text',
};

const Button = ({
  children,
  variant = 'primary',
  size = 'md',
  className = '',
  leftIcon: LeftIcon,
  rightIcon: RightIcon,
  loading = false,
  disabled = false,
  type = 'button',
  ...props
}) => {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={`
        inline-flex items-center justify-center rounded font-medium
        transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-surface
        disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer
        ${sizeStyles[size] || sizeStyles.md}
        ${variantStyles[variant] || variantStyles.primary}
        ${className}
      `}
      {...props}
    >
      {loading ? (
        <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      ) : LeftIcon ? (
        <LeftIcon className="w-3.5 h-3.5 flex-shrink-0" />
      ) : null}
      {children}
      {!loading && RightIcon ? <RightIcon className="w-3.5 h-3.5 flex-shrink-0" /> : null}
    </button>
  );
};

export default Button;

