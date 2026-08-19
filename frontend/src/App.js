import React, { useState, useEffect, lazy, Suspense } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";
import Header from "./component/header";
import PlanGate from "./component/common/PlanGate";
import AppShell from "./component/common/AppShell";
import { onAuthError } from "./utils/api";
import { ThemeProvider } from "./contexts/ThemeContexts";
import { PermissionsProvider, usePermissions } from "./contexts/PermissionsContext";
import { ToastProvider } from "./contexts/ToastContext";
import ErrorBoundary from "./component/common/ErrorBoundary";
import { getPostLogoutPath } from "./utils/loginPath";

// Dynamic component imports for optimal code splitting
const NewLogin = lazy(() => import("./component/newLogin"));
const Register = lazy(() => import("./component/login"));
const Dashboard = lazy(() => import("./component/Dashboard"));
const Ticket = lazy(() => import("./component/add-tickets"));
const TeacherDashboard = lazy(() => import("./component/teacherDashboard"));
const AdminDashboard = lazy(() => import("./component/Admin/AdminDashboard"));
const MarkAttendance = lazy(() => import("./component/markAttendance"));
const Profile = lazy(() => import("./component/profile"));
const AttendanceOverview = lazy(() => import("./component/AttendanceTable"));
const AttendanceHistory = lazy(() => import("./component/AttendanceHistory"));
const UploadEnrollments = lazy(() => import("./component/Admin/UploadEnrollments"));
const ManageTeachers = lazy(() => import("./component/Admin/ManageTeachers"));
const ManageSubjects = lazy(() => import("./component/Admin/ManageSubjects"));
const AssignSubjects = lazy(() => import("./component/Admin/AssignSubjects"));
const SubjectList = lazy(() => import("./component/Subjects/SubjectsList"));
const StudentSubjects = lazy(() => import("./component/Subjects/StudentsSubjects"));
const TeacherSubjects = lazy(() => import("./component/Subjects/TeachersSubjects"));
const TeacherAlerts = lazy(() => import("./component/Teacher/TeacherAlerts"));
const LandingPage = lazy(() => import("./component/Landing/LandingPage"));
const TenantRegistration = lazy(() => import("./component/Landing/TenantRegistration"));
const OnboardingWizard = lazy(() => import("./component/Admin/OnboardingWizard"));
const TenantSettings = lazy(() => import("./component/Admin/TenantSettings"));
const SuperAdminDashboard = lazy(() => import("./component/SuperAdmin/SuperAdminDashboard"));
const SuperAdminMonitoring = lazy(() => import("./component/SuperAdmin/SuperAdminMonitoring"));
const TenantList = lazy(() => import("./component/SuperAdmin/TenantList"));
const TenantDetails = lazy(() => import("./component/SuperAdmin/TenantDetails"));
const SupportPanel = lazy(() => import("./component/Admin/SupportPanel"));
const SupportDashboard = lazy(() => import("./component/SuperAdmin/SupportDashboard"));
const PlanManager = lazy(() => import("./component/SuperAdmin/PlanManager"));
const RoleManager = lazy(() => import("./component/Admin/RoleManager"));
const ParentDashboard = lazy(() => import("./component/ParentDashboard"));
const TimetableManager = lazy(() => import("./component/Admin/TimetableManager"));
const TimetableView = lazy(() => import("./component/TimetableView"));
const FeeManager = lazy(() => import("./component/Admin/FeeManager"));
const FeePortal = lazy(() => import("./component/FeePortal"));
const ExamSchedule = lazy(() => import("./component/ExamSchedule"));
const GradeManager = lazy(() => import("./component/GradeManager"));
const ResultsView = lazy(() => import("./component/ResultsView"));
const ExamManager = lazy(() => import("./component/Admin/ExamManager"));
const ExamStructureConfig = lazy(() => import("./component/Admin/ExamStructureConfig"));
const Announcements = lazy(() => import("./component/Admin/Announcements"));
const StudentsManager = lazy(() => import("./component/Admin/StudentsManager"));
const ReportsManager = lazy(() => import("./component/Admin/ReportsManager"));
const AcademicStructure = lazy(() => import("./component/Admin/AcademicStructure"));
const ForgotPassword = lazy(() => import("./component/Auth/ForgotPassword"));
const ResetPassword = lazy(() => import("./component/Auth/ResetPassword"));

const PageLoader = () => (
  <div className="min-h-[60vh] flex items-center justify-center">
    <div className="flex flex-col items-center gap-3">
      <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      <p className="text-sm font-semibold text-ink-soft">Loading page...</p>
    </div>
  </div>
);
// Improved PrivateRoute component
const PrivateRoute = ({
  children,
  isAuthenticated,
  requiredRole,
  userRole,
}) => {
  if (!isAuthenticated) {
    return <Navigate to={getPostLogoutPath(userRole)} replace />;
  }

  // Check if user has required role (if specified)
  if (requiredRole && userRole !== requiredRole && !(requiredRole === 'admin' && userRole === 'super_admin')) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

// Public Route (redirects if already authenticated)
const PublicRoute = ({ children, isAuthenticated }) => {
  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }
  return children;
};

// Header shown only on public non-auth pages (hidden on the login screen)
const PublicHeader = ({ isAuthenticated, onLogout, role, userName }) => {
  const location = useLocation();
  if (isAuthenticated || location.pathname.startsWith("/login")) return null;
  return (
    <Header isAuthenticated={isAuthenticated} onLogout={onLogout} role={role} userName={userName} />
  );
};

// Wrapper component for role-based routing
const DashboardRouter = ({ role, userId, userName, userEmail }) => {  switch (role) {
    case "super_admin":
      return (
        <Navigate to="/super-admin/dashboard" replace />
      );
    case "admin":
      return (
        <AdminDashboard
          userId={userId}
          userName={userName}
          userEmail={userEmail}
          role={role}
        />
      );
    case "teacher":
      return (
        <TeacherDashboard
          userId={userId}
          userName={userName}
          userEmail={userEmail}
          role={role}
        />
      );
    case "student":
      return (
        <Dashboard
          userId={userId}
          userName={userName}
          userEmail={userEmail}
          role={role}
        />
      );
    case "parent":
      return <Navigate to="/parent/dashboard" replace />;
    default:
      return <Navigate to={getPostLogoutPath(role)} replace />;
  }
};

const App = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [role, setRole] = useState("");
  const [userId, setUserId] = useState(null);
  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Load user data from localStorage
    const token = localStorage.getItem("token");
    const userRole = localStorage.getItem("role");
    const storedUserId = localStorage.getItem("userId");
    const storedUserName = localStorage.getItem("userName");
    const storedUserEmail = localStorage.getItem("userEmail");

    if (token && userRole) {
      setIsAuthenticated(true);
      setRole(userRole);
      setUserId(storedUserId);
      setUserName(storedUserName || "");
      setUserEmail(storedUserEmail || "");
    }

    setLoading(false);
  }, []);

  // Listen for 401 token expiry → auto-logout
  useEffect(() => {
    const unsubAuthError = onAuthError(() => {
      setIsAuthenticated(false);
      setRole("");
      setUserId(null);
      setUserName("");
      setUserEmail("");
    });
    return unsubAuthError;
  }, []);

  const handleLogin = (token, role, userId, userName, userEmail) => {
    // Store all user data
    localStorage.setItem("token", token);
    localStorage.setItem("role", role);
    localStorage.setItem("userId", userId);
    localStorage.setItem("userName", userName);
    localStorage.setItem("userEmail", userEmail);

    // Update state
    setIsAuthenticated(true);
    setRole(role);
    setUserId(userId);
    setUserName(userName);
    setUserEmail(userEmail);

    // Signal theme/branding consumers to re-fetch for this tenant
    window.dispatchEvent(new CustomEvent("attendease:auth-changed"));
  };

  // Handle registration success
  const handleRegisterSuccess = () => {};

  const handleLogout = () => {
    const destination = getPostLogoutPath();

    // Clear all user data
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    localStorage.removeItem("userId");
    localStorage.removeItem("userName");
    localStorage.removeItem("userEmail");

    // Reset state
    setIsAuthenticated(false);
    setRole("");
    setUserId(null);
    setUserName("");
    setUserEmail("");

    // Signal theme/branding consumers to reset to defaults
    window.dispatchEvent(new CustomEvent("attendease:auth-changed"));

    // Navigate to the role-appropriate login page (subdomain link for non-admins)
    window.location.href = destination;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-blue-50">
        <div className="flex flex-col items-center">
          <div className="w-16 h-16 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin mb-4"></div>
          <div className="text-purple-700 font-semibold">Loading...</div>
        </div>
      </div>
    );
  }

  // App shell wrapper for all protected routes
  const Shell = ({ children }) => (
    <AppShell role={role} userName={userName} userId={userId} onLogout={handleLogout}>
      {children}
    </AppShell>
  );

  // Combined guard: auth + role/permission + app shell
  const Protected = ({ requiredRole, requiredPermission, children }) => {
    const { can, loading } = usePermissions();

    // Wait for custom permissions to resolve before gating, otherwise
    // permissioned teachers get bounced to /dashboard mid-load and never
    // see permission-gated pages like Exam Manager.
    if (loading) {
      return (
        <div className="min-h-[60vh] flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
            <p className="text-sm font-semibold text-ink-soft">Checking access...</p>
          </div>
        </div>
      );
    }

    const allowed =
      (!requiredRole && !requiredPermission) ||
      role === requiredRole ||
      (role === 'super_admin' && (requiredRole === 'admin' || !requiredRole)) ||
      (requiredPermission && can(requiredPermission));

    if (!allowed) {
      return <Navigate to={role ? "/dashboard" : getPostLogoutPath(role)} replace />;
    }

    return (
      <PrivateRoute isAuthenticated={isAuthenticated} requiredRole={requiredRole} userRole={role}>
        <Shell>{children}</Shell>
      </PrivateRoute>
    );
  };

  return (
    <ErrorBoundary>
    <ThemeProvider>
    <ToastProvider>
    <PermissionsProvider role={role}>
    <Router>
      <PublicHeader
        isAuthenticated={isAuthenticated}
        onLogout={handleLogout}
        role={role}
        userName={userName}
      />
      <Suspense fallback={<PageLoader />}>
        <Routes>
        {/* Landing Page - Public Route (No header) */}
        <Route
          path="/"
          element={
            isAuthenticated ? (
              <Navigate to="/dashboard" replace />
            ) : (
              <LandingPage />
            )
          }
        />

        {/* Login Route - Public only */}
        <Route
          path="/login"
          element={
            <PublicRoute isAuthenticated={isAuthenticated}>
              <NewLogin onLogin={handleLogin} />
            </PublicRoute>
          }
        />

        {/* Tenant-specific login link (unique endpoint per institution) */}
        <Route
          path="/login/:subdomain"
          element={
            <PublicRoute isAuthenticated={isAuthenticated}>
              <NewLogin onLogin={handleLogin} />
            </PublicRoute>
          }
        />

        {/* Forgot Password Route - Public only */}
        <Route
          path="/forgot-password"
          element={
            <PublicRoute isAuthenticated={isAuthenticated}>
              <ForgotPassword />
            </PublicRoute>
          }
        />

        {/* Reset Password Route - Public only */}
        <Route
          path="/reset-password"
          element={
            <PublicRoute isAuthenticated={isAuthenticated}>
              <ResetPassword />
            </PublicRoute>
          }
        />

        {/* Register Route - Public only */}
        <Route
          path="/register"
          element={
            <PublicRoute isAuthenticated={isAuthenticated}>
              <Register
                setIsRegistered={handleRegisterSuccess}
                onRegisterSuccess={handleRegisterSuccess}
              />
            </PublicRoute>
          }
        />
        <Route
          path="/register/tenant"
          element={
            <PublicRoute isAuthenticated={isAuthenticated}>
              <TenantRegistration />
            </PublicRoute>
          }
        />

        {/* Dashboard Route - Protected */}
        <Route
          path="/dashboard"
          element={
            <Protected>
              <DashboardRouter role={role} userId={userId} userName={userName} userEmail={userEmail} />
            </Protected>
          }
        />

        {/* Student Routes */}
        <Route
          path="/tickets"
          element={
            <Protected requiredRole="student">
              <Ticket />
            </Protected>
          }
        />
        <Route
          path="/student/subjects"
          element={
            <Protected requiredRole="student">
              <StudentSubjects userId={userId} userName={userName} userEmail={userEmail} />
            </Protected>
          }
        />

        {/* Teacher Routes */}
        <Route
          path="/attendance"
          element={
            <Protected requiredRole="teacher">
              <MarkAttendance />
            </Protected>
          }
        />
        <Route
          path="/attendance-overview"
          element={
            <Protected requiredRole="teacher">
              <AttendanceOverview />
            </Protected>
          }
        />
        <Route
          path="/teacher/subjects"
          element={
            <Protected requiredRole="teacher">
              <TeacherSubjects userId={userId} userName={userName} userEmail={userEmail} />
            </Protected>
          }
        />
        <Route
          path="/teacher/announcements"
          element={
            <Protected requiredRole="teacher" requiredPermission="alerts:create">
              <PlanGate requiredModule="alerts">
                <TeacherAlerts />
              </PlanGate>
            </Protected>
          }
        />

        {/* Admin Routes */}
        <Route
          path="/admin/upload-enrollments"
          element={
            <Protected requiredRole="admin">
              <UploadEnrollments />
            </Protected>
          }
        />
        {/* Admin Support — no requiredRole lock so expired tenants can still reach it */}
        <Route
          path="/admin/support"
          element={
            <Protected requiredRole="admin">
              <SupportPanel />
            </Protected>
          }
        />
        <Route
          path="/admin/manage-teachers"
          element={
            <Protected requiredRole="admin">
              <ManageTeachers />
            </Protected>
          }
        />
        <Route
          path="/admin/manage-subjects"
          element={
            <Protected requiredPermission="subjects:write">
              <ManageSubjects />
            </Protected>
          }
        />
        <Route
          path="/admin/assign-subjects"
          element={
            <Protected requiredRole="admin">
              <AssignSubjects />
            </Protected>
          }
        />
        <Route
          path="/onboarding"
          element={
            <Protected requiredRole="admin">
              <OnboardingWizard />
            </Protected>
          }
        />
        <Route
          path="/admin/settings"
          element={
            <Protected requiredRole="admin">
              <TenantSettings />
            </Protected>
          }
        />

        {/* Super Admin Routes */}
        <Route
          path="/super-admin/dashboard"
          element={
            <Protected requiredRole="super_admin">
              <SuperAdminDashboard
                role={role}
                userId={userId}
                userName={userName}
                userEmail={userEmail}
              />
            </Protected>
          }
        />
        <Route
          path="/super-admin/monitoring"
          element={
            <Protected requiredRole="super_admin">
              <SuperAdminMonitoring />
            </Protected>
          }
        />
        <Route
          path="/super-admin/tenants"
          element={
            <Protected requiredRole="super_admin">
              <TenantList />
            </Protected>
          }
        />
        <Route
          path="/super-admin/support"
          element={
            <Protected requiredRole="super_admin">
              <SupportDashboard />
            </Protected>
          }
        />
        <Route
          path="/super-admin/tenants/:tenantId"
          element={
            <Protected requiredRole="super_admin">
              <TenantDetails />
            </Protected>
          }
        />
        <Route
          path="/super-admin/plans"
          element={
            <Protected requiredRole="super_admin">
              <PlanManager />
            </Protected>
          }
        />
        <Route
          path="/super-admin/plan"
          element={
            <Protected requiredRole="super_admin">
              <PlanManager />
            </Protected>
          }
        />

        {/* Profile Route - Available to all authenticated users */}
        <Route
          path="/profile"
          element={
            <Protected>
              <Profile userId={userId} />
            </Protected>
          }
        />

        <Route
          path="/attendance-history"
          element={
            <Protected>
              <AttendanceHistory role={role} />
            </Protected>
          }
        />

        {/* Parent Portal Route */}
        <Route
          path="/parent/dashboard"
          element={
            <Protected requiredRole="parent">
              <PlanGate requiredModule="parentPortal">
                <ParentDashboard />
              </PlanGate>
            </Protected>
          }
        />

        {/* Timetable Routes */}
        <Route
          path="/admin/timetable"
          element={
            <Protected requiredPermission="timetable:write">
              <PlanGate requiredModule="timetable">
                <TimetableManager role={role} userId={userId} userName={userName} />
              </PlanGate>
            </Protected>
          }
        />
        <Route
          path="/timetable"
          element={
            <Protected>
              <PlanGate requiredModule="timetable">
                <TimetableView role={role} userId={userId} />
              </PlanGate>
            </Protected>
          }
        />

        {/* Admin Custom Roles Route */}
        <Route
          path="/admin/roles"
          element={
            <Protected requiredRole="admin">
              <PlanGate requiredModule="customRoles">
                <RoleManager />
              </PlanGate>
            </Protected>
          }
        />

        {/* Exam Routes */}
        <Route
          path="/exams"
          element={
            <Protected>
              <PlanGate requiredModule="examManagement">
                <ExamSchedule role={role} userId={userId} />
              </PlanGate>
            </Protected>
          }
        />
        <Route
          path="/admin/exams"
          element={
            <Protected requiredPermission="exam:create">
              <PlanGate requiredModule="examManagement">
                <ExamManager />
              </PlanGate>
            </Protected>
          }
        />
        <Route
          path="/admin/exam-structure"
          element={
            <Protected requiredPermission="exam:update">
              <PlanGate requiredModule="examManagement">
                <ExamStructureConfig />
              </PlanGate>
            </Protected>
          }
        />
        <Route
          path="/admin/announcements"
          element={
            <Protected requiredRole="admin">
              <PlanGate requiredModule="alerts">
                <Announcements />
              </PlanGate>
            </Protected>
          }
        />
        <Route
          path="/exams/grades"
          element={
            <Protected>
              <PlanGate requiredModule="examManagement">
                <GradeManager role={role} userId={userId} />
              </PlanGate>
            </Protected>
          }
        />
        <Route
          path="/exams/results"
          element={
            <Protected>
              <PlanGate requiredModule="examManagement">
                <ResultsView role={role} userId={userId} />
              </PlanGate>
            </Protected>
          }
        />

        {/* Fee Management Routes */}
        <Route
          path="/admin/fees"
          element={
            <Protected requiredPermission="fee:collect">
              <PlanGate requiredModule="financeManagement">
                <FeeManager />
              </PlanGate>
            </Protected>
          }
        />
        <Route
          path="/fees"
          element={
            <Protected>
              <PlanGate requiredModule="financeManagement">
                <FeePortal role={role} userId={userId} />
              </PlanGate>
            </Protected>
          }
        />

        {/* Subjects Route - Available to all authenticated users */}
        <Route
          path="/subjects"
          element={
            <Protected>
              <SubjectList role={role} userId={userId} userName={userName} userEmail={userEmail} />
            </Protected>
          }
        />

        {/* Students Management Route - Permission-gated */}
        <Route
          path="/students"
          element={
            <Protected requiredPermission="students:read">
              <StudentsManager role={role} userId={userId} />
            </Protected>
          }
        />

        {/* Academic Structure Route - Basic plan+ gated */}
        <Route
          path="/admin/academic-structure"
          element={
            <Protected requiredPermission="students:write">
              <PlanGate requiredModule="academicStructure">
                <AcademicStructure />
              </PlanGate>
            </Protected>
          }
        />

        {/* Reports Route - Permission-gated */}
        <Route
          path="/reports"
          element={
            <Protected requiredPermission="reports:view">
              <ReportsManager role={role} userId={userId} />
            </Protected>
          }
        />

        {/* 404 Route */}
        <Route
          path="*"
          element={
            <div className="min-h-screen flex items-center justify-center bg-background">
              <div className="text-center p-8">
                <div className="text-9xl font-bold text-primary mb-4 opacity-20">
                  404
                </div>
                <h1 className="text-3xl font-bold text-ink mb-4">
                  Page Not Found
                </h1>
                <p className="text-lg text-ink-soft mb-6">
                  The page you're looking for doesn't exist.
                </p>
                <div className="space-x-4">
                  <button
                    onClick={() => window.history.back()}
                    className="px-6 py-2 border border-line text-ink-soft rounded-lg hover:bg-background transition-colors duration-200"
                  >
                    Go Back
                  </button>
                  <button
                    onClick={() =>
                      (window.location.href = isAuthenticated
                        ? "/dashboard"
                        : "/login")
                    }
                    className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors duration-200"
                  >
                    {isAuthenticated ? "Go to Dashboard" : "Go to Login"}
                  </button>
                </div>
              </div>
            </div>
          }
        />
      </Routes>
      </Suspense>
    </Router>
    </PermissionsProvider>
    </ToastProvider>
    </ThemeProvider>
    </ErrorBoundary>
  );
};

export default App;
