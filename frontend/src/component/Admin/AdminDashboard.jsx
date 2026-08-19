// src/components/Admin/AdminDashboard.jsx
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../utils/api";
import { logError } from "../../utils/logger";
import {
  Users,
  BookOpen,
  GraduationCap,
  Upload,
  UserPlus,
  BookMarked,
  Grid,
  TrendingUp,
  Calendar,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Activity,
  ChevronRight,
  Layers,
  UserCog,
  RefreshCw,
  Building2,
  CreditCard,
  AlertTriangle,
  Search,
  DollarSign
} from "lucide-react";
import { useTheme } from '../../contexts/ThemeContexts';
import { motion } from 'framer-motion';
import Button from '../common/ui/Button';
import Card from '../common/ui/Card';
import Modal from '../common/ui/Modal';
import Table from '../common/ui/Table';
import Badge from '../common/ui/Badge';
import StatCard from '../common/ui/StatCard';
import EmptyState from '../common/ui/EmptyState';
import Skeleton from '../common/ui/Skeleton';

const cardItem = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 }
};

const AdminDashboard = ({ role, userId, userName, userEmail }) => {
  const navigate = useNavigate();
  const { colors } = useTheme();
  const [stats, setStats] = useState({
    totalTeachers: 0,
    totalSubjects: 0,
    totalEnrollments: 0,
    totalStudents: 0,
    activeSubjects: 0,
    pendingRegistrations: 0,
    totalSections: 0,
    recentActivities: [],
  });

  const [students, setStudents] = useState([]);
  const [showStudentsModal, setShowStudentsModal] = useState(false);
  const [studentFilter, setStudentFilter] = useState('all'); // all | registered | pending
  const [studentSearch, setStudentSearch] = useState('');

  const [tenantInfo, setTenantInfo] = useState(null);
  const [subscription, setSubscription] = useState(null);
  const [enrollmentStats, setEnrollmentStats] = useState({
    bySection: {},
    byStatus: { registered: 0, pending: 0 },
    recentEnrollments: [],
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const tenantId = localStorage.getItem("tenantId");

  useEffect(() => {
    const userRole = localStorage.getItem("role");
    if (userRole !== "admin") {
      setError("Admin access required");
      setLoading(false);
      return;
    }

    if (!localStorage.getItem("token")) {
      setError("Please login again");
      setLoading(false);
      return;
    }

    fetchAllStats();
    fetchTenantInfo();
    fetchSubscriptionInfo();
  }, []);

  const fetchTenantInfo = async () => {
    try {
      const response = await api.get('/auth/tenant-info');

      if (response.data.success) {
        setTenantInfo(response.data.data?.tenant);
      }
    } catch (error) {
      logError("Fetch Tenant Info", error);
    }
  };

  const fetchSubscriptionInfo = async () => {
    try {
      const response = await api.get('/billing/subscription');

      if (response.data.success) {
        setSubscription(response.data.data);
        const status = response.data.data?.subscription?.status || null;
        if (status) {
          localStorage.setItem('subscriptionStatus', status);
        }
      }
    } catch (error) {
      logError("Fetch Subscription", error);
    }
  };

  const fetchAllStats = async () => {
    try {
      setLoading(true);
      setError(null);

      const [teachersRes, subjectsRes, enrollmentsRes] = await Promise.all([
        api.get('/admin/teachers'),
        api.get('/admin/subjects'),
        api.get('/admin/enrollments?limit=1000'),
      ]);

      let teachers = [];
      if (Array.isArray(teachersRes.data)) {
        teachers = teachersRes.data;
      } else if (teachersRes.data?.data && Array.isArray(teachersRes.data.data)) {
        teachers = teachersRes.data.data;
      }

      let subjects = [];
      if (subjectsRes.data?.data && Array.isArray(subjectsRes.data.data)) {
        subjects = subjectsRes.data.data;
      } else if (Array.isArray(subjectsRes.data)) {
        subjects = subjectsRes.data;
      }

      let enrollments = [];
      if (enrollmentsRes.data?.data?.enrollments && Array.isArray(enrollmentsRes.data.data.enrollments)) {
        enrollments = enrollmentsRes.data.data.enrollments;
      } else if (enrollmentsRes.data?.enrollments && Array.isArray(enrollmentsRes.data.enrollments)) {
        enrollments = enrollmentsRes.data.enrollments;
      } else if (enrollmentsRes.data?.data && Array.isArray(enrollmentsRes.data.data)) {
        enrollments = enrollmentsRes.data.data;
      }

      const bySection = {};
      let registered = 0;
      let pending = 0;

      enrollments.forEach((en) => {
        bySection[en.section] = (bySection[en.section] || 0) + 1;
        if (en.isRegistered) {
          registered++;
        } else {
          pending++;
        }
      });

      const sections = [...new Set(enrollments.map((e) => e.section))];
      const recentEnrollments = enrollments
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 5);
      const activeSubjects = subjects?.filter((s) => s.isActive !== false).length;

      setStats({
        totalTeachers: teachers.length || 0,
        totalSubjects: subjects.length || 0,
        totalEnrollments: enrollments.length || 0,
        totalStudents: enrollments.length || 0,
        activeSubjects,
        pendingRegistrations: pending,
        totalSections: sections.length,
        recentActivities: generateRecentActivities(enrollments, subjects),
      });

      setEnrollmentStats({
        bySection,
        byStatus: { registered, pending },
        recentEnrollments,
      });

      setStudents(enrollments);
    } catch (err) {
      logError("Fetch Stats", err);
      if (err.response?.status === 403 && (err.response?.data?.subscriptionStatus === 'expired' || err.response?.data?.upgradeRequired)) {
        // Subscription expired — stats loading bypassed gracefully
      } else {
        setError(err.response?.data?.message || "Failed to load dashboard statistics");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchAllStats(), fetchTenantInfo(), fetchSubscriptionInfo()]);
    setRefreshing(false);
  };

  const generateRecentActivities = (enrollments, subjects) => {
    const activities = [];
    enrollments.slice(0, 3).forEach((en) => {
      activities.push({
        id: `enroll-${en._id}`,
        type: "enrollment",
        message: `${en.firstName} ${en.lastName} enrolled in section ${en.section}`,
        time: new Date(en.createdAt).toLocaleDateString(),
        icon: <GraduationCap className="w-4 h-4" />,
      });
    });
    return activities;
  };

  const getTrialDaysLeft = () => {
    if (subscription?.subscription?.status !== 'trial' || !subscription?.subscription?.trialEndsAt) return null;
    const trialEnd = new Date(subscription.subscription.trialEndsAt);
    const now = new Date();
    const daysLeft = Math.ceil((trialEnd - now) / (1000 * 60 * 60 * 24));
    return daysLeft > 0 ? daysLeft : 0;
  };

  const trialDaysLeft = getTrialDaysLeft();
  const isTrial = subscription?.subscription?.status === 'trial';
  const isExpired = subscription?.subscription?.status === 'expired';

  const filteredStudents = students.filter(student => {
    if (studentFilter === 'registered' && !student.isRegistered) return false;
    if (studentFilter === 'pending' && student.isRegistered) return false;

    const searchLower = studentSearch.toLowerCase();
    const fullName = `${student.firstName} ${student.lastName}`.toLowerCase();
    const email = (student.email || '').toLowerCase();
    const enrollNum = (student.enrollmentNumber || '').toLowerCase();

    return fullName.includes(searchLower) || email.includes(searchLower) || enrollNum.includes(searchLower);
  });

  // ✅ Get theme-based color classes
  const themeColors = {
    primary: colors.primary || '#6366f1',
    secondary: colors.secondary || '#8b5cf6',
    light: colors.primary ? `${colors.primary}20` : '#eef2ff',
    lighter: colors.primary ? `${colors.primary}10` : '#f5f3ff',
  };

  const quickActions = [
    {
      title: "Upload Enrollments",
      description: "Bulk upload student data via CSV",
      icon: <Upload className="w-6 h-6" />,
      path: "/admin/upload-enrollments",
      color: themeColors.primary,
      lightColor: themeColors.light,
      textColor: "text-primary",
      stats: "Process batch enrollments",
    },
    {
      title: "Manage Teachers",
      description: "Add or update teacher profiles",
      icon: <UserCog className="w-6 h-6" />,
      path: "/admin/manage-teachers",
      color: themeColors.secondary,
      lightColor: themeColors.lighter,
      textColor: "text-secondary",
      stats: `${stats.totalTeachers} active`,
    },
    {
      title: "Manage Subjects",
      description: "Create and organize subjects",
      icon: <BookMarked className="w-6 h-6" />,
      path: "/admin/manage-subjects",
      color: "#8b5cf6",
      lightColor: "#f5f3ff",
      textColor: "text-secondary",
      stats: `${stats.totalSubjects} total`,
    },
    {
      title: "Assign Subjects",
      description: "Map subjects to teachers & sections",
      icon: <Grid className="w-6 h-6" />,
      path: "/admin/assign-subjects",
      color: "#f59e0b",
      lightColor: "#fffbeb",
      textColor: "text-amber-600",
      stats: `${stats.totalSections} sections`,
    },
    {
      title: "Fee Management",
      description: "Manage fees, collect payments",
      icon: <DollarSign className="w-6 h-6" />,
      path: "/admin/fees",
      color: "#16a34a",
      lightColor: "#f0fdf4",
      textColor: "text-green-600",
      stats: "Pending & overdue",
    },
  ];

  // Loading Skeleton
  if (loading && !refreshing) {
    return (
      <div className="space-y-6">
        <Card padding="lg">
          <Skeleton rows={2} />
        </Card>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-background rounded-xl animate-pulse"></div>
                <div className="w-16 h-6 bg-background rounded-full animate-pulse"></div>
              </div>
              <div className="h-4 w-24 bg-background rounded animate-pulse mb-2"></div>
              <div className="h-8 w-32 bg-background rounded animate-pulse"></div>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // Error UI
  if (error) {
    return (
      <div className="flex items-center justify-center p-6 min-h-[60vh]">
        <Card padding="lg" className="max-w-md w-full text-center">
          <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-10 h-10 text-red-500" />
          </div>
          <h2 className="text-2xl font-bold text-ink mb-2">Access Denied</h2>
          <p className="text-ink-soft mb-6">{error}</p>
          <Button onClick={() => navigate("/dashboard")}>
            Go to Dashboard
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome Banner with Tenant Info - Dynamic Theme */}
      <div
        className="rounded-2xl p-6 text-white"
        style={{
          background: `linear-gradient(135deg, ${themeColors.primary}, ${themeColors.secondary})`
        }}
      >
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold mb-2">
              Welcome, {userName || "Admin"}!
            </h1>
            <p className="text-white/80">
              {tenantInfo?.name || "Your Institution"} • Admin Dashboard
            </p>
            {tenantInfo?.subdomain && (
              <p className="text-white/60 text-sm mt-1">
                Subdomain: {tenantInfo.subdomain}.yourapp.com
              </p>
            )}
          </div>
          <Button
            variant="ghost"
            onClick={handleRefresh}
            disabled={refreshing}
            className="!bg-white/20 !text-white hover:!bg-white/30 border border-white/30"
            aria-label="Refresh data"
          >
            <RefreshCw className={`w-5 h-5 ${refreshing ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* Subscription Alert */}
      {isTrial && trialDaysLeft <= 7 && (
        <div className={`p-4 rounded-xl flex items-center justify-between gap-4 ${trialDaysLeft <= 3 ? "bg-red-50 border border-red-200" : "bg-amber-50 border border-amber-200"
          }`}>
          <div className="flex items-center gap-3">
            <AlertTriangle className={`w-5 h-5 ${trialDaysLeft <= 3 ? "text-red-500" : "text-amber-500"}`} />
            <div>
              <p className={`font-medium ${trialDaysLeft <= 3 ? "text-red-700" : "text-amber-700"}`}>
                {trialDaysLeft === 0 ? "Your trial has expired!" : `${trialDaysLeft} days remaining in your trial`}
              </p>
              <p className="text-sm text-ink-soft">
                {trialDaysLeft === 0
                  ? "Please upgrade to continue using the platform."
                  : "Upgrade now to unlock more features and higher limits."}
              </p>
            </div>
          </div>
          {trialDaysLeft <= 3 ? (
            <Button
              variant="danger"
              onClick={() => navigate("/admin/settings")}
            >
              Upgrade Now
            </Button>
          ) : (
            <Button
              className="!bg-amber-600 hover:!bg-amber-700"
              onClick={() => navigate("/admin/settings")}
            >
              Upgrade Now
            </Button>
          )}
        </div>
      )}

      {isExpired && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <XCircle className="w-5 h-5 text-red-500" />
              <div>
                <p className="font-medium text-red-700">Your subscription has expired!</p>
                <p className="text-sm text-ink-soft">Please upgrade to continue using the platform.</p>
              </div>
            </div>
            <Button
              variant="danger"
              onClick={() => navigate("/pricing")}
            >
              Upgrade Now
            </Button>
          </div>
        </div>
      )}

      {/* Key Metrics Grid */}
      <motion.div
        initial="hidden"
        animate="visible"
        variants={{
          hidden: { opacity: 0 },
          visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
        }}
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
      >
        <motion.div
          variants={cardItem}
          className="cursor-pointer"
          onClick={() => {
            setStudentFilter('all');
            setShowStudentsModal(true);
          }}
        >
          <StatCard
            label="Total Students"
            value={stats.totalStudents.toLocaleString()}
            icon={Users}
            tone="primary"
            subtitle={`${enrollmentStats.byStatus.registered} registered`}
            trend="12%"
            trendDirection="up"
          />
        </motion.div>
        <motion.div variants={cardItem}>
          <StatCard
            label="Total Teachers"
            value={stats.totalTeachers.toLocaleString()}
            icon={UserCog}
            tone="success"
            subtitle={`${stats.totalTeachers} active`}
            trend="5%"
            trendDirection="up"
          />
        </motion.div>
        <motion.div variants={cardItem}>
          <StatCard
            label="Total Subjects"
            value={stats.totalSubjects.toLocaleString()}
            icon={BookOpen}
            tone="secondary"
            subtitle={`${stats.activeSubjects} active`}
            trend="8%"
            trendDirection="up"
          />
        </motion.div>
        <motion.div
          variants={cardItem}
          className="cursor-pointer"
          onClick={() => {
            setStudentFilter('pending');
            setShowStudentsModal(true);
          }}
        >
          <StatCard
            label="Pending Registrations"
            value={enrollmentStats.byStatus.pending.toLocaleString()}
            icon={Clock}
            tone="warning"
            subtitle="Awaiting completion"
            trend="3%"
            trendDirection="down"
          />
        </motion.div>
      </motion.div>

      {/* Quick Actions Grid */}
      <div>
        <h2 className="text-lg font-bold text-ink mb-5 flex items-center gap-2">
          <Activity className="w-5 h-5 text-ink-faint" />
          Quick Actions
        </h2>
        <motion.div
          initial="hidden"
          animate="visible"
          variants={{
            hidden: { opacity: 0 },
            visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
          }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
        >
          {quickActions.map((action, index) => (
            <QuickActionCard
              key={index}
              {...action}
              onClick={() => navigate(action.path)}
              themeColor={themeColors.primary}
            />
          ))}
        </motion.div>
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Section Distribution */}
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-ink flex items-center gap-2">
                <Layers className="w-5 h-5" style={{ color: themeColors.primary }} />
                Enrollment by Section
              </h3>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Object.entries(enrollmentStats.bySection).map(([section, count]) => (
                <div
                  key={section}
                  className="bg-background rounded-xl p-4"
                  style={{ borderLeft: `4px solid ${themeColors.primary}` }}
                >
                  <p className="text-sm text-ink-soft mb-1">Section {section}</p>
                  <p className="text-2xl font-bold text-ink">{count}</p>
                  <p className="text-xs text-ink-faint">students</p>
                </div>
              ))}
            </div>
          </Card>

          {/* Recent Enrollments */}
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-ink flex items-center gap-2">
                <GraduationCap className="w-5 h-5" style={{ color: themeColors.primary }} />
                Recent Enrollments
              </h3>
            </div>
            <div className="space-y-3">
              {enrollmentStats.recentEnrollments.map((enrollment, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 hover:bg-background rounded-xl transition">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center"
                      style={{
                        backgroundColor: `${themeColors.primary}20`,
                        color: themeColors.primary
                      }}
                    >
                      <span className="font-semibold">
                        {enrollment.firstName?.[0]}{enrollment.lastName?.[0]}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium text-ink">
                        {enrollment.firstName} {enrollment.lastName}
                      </p>
                      <p className="text-sm text-ink-soft">
                        {enrollment.enrollmentNumber} • Section {enrollment.section}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge tone={enrollment.isRegistered ? 'success' : 'warning'}>
                      {enrollment.isRegistered ? "Registered" : "Pending"}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Plan & Usage */}
          <Card>
            <h3 className="text-lg font-semibold text-ink mb-4 flex items-center gap-2">
              <CreditCard className="w-5 h-5" style={{ color: themeColors.primary }} />
              Current Plan
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-ink-soft">Plan</span>
                <span className="font-semibold capitalize text-ink">{subscription?.subscription?.plan || "Free"}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-ink-soft">Status</span>
                <Badge tone={subscription?.subscription?.status === 'active' ? 'success' :
                  subscription?.subscription?.status === 'trial' ? 'warning' : 'danger'}>
                  {subscription?.subscription?.status || "Active"}
                </Badge>
              </div>
              {isTrial && (
                <div className="flex justify-between items-center">
                  <span className="text-ink-soft">Trial Ends</span>
                  <span className="text-sm font-medium text-ink">
                    {new Date(subscription?.subscription?.trialEndsAt).toLocaleDateString()}
                  </span>
                </div>
              )}
              <Button
                className="w-full mt-3 text-sm"
                style={{
                  background: `linear-gradient(135deg, ${themeColors.primary}, ${themeColors.secondary})`
                }}
                onClick={() => navigate("/admin/settings")}
              >
                Manage Subscription
              </Button>
            </div>
          </Card>

          {/* Registration Status */}
          <Card>
            <h3 className="text-lg font-semibold text-ink mb-4 flex items-center gap-2">
              <Activity className="w-5 h-5" style={{ color: themeColors.primary }} />
              Registration Status
            </h3>
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-ink-soft">Registered</span>
                  <span className="font-medium text-ink">{enrollmentStats.byStatus.registered}</span>
                </div>
                <div className="w-full bg-line rounded-full h-2">
                  <div
                    className="h-2 rounded-full"
                    style={{
                      width: `${(enrollmentStats.byStatus.registered / stats.totalStudents) * 100 || 0}%`,
                      backgroundColor: themeColors.primary
                    }}
                  />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-ink-soft">Pending</span>
                  <span className="font-medium text-ink">{enrollmentStats.byStatus.pending}</span>
                </div>
                <div className="w-full bg-line rounded-full h-2">
                  <div
                    className="h-2 rounded-full"
                    style={{
                      width: `${(enrollmentStats.byStatus.pending / stats.totalStudents) * 100 || 0}%`,
                      backgroundColor: themeColors.secondary
                    }}
                  />
                </div>
              </div>
            </div>
          </Card>

          {/* Recent Activity */}
          <Card>
            <h3 className="text-lg font-semibold text-ink mb-4 flex items-center gap-2">
              <Activity className="w-5 h-5" style={{ color: themeColors.primary }} />
              Recent Activity
            </h3>
            <div className="space-y-3">
              {stats.recentActivities.length > 0 ? (
                stats.recentActivities.map((activity) => (
                  <div key={activity.id} className="flex items-start gap-3 p-2 hover:bg-background rounded-lg transition">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{
                        backgroundColor: `${themeColors.primary}20`,
                        color: themeColors.primary
                      }}
                    >
                      {activity.icon}
                    </div>
                    <div>
                      <p className="text-sm text-ink">{activity.message}</p>
                      <p className="text-xs text-ink-faint">{activity.time}</p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-ink-soft text-sm text-center py-4">No recent activities</p>
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* Student List Modal */}
      <Modal
        isOpen={showStudentsModal}
        onClose={() => {
          setShowStudentsModal(false);
          setStudentSearch('');
        }}
        title="Student Enrollment List"
        subtitle="Manage and view all enrolled student registration statuses."
        size="xl"
        footer={
          <div className="flex items-center justify-between w-full text-xs text-ink-faint">
            <span>Showing {filteredStudents.length} of {students.length} students</span>
            <Button
              variant="outline"
              onClick={() => {
                setShowStudentsModal(false);
                setStudentSearch('');
              }}
            >
              Close
            </Button>
          </div>
        }
      >
        {/* Modal Filters & Search */}
        <div className="flex flex-col sm:flex-row gap-4 items-center justify-between mb-4">
          {/* Search Input */}
          <div className="relative w-full sm:w-80">
            <input
              type="text"
              value={studentSearch}
              onChange={(e) => setStudentSearch(e.target.value)}
              placeholder="Search by name, email, roll number..."
              className="w-full pl-10 pr-4 py-2 border border-line bg-surface text-ink placeholder:text-ink-faint rounded-xl text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all"
            />
            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint">
              <Search className="w-4 h-4" />
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="flex gap-1.5 bg-surface p-1 rounded-xl border border-line shadow-sm w-full sm:w-auto justify-center">
            {[
              { id: 'all', label: 'All Students' },
              { id: 'registered', label: 'Registered' },
              { id: 'pending', label: 'Pending' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setStudentFilter(tab.id)}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${studentFilter === tab.id
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-ink-soft hover:bg-background'
                  }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Student Table */}
        <div className="max-h-[50vh] overflow-y-auto">
          {filteredStudents.length === 0 ? (
            <EmptyState
              title="No students found"
              description="Try adjusting your filters or search keywords."
              icon={Users}
            />
          ) : (
            <Table
              columns={[
                { header: 'Name', cell: (row) => <span className="font-semibold text-ink">{row.firstName} {row.lastName}</span> },
                { header: 'Enrollment No', cell: (row) => <span className="text-ink-soft font-mono text-xs">{row.enrollmentNumber}</span> },
                { header: 'Email', cell: (row) => <span className="text-ink-soft">{row.email}</span> },
                { header: 'Section', cell: (row) => <span className="font-medium text-ink">Section {row.section}</span> },
                {
                  header: 'Status',
                  cell: (row) => row.isRegistered ? (
                    <Badge tone="success" dot><CheckCircle className="w-3.5 h-3.5" /> Registered</Badge>
                  ) : (
                    <Badge tone="warning" dot><Clock className="w-3.5 h-3.5" /> Pending</Badge>
                  )
                },
              ]}
              data={filteredStudents}
              rowKey="_id"
            />
          )}
        </div>
      </Modal>
    </div>
  );
};

// ===== Quick Action Card Component =====
const QuickActionCard = ({ title, description, icon, lightColor, textColor, stats, onClick, themeColor }) => {
  return (
    <motion.div variants={cardItem}>
      <Card
        hoverable
        onClick={onClick}
        className="cursor-pointer group h-full"
      >
        <div className="flex items-start justify-between mb-4">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform duration-300"
            style={{ backgroundColor: `${themeColor || '#6366f1'}15`, color: themeColor || '#6366f1' }}
          >
            <div>{icon}</div>
          </div>
          <div className="p-1.5 bg-background rounded-lg group-hover:bg-line/60 transition-colors">
            <ChevronRight className="w-4 h-4 text-ink-faint group-hover:text-ink transition-colors" />
          </div>
        </div>
        <div>
          <h3 className="font-bold text-ink mb-1 tracking-tight">{title}</h3>
          <p className="text-sm font-medium text-ink-soft mb-4">{description}</p>
          <p className="text-xs font-bold text-ink-faint uppercase tracking-wider">{stats}</p>
        </div>
      </Card>
    </motion.div>
  );
};

export default AdminDashboard;
