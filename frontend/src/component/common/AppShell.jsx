import React, { useState, useEffect } from 'react';
import { NavLink, Link, useLocation } from 'react-router-dom';
import { Menu, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Home,
  LogOut,
  GraduationCap,
  ChevronDown,
  Users,
  BookMarked,
  Calendar,
  Settings,
  Upload,
  UserCog,
  BookOpen,
  Building2,
  LifeBuoy,
  Package,
  FileText,
  DollarSign,
  ClipboardCheck,
  PenSquare,
  Ticket,
  User,
  LayoutDashboard,
  Menu as MenuIcon,
  Link2,
  Lock,
  Network,
  Megaphone,
  Award,
  Activity,
  Camera,
  UserCheck,
  Grid,
  Scan,
} from 'lucide-react';
import api from '../../utils/api';
import { usePermissions } from '../../contexts/PermissionsContext';
import { clearTenantFaceCache } from '../../utils/idbStorage';
import { initOfflineSync, onSyncEvent } from '../../utils/offlineSync';

const roleNav = {
  super_admin: [
    { group: 'Platform', items: [
      { to: '/super-admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { to: '/super-admin/tenants', label: 'Tenants', icon: Building2 },
      { to: '/super-admin/plans', label: 'Plans', icon: Package },
      { to: '/super-admin/support', label: 'Support', icon: LifeBuoy },
      { to: '/super-admin/monitoring', label: 'System Logs', icon: Activity },
    ]},
  ],
  admin: [
    { group: 'Overview', items: [
      { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    ]},
    { group: 'Academics', items: [
      { to: '/admin/manage-subjects', label: 'Subjects', icon: BookMarked },
      { to: '/admin/assign-subjects', label: 'Assign Subjects', icon: BookOpen },
      { to: '/attendance-history', label: 'Attendance History', icon: ClipboardCheck },
      { to: '/admin/academic-structure', label: 'Academic Structure', icon: Network, module: 'academicStructure' },
      { to: '/admin/timetable', label: 'Timetable', icon: Calendar, module: 'timetable' },
      { to: '/admin/exams', label: 'Exam Manager', icon: FileText, module: 'examManagement' },
      { to: '/admin/exams/halls', label: 'Exam Halls', icon: Building2, module: 'examSeating' },
      { to: '/admin/exams/seating', label: 'Seating Engine', icon: Grid, module: 'examSeating' },
      { to: '/exams', label: 'Exam Schedule', icon: Calendar, module: 'examManagement' },
      { to: '/exams/grades', label: 'Grade Manager', icon: ClipboardCheck, module: 'examManagement' },
      { to: '/reports', label: 'Reports', icon: ClipboardCheck, permission: 'reports:view' },
    ]},
    { group: 'People', items: [
      { to: '/admin/manage-teachers', label: 'Teachers', icon: Users },
      { to: '/students', label: 'Students', icon: Users, permission: 'students:read' },
      { to: '/admin/roles', label: 'Roles', icon: UserCog, module: 'customRoles' },
    ]},
    { group: 'Administration', items: [
      { to: '/admin/announcements', label: 'Announcements', icon: Megaphone, module: 'alerts' },
      { to: '/admin/upload-enrollments', label: 'Enrollments', icon: Upload },
      { to: '/admin/fees', label: 'Fees', icon: DollarSign, module: 'financeManagement' },
      { to: '/admin/settings', label: 'Settings', icon: Settings },
      { to: '/admin/support', label: 'Support', icon: LifeBuoy },
    ]},
  ],
  teacher: [
    { group: 'Overview', items: [
      { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { to: '/timetable', label: 'Timetable', icon: Calendar, module: 'timetable', permission: 'timetable:read' },
    ]},
    { group: 'Academics', items: [
      { to: '/attendance', label: 'Mark Attendance', icon: PenSquare, permission: 'attendance:write' },
      { to: '/attendance-overview', label: 'Overview', icon: ClipboardCheck, permission: 'attendance:read' },
      { to: '/attendance-history', label: 'Attendance History', icon: ClipboardCheck, permission: 'attendance:read' },
      { to: '/teacher/subjects', label: 'My Subjects', icon: BookMarked, permission: 'subjects:read' },
      { to: '/admin/manage-subjects', label: 'Manage Subjects', icon: BookMarked, permission: 'subjects:write' },
      { to: '/admin/timetable', label: 'Timetable Manager', icon: Calendar, module: 'timetable', permission: 'timetable:write' },
      { to: '/exams', label: 'Exams', icon: FileText, module: 'examManagement', permission: 'exam:read' },
      { to: '/admin/exams', label: 'Exam Manager', icon: FileText, module: 'examManagement', permission: 'exam:create' },
      { to: '/admin/exams/halls', label: 'Exam Halls', icon: Building2, module: 'examSeating', permission: 'exam:create' },
      { to: '/admin/exams/seating', label: 'Seating Engine', icon: Grid, module: 'examSeating', permission: 'exam:create' },
      { to: '/exams/invigilator-scanner', label: 'Invigilator Scanner', icon: Scan, module: 'examSeating', permission: 'exam:grade' },
      { to: '/exams/grades', label: 'Grade Manager', icon: ClipboardCheck, module: 'examManagement', permission: 'exam:grade' },
      { to: '/reports', label: 'Reports', icon: ClipboardCheck, permission: 'reports:view' },
      { to: '/face-attendance', label: 'Face Attendance', icon: Camera, module: 'biometricAttendance' },
      { to: '/face-registration', label: 'Face Registration', icon: UserCheck, module: 'biometricAttendance' },
    ]},
    { group: 'People', items: [
      { to: '/students', label: 'Students', icon: Users, permission: 'students:read' },
    ]},
    { group: 'Finance', items: [
      { to: '/fees', label: 'Fees', icon: DollarSign, module: 'financeManagement', permission: 'fee:read' },
      { to: '/admin/fees', label: 'Fee Management', icon: DollarSign, module: 'financeManagement', permission: 'fee:collect' },
    ]},
    { group: 'Communication', items: [
      { to: '/teacher/announcements', label: 'Announcements', icon: Megaphone, module: 'alerts', permission: 'alerts:create' },
    ]},
  ],
  student: [
    { group: 'Overview', items: [
      { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { to: '/timetable', label: 'Timetable', icon: Calendar, module: 'timetable', permission: 'timetable:read' },
      { to: '/student/subjects', label: 'My Subjects', icon: BookMarked, permission: 'subjects:read' },
    ]},
    { group: 'Academics', items: [
      { to: '/attendance-history', label: 'Attendance History', icon: ClipboardCheck },
      { to: '/exams', label: 'Exams', icon: FileText, module: 'examManagement', permission: 'exam:read' },
      { to: '/exams/hall-ticket', label: 'Admit Card', icon: Award, module: 'examSeating', permission: 'exam:read' },
      { to: '/exams/results', label: 'My Results', icon: Award, module: 'examManagement', permission: 'exam:read' },
    ]},
    { group: 'Finance', items: [
      { to: '/fees', label: 'My Fees', icon: DollarSign, module: 'financeManagement', permission: 'fee:read' },
    ]},
    { group: 'Communication', items: [
      { to: '/admin/announcements', label: 'Announcements', icon: Megaphone, module: 'alerts' },
    ]},
    { group: 'Support', items: [
      { to: '/tickets', label: 'Create Ticket', icon: Ticket },
    ]},
  ],
  parent: [
    { group: 'Overview', items: [
      { to: '/parent/dashboard', label: 'Dashboard', icon: Home },
    ]},
    { group: 'Academics', items: [
      { to: '/subjects', label: "My Child's Subjects", icon: BookMarked, permission: 'subjects:read' },
      { to: '/attendance-history', label: 'Attendance History', icon: ClipboardCheck, permission: 'attendance:read' },
      { to: '/timetable', label: 'Timetable', icon: Calendar, module: 'timetable', permission: 'timetable:read' },
      { to: '/exams/hall-ticket', label: 'Admit Card', icon: Award, module: 'examSeating', permission: 'exam:read' },
      { to: '/exams/results', label: 'Results', icon: Award, module: 'examManagement', permission: 'exam:read' },
    ]},
    { group: 'Finance', items: [
      { to: '/fees', label: 'My Fees', icon: DollarSign, module: 'financeManagement', permission: 'fee:read' },
    ]},
  ],
};

const roleLabels = {
  super_admin: 'Super Admin',
  admin: 'Administrator',
  teacher: 'Teacher',
  student: 'Student',
  parent: 'Parent',
};

const AppShell = ({ role, userName, userId, onLogout, children }) => {
  const { can } = usePermissions();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [planModules, setPlanModules] = useState(null);
  const [tenantName, setTenantName] = useState('AttendEase');
  const [tenantLogo, setTenantLogo] = useState(null);
  const [tenantSubdomain, setTenantSubdomain] = useState(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const location = useLocation();

  useEffect(() => {
    fetchTenantInfo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const handler = () => fetchTenantInfo();
    window.addEventListener('attendease:branding-updated', handler);
    window.addEventListener('attendease:auth-changed', handler);
    return () => {
      window.removeEventListener('attendease:branding-updated', handler);
      window.removeEventListener('attendease:auth-changed', handler);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchTenantInfo = async () => {
    // Super admins are platform-level — no tenant branding, plan, or login link
    if (role === 'super_admin') {
      setTenantName('AttendEase');
      setTenantLogo(null);
      setTenantSubdomain(null);
      const faviconLink = document.querySelector("link[rel='icon']");
      if (faviconLink) faviconLink.href = '/favicon.ico';
      return;
    }
    try {
      const [usageRes, infoRes] = await Promise.all([
        api.get('/tenant/usage'),
        api.get('/tenant/info'),
      ]);
      if (usageRes.data?.data?.plan?.modules) {
        setPlanModules(usageRes.data.data.plan.modules);
      }
      const tenant = infoRes.data?.data?.tenant;
      if (tenant) {
        setTenantName(tenant.name || 'AttendEase');
        setTenantLogo(tenant.branding?.logo || null);
        setTenantSubdomain(tenant.subdomain || null);
        if (tenant.subdomain) localStorage.setItem('tenantSubdomain', tenant.subdomain);
        if (tenant.branding?.favicon) {
          let faviconLink = document.querySelector("link[rel='icon']");
          if (!faviconLink) {
            faviconLink = document.createElement('link');
            faviconLink.rel = 'icon';
            document.head.appendChild(faviconLink);
          }
          faviconLink.href = tenant.branding.favicon;
        }
      }
    } catch (err) {
      /* ignore */
    }
  };

  const [userAvatar, setUserAvatar] = useState(localStorage.getItem('userAvatar') || null);

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const handleAvatarUpdate = () => {
      setUserAvatar(localStorage.getItem('userAvatar') || null);
    };
    window.addEventListener('userAvatarUpdated', handleAvatarUpdate);

    // Initial avatar fetch if token present and avatar not yet cached
    const cachedAv = localStorage.getItem('userAvatar');
    if (localStorage.getItem('token') && !cachedAv) {
      api.get('/users/profile')
        .then((res) => {
          const av = res.data?.data?.avatar;
          if (av) {
            setUserAvatar(av);
            localStorage.setItem('userAvatar', av);
          }
        })
        .catch(() => {});
    }

    return () => {
      window.removeEventListener('userAvatarUpdated', handleAvatarUpdate);
    };
  }, []);

  useEffect(() => {
    initOfflineSync().catch(() => {});

    const unsubscribe = onSyncEvent((event) => {
      if (event.type === 'SYNC_COMPLETE' && event.syncedCount > 0) {
        if (typeof window !== 'undefined' && window.notifyToast) {
          window.notifyToast(`✅ Auto-synced ${event.syncedCount} offline attendance record(s) successfully!`, 'success', 4000);
        }
      }
    });

    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, []);

  const handleLogout = () => {
    const currentTenantId = localStorage.getItem('tenantId');
    if (currentTenantId) {
      clearTenantFaceCache(currentTenantId).catch(() => {});
    }
    if (onLogout) onLogout();
  };

  const groups = roleNav[role] || [];
  const displayName = userName || localStorage.getItem('userName') || 'Account';
  const initial = (displayName || 'A').charAt(0).toUpperCase();

  const isActive = (to) => location.pathname === to || location.pathname.startsWith(to + '/') || (to === '/exams' && location.pathname.startsWith('/exams'));

  const moduleLabels = {
    examManagement: 'Exam Management',
    financeManagement: 'Fee Management',
    parentPortal: 'Parent Portal',
    timetable: 'Timetable Management',
    customRoles: 'Custom Roles & RBAC',
    bulkOperations: 'Bulk Operations',
    academicStructure: 'Academic Structure',
  };

  const isModuleActive = (modules, mod) => {
    if (!modules || !mod) return true;
    if (modules[mod] === true) return true;
    if ((mod === 'biometricAttendance' || mod === 'faceAttendance') && (modules.biometricAttendance || modules.biometric_attendance || modules.faceAttendance || modules.face_attendance)) return true;
    if (mod === 'examManagement' && modules.exam_management) return true;
    if (mod === 'financeManagement' && modules.finance_management) return true;
    if (mod === 'parentPortal' && modules.parent_portal) return true;
    if (mod === 'academicStructure' && modules.academic_structure) return true;
    return Boolean(modules[mod]);
  };

  const renderItems = (items) =>
    items
      .filter((item) => !item.permission || can(item.permission))
      .map((item) => {
      const locked = Boolean(item.module) && planModules !== null && !isModuleActive(planModules, item.module);
      const active = isActive(item.to);

      if (locked) {
        return (
          <div
            key={item.to}
            className="relative group/locked flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-ink-faint cursor-not-allowed select-none"
            title={`${moduleLabels[item.module] || item.label} is not in your current plan. Upgrade your plan to unlock.`}
          >
            <item.icon className="w-[18px] h-[18px] text-ink-faint" />
            <span className="flex-1 truncate">{item.label}</span>
            <Lock className="w-3.5 h-3.5 text-ink-faint flex-shrink-0" />
            <div className="pointer-events-none absolute top-full left-3 mt-1.5 z-50 hidden group-hover/locked:block whitespace-nowrap">
              <div className="rounded-lg bg-ink px-3 py-2 text-white text-xs shadow-pop">
                <p className="font-semibold">{moduleLabels[item.module] || item.label}</p>
                <p className="mt-0.5 text-white/80">Upgrade your plan to unlock</p>
              </div>
            </div>
          </div>
        );
      }

      return (
        <NavLink
          key={item.to}
          to={item.to}
          className={`
            group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
            ${active
              ? 'bg-primary-soft text-primary-dark'
              : 'text-ink-soft hover:bg-background hover:text-ink'}
          `}
        >
          <item.icon className={`w-[18px] h-[18px] ${active ? 'text-primary' : 'text-ink-faint group-hover:text-ink-soft'}`} />
          {item.label}
          {active && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />}
        </NavLink>
      );
    });

  const sidebarContent = (
    <>
      {/* Logo */}
      <div className="h-16 flex items-center gap-3 px-5 border-b border-line shrink-0">
        {tenantLogo ? (
          <img src={tenantLogo} alt="logo" className="w-9 h-9 rounded-lg object-cover" />
        ) : (
          <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center shadow-sm">
            <GraduationCap className="w-5 h-5 text-white" />
          </div>
        )}
        <div className="min-w-0">
          <p className="font-bold text-ink truncate leading-tight">{tenantName}</p>
          <p className="text-[11px] font-medium text-ink-faint">{roleLabels[role] || role}</p>
        </div>
      </div>

      {/* Unique login link */}
      {tenantSubdomain && (
        <button
          type="button"
          onClick={() => {
            navigator.clipboard?.writeText(`${window.location.origin}/login/${tenantSubdomain}`);
            setLinkCopied(true);
            setTimeout(() => setLinkCopied(false), 2000);
          }}
          title={`Copy your institution's unique login link: ${window.location.origin}/login/${tenantSubdomain}`}
          className="mx-3 mt-3 flex items-center gap-2 px-3 py-2 rounded-lg bg-primary-soft text-primary hover:bg-primary/10 transition-colors text-left"
        >
          <Link2 className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="text-xs font-medium truncate">
            {linkCopied ? 'Login link copied!' : `login/${tenantSubdomain}`}
          </span>
        </button>
      )}

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        {groups.map((section) => (
          <div key={section.group}>
            <p className="px-3 mb-2 text-[11px] font-bold uppercase tracking-wider text-ink-faint">
              {section.group}
            </p>
            <div className="space-y-1">{renderItems(section.items)}</div>
          </div>
        ))}
      </nav>

      {/* Sign out */}
      <div className="border-t border-line p-3 shrink-0">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
        >
          <LogOut className="w-[18px] h-[18px]" />
          Sign out
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-background lg:flex">
      {/* Mobile sidebar + backdrop */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            className="fixed inset-0 bg-ink/50 backdrop-blur-sm z-40 lg:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      <aside
        className={`
          fixed inset-y-0 left-0 z-50 w-72 bg-surface border-r border-line flex flex-col
          transform transition-transform duration-300 ease-in-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:static lg:translate-x-0 lg:w-64 lg:shrink-0 lg:z-20
        `}
      >
        {sidebarContent}
      </aside>

      {/* Main column */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        {/* Topbar */}
        <header className="sticky top-0 z-30 h-16 bg-surface/80 backdrop-blur-md border-b border-line flex items-center justify-between px-4 sm:px-6 shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-lg text-ink-soft hover:bg-background transition-colors"
              aria-label="Open menu"
            >
              <MenuIcon className="w-5 h-5" />
            </button>
          </div>

          {/* User menu */}
          <Menu as="div" className="relative">
            <Menu.Button className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-background transition-colors">
              {userAvatar ? (
                <img
                  src={userAvatar}
                  alt={displayName}
                  className="w-8 h-8 rounded-full object-cover border border-line shadow-xs"
                />
              ) : (
                <span className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center text-sm font-bold">
                  {initial}
                </span>
              )}
              <span className="hidden md:block text-sm font-semibold text-ink max-w-[140px] truncate">{displayName}</span>
              <ChevronDown className="w-4 h-4 text-ink-faint hidden md:block" />
            </Menu.Button>
            <Transition
              as={Fragment}
              enter="transition ease-out duration-100"
              enterFrom="transform opacity-0 scale-95"
              enterTo="transform opacity-100 scale-100"
              leave="transition ease-in duration-75"
              leaveFrom="transform opacity-100 scale-100"
              leaveTo="transform opacity-0 scale-95"
            >
              <Menu.Items className="absolute right-0 mt-2 w-56 origin-top-right rounded-xl bg-surface shadow-pop ring-1 ring-line focus:outline-none z-50">
                <div className="p-1.5">
                  <div className="px-3 py-2.5 border-b border-line mb-1">
                    <p className="text-sm font-semibold text-ink">{displayName}</p>
                    <p className="text-xs text-ink-faint mt-0.5">{roleLabels[role] || role}</p>
                  </div>
                  <Menu.Item>
                    {({ active }) => (
                      <Link
                        to="/profile"
                        className={`${active ? 'bg-background' : ''} group flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-ink-soft hover:text-ink`}
                      >
                        <User className="w-4 h-4" /> Profile
                      </Link>
                    )}
                  </Menu.Item>
                  <Menu.Item>
                    {({ active }) => (
                      <button
                        onClick={handleLogout}
                        className={`${active ? 'bg-red-50' : ''} group flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-red-600`}
                      >
                        <LogOut className="w-4 h-4" /> Sign out
                      </button>
                    )}
                  </Menu.Item>
                </div>
              </Menu.Items>
            </Transition>
          </Menu>
        </header>

        {/* Content */}
        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6 max-w-[1400px] w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
};

export default AppShell;
