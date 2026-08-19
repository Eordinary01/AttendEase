import React, { useState } from 'react';
import { FaEye, FaEyeSlash } from 'react-icons/fa';

const baseField = `
  w-full rounded-lg border border-line bg-surface px-3.5 py-2.5 text-sm text-ink
  placeholder:text-ink-faint transition-colors
  focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary
  disabled:opacity-50 disabled:cursor-not-allowed
`;

export const Input = ({ label, error, hint, className = '', id, type = 'text', ...props }) => {
  const [showPassword, setShowPassword] = useState(false);
  const isPasswordInput = type === 'password';
  const fieldId = id || props.name || label;
  const currentType = isPasswordInput ? (showPassword ? 'text' : 'password') : type;

  return (
    <div className={className}>
      {label && (
        <label htmlFor={fieldId} className="block text-sm font-semibold text-ink mb-1.5">
          {label}
        </label>
      )}
      <div className="relative">
        <input
          id={fieldId}
          type={currentType}
          className={`${baseField} ${isPasswordInput ? 'pr-10' : ''} ${
            error ? 'border-red-400 focus:ring-red-500 focus:border-red-500' : ''
          }`}
          {...props}
        />
        {isPasswordInput && (
          <button
            type="button"
            onClick={() => setShowPassword(prev => !prev)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-faint hover:text-ink transition-colors p-1 focus:outline-none"
            title={showPassword ? 'Hide password' : 'Show password'}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? <FaEyeSlash className="w-4 h-4 text-primary" /> : <FaEye className="w-4 h-4 text-ink-faint" />}
          </button>
        )}
      </div>
      {error ? (
        <p className="mt-1 text-xs font-medium text-red-600">{error}</p>
      ) : hint ? (
        <p className="mt-1 text-xs text-ink-faint">{hint}</p>
      ) : null}
    </div>
  );
};

export const Select = ({ label, error, hint, className = '', children, id, ...props }) => {
  const fieldId = id || props.name || label;
  return (
    <div className={className}>
      {label && (
        <label htmlFor={fieldId} className="block text-sm font-semibold text-ink mb-1.5">
          {label}
        </label>
      )}
      <select id={fieldId} className={`${baseField} ${error ? 'border-red-400' : ''}`} {...props}>
        {children}
      </select>
      {error ? (
        <p className="mt-1 text-xs font-medium text-red-600">{error}</p>
      ) : hint ? (
        <p className="mt-1 text-xs text-ink-faint">{hint}</p>
      ) : null}
    </div>
  );
};

export const Textarea = ({ label, error, hint, className = '', id, ...props }) => {
  const fieldId = id || props.name || label;
  return (
    <div className={className}>
      {label && (
        <label htmlFor={fieldId} className="block text-sm font-semibold text-ink mb-1.5">
          {label}
        </label>
      )}
      <textarea id={fieldId} className={`${baseField} min-h-[100px] resize-y ${error ? 'border-red-400' : ''}`} {...props} />
      {error ? (
        <p className="mt-1 text-xs font-medium text-red-600">{error}</p>
      ) : hint ? (
        <p className="mt-1 text-xs text-ink-faint">{hint}</p>
      ) : null}
    </div>
  );
};

export default Input;
