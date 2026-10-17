import React from 'react';
import { NavLink } from 'react-router-dom';
import { Lock } from 'lucide-react';

/**
 * NavItem — Academic Registrar navigation item.
 * Active: Deep Teal tint + high contrast text + 2px left border indicator.
 * Inactive: muted hover with subtle surface-subtle background.
 */
export const NavItem = ({
  item,
  active = false,
  locked = false,
  collapsed = false,
  moduleLabel = '',
  onClick,
}) => {
  const Icon = item.icon;

  if (locked) {
    return (
      <div
        className={`
          relative group/locked flex items-center min-h-[36px] rounded text-xs font-medium
          text-ink-disabled cursor-not-allowed select-none transition-colors
          ${collapsed ? 'justify-center px-0 w-9 h-9 mx-auto' : 'px-2.5 py-1.5 gap-2.5'}
        `}
        role="button"
        aria-disabled="true"
        aria-label={`${item.label} (Locked - Plan Upgrade Required)`}
        tabIndex={0}
      >
        <Icon className="w-4 h-4 flex-shrink-0 text-ink-disabled" />

        {!collapsed && (
          <>
            <span className="flex-1 truncate">{item.label}</span>
            <Lock className="w-3.5 h-3.5 text-ink-disabled flex-shrink-0" />
          </>
        )}

        {/* Hover / Focus Tooltip */}
        <div
          className={`
            pointer-events-none absolute z-50 hidden group-hover/locked:flex group-focus/locked:flex flex-col
            rounded bg-ink px-2.5 py-1.5 text-surface text-[11px] shadow-level3 whitespace-nowrap border border-line-strong
            ${collapsed ? 'left-full ml-2 top-1/2 -translate-y-1/2' : 'left-2 top-full mt-1'}
          `}
        >
          <p className="font-semibold flex items-center gap-1.5">
            <Lock className="w-3 h-3 text-status-warning-text" />
            {moduleLabel || item.label}
          </p>
          <p className="mt-0.5 text-ink-muted font-normal">Plan upgrade required to access</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative group/nav">
      <NavLink
        to={item.to}
        onClick={onClick}
        aria-current={active ? 'page' : undefined}
        aria-label={item.label}
        className={`
          flex items-center min-h-[36px] rounded text-xs font-medium transition-colors
          outline-none focus-visible:ring-2 focus-visible:ring-primary
          ${collapsed ? 'justify-center px-0 w-9 h-9 mx-auto' : 'px-2.5 py-1.5 gap-2.5'}
          ${
            active
              ? 'bg-primary-soft text-primary-ink font-semibold border-l-2 border-l-primary'
              : 'text-ink-muted hover:bg-primary-soft/20 hover:text-primary'
          }
        `}
      >
        <Icon
          className={`w-4 h-4 flex-shrink-0 transition-colors ${
            active ? 'text-primary-ink' : 'text-ink-muted group-hover/nav:text-primary'
          }`}
        />
        {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
      </NavLink>

      {/* Floating Tooltip in Collapsed Icon-Only Mode */}
      {collapsed && (
        <div className="pointer-events-none absolute left-full ml-2 top-1/2 -translate-y-1/2 z-50 hidden group-hover/nav:block group-focus-within/nav:block">
          <div className="rounded bg-ink px-2 py-1 text-surface text-[11px] font-medium shadow-level3 whitespace-nowrap">
            {item.label}
          </div>
        </div>
      )}
    </div>
  );
};

export default NavItem;

