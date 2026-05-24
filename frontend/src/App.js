import React, { useState, useEffect } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import NewLogin from "./component/newLogin";
import Register from "./component/login"; // Import the Register component
import Header from "./component/header";
import Dashboard from "./component/Dashboard";
import Ticket from "./component/add-tickets";
import TeacherDashboard from "./component/teacherDashboard";
import AdminDashboard from "./component/Admin/AdminDashboard";
import MarkAttendance from "./component/markAttendance";
import Profile from "./component/profile";
import AttendanceOverview from "./component/AttendanceTable";
import UploadEnrollments from "./component/Admin/UploadEnrollments";
import ManageTeachers from "./component/Admin/ManageTeachers";
import ManageSubjects from "./component/Admin/ManageSubjects";
import AssignSubjects from "./component/Admin/AssignSubjects";
import SubjectList from "./component/Subjects/SubjectsList";
import StudentSubjects from "./component/Subjects/StudentsSubjects";
import TeacherSubjects from "./component/Subjects/TeachersSubjects";

// Improved PrivateRoute component
const PrivateRoute = ({
  children,
  isAuthenticated,
  requiredRole,
  userRole,
  userId,
  userName,
  userEmail,
}) => {
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Check if user has required role (if specified)
  if (requiredRole && userRole !== requiredRole) {
    return <Navigate to="/dashboard" replace />;
  }

  // Pass user data as props to children
  return React.cloneElement(children, {
    userId,
    userName,
    userEmail,
    role: userRole,
  });
};

// Public Route (redirects if already authenticated)
const PublicRoute = ({ children, isAuthenticated }) => {
  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }
  return children;
};

// Wrapper component for role-based routing
const DashboardRouter = ({ role, userId, userName, userEmail }) => {
  switch (role) {
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
    default:
      return <Navigate to="/login" replace />;
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

    // Debug log
    console.log("🔍 App loaded user data:", {
      isAuthenticated: !!token,
      role: userRole,
      userId: storedUserId,
      userName: storedUserName,
      userEmail: storedUserEmail,
    });
  }, []);

  const handleLogin = (token, role, userId, userName, userEmail) => {
    console.log("✅ Login successful, storing data:", {
      role,
      userId,
      userName,
      userEmail,
    });

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
  };

  // Handle registration success
  const handleRegisterSuccess = () => {
    console.log("✅ Registration successful, user can now login");
    // You might want to show a success message or redirect to login
  };

  const handleLogout = () => {
    console.log("🚪 Logging out user");

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

  return (
    <Router>
      <Header
        isAuthenticated={isAuthenticated}
        onLogout={handleLogout}
        role={role}
        userName={userName}
      />
      <Routes>
        {/* Login Route - Public only */}
        <Route
          path="/login"
          element={
            <PublicRoute isAuthenticated={isAuthenticated}>
              <NewLogin onLogin={handleLogin} />
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

        {/* Root Route - Redirect based on auth status */}
        <Route
          path="/"
          element={
            <Navigate to={isAuthenticated ? "/dashboard" : "/login"} replace />
          }
        />

        {/* Dashboard Route */}
        <Route
          path="/dashboard"
          element={
            <PrivateRoute
              isAuthenticated={isAuthenticated}
              userRole={role}
              userId={userId}
              userName={userName}
              userEmail={userEmail}
            >
              <DashboardRouter
                role={role}
                userId={userId}
                userName={userName}
                userEmail={userEmail}
              />
            </PrivateRoute>
          }
        />

        {/* Student Routes */}
        <Route
          path="/tickets"
          element={
            <PrivateRoute
              isAuthenticated={isAuthenticated}
              requiredRole="student"
              userRole={role}
              userId={userId}
              userName={userName}
              userEmail={userEmail}
            >
              <Ticket />
            </PrivateRoute>
          }
        />
        <Route
          path="/student/subjects"
          element={
            <PrivateRoute
              isAuthenticated={isAuthenticated}
              requiredRole="student"
              userRole={role}
              userId={userId}
              userName={userName}
              userEmail={userEmail}
            >
              <StudentSubjects
                userId={userId}
                userName={userName}
                userEmail={userEmail}
              />
            </PrivateRoute>
          }
        />

        {/* Teacher Routes */}
        <Route
          path="/attendance"
          element={
            <PrivateRoute
              isAuthenticated={isAuthenticated}
              requiredRole="teacher"
              userRole={role}
              userId={userId}
              userName={userName}
              userEmail={userEmail}
            >
              <MarkAttendance />
            </PrivateRoute>
          }
        />

        <Route
          path="/attendance-overview"
          element={
            <PrivateRoute
              isAuthenticated={isAuthenticated}
              requiredRole="teacher"
              userRole={role}
              userId={userId}
              userName={userName}
              userEmail={userEmail}
            >
              <AttendanceOverview />
            </PrivateRoute>
          }
        />
        <Route
          path="/teacher/subjects"
          element={
            <PrivateRoute
              isAuthenticated={isAuthenticated}
              requiredRole="teacher"
              userRole={role}
              userId={userId}
              userName={userName}
              userEmail={userEmail}
            >
              <TeacherSubjects
                userId={userId}
                userName={userName}
                userEmail={userEmail}
              />
            </PrivateRoute>
          }
        />

        {/* Admin Routes */}
        <Route
          path="/admin/upload-enrollments"
          element={
            <PrivateRoute
              isAuthenticated={isAuthenticated}
              requiredRole="admin"
              userRole={role}
              userId={userId}
              userName={userName}
              userEmail={userEmail}
            >
              <UploadEnrollments />
            </PrivateRoute>
          }
        />

        <Route
          path="/admin/manage-teachers"
          element={
            <PrivateRoute
              isAuthenticated={isAuthenticated}
              requiredRole="admin"
              userRole={role}
              userId={userId}
              userName={userName}
              userEmail={userEmail}
            >
              <ManageTeachers />
            </PrivateRoute>
          }
        />

        <Route
          path="/admin/manage-subjects"
          element={
            <PrivateRoute
              isAuthenticated={isAuthenticated}
              requiredRole="admin"
              userRole={role}
              userId={userId}
              userName={userName}
              userEmail={userEmail}
            >
              <ManageSubjects />
            </PrivateRoute>
          }
        />

        <Route
          path="/admin/assign-subjects"
          element={
            <PrivateRoute
              isAuthenticated={isAuthenticated}
              requiredRole="admin"
              userRole={role}
              userId={userId}
              userName={userName}
              userEmail={userEmail}
            >
              <AssignSubjects />
            </PrivateRoute>
          }
        />

        {/* Profile Route - Available to all authenticated users */}
        <Route
          path="/profile"
          element={
            <PrivateRoute
              isAuthenticated={isAuthenticated}
              userRole={role}
              userId={userId}
              userName={userName}
              userEmail={userEmail}
            >
              <Profile />
            </PrivateRoute>
          }
        />
        <Route
          path="/subjects"
          element={
            <PrivateRoute
              isAuthenticated={isAuthenticated}
              userRole={role}
              userId={userId}
              userName={userName}
              userEmail={userEmail}
            >
              <SubjectList
                role={role}
                userId={userId}
                userName={userName}
                userEmail={userEmail}
              />
            </PrivateRoute>
          }
        />

        {/* 404 Route */}
        <Route
          path="*"
          element={
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-blue-50">
              <div className="text-center p-8">
                <div className="text-9xl font-bold text-purple-900 mb-4 opacity-20">
                  404
                </div>
                <h1 className="text-3xl font-bold text-purple-900 mb-4">
                  Page Not Found
                </h1>
                <p className="text-lg text-purple-700 mb-6">
                  The page you're looking for doesn't exist.
                </p>
                <div className="space-x-4">
                  <button
                    onClick={() => window.history.back()}
                    className="px-6 py-2 border border-purple-600 text-purple-600 rounded-lg hover:bg-purple-50 transition-colors duration-200"
                  >
                    Go Back
                  </button>
                  <button
                    onClick={() =>
                      (window.location.href = isAuthenticated
                        ? "/dashboard"
                        : "/login")
                    }
                    className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors duration-200"
                  >
                    {isAuthenticated ? "Go to Dashboard" : "Go to Login"}
                  </button>
                </div>
              </div>
            </div>
          }
        />
      </Routes>
    </Router>
  );
};

export default App;
