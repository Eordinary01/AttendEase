import React, { useState, Fragment } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Dialog, Transition } from '@headlessui/react';
import {
  LayoutDashboard,
  PenSquare,
  ClipboardCheck,
  Calendar,
  Users,
  FileText,
  DollarSign,
  Building2,
  Package,
  Activity,
  Award,
  Menu,
  X,
} from 'lucide-react';
import NavItem from './NavItem';

const ROLE_PRIMARY_NAV = {
  super_admin: [
    { to: '/super-admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/super-admin/tenants', label: 'Tenants', icon: Building2 },
    { to: '/super-admin/plans', label: 'Plans', icon: Package },
    { to: '/super-admin/monitoring', label: 'Logs', icon: Activity },
  ],
  admin: [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/students', label: 'Students', icon: Users, permission: 'students:read' },
    { to: '/admin/manage-teachers', label: 'Teachers', icon: Users },
    { to: '/reports', label: 'Reports', icon: ClipboardCheck, permission: 'reports:view' },
  ],
  teacher: [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/attendance', label: 'Attendance', icon: PenSquare, permission: 'attendance:write' },
    { to: '/students', label: 'Students', icon: Users, permission: 'students:read' },
    { to: '/timetable', label: 'Timetable', icon: Calendar, module: 'timetable', permission: 'timetable:read' },
  ],
  student: [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/attendance-history', label: 'Attendance', icon: ClipboardCheck },
    { to: '/exams', label: 'Exams', icon: FileText, module: 'examManagement', permission: 'exam:read' },
    { to: '/fees', label: 'My Fees', icon: DollarSign, module: 'financeManagement', permission: 'fee:read' },
  ],
  parent: [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/attendance-history', label: 'Attendance', icon: ClipboardCheck },
    { to: '/exams/results', label: 'Results', icon: Award, module: 'examManagement', permission: 'exam:read' },
    { to: '/fees', label: 'My Fees', icon: DollarSign, module: 'financeManagement', permission: 'fee:read' },
  ],
};

/**
 * BottomNav
 * Fixed mobile bottom navigation with role-tailored primary quick actions and an expandable "More" sheet.
 */
export const BottomNav = ({
  role = 'student',
  groups = [],
  planModules,
  isModuleActive,
  moduleLabels = {},
  can = () => true,
}) => {
  const location = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);

  const primaryItems = (ROLE_PRIMARY_NAV[role] || ROLE_PRIMARY_NAV.student).filter(
    (item) => !item.permission || can(item.permission)
  );

  const isActive = (to) => location.pathname === to || (to !== '/' && location.pathname.startsWith(to + '/'));

  // Flatten all secondary items for the "More" bottom sheet
  const primaryUrls = new Set(primaryItems.map((i) => i.to));
  const secondaryGroups = groups
    .map((g) => ({
      ...g,
      items: (g.items || []).filter((item) => !primaryUrls.has(item.to)),
    }))
    .filter((g) => g.items.length > 0);

  return (
    <>
      <nav
        aria-label="Mobile Navigation"
        className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-surface/90 backdrop-blur-md border-t border-line shadow-card pb-[env(safe-area-inset-bottom)]"
      >
        <div className="flex items-center justify-around h-16 px-1">
          {primaryItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.to);

            return (
              <NavLink
                key={item.to}
                to={item.to}
                aria-current={active ? 'page' : undefined}
                className={`
                  flex-1 flex flex-col items-center justify-center min-h-[44px] py-1.5 px-1 rounded-xl transition-colors
                  outline-none focus-visible:ring-2 focus-visible:ring-primary/40
                  ${active ? 'text-primary font-bold' : 'text-ink-faint hover:text-ink'}
                `}
              >
                <Icon className={`w-5 h-5 mb-0.5 transition-colors ${active ? 'text-primary' : 'text-ink-faint'}`} />
                <span className="text-[10px] truncate max-w-[64px]">{item.label}</span>
              </NavLink>
            );
          })}

          {/* "More" Sheet Trigger */}
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className={`
              flex-1 flex flex-col items-center justify-center min-h-[44px] py-1.5 px-1 rounded-xl text-ink-faint hover:text-ink transition-colors
              outline-none focus-visible:ring-2 focus-visible:ring-primary/40
              ${moreOpen ? 'text-primary font-bold' : ''}
            `}
            aria-label="More navigation options"
          >
            <Menu className="w-5 h-5 mb-0.5" />
            <span className="text-[10px]">More</span>
          </button>
        </div>
      </nav>

      {/* "More" Action Sheet */}
      <Transition appear show={moreOpen} as={Fragment}>
        <Dialog as="div" className="relative z-50 lg:hidden" onClose={() => setMoreOpen(false)}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-200"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-150"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-ink/40 backdrop-blur-sm" />
          </Transition.Child>

          <div className="fixed inset-x-0 bottom-0 z-10 flex flex-col max-h-[80vh]">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-200"
              enterFrom="translate-y-full"
              enterTo="translate-y-0"
              leave="ease-in duration-150"
              leaveFrom="translate-y-0"
              leaveTo="translate-y-full"
            >
              <Dialog.Panel className="w-full bg-surface border-t border-line rounded-t-3xl p-4 shadow-pop overflow-y-auto pb-[calc(1rem+env(safe-area-inset-bottom))]">
                <div className="flex items-center justify-between pb-3 border-b border-line mb-3">
                  <Dialog.Title className="text-sm font-bold text-ink">
                    Navigation Menu
                  </Dialog.Title>
                  <button
                    type="button"
                    onClick={() => setMoreOpen(false)}
                    className="p-1.5 rounded-xl text-ink-faint hover:bg-background hover:text-ink transition-colors"
                    aria-label="Close menu"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-4">
                  {secondaryGroups.map((section) => (
                    <div key={section.group}>
                      <p className="px-3 mb-1.5 text-[11px] font-bold uppercase tracking-wider text-ink-faint">
                        {section.group}
                      </p>
                      <div className="space-y-1">
                        {section.items
                          .filter((item) => !item.permission || can(item.permission))
                          .map((item) => {
                            const locked = Boolean(item.module) && planModules !== null && !isModuleActive(planModules, item.module);
                            const active = isActive(item.to);

                            return (
                              <NavItem
                                key={item.to}
                                item={item}
                                active={active}
                                locked={locked}
                                collapsed={false}
                                moduleLabel={moduleLabels[item.module]}
                                onClick={() => setMoreOpen(false)}
                              />
                            );
                          })}
                      </div>
                    </div>
                  ))}
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </Dialog>
      </Transition>
    </>
  );
};

export default BottomNav;
