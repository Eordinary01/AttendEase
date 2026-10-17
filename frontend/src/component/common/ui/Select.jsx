import React from 'react';

const Select = ({
  label,
  error,
  hint,
  className = '',
  children,
  id,
  dense = false,
  options = [],
  placeholder,
  value,
  onChange,
  disabled = false,
  ...props
}) => {
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
        value={value}
        onChange={onChange}
        disabled={disabled}
        className={`
          w-full rounded border border-line bg-surface px-3 text-sm text-ink
          transition-colors hover:border-primary/40
          focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20
          disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-surface-subtle
          ${heightClass}
          ${error ? 'border-status-error-text focus:border-status-error-text focus:ring-status-error-text' : ''}
        `}
        {...props}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.length > 0
          ? options.map((opt) => {
              const val = typeof opt === 'object' ? opt.value : opt;
              const lbl = typeof opt === 'object' ? opt.label : opt;
              return (
                <option key={val} value={val}>
                  {lbl}
                </option>
              );
            })
          : children}
      </select>
      {error ? (
        <p className="mt-1 text-xs font-medium text-status-error-text">{error}</p>
      ) : hint ? (
        <p className="mt-1 text-xs text-ink-muted">{hint}</p>
      ) : null}
    </div>
  );
};

export default Select;
