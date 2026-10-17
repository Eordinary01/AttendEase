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
      <div className="w-full h-[3px] bg-gradient-to-r from-primary via-primary-light to-secondary" />

      {/* Main Header Strip with Subtle Brand Atmosphere */}
      <div className="bg-surface border-b border-line px-6 py-5 shadow-xs relative overflow-hidden">
        {/* Ambient Top-Right Brand Wash */}
        <div className="absolute top-0 right-0 w-96 h-full pointer-events-none bg-[radial-gradient(ellipse_at_top_right,rgba(var(--color-primary),0.06),transparent_70%)]" />

        <div className="max-w-[1440px] mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          {/* Identity & Meta */}
          <div className="space-y-1">
            <h1 className="text-xl font-bold tracking-tight text-ink font-headline">
              {greeting}
            </h1>
            {meta && (
              <p className="text-xs font-medium text-ink-muted">
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
