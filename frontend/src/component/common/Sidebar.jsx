import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { GraduationCap, Link2, LogOut, X } from 'lucide-react';
import NavGroup from './NavGroup';
import NavItem from './NavItem';
import { useReducedMotion } from '../../hooks/useReducedMotion';

const ROLE_LABELS = {
  super_admin: 'Super Admin',
  admin: 'Administrator',
  teacher: 'Teacher',
  student: 'Student',
  parent: 'Parent',
};

export const Sidebar = ({
  role = 'student',
  collapsed = false,
  mobileOpen = false,
  onMobileClose,
  tenantName = 'AttendEase',
  tenantLogo = null,
  tenantSubdomain = null,
  linkCopied = false,
  onCopyLoginLink,
  groups = [],
  planModules,
  isModuleActive,
  moduleLabels = {},
  can = () => true,
  isGroupCollapsed,
  onToggleGroup,
  onLogout,
}) => {
  const location = useLocation();
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    if (mobileOpen && onMobileClose) onMobileClose();
  }, [location.pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!mobileOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && onMobileClose) onMobileClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mobileOpen, onMobileClose]);

  const isActive = (to) => location.pathname === to || (to !== '/' && location.pathname.startsWith(to + '/'));

  const renderNavContent = (isMobile = false) => {
    const isIconOnly = collapsed && !isMobile;

    return (
      <div className="flex flex-col h-full select-none">
        {/* Brand / Logo Header */}
        <div className={`h-14 flex items-center border-b border-line shrink-0 ${isIconOnly ? 'justify-center px-0' : 'justify-between px-4'}`}>
          <div className={`flex items-center gap-2.5 min-w-0 ${isIconOnly ? 'justify-center' : ''}`}>
            {tenantLogo ? (
              <img src={tenantLogo} alt="logo" className="w-8 h-8 rounded object-cover shrink-0 border border-primary/30 ring-2 ring-primary/15 shadow-xs" />
            ) : (
              <div className="w-8 h-8 rounded bg-primary flex items-center justify-center shrink-0 text-on-primary shadow-xs">
                <GraduationCap className="w-4 h-4" />
              </div>
            )}
            {!isIconOnly && (
              <div className="min-w-0">
                <p className="font-semibold text-xs text-ink truncate leading-tight">{tenantName}</p>
                <p className="text-[10px] font-medium text-ink-muted capitalize truncate mt-0.5">
                  {ROLE_LABELS[role] || role}
                </p>
              </div>
            )}
          </div>

          {isMobile && (
            <button
              type="button"
              onClick={onMobileClose}
              className="p-1 rounded text-ink-muted hover:bg-surface-subtle hover:text-ink transition-colors"
              aria-label="Close navigation"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Unique Subdomain Login Link */}
        {tenantSubdomain && tenantSubdomain !== 'demo' && role !== 'super_admin' && (
          <div className={isIconOnly ? 'px-2 pt-2' : 'px-3 pt-2.5'}>
            <button
              type="button"
              onClick={onCopyLoginLink}
              title={`Copy unique portal link: ${window.location.origin}/login/${tenantSubdomain}`}
              className={`
                w-full flex items-center rounded bg-surface-subtle hover:bg-primary-soft/30 border border-line hover:border-primary/40 text-ink hover:text-primary transition-colors text-left font-medium
                ${isIconOnly ? 'justify-center h-8 px-0' : 'gap-2 px-2.5 py-1.5'}
              `}
            >
              <Link2 className={`w-3.5 h-3.5 shrink-0 transition-colors ${linkCopied ? 'text-primary font-bold' : 'text-ink-muted'}`} />
              {!isIconOnly && (
                <span className="text-xs truncate font-mono tnum">
                  {linkCopied ? 'Link copied!' : `portal/${tenantSubdomain}`}
                </span>
              )}
            </button>
          </div>
        )}

        {/* Scrollable Navigation Groups */}
        <nav
          aria-label="Sidebar Navigation"
          className="flex-1 overflow-y-auto overflow-x-hidden px-2.5 py-4 space-y-4"
        >
          {groups.map((section) => {
            const filteredItems = (section.items || []).filter(
              (item) => !item.permission || can(item.permission)
            );
            if (filteredItems.length === 0) return null;

            return (
              <NavGroup
                key={section.group}
                title={section.group}
                collapsed={isIconOnly}
                isGroupCollapsed={isGroupCollapsed ? isGroupCollapsed(section.group) : false}
                onToggle={() => onToggleGroup && onToggleGroup(section.group)}
              >
                {filteredItems.map((item) => {
                  const locked =
                    Boolean(item.module) &&
                    planModules !== null &&
                    !isModuleActive(planModules, item.module);
                  const active = isActive(item.to);

                  return (
                    <NavItem
                      key={item.to}
                      item={item}
                      active={active}
                      locked={locked}
                      collapsed={isIconOnly}
                      moduleLabel={moduleLabels[item.module]}
                      onClick={isMobile ? onMobileClose : undefined}
                    />
                  );
                })}
              </NavGroup>
            );
          })}
        </nav>

        {/* Sign Out Footer */}
        <div className="border-t border-line p-2 shrink-0">
          <button
            type="button"
            onClick={onLogout}
            title={isIconOnly ? 'Sign out' : undefined}
            aria-label="Sign out"
            className={`
              w-full flex items-center rounded text-xs font-semibold text-status-error-text hover:bg-status-error-bg transition-colors
              ${isIconOnly ? 'justify-center h-9 px-0' : 'gap-2.5 px-3 py-2'}
            `}
          >
            <LogOut className="w-4 h-4 shrink-0" />
            {!isIconOnly && <span>Sign out</span>}
          </button>
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Mobile Drawer Backdrop */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            className="fixed inset-0 bg-ink/40 z-40 lg:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.15 }}
            onClick={onMobileClose}
            aria-hidden="true"
          />
        )}
      </AnimatePresence>

      {/* Mobile Drawer (Left Slide-in) */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50 w-72 bg-surface border-r border-line flex flex-col lg:hidden
          transform transition-transform duration-200 ease-out shadow-level4
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {renderNavContent(true)}
      </aside>

      {/* Desktop Sticky Sidebar (Width transition between w-64 and w-16) */}
      <aside
        className={`
          hidden lg:flex flex-col shrink-0 z-20 bg-surface border-r border-line h-screen sticky top-0
          transition-[width] duration-150 ease-out
          ${collapsed ? 'w-16' : 'w-60'}
        `}
      >
        {renderNavContent(false)}
      </aside>
    </>
  );
};

export default Sidebar;

