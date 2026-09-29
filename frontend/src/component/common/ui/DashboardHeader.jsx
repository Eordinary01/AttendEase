import React from 'react';

export default function DashboardHeader({
  greeting,
  title,
  meta,
  subtitle,
  badge,
  actions,
  highlightAction,
  className = '',
}) {
  const displayTitle = title || greeting;
  const displayMeta = subtitle || meta;

  return (
    <section className={`bg-white rounded-2xl p-6 border border-slate-200/90 shadow-sm flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 font-sans ${className}`}>
      <div className="space-y-1.5 min-w-0">
        <div className="flex items-center gap-2.5 flex-wrap">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            {displayTitle}
          </h1>
          {badge && (
            typeof badge === 'string' ? (
              <span className="bg-slate-100 text-slate-600 text-xs font-semibold px-2.5 py-0.5 rounded-full border border-slate-200/80">
                {badge}
              </span>
            ) : badge
          )}
        </div>

        {displayMeta && (
          <div className="flex items-center gap-2 text-xs text-slate-500 font-medium flex-wrap">
            {displayMeta}
          </div>
        )}
      </div>

      {(highlightAction || actions) && (
        <div className="flex items-center gap-3 shrink-0 flex-wrap">
          {highlightAction}
          {actions}
        </div>
      )}
    </section>
  );
}
