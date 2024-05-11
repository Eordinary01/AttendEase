import React from 'react';
import { Link, useNavigate } from 'react-router-dom';

const Header = ({ isAuthenticated, onLogout }) => {
  const navigate = useNavigate();

  const handleLogout = () => {
    onLogout();
    navigate('/login');
  };

  return (
    
    <div className="bg-gray-800 p-4 flex justify-between items-center">
      <div>
        <h1 className="text-white text-xl font-bold">Attend Ease</h1>
      </div>
      <div>
        {!isAuthenticated && (
          <>
            <Link to="/register" className="text-white mx-2">Register</Link>
            <Link to="/login" className="text-white mx-2">Login</Link>
          </>
        )}
        {isAuthenticated && (
          <button onClick={handleLogout} className="text-white mx-2">Logout</button>
        )}
      </div>
    </div>
  );
};

export default Header;
