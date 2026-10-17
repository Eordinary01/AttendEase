import React from 'react';
import { ChevronDown } from 'lucide-react';

/**
 * NavGroup — Collapsible section header for sidebar navigation.
 * Uses institutional registrar tokens: uppercase muted headers, hairline dividers.
 */
export const NavGroup = ({
  title,
  collapsed = false,
  isGroupCollapsed = false,
  onToggle,
  children,
}) => {
  if (collapsed) {
    return (
      <div className="py-2">
        <div className="border-t border-line my-1 mx-2" />
        <div className="space-y-1">{children}</div>
      </div>
    );
  }

  return (
    <div className="space-y-0.5">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={!isGroupCollapsed}
        className="w-full flex items-center justify-between px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-muted hover:text-ink transition-colors rounded select-none outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <span className="truncate">{title}</span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-ink-faint transition-transform duration-150 ease-out ${
            isGroupCollapsed ? '-rotate-90' : 'rotate-0'
          }`}
          aria-hidden="true"
        />
      </button>

      <div
        className={`grid transition-all duration-150 ease-out overflow-hidden ${
          isGroupCollapsed ? 'grid-rows-[0fr] opacity-0' : 'grid-rows-[1fr] opacity-100'
        }`}
      >
        <div className="min-h-0 space-y-0.5">{children}</div>
      </div>
    </div>
  );
};

export default NavGroup;

