import React from 'react';

const PageHeader = ({ title, subtitle, badge, actions, icon: Icon, className = '' }) => {
  return (
    <section className={`bg-white rounded-2xl p-6 border border-slate-200/90 shadow-sm flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 font-sans mb-6 ${className}`}>
      <div className="flex items-start gap-3.5 min-w-0">
        {Icon && (
          <div className="shrink-0 w-11 h-11 rounded-xl bg-primary-soft text-primary border border-primary-surface flex items-center justify-center shadow-xs">
            <Icon className="w-5 h-5" />
          </div>
        )}
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">{title}</h1>
            {badge && (
              typeof badge === 'string' ? (
                <span className="bg-slate-100 text-slate-600 text-xs font-semibold px-2.5 py-0.5 rounded-full border border-slate-200/80">
                  {badge}
                </span>
              ) : badge
            )}
          </div>
          {subtitle && <p className="text-xs text-slate-500 font-medium">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex items-center gap-3 shrink-0 flex-wrap">{actions}</div>}
    </section>
  );
};

export default PageHeader;
