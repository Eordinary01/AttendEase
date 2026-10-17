import React from "react";
import { RefreshCw } from "lucide-react";

export default function ERPCard({
  title,
  subtitle,
  icon: Icon,
  badge,
  onRefresh,
  isRefreshing = false,
  actions,
  children,
  className = "",
  bodyClassName = "p-4",
  headerClassName = "",
  minHeight = "min-h-[260px]",
}) {
  return (
    <div
      className={`bg-surface border border-line hover:border-primary/35 rounded-panel transition-all duration-200 flex flex-col overflow-hidden shadow-xs hover:shadow-sm ${minHeight} ${className}`}
    >
      {/* ERP Card Header */}
      <div
        className={`px-4 py-3 border-b border-line flex items-center justify-between bg-surface-subtle/80 ${headerClassName}`}
      >
        <div className="flex items-center gap-2 min-w-0">
          {Icon && <Icon className="w-4 h-4 text-primary shrink-0" />}
          <h3 className="text-sm font-bold text-ink truncate tracking-tight">
            {title}
          </h3>
          {badge && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary-soft text-primary border border-primary/20 shrink-0">
              {badge}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0 ml-2">
          {actions}
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              disabled={isRefreshing}
              title="Refresh data"
              className="p-1 rounded text-ink-muted hover:text-ink hover:bg-surface border border-line transition disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin text-primary" : ""}`}
              />
            </button>
          )}
        </div>
      </div>

      {/* ERP Card Body */}
      <div className={`flex-1 flex flex-col bg-surface ${bodyClassName}`}>
        {children}
      </div>
    </div>
  );
}
