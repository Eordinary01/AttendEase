import React, { useState, useEffect } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import NewLogin from "./component/newLogin";
import Header from "./component/header";
import Register from "./component/login";
import Dashboard from "./component/Dashboard";
import Ticket from "./component/add-tickets";
import TeacherDashboard from "./component/teacherDashboard";
import MarkAttendance from "./component/markAttendance";
import Profile from "./component/profile";
import AttendanceOverview from "./component/AttendanceTable";

const PrivateRoute = ({
  element: Component,
  isAuthenticated,
  role,
  ...props
}) => {
  return isAuthenticated ? (
    <Component {...props} role={role} />
  ) : (
    <Navigate to="/login" replace />
  );
};

const App = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [role, setRole] = useState("");
  const [userId, setUserId] = useState(null);
  const API_URL = process.env.REACT_APP_API_URL;

  // const validateToken  = async (req,res)=>{
  //   try {

  //     const response = await  
      
  //   } catch (error) {
      
  //   }
  // }

  useEffect(() => {
    const token = localStorage.getItem("token");
    const userRole = localStorage.getItem("role");
    const storedUserId = localStorage.getItem("userId");

    if (token) {
      setIsAuthenticated(true);
    }
    if (userRole) {
      setRole(userRole);
    }
    if (storedUserId) {
      setUserId(storedUserId);
    }
  }, []);

  const handleLogin = (token, role, userId) => {
    localStorage.setItem("token", token);
    localStorage.setItem("role", role);
    localStorage.setItem("userId", userId);
    setIsAuthenticated(true);
    setRole(role);
    setUserId(userId);
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    localStorage.removeItem("userId");
    setIsAuthenticated(false);
    setRole("");
    setUserId(null);
  };

  return (
    <Router>
      <Header
        isAuthenticated={isAuthenticated}
        onLogout={handleLogout}
        role={role}
      />
      <Routes>
        <Route
          path="/login"
          element={
            isAuthenticated ? (
              <Navigate to="/dashboard" replace />
            ) : (
              <NewLogin onLogin={handleLogin} />
            )
          }
        />
        <Route
          path="/register"
          element={
            isAuthenticated ? (
              <Navigate to="/dashboard" replace />
            ) : (
              <Register onRegisterSuccess={handleLogin} />
            )
          }
        />
        <Route
          path="/dashboard"
          element={
            <PrivateRoute
              element={role === "student" ? Dashboard : TeacherDashboard}
              isAuthenticated={isAuthenticated}
              role={role}
            />
          }
        />
        <Route
          path="/"
          element={
            <Navigate to={isAuthenticated ? "/dashboard" : "/login"} replace />
          }
        />
        {role === "student" && (
          <Route
            path="/tickets"
            element={
              <PrivateRoute
                element={Ticket}
                isAuthenticated={isAuthenticated}
                role={role}
              />
            }
          />
        )}
        {role === "teacher" && (
          <>
            <Route
              path="/attendance"
              element={
                <PrivateRoute
                  element={MarkAttendance}
                  isAuthenticated={isAuthenticated}
                  role={role}
                />
              }
            />
            <Route
              path="/attendance-overview"
              element={
                <PrivateRoute
                  element={AttendanceOverview}
                  isAuthenticated={isAuthenticated}
                  role={role}
                />
              }
            />
          </>
        )}
        <Route
          path="/profile"
          element={
            <PrivateRoute
              element={Profile}
              isAuthenticated={isAuthenticated}
              role={role}
              userId={userId}
            />
          }
        />
      </Routes>
    </Router>
  );
};

export default App;