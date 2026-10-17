import React from 'react';

const paddingStyles = {
  none: 'p-0',
  dense: 'p-3',
  standard: 'p-5',
  relaxed: 'p-6',
};

const Panel = ({
  title,
  subtitle,
  actions,
  children,
  footer,
  padding = 'standard',
  className = '',
  headerClassName = '',
  footerClassName = '',
  id,
}) => {
  const hasHeader = title || subtitle || actions;

  return (
    <section
      id={id}
      className={`
        bg-surface rounded-lg border border-line overflow-hidden shadow-level1
        ${className}
      `}
    >
      {hasHeader && (
        <header
          className={`
            px-5 py-3.5 border-b border-line flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface
            ${headerClassName}
          `}
        >
          <div>
            {title && (
              <h3 className="text-sm font-semibold text-ink tracking-tight">
                {title}
              </h3>
            )}
            {subtitle && (
              <p className="text-xs text-ink-muted mt-0.5">
                {subtitle}
              </p>
            )}
          </div>
          {actions && (
            <div className="flex items-center gap-2 flex-wrap">
              {actions}
            </div>
          )}
        </header>
      )}

      <div className={paddingStyles[padding] || paddingStyles.standard}>
        {children}
      </div>

      {footer && (
        <footer
          className={`
            px-5 py-3 border-t border-line bg-surface-subtle text-xs text-ink-muted
            ${footerClassName}
          `}
        >
          {footer}
        </footer>
      )}
    </section>
  );
};

export default Panel;
