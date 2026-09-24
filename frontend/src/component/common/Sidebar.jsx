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

/**
 * Sidebar
 * Primary navigation sidebar supporting desktop icon-only collapse, collapsible nav groups, and accessible mobile drawer.
 */
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

  // Close mobile drawer on route change or Escape
  useEffect(() => {
    if (mobileOpen && onMobileClose) {
      onMobileClose();
    }
  }, [location.pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!mobileOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && onMobileClose) {
        onMobileClose();
      }
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
        <div className={`h-16 flex items-center border-b border-line shrink-0 ${isIconOnly ? 'justify-center px-0' : 'justify-between px-4'}`}>
          <div className={`flex items-center gap-3 min-w-0 ${isIconOnly ? 'justify-center' : ''}`}>
            {tenantLogo ? (
              <img src={tenantLogo} alt="logo" className="w-9 h-9 rounded-xl object-cover shrink-0 shadow-xs" />
            ) : (
              <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center shadow-xs shrink-0 text-white">
                <GraduationCap className="w-5 h-5" />
              </div>
            )}
            {!isIconOnly && (
              <div className="min-w-0">
                <p className="font-bold text-xs text-ink truncate leading-tight">{tenantName}</p>
                <p className="text-[10px] font-semibold text-ink-faint capitalize truncate mt-0.5">
                  {ROLE_LABELS[role] || role}
                </p>
              </div>
            )}
          </div>

          {/* Close button on mobile drawer */}
          {isMobile && (
            <button
              type="button"
              onClick={onMobileClose}
              className="p-1.5 rounded-xl text-ink-faint hover:bg-background hover:text-ink transition-colors"
              aria-label="Close navigation"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Unique Subdomain Login Link (Only for real tenants, hidden for super_admin and demo) */}
        {tenantSubdomain && tenantSubdomain !== 'demo' && role !== 'super_admin' && (
          <div className={isIconOnly ? 'px-2 pt-2' : 'px-3 pt-3'}>
            <button
              type="button"
              onClick={onCopyLoginLink}
              title={`Copy unique portal link: ${window.location.origin}/login/${tenantSubdomain}`}
              className={`
                w-full flex items-center rounded-xl bg-primary-soft text-primary hover:bg-primary/15 transition-colors text-left
                ${isIconOnly ? 'justify-center h-10 px-0' : 'gap-2 px-3 py-2'}
              `}
            >
              <Link2 className="w-3.5 h-3.5 shrink-0" />
              {!isIconOnly && (
                <span className="text-xs font-semibold truncate">
                  {linkCopied ? 'Login link copied!' : `login/${tenantSubdomain}`}
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
              w-full flex items-center rounded-xl text-xs font-semibold text-red-500 hover:bg-red-500/10 transition-colors
              ${isIconOnly ? 'justify-center h-11 px-0' : 'gap-3 px-3 py-2.5'}
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
            className="fixed inset-0 bg-ink/40 backdrop-blur-sm z-40 lg:hidden"
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
          fixed inset-y-0 left-0 z-50 w-80 bg-surface border-r border-line flex flex-col lg:hidden
          transform transition-transform duration-200 ease-out shadow-pop
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {renderNavContent(true)}
      </aside>

      {/* Desktop Sticky Sidebar (Width transition between w-64 and w-16) */}
      <aside
        className={`
          hidden lg:flex flex-col shrink-0 z-20 bg-surface border-r border-line h-screen sticky top-0
          transition-[width] duration-200 ease-out
          ${collapsed ? 'w-16' : 'w-64'}
        `}
      >
        {renderNavContent(false)}
      </aside>
    </>
  );
};

export default Sidebar;
