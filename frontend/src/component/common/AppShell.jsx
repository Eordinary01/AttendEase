import React, { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import {
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
  LayoutDashboard,
  Network,
  Megaphone,
  Award,
  Activity,
  Camera,
  UserCheck,
  Grid,
  Scan,
  CalendarDays,
} from 'lucide-react';

import api from '../../utils/api';
import { usePermissions } from '../../contexts/PermissionsContext';
import { clearTenantFaceCache } from '../../utils/idbStorage';
import { initOfflineSync, onSyncEvent } from '../../utils/offlineSync';
import {
  fetchTenantInfo as fetchTenantInfoService,
  fetchTenantUsage as fetchTenantUsageService,
  getCachedTenantBranding,
} from '../../utils/tenantService';

import { useSidebarState } from '../../hooks/useSidebarState';
import SkipLink from './SkipLink';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import BottomNav from './BottomNav';
import CommandPalette from './CommandPalette';
import DemoBanner from './DemoBanner';

export const roleNav = {
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
      { to: '/calendar', label: 'Academic Calendar', icon: CalendarDays },
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
      { to: '/admin/leaves', label: 'Leave Management', icon: CalendarDays },
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
      { to: '/calendar', label: 'Academic Calendar', icon: CalendarDays },
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
      { to: '/teacher/leaves', label: 'Leave Requests', icon: CalendarDays },
    ]},
    { group: 'People', items: [
      { to: '/students', label: 'Students', icon: Users, permission: 'students:read' },
    ]},
    { group: 'Finance', items: [
      { to: '/admin/fees', label: 'Fee Management', icon: DollarSign, module: 'financeManagement', permission: 'fee:collect' },
    ]},
    { group: 'Communication', items: [
      { to: '/teacher/alerts', label: 'Announcements', icon: Megaphone, module: 'alerts' },
    ]},
  ],
  student: [
    { group: 'Overview', items: [
      { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { to: '/timetable', label: 'Timetable', icon: Calendar, module: 'timetable', permission: 'timetable:read' },
      { to: '/student/subjects', label: 'My Subjects', icon: BookMarked, permission: 'subjects:read' },
    ]},
    { group: 'Academics', items: [
      { to: '/calendar', label: 'Academic Calendar', icon: CalendarDays },
      { to: '/attendance-history', label: 'Attendance History', icon: ClipboardCheck },
      { to: '/exams', label: 'Exams', icon: FileText, module: 'examManagement', permission: 'exam:read' },
      { to: '/exams/hall-ticket', label: 'Admit Card', icon: Award, module: 'examSeating', permission: 'exam:read' },
      { to: '/exams/results', label: 'My Results', icon: Award, module: 'examManagement', permission: 'exam:read' },
      { to: '/leaves', label: 'Apply Leave', icon: CalendarDays },
    ]},
    { group: 'Finance', items: [
      { to: '/fees', label: 'My Fees', icon: DollarSign, module: 'financeManagement', permission: 'fee:read' },
    ]},
    { group: 'Communication', items: [
      { to: '/student/announcements', label: 'Announcements', icon: Megaphone, module: 'alerts' },
    ]},
    { group: 'Support', items: [
      { to: '/tickets', label: 'Create Ticket', icon: Ticket },
    ]},
  ],
  parent: [
    { group: 'Overview', items: [
      { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { to: '/calendar', label: 'Academic Calendar', icon: CalendarDays },
      { to: '/attendance-history', label: 'Attendance History', icon: ClipboardCheck },
      { to: '/exams/results', label: 'Exam Results', icon: Award, module: 'examManagement', permission: 'exam:read' },
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

/**
 * AppShell
 * Modern, accessible layout orchestrator coordinating sidebar, topbar, mobile bottom navigation, and command palette.
 */
export const AppShell = ({ role, userName, userId, onLogout, children }) => {
  const { can } = usePermissions();
  const location = useLocation();

  // Layout & Navigation State
  const [mobileOpen, setMobileOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const { collapsed, setCollapsed, toggleGroup, isGroupCollapsed } = useSidebarState(role);

  // Tenant Branding & Modules
  const cachedBranding = role !== 'super_admin' ? getCachedTenantBranding() : null;
  const [planModules, setPlanModules] = useState(null);
  const [tenantName, setTenantName] = useState(cachedBranding?.name || 'AttendEase');
  const [tenantLogo, setTenantLogo] = useState(cachedBranding?.branding?.logo || null);
  const [tenantSubdomain, setTenantSubdomain] = useState(cachedBranding?.subdomain || null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [userAvatar, setUserAvatar] = useState(localStorage.getItem('userAvatar') || null);

  // Keyboard shortcut for Cmd+K command palette
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCommandOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Fetch Tenant Info & Subdomain Branding
  const fetchTenantInfo = useCallback(async () => {
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
        fetchTenantUsageService(),
        fetchTenantInfoService(),
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
    } catch {
      /* ignore */
    }
  }, [role]);

  useEffect(() => {
    fetchTenantInfo();
    const handleBranding = () => fetchTenantInfo();
    window.addEventListener('attendease:branding-updated', handleBranding);
    window.addEventListener('attendease:auth-changed', handleBranding);
    return () => {
      window.removeEventListener('attendease:branding-updated', handleBranding);
      window.removeEventListener('attendease:auth-changed', handleBranding);
    };
  }, [fetchTenantInfo]);

  // Sync avatar updates
  useEffect(() => {
    const handleAvatarUpdate = () => {
      setUserAvatar(localStorage.getItem('userAvatar') || null);
    };
    window.addEventListener('userAvatarUpdated', handleAvatarUpdate);

    const cachedAv = localStorage.getItem('userAvatar');
    if ((localStorage.getItem('userId') || localStorage.getItem('token')) && !cachedAv) {
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

  // Offline Sync Initializer
  useEffect(() => {
    initOfflineSync().catch(() => {});

    const unsubscribe = onSyncEvent((event) => {
      if (event.type === 'SYNC_COMPLETE' && event.syncedCount > 0) {
        if (typeof window !== 'undefined' && window.notifyToast) {
          window.notifyToast(
            `✅ Auto-synced ${event.syncedCount} offline attendance record(s) successfully!`,
            'success',
            4000
          );
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

  const handleCopyLoginLink = () => {
    if (!tenantSubdomain) return;
    navigator.clipboard?.writeText(`${window.location.origin}/login/${tenantSubdomain}`);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  const groups = roleNav[role] || [];
  const displayName = userName || localStorage.getItem('userName') || 'Account';
  const roleLabel = roleLabels[role] || role;

  return (
    <div className="min-h-screen bg-background flex flex-col lg:flex-row">
      <SkipLink targetId="main-content" />

      {/* Responsive Sidebar (Desktop Collapse & Mobile Drawer) */}
      <Sidebar
        role={role}
        collapsed={collapsed}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
        tenantName={tenantName}
        tenantLogo={tenantLogo}
        tenantSubdomain={tenantSubdomain}
        linkCopied={linkCopied}
        onCopyLoginLink={handleCopyLoginLink}
        groups={groups}
        planModules={planModules}
        isModuleActive={isModuleActive}
        moduleLabels={moduleLabels}
        can={can}
        isGroupCollapsed={isGroupCollapsed}
        onToggleGroup={toggleGroup}
        onLogout={handleLogout}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        <DemoBanner />
        <Topbar
          onMenuClick={() => setMobileOpen(true)}
          onCollapseClick={() => setCollapsed((prev) => !prev)}
          collapsed={collapsed}
          onCommandClick={() => setCommandOpen(true)}
          displayName={displayName}
          userAvatar={userAvatar}
          role={role}
          roleLabel={roleLabel}
          onLogout={handleLogout}
          groups={groups}
        />

        {/* Dynamic Page Content (with bottom padding on mobile for BottomNav) */}
        <main
          id="main-content"
          className="flex-1 px-4 sm:px-6 lg:px-8 py-6 w-full mx-auto pb-24 lg:pb-8 outline-none"
          tabIndex={-1}
        >
          {children}
        </main>

        {/* Mobile-Only Bottom Navigation */}
        <BottomNav
          role={role}
          groups={groups}
          planModules={planModules}
          isModuleActive={isModuleActive}
          moduleLabels={moduleLabels}
          can={can}
        />
      </div>

      {/* Accessible Command Palette (Cmd+K) */}
      <CommandPalette
        open={commandOpen}
        onClose={() => setCommandOpen(false)}
        groups={groups}
      />
    </div>
  );
};

export default AppShell;
