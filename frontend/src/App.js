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

    // window.alert("Database has been wiped out! Pls Register again");
  }, []);

  const handleLogin = (token, role) => {
    localStorage.setItem("token", token);
    setIsAuthenticated(true);
    setRole(role);
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    localStorage.removeItem("isRegistered");
    setIsAuthenticated(false);
    setRole("");
    setIsRegistered(false);
  };

  return (
    <Router>
      <Header isAuthenticated={isAuthenticated} onLogout={handleLogout} isRegistered={!isRegistered} />
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
