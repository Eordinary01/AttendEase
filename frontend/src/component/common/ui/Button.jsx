import React from 'react';

const sizeStyles = {
  sm: 'px-3 py-1.5 text-xs gap-1.5',
  md: 'px-4 py-2.5 text-sm gap-2',
  lg: 'px-5 py-3 text-base gap-2',
};

const variantStyles = {
  primary: 'bg-primary text-white shadow-xs hover:bg-primary-dark focus-visible:ring-primary',
  secondary: 'bg-secondary text-white shadow-xs hover:bg-secondary-dark focus-visible:ring-secondary',
  outline: 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900 focus-visible:ring-primary/20 shadow-xs',
  ghost: 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
  subtle: 'bg-primary-soft text-primary-dark hover:bg-primary-surface focus-visible:ring-primary',
  danger: 'bg-rose-600 text-white shadow-xs hover:bg-rose-700 focus-visible:ring-rose-500',
  dangerSubtle: 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 focus-visible:ring-rose-500',
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
        inline-flex items-center justify-center rounded-xl font-semibold font-sans
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
