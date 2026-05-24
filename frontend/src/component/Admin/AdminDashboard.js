import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
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
  Settings,
  BarChart3,
  Download,
  Filter,
  Search,
  ChevronRight,
  Layers,
  School,
  UserCog,
  FileText,
  Activity,
  DollarSign,
  PieChart,
  ArrowUpRight,
  ArrowDownRight,
  MoreVertical,
  RefreshCw,
} from "lucide-react";

const AdminDashboard = ({ role }) => {
  const navigate = useNavigate();
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

  const [enrollmentStats, setEnrollmentStats] = useState({
    bySection: {},
    byStatus: { registered: 0, pending: 0 },
    recentEnrollments: [],
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [timeRange, setTimeRange] = useState("week");

  const API_URL = process.env.REACT_APP_API_URL;
  const token = localStorage.getItem("token");

  useEffect(() => {
    if (role !== "admin") {
      setError("Admin access required");
      setLoading(false);
      return;
    }

    if (!token) {
      setError("Please login again");
      setLoading(false);
      return;
    }

    fetchAllStats();
  }, [role, timeRange]);

  const fetchAllStats = async () => {
    try {
      setLoading(true);
      setError(null);

      const config = {
        headers: { Authorization: `Bearer ${token}` },
      };

      // Fetch all data in parallel
      const [teachersRes, subjectsRes, enrollmentsRes] = await Promise.all([
        axios.get(`${API_URL}/admin/teachers`, config),
        axios.get(`${API_URL}/admin/subjects`, config),
        axios.get(`${API_URL}/admin/enrollments?limit=1000`, config),
      ]);

      let teachers = [];
      if (Array.isArray(teachersRes.data)) {
        teachers = teachersRes.data;
      } else if (
        teachersRes.data?.data &&
        Array.isArray(teachersRes.data.data)
      ) {
        teachers = teachersRes.data.data;
      } else if (
        teachersRes.data?.teachers &&
        Array.isArray(teachersRes.data.teachers)
      ) {
        teachers = teachersRes.data.teachers;
      }

      // Handle subjects data - FIXED based on your response
      let subjects = [];
      if (subjectsRes.data?.data && Array.isArray(subjectsRes.data.data)) {
        subjects = subjectsRes.data.data; // Your subjects are in data array
      } else if (Array.isArray(subjectsRes.data)) {
        subjects = subjectsRes.data;
      } else if (
        subjectsRes.data?.subjects &&
        Array.isArray(subjectsRes.data.subjects)
      ) {
        subjects = subjectsRes.data.subjects;
      }

      // Handle enrollments data
      let enrollments = [];
      if (
        enrollmentsRes.data?.data?.enrollments &&
        Array.isArray(enrollmentsRes.data.data.enrollments)
      ) {
        enrollments = enrollmentsRes.data.data.enrollments;
      } else if (
        enrollmentsRes.data?.enrollments &&
        Array.isArray(enrollmentsRes.data.enrollments)
      ) {
        enrollments = enrollmentsRes.data.enrollments;
      } else if (
        enrollmentsRes.data?.data &&
        Array.isArray(enrollmentsRes.data.data)
      ) {
        enrollments = enrollmentsRes.data.data;
      } else if (Array.isArray(enrollmentsRes.data)) {
        enrollments = enrollmentsRes.data;
      }

      // Calculate enrollment stats
      const bySection = {};
      let registered = 0;
      let pending = 0;

      enrollments.forEach((en) => {
        // Count by section
        bySection[en.section] = (bySection[en.section] || 0) + 1;

        // Count by registration status
        if (en.isRegistered) {
          registered++;
        } else {
          pending++;
        }
      });

      // Get unique sections
      const sections = [...new Set(enrollments.map((e) => e.section))];

      // Get recent enrollments (last 5)
      const recentEnrollments = enrollments
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 5);

      // Calculate active subjects
      const activeSubjects = subjects?.filter(
        (s) => s.isActive !== false,
      ).length;

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
    } catch (err) {
      console.error("Error fetching stats:", err);
      setError(
        err.response?.data?.message || "Failed to load dashboard statistics",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchAllStats();
    setRefreshing(false);
  };

  const generateRecentActivities = (enrollments, subjects) => {
    const activities = [];

    // Add recent enrollments
    enrollments.slice(0, 3).forEach((en) => {
      activities.push({
        id: `enroll-${en._id}`,
        type: "enrollment",
        message: `${en.firstName} ${en.lastName} enrolled in section ${en.section}`,
        time: new Date(en.createdAt).toLocaleDateString(),
        icon: <GraduationCap className="w-4 h-4" />,
      });
    });

    // Add subject assignments (if you have that data)
    // This is placeholder - you'd need to fetch assignments separately

    return activities;
  };

  const quickActions = [
    {
      title: "Upload Enrollments",
      description: "Bulk upload student data via CSV",
      icon: <Upload className="w-6 h-6" />,
      path: "/admin/upload-enrollments",
      color: "bg-blue-500",
      lightColor: "bg-blue-50",
      textColor: "text-blue-600",
      stats: "Process batch enrollments",
    },
    {
      title: "Manage Teachers",
      description: "Add or update teacher profiles",
      icon: <UserCog className="w-6 h-6" />,
      path: "/admin/manage-teachers",
      color: "bg-green-500",
      lightColor: "bg-green-50",
      textColor: "text-green-600",
      stats: `${stats.totalTeachers} active`,
    },
    {
      title: "Manage Subjects",
      description: "Create and organize subjects",
      icon: <BookMarked className="w-6 h-6" />,
      path: "/admin/manage-subjects",
      color: "bg-purple-500",
      lightColor: "bg-purple-50",
      textColor: "text-purple-600",
      stats: `${stats.totalSubjects} total`,
    },
    {
      title: "Assign Subjects",
      description: "Map subjects to teachers & sections",
      icon: <Grid className="w-6 h-6" />,
      path: "/admin/assign-subjects",
      color: "bg-orange-500",
      lightColor: "bg-orange-50",
      textColor: "text-orange-600",
      stats: `${stats.totalSections} sections`,
    },
  ];

  // ===== Loading Skeleton =====
  if (loading && !refreshing) {
    return (
      <div className="min-h-screen bg-gray-50 p-6 lg:p-8">
        <div className="max-w-7xl mx-auto">
          {/* Header Skeleton */}
          <div className="mb-8">
            <div className="h-8 w-64 bg-gray-200 rounded-lg animate-pulse mb-2"></div>
            <div className="h-4 w-96 bg-gray-200 rounded-lg animate-pulse"></div>
          </div>

          {/* Stats Grid Skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-white rounded-2xl p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 bg-gray-200 rounded-xl animate-pulse"></div>
                  <div className="w-16 h-6 bg-gray-200 rounded-full animate-pulse"></div>
                </div>
                <div className="h-4 w-24 bg-gray-200 rounded animate-pulse mb-2"></div>
                <div className="h-8 w-32 bg-gray-200 rounded animate-pulse"></div>
              </div>
            ))}
          </div>

          {/* Quick Actions Skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-white rounded-2xl p-6 shadow-sm">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 bg-gray-200 rounded-xl animate-pulse"></div>
                  <div className="flex-1">
                    <div className="h-5 w-32 bg-gray-200 rounded animate-pulse mb-2"></div>
                    <div className="h-4 w-24 bg-gray-200 rounded animate-pulse"></div>
                  </div>
                </div>
                <div className="h-4 w-full bg-gray-200 rounded animate-pulse"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ===== Error UI =====
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-10 h-10 text-red-500" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">
            Oops! Something went wrong
          </h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <div className="flex gap-4 justify-center">
            <button
              onClick={handleRefresh}
              className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Try Again
            </button>
            <button
              onClick={() => navigate("/login")}
              className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
            >
              Go to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Navigation Bar */}
      {/* <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">
                Admin Dashboard
              </h1>
              <p className="text-sm text-gray-500">
                Manage and monitor your educational system
              </p>
            </div>
            <div className="flex items-center gap-4">
              Time Range Selector
              <select
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              >
                <option value="day">Last 24 Hours</option>
                <option value="week">Last Week</option>
                <option value="month">Last Month</option>
                <option value="year">Last Year</option>
              </select>

              Refresh Button
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className={`p-2 hover:bg-gray-100 rounded-lg transition ${
                  refreshing ? "animate-spin" : ""
                }`}
              >
                <RefreshCw className="w-5 h-5 text-gray-600" />
              </button>
            </div>
          </div>
        </div>
      </div> */}

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Key Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <MetricCard
            title="Total Students"
            value={stats.totalStudents}
            change={+12}
            icon={<Users className="w-6 h-6" />}
            color="blue"
            subtitle={`${enrollmentStats.byStatus.registered} registered`}
          />
          <MetricCard
            title="Total Teachers"
            value={stats.totalTeachers}
            change={+5}
            icon={<UserCog className="w-6 h-6" />}
            color="green"
            subtitle={`${stats.totalTeachers} active`}
          />
          <MetricCard
            title="Total Subjects"
            value={stats.totalSubjects}
            change={+8}
            icon={<BookOpen className="w-6 h-6" />}
            color="purple"
            subtitle={`${stats.activeSubjects} active`}
          />
          <MetricCard
            title="Pending Registrations"
            value={enrollmentStats.byStatus.pending}
            change={-3}
            icon={<Clock className="w-6 h-6" />}
            color="orange"
            subtitle="Awaiting completion"
          />
        </div>

        {/* Quick Actions Grid */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Activity className="w-5 h-5 text-gray-500" />
            Quick Actions
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {quickActions.map((action, index) => (
              <QuickActionCard
                key={index}
                {...action}
                onClick={() => navigate(action.path)}
              />
            ))}
          </div>
        </div>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Enrollment Overview */}
          <div className="lg:col-span-2 space-y-6">
            {/* Section Distribution */}
            <div className="bg-white rounded-2xl shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                  <Layers className="w-5 h-5 text-indigo-500" />
                  Enrollment by Section
                </h3>
                <button className="text-sm text-indigo-600 hover:text-indigo-700 font-medium">
                  View All
                </button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {Object.entries(enrollmentStats.bySection).map(
                  ([section, count]) => (
                    <div key={section} className="bg-gray-50 rounded-xl p-4">
                      <p className="text-sm text-gray-500 mb-1">
                        Section {section}
                      </p>
                      <p className="text-2xl font-bold text-gray-800">
                        {count}
                      </p>
                      <p className="text-xs text-gray-400">students</p>
                    </div>
                  ),
                )}
              </div>
            </div>

            {/* Recent Enrollments */}
            <div className="bg-white rounded-2xl shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                  <GraduationCap className="w-5 h-5 text-indigo-500" />
                  Recent Enrollments
                </h3>
                <button className="text-sm text-indigo-600 hover:text-indigo-700 font-medium">
                  View All
                </button>
              </div>
              <div className="space-y-3">
                {enrollmentStats.recentEnrollments.map((enrollment, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-xl transition"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center">
                        <span className="text-indigo-600 font-semibold">
                          {enrollment.firstName?.[0]}
                          {enrollment.lastName?.[0]}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium text-gray-800">
                          {enrollment.firstName} {enrollment.lastName}
                        </p>
                        <p className="text-sm text-gray-500">
                          {enrollment.enrollmentNumber} • Section{" "}
                          {enrollment.section}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span
                        className={`text-xs px-2 py-1 rounded-full ${
                          enrollment.isRegistered
                            ? "bg-green-100 text-green-700"
                            : "bg-yellow-100 text-yellow-700"
                        }`}
                      >
                        {enrollment.isRegistered ? "Registered" : "Pending"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column - Activity & Insights */}
          <div className="space-y-6">
            {/* Registration Status */}
            <div className="bg-white rounded-2xl shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <PieChart className="w-5 h-5 text-indigo-500" />
                Registration Status
              </h3>
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-gray-600">Registered</span>
                    <span className="font-medium text-gray-800">
                      {enrollmentStats.byStatus.registered}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-green-500 h-2 rounded-full"
                      style={{
                        width: `${(enrollmentStats.byStatus.registered / stats.totalStudents) * 100 || 0}%`,
                      }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-gray-600">Pending</span>
                    <span className="font-medium text-gray-800">
                      {enrollmentStats.byStatus.pending}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-yellow-500 h-2 rounded-full"
                      style={{
                        width: `${(enrollmentStats.byStatus.pending / stats.totalStudents) * 100 || 0}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Recent Activity */}
            <div className="bg-white rounded-2xl shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <Activity className="w-5 h-5 text-indigo-500" />
                Recent Activity
              </h3>
              <div className="space-y-3">
                {stats.recentActivities.map((activity) => (
                  <div
                    key={activity.id}
                    className="flex items-start gap-3 p-2 hover:bg-gray-50 rounded-lg transition"
                  >
                    <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center flex-shrink-0">
                      {activity.icon}
                    </div>
                    <div>
                      <p className="text-sm text-gray-800">
                        {activity.message}
                      </p>
                      <p className="text-xs text-gray-400">{activity.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* System Health */}
            <div className="bg-white rounded-2xl shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <Activity className="w-5 h-5 text-indigo-500" />
                System Health
              </h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">API Status</span>
                  <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded-full">
                    Operational
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Database</span>
                  <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded-full">
                    Connected
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Last Backup</span>
                  <span className="text-sm text-gray-800">2 hours ago</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ===== Metric Card Component =====
const MetricCard = ({ title, value, change, icon, color, subtitle }) => {
  const isPositive = change > 0;

  const colorClasses = {
    blue: {
      bg: "bg-blue-50",
      text: "text-blue-600",
      icon: "text-blue-600",
    },
    green: {
      bg: "bg-green-50",
      text: "text-green-600",
      icon: "text-green-600",
    },
    purple: {
      bg: "bg-purple-50",
      text: "text-purple-600",
      icon: "text-purple-600",
    },
    orange: {
      bg: "bg-orange-50",
      text: "text-orange-600",
      icon: "text-orange-600",
    },
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm p-6 hover:shadow-md transition">
      <div className="flex items-center justify-between mb-4">
        <div
          className={`w-12 h-12 ${colorClasses[color].bg} rounded-xl flex items-center justify-center`}
        >
          <div className={colorClasses[color].icon}>{icon}</div>
        </div>
        <span
          className={`flex items-center gap-1 text-sm ${
            isPositive ? "text-green-600" : "text-red-600"
          }`}
        >
          {isPositive ? (
            <ArrowUpRight className="w-4 h-4" />
          ) : (
            <ArrowDownRight className="w-4 h-4" />
          )}
          {Math.abs(change)}%
        </span>
      </div>
      <p className="text-sm text-gray-500 mb-1">{title}</p>
      <p className="text-2xl font-bold text-gray-800 mb-1">
        {value.toLocaleString()}
      </p>
      <p className="text-xs text-gray-400">{subtitle}</p>
    </div>
  );
};

// ===== Quick Action Card Component =====
const QuickActionCard = ({
  title,
  description,
  icon,
  path,
  color,
  lightColor,
  textColor,
  stats,
  onClick,
}) => {
  return (
    <div
      onClick={onClick}
      className="bg-white rounded-2xl shadow-sm p-6 hover:shadow-lg hover:-translate-y-1 transition-all cursor-pointer group"
    >
      <div className="flex items-start justify-between mb-4">
        <div
          className={`w-12 h-12 ${lightColor} rounded-xl flex items-center justify-center group-hover:scale-110 transition`}
        >
          <div className={textColor}>{icon}</div>
        </div>
        <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-gray-500 transition" />
      </div>
      <h3 className="font-semibold text-gray-800 mb-1">{title}</h3>
      <p className="text-sm text-gray-500 mb-3">{description}</p>
      <p className="text-xs text-gray-400">{stats}</p>
    </div>
  );
};

export default AdminDashboard;
