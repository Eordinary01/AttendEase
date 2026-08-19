import React from 'react';

const sizeStyles = {
  sm: 'px-3 py-1.5 text-xs gap-1.5',
  md: 'px-4 py-2.5 text-sm gap-2',
  lg: 'px-5 py-3 text-base gap-2',
};

const variantStyles = {
  primary: 'bg-primary text-white shadow-sm hover:bg-primary-dark focus-visible:ring-primary',
  secondary: 'bg-secondary text-white shadow-sm hover:bg-secondary-dark focus-visible:ring-secondary',
  outline: 'border border-line bg-surface text-ink hover:bg-background hover:border-ink-faint focus-visible:ring-ink-faint',
  ghost: 'text-ink-soft hover:bg-background hover:text-ink focus-visible:ring-ink-faint',
  subtle: 'bg-primary-soft text-primary-dark hover:bg-primary-surface focus-visible:ring-primary',
  danger: 'bg-red-600 text-white shadow-sm hover:bg-red-700 focus-visible:ring-red-500',
  dangerSubtle: 'bg-red-50 text-red-700 hover:bg-red-100 focus-visible:ring-red-500',
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
  ...props
}) => {
  return (
    <button
      disabled={disabled || loading}
      className={`
        inline-flex items-center justify-center rounded-lg font-semibold
        transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2
        disabled:opacity-50 disabled:cursor-not-allowed
        active:scale-[0.98]
        ${sizeStyles[size]}
        ${variantStyles[variant]}
        ${className}
      `}
      {...props}
    >
      {loading ? (
        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      ) : LeftIcon ? (
        <LeftIcon className="w-4 h-4" />
      ) : null}
      {children}
      {!loading && RightIcon ? <RightIcon className="w-4 h-4" /> : null}
    </button>
  );
};

export default Button;
