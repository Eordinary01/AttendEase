import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import NewLogin from './component/newLogin';
import Header from './component/header';
import Register from './component/login';
import Dashboard from './component/Dashboard';

const App = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    // Check if the user is already authenticated (e.g., by checking local storage)
    const userIsAuthenticated = localStorage.getItem('token');
    if (userIsAuthenticated) {
      setIsAuthenticated(true);
    }
  }, []);

  const handleLogin = () => {
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setIsAuthenticated(false);
  };

  return (
    <Router>
      <Header isAuthenticated={!isAuthenticated} onLogout={handleLogin} />
      <Routes>
        <Route path="/login" element={<NewLogin onLogin={handleLogout} />} />
        <Route path="/register" element={<Register />} />
        <Route
          path="/dashboard"
          element={!isAuthenticated ? <Navigate to="/login" /> : <Dashboard />}
        />
        <Route
          path="/"
          element={isAuthenticated ? <Navigate to="/dashboard" /> : <Navigate to="/login" />}
        />
      </Routes>
    </Router>
  );
};

export default App;
