import React from 'react';
import { Link } from 'react-router-dom';

const Header = ({ isAuthenticated, onLogout, isRegistered }) => {
  return (
    <div className="bg-purple-900 p-4 flex justify-between items-center">
      <div>
        <h1 className="text-white text-xl font-bold">Attend Ease</h1> 
      </div>
      <div>
        {!isAuthenticated &&(
          <button onClick={onLogout} className="text-white mx-2">
            Logout
          </button>

          

        )}
        {!isAuthenticated && !isRegistered && (
          <Link to="/login" className="text-white mx-2"> 
            Login
          </Link>
        )}
        {isAuthenticated && !isRegistered && (
          <>
            <Link to="/register" className="text-white mx-2"> 
              Register
            </Link>
            <Link to="/login" className="text-white mx-2"> 
              Login
            </Link>
          </>
        )}
        <Link to="/tickets" className="text-white mx-2">
          Create Ticket
        </Link>
        <Link to={"/dashboard"} className='text-white mx-2'>
          Dashboard
        </Link>
      </div>
    </div>
  );
};

export default Header;
