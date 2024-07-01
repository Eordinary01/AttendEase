import React, { useState, useEffect } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useNavigate
} from "react-router-dom";
import NewLogin from "./component/newLogin";
import Header from "./component/header";
import Register from "./component/login";
import Dashboard from "./component/Dashboard";
import Ticket from "./component/add-tickets";
import TeacherDashboard from "./component/teacherDashboard";
import NewUserPopup from "./component/userPopup";
import MarkAttendance from "./component/markAttendance";
import Profile from "./component/profile";

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
  const [isRegistered, setIsRegistered] = useState(false);
  const [role, setRole] = useState("");
  const [userId, setUserId] = useState(null); // Track the logged-in user's ID
  const [showPopup, setShowPopup] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      setIsAuthenticated(true);
    }
    const userRole = localStorage.getItem("role");
    if (userRole) {
      setRole(userRole);
    }
    const storedUserId = localStorage.getItem("userId"); // Retrieve userId from localStorage
    if (storedUserId) {
      setUserId(storedUserId);
    }
    console.log(storedUserId)

    // window.alert("Database has been wiped out! Pls Register again");
  }, []);

  const handleLogin = (token, role, userId) => { // Include userId parameter
    localStorage.setItem("token", token);
    localStorage.setItem("userId", userId); // Store userId in localStorage
    setIsAuthenticated(true);
    setRole(role);
    setUserId(userId); // Set userId in state
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    localStorage.removeItem("isRegistered");
    localStorage.removeItem("userId"); // Remove userId from localStorage
    setIsAuthenticated(false);
    setRole("");
    setIsRegistered(false);
    setUserId(null); // Reset userId in state
  };

  return (
    <Router>
      <Header isAuthenticated={isAuthenticated} onLogout={handleLogout} isRegistered={!isRegistered} role={role} />
      {showPopup && <Popup setShowPopup={setShowPopup} />}
      <Routes>
        <Route
          path="/login"
          element={
            <NewLogin onLogin={handleLogin} setIsRegistered={setIsRegistered} />
          }
        />
        <Route
          path="/register"
          element={
            !isAuthenticated ? (
              <Register
                setIsRegistered={setIsRegistered}
                onRegisterSuccess={() => setIsRegistered(true)}
              />
            ) : (
              <Navigate to="/login" />
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
        )}
        <Route
          path="/profile"
          element={<PrivateRoute element={Profile} isAuthenticated={isAuthenticated} role={role} userId={userId} />}
        />
      </Routes>
    </Router>
  );
};

const Popup = ({ setShowPopup }) => {
  const navigate = useNavigate();

  const handleYesClick = () => {
    setShowPopup(false);
    navigate('/register');
  };
  
  const handleNoClick = () => {
    setShowPopup(false);
    navigate('/login');
  };

  return (
    <NewUserPopup onYesClick={handleYesClick} onNoClick={handleNoClick} />
  );
};

export default App;
