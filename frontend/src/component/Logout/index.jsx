import React from 'react';
import { useNavigate } from 'react-router-dom';
import { getPostLogoutPath } from '../../utils/loginPath';

const Logout = ({ onLogout }) => {
  const navigate = useNavigate();

  const handleLogout = () => {
    onLogout();
    navigate(getPostLogoutPath());
  };

  return (
    <button onClick={handleLogout} className="bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-xl text-xs font-bold transition shadow-sm cursor-pointer">
      Logout
    </button>
  );
};

export default Logout;
