import React from 'react';
import { NavLink } from 'react-router-dom';
import { Lock } from 'lucide-react';

/**
 * NavItem
 * Accessible, responsive navigation item supporting full expanded, icon-only collapsed, and locked plan states.
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
          relative group/locked flex items-center min-h-[44px] rounded-xl text-sm font-medium
          text-ink-faint cursor-not-allowed select-none transition-colors
          ${collapsed ? 'justify-center px-0 w-11 h-11 mx-auto' : 'px-3 py-2.5 gap-3'}
        `}
        role="button"
        aria-disabled="true"
        aria-label={`${item.label} (Locked - Plan Upgrade Required)`}
        tabIndex={0}
      >
        <Icon className="w-5 h-5 flex-shrink-0 text-ink-faint" />
        
        {!collapsed && (
          <>
            <span className="flex-1 truncate">{item.label}</span>
            <Lock className="w-4 h-4 text-ink-faint/80 flex-shrink-0" />
          </>
        )}

        {/* Hover / Focus Tooltip */}
        <div className={`
          pointer-events-none absolute z-50 hidden group-hover/locked:flex group-focus/locked:flex flex-col
          rounded-xl bg-ink px-3 py-2 text-white text-xs shadow-pop whitespace-nowrap
          ${collapsed ? 'left-full ml-3 top-1/2 -translate-y-1/2' : 'left-3 top-full mt-1.5'}
        `}>
          <p className="font-bold flex items-center gap-1.5">
            <Lock className="w-3 h-3 text-amber-400" />
            {moduleLabel || item.label}
          </p>
          <p className="mt-0.5 text-white/80 font-normal">Plan upgrade required to access</p>
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
          flex items-center min-h-[44px] rounded-xl text-sm font-medium transition-all duration-150
          outline-none focus-visible:ring-2 focus-visible:ring-primary/40
          ${collapsed ? 'justify-center px-0 w-11 h-11 mx-auto' : 'px-3 py-2.5 gap-3'}
          ${active
            ? 'bg-primary-soft text-primary-dark font-semibold shadow-xs'
            : 'text-ink-soft hover:bg-background hover:text-ink'}
        `}
      >
        <Icon className={`w-5 h-5 flex-shrink-0 transition-colors ${active ? 'text-primary' : 'text-ink-faint group-hover/nav:text-ink-soft'}`} />
        
        {!collapsed && (
          <span className="flex-1 truncate">{item.label}</span>
        )}
      </NavLink>

      {/* Floating Tooltip in Collapsed Icon-Only Mode */}
      {collapsed && (
        <div className="pointer-events-none absolute left-full ml-3 top-1/2 -translate-y-1/2 z-50 hidden group-hover/nav:block group-focus-within/nav:block">
          <div className="rounded-lg bg-ink px-2.5 py-1.5 text-white text-xs font-medium shadow-pop whitespace-nowrap">
            {item.label}
          </div>
        </div>
      )}
    </div>
  );
};

export default NavItem;
