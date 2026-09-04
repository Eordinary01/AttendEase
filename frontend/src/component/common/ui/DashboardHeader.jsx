import React from 'react';

export default function DashboardHeader({
  greeting,
  meta,
  actions,
  highlightAction,
  className = '',
}) {
  return (
    <div className={`w-full ${className}`}>
      {/* Top Brand 3px Accent Line */}
      <div className="w-full h-[3px] bg-primary" />

      {/* Main Header Strip */}
      <div className="bg-surface border-b border-line/50 px-6 py-5">
        <div className="max-w-[1440px] mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Identity & Meta */}
          <div className="space-y-1">
            <h1 className="text-xl font-bold tracking-tight text-ink">
              {greeting}
            </h1>
            {meta && (
              <p className="text-xs font-medium text-ink-soft">
                {meta}
              </p>
            )}
          </div>

          {/* Action CTAs */}
          {(highlightAction || actions) && (
            <div className="flex items-center flex-wrap gap-2.5">
              {highlightAction}
              {actions}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
