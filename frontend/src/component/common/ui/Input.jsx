import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

const baseField = `
  w-full rounded border border-line bg-surface px-3 text-sm text-ink
  placeholder:text-ink-faint transition-colors
  hover:border-primary/40
  focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20
  disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-surface-subtle
`;

export const Input = ({
  label,
  error,
  hint,
  className = '',
  id,
  type = 'text',
  dense = false,
  leftIcon: LeftIcon,
  rightIcon: RightIcon,
  ...props
}) => {
  const [showPassword, setShowPassword] = useState(false);
  const isPasswordInput = type === 'password';
  const fieldId = id || props.name || label;
  const currentType = isPasswordInput ? (showPassword ? 'text' : 'password') : type;
  const heightClass = dense ? 'h-7 text-xs py-1' : 'h-9 text-sm py-1.5';

  return (
    <div className={className}>
      {label && (
        <label htmlFor={fieldId} className="block text-xs font-semibold text-ink mb-1">
          {label}
        </label>
      )}
      <div className="relative">
        {LeftIcon && (
          <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-muted pointer-events-none">
            <LeftIcon className="w-4 h-4" />
          </div>
        )}
        <input
          id={fieldId}
          type={currentType}
          className={`
            ${baseField}
            ${heightClass}
            ${LeftIcon ? 'pl-8' : ''}
            ${isPasswordInput || RightIcon ? 'pr-8' : ''}
            ${error ? 'border-status-error-text focus:border-status-error-text focus:ring-status-error-text' : ''}
          `}
          {...props}
        />
        {isPasswordInput ? (
          <button
            type="button"
            onClick={() => setShowPassword((prev) => !prev)}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink p-0.5 focus:outline-none"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        ) : RightIcon ? (
          <div className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-muted pointer-events-none">
            <RightIcon className="w-4 h-4" />
          </div>
        ) : null}
      </div>
      {error ? (
        <p className="mt-1 text-xs font-medium text-status-error-text">{error}</p>
      ) : hint ? (
        <p className="mt-1 text-xs text-ink-muted">{hint}</p>
      ) : null}
    </div>
  );
};

export const Select = ({ label, error, hint, className = '', children, id, dense = false, ...props }) => {
  const fieldId = id || props.name || label;
  const heightClass = dense ? 'h-7 text-xs py-1' : 'h-9 text-sm py-1.5';

  return (
    <div className={className}>
      {label && (
        <label htmlFor={fieldId} className="block text-xs font-semibold text-ink mb-1">
          {label}
        </label>
      )}
      <select
        id={fieldId}
        className={`
          ${baseField}
          ${heightClass}
          ${error ? 'border-status-error-text focus:border-status-error-text focus:ring-status-error-text' : ''}
        `}
        {...props}
      >
        {children}
      </select>
      {error ? (
        <p className="mt-1 text-xs font-medium text-status-error-text">{error}</p>
      ) : hint ? (
        <p className="mt-1 text-xs text-ink-muted">{hint}</p>
      ) : null}
    </div>
  );
};

export const Textarea = ({ label, error, hint, className = '', id, ...props }) => {
  const fieldId = id || props.name || label;
  return (
    <div className={className}>
      {label && (
        <label htmlFor={fieldId} className="block text-xs font-semibold text-ink mb-1">
          {label}
        </label>
      )}
      <textarea
        id={fieldId}
        className={`
          ${baseField}
          min-h-[96px] py-2 resize-y
          ${error ? 'border-status-error-text focus:border-status-error-text focus:ring-status-error-text' : ''}
        `}
        {...props}
      />
      {error ? (
        <p className="mt-1 text-xs font-medium text-status-error-text">{error}</p>
      ) : hint ? (
        <p className="mt-1 text-xs text-ink-muted">{hint}</p>
      ) : null}
    </div>
  );
};

export default Input;

