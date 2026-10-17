import React, { useMemo, useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Menu as MenuIcon, PanelLeftClose, PanelLeft, Search, ChevronRight, Sun, Moon } from 'lucide-react';
import UserMenu from './UserMenu';
import NotificationBell from './NotificationBell';

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
  const [isDark, setIsDark] = useState(() => {
    if (typeof window !== 'undefined') {
      return document.documentElement.classList.contains('dark') || localStorage.getItem('theme') === 'dark';
    }
    return false;
  });

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      root.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDark]);

  const toggleTheme = () => setIsDark((prev) => !prev);

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
      if (path === '/profile') return { group: 'Account', item: 'My Profile' };
      if (path.startsWith('/super-admin/leads')) return { group: 'Platform', item: 'Inbound Inquiries' };
      return null;
    }
    return { group: foundGroup, item: foundItem };
  }, [location.pathname, groups]);

  return (
    <header className="sticky top-0 z-30 bg-surface border-b border-line flex flex-col shrink-0">
      {/* Institutional Accent Roofline Strip */}
      <div className="w-full h-[2.5px] bg-gradient-to-r from-primary via-primary-light to-secondary shrink-0" />

      <div className="h-14 flex items-center justify-between px-4 sm:px-6 shrink-0 gap-3">
        {/* Left Area: Toggles & Breadcrumb */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onMenuClick}
            className="lg:hidden p-1.5 rounded text-ink-muted hover:bg-surface-subtle hover:text-ink transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-label="Open navigation menu"
          >
            <MenuIcon className="w-5 h-5" />
          </button>

          <button
            type="button"
            onClick={onCollapseClick}
            className="hidden lg:flex p-1.5 rounded text-ink-muted hover:bg-surface-subtle hover:text-ink transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <PanelLeft className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
          </button>

          {breadcrumb && (
            <nav aria-label="Breadcrumb" className="hidden sm:flex items-center gap-1.5 text-xs truncate">
              <span className="text-ink-muted font-medium">{breadcrumb.group}</span>
              <ChevronRight className="w-3.5 h-3.5 text-ink-faint shrink-0" aria-hidden="true" />
              <span className="text-primary font-semibold truncate">{breadcrumb.item}</span>
            </nav>
          )}
        </div>

        {/* Right Area: Search Trigger, Theme Toggle & User Menu */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onCommandClick}
            aria-label="Open command palette search"
            className="flex items-center gap-2 px-2.5 h-7 rounded bg-surface-subtle hover:bg-surface-alt hover:border-primary/40 border border-line text-xs text-ink-muted hover:text-ink transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <Search className="w-3.5 h-3.5 text-ink-muted" />
            <span className="hidden md:inline">Jump to...</span>
            <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.2 text-[10px] font-mono text-ink-muted bg-surface rounded border border-line">
              ⌘K
            </kbd>
          </button>

          <button
            type="button"
            onClick={toggleTheme}
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            className="p-1.5 h-7 w-7 flex items-center justify-center rounded text-ink-muted hover:text-ink hover:bg-surface-subtle border border-line transition-colors focus-visible:ring-2 focus-visible:ring-primary"
          >
            {isDark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
          </button>

          <NotificationBell role={role} />

          <UserMenu
            displayName={displayName}
            userAvatar={userAvatar}
            role={role}
            roleLabel={roleLabel}
            onLogout={onLogout}
          />
        </div>
      </div>
    </header>
  );
};

export default Topbar;

