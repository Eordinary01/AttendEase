import React from 'react';
import { ChevronDown } from 'lucide-react';

/**
 * NavGroup
 * Collapsible section header and children container with animated chevron and accessibility attributes.
 */
export const NavGroup = ({
  title,
  collapsed = false,
  isGroupCollapsed = false,
  onToggle,
  children,
}) => {
  // In collapsed desktop sidebar mode (icon-only), show subtle divider instead of headers
  if (collapsed) {
    return (
      <div className="py-2">
        <div className="border-t border-line/50 my-1 mx-2" />
        <div className="space-y-1">{children}</div>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={!isGroupCollapsed}
        className="w-full flex items-center justify-between px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-ink-faint hover:text-ink transition-colors rounded-lg group select-none outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      >
        <span className="truncate">{title}</span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-ink-faint group-hover:text-ink transition-transform duration-200 ease-out ${
            isGroupCollapsed ? '-rotate-90' : 'rotate-0'
          }`}
          aria-hidden="true"
        />
      </button>

      {/* Collapsible Content Area */}
      <div
        className={`grid transition-all duration-200 ease-out overflow-hidden ${
          isGroupCollapsed ? 'grid-rows-[0fr] opacity-0' : 'grid-rows-[1fr] opacity-100'
        }`}
      >
        <div className="min-h-0 space-y-1">{children}</div>
      </div>
    </div>
  );
};

export default NavGroup;
