import React, { useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { Menu as MenuIcon, PanelLeftClose, PanelLeft, Search, ChevronRight } from 'lucide-react';
import UserMenu from './UserMenu';
import NotificationBell from './NotificationBell';

/**
 * Topbar
 * Header bar providing mobile drawer trigger, desktop collapse toggle, contextual breadcrumbs, Cmd+K trigger, and user profile menu.
 */
export const Topbar = ({
  onMenuClick,
  onCollapseClick,
  collapsed = false,
  onCommandClick,
  displayName,
  userAvatar,
  role,
  roleLabel,
  onLogout,
  groups = [],
}) => {
  const location = useLocation();

  // Derive active breadcrumb from current pathname and role groups
  const breadcrumb = useMemo(() => {
    const path = location.pathname;
    let foundGroup = null;
    let foundItem = null;

    for (const section of groups) {
      for (const item of section.items || []) {
        if (item.to === path || (item.to !== '/' && path.startsWith(item.to + '/'))) {
          foundGroup = section.group;
          foundItem = item.label;
          break;
        }
      }
      if (foundItem) break;
    }

    if (!foundItem) {
      if (path === '/profile') {
        return { group: 'Account', item: 'My Profile' };
      }
      return null;
    }

    return { group: foundGroup, item: foundItem };
  }, [location.pathname, groups]);

  return (
    <header className="sticky top-0 z-30 h-16 bg-surface/85 backdrop-blur-md border-b border-line flex items-center justify-between px-4 sm:px-6 shrink-0 gap-3">
      {/* Left Area: Toggles & Breadcrumb */}
      <div className="flex items-center gap-3 min-w-0">
        {/* Mobile Hamburger Drawer Trigger */}
        <button
          type="button"
          onClick={onMenuClick}
          className="lg:hidden p-2 rounded-xl text-ink-soft hover:bg-background transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          aria-label="Open navigation menu"
        >
          <MenuIcon className="w-5 h-5" />
        </button>

        {/* Desktop Sidebar Collapse / Expand Toggle */}
        <button
          type="button"
          onClick={onCollapseClick}
          className="hidden lg:flex p-2 rounded-xl text-ink-soft hover:bg-background hover:text-ink transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? (
            <PanelLeft className="w-5 h-5" />
          ) : (
            <PanelLeftClose className="w-5 h-5" />
          )}
        </button>

        {/* Breadcrumb Context (Hidden on very small screens to save space) */}
        {breadcrumb && (
          <nav aria-label="Breadcrumb" className="hidden sm:flex items-center gap-1.5 text-xs truncate">
            <span className="text-ink-faint font-medium">{breadcrumb.group}</span>
            <ChevronRight className="w-3.5 h-3.5 text-ink-faint shrink-0" aria-hidden="true" />
            <span className="text-ink font-bold truncate">{breadcrumb.item}</span>
          </nav>
        )}
      </div>

      {/* Right Area: Search Trigger & User Menu */}
      <div className="flex items-center gap-2.5 shrink-0">
        {/* Cmd+K Quick Search Trigger */}
        <button
          type="button"
          onClick={onCommandClick}
          aria-label="Open command palette search"
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-background hover:bg-line/40 border border-line/70 text-xs text-ink-soft transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          <Search className="w-3.5 h-3.5 text-ink-faint" />
          <span className="hidden md:inline">Jump to...</span>
          <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono text-ink-faint bg-surface rounded border border-line">
            ⌘K
          </kbd>
        </button>

        {/* Notification Bell */}
        <NotificationBell role={role} />

        {/* User Profile Menu */}
        <UserMenu
          displayName={displayName}
          userAvatar={userAvatar}
          role={role}
          roleLabel={roleLabel}
          onLogout={onLogout}
        />
      </div>
    </header>
  );
};

export default Topbar;
