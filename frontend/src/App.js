import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import NewLogin from './component/newLogin';
import Header from './component/header';
import Register from './component/login';
import Dashboard from './component/Dashboard';
import Ticket from './component/add-tickets';
import TeacherDashboard from './component/teacherDashboard';


const PrivateRoute = ({ element, isAuthenticated, role, ...props }) => {
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  switch (role) {
    case 'student':
      return React.cloneElement(element, { role, ...props });
    case 'teacher':
      return React.cloneElement(element, { role, ...props });
    default:
      return <Navigate to="/login" replace />;
  }
};

const App = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isRegistered, setIsRegistered] = useState(false);
  const [role, setRole] = useState('');
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      setIsAuthenticated(true);
    }
    const userRole = localStorage.getItem('role'); // Ensure correct key used ('role')
    if (userRole) {
      setRole(userRole); // Set role in state
      // console.log(userRole)
    }
    const userIsRegistered = localStorage.getItem('isRegistered');
    if (userIsRegistered) {
      setIsRegistered(true);
    }
  }, []);
  

  const handleLogin = (token, role, registered) => {
    localStorage.setItem('token', token);
    setIsAuthenticated(true);
    setRole(role); // Ensure role is set correctly
    // console.log(role)
    if (registered) {
      localStorage.setItem('isRegistered', true);
      setIsRegistered(true);
    }
  };
  

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    setIsAuthenticated(false);
    setRole('');
  };

  return (
    <Router>
      <Header isAuthenticated={isAuthenticated} onLogout={handleLogout} isRegistered={!isRegistered} />
      <Routes>
        <Route path="/login" element={<NewLogin onLogin={handleLogin} setIsRegistered={setIsRegistered} />} />
        <Route path="/register" element={!isAuthenticated ? <Navigate to="/login" /> : <Register />} />
        <Route
          path="/dashboard"
          element={
            <PrivateRoute
              element={role === 'student' ? <Dashboard /> : <TeacherDashboard />}
              isAuthenticated={isAuthenticated}
              role={role}
            />
          }
        />
        <Route path="/" element={<Navigate to={isAuthenticated ? "/dashboard" : "/login"} replace />} />
        <Route path="/tickets" element={<Ticket />} />
      </Routes>
    </Router>
  );
};

export default App;
