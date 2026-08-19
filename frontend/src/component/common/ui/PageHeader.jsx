import React from 'react';

const PageHeader = ({ title, subtitle, actions, icon: Icon, className = '' }) => {
  return (
    <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 ${className}`}>
      <div className="flex items-start gap-3">
        {Icon && (
          <div className="shrink-0 w-11 h-11 rounded-xl bg-primary-soft text-primary-dark flex items-center justify-center">
            <Icon className="w-6 h-6" />
          </div>
        )}
        <div>
          <h1 className="text-2xl font-bold text-ink tracking-tight">{title}</h1>
          {subtitle && <p className="text-sm text-ink-faint mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex items-center gap-3 flex-wrap">{actions}</div>}
    </div>
  );
};

export default PageHeader;
