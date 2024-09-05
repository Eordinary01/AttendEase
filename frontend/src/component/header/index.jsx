import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Menu, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import { 
  ChevronDownIcon, 
  UserCircleIcon, 
  LogoutIcon, 
  TicketIcon, 
  ChartBarIcon, 
  ClipboardListIcon, 
  PencilIcon, 
  MenuIcon, 
  XIcon 
} from '@heroicons/react/outline';

const Header = ({ isAuthenticated, onLogout, role }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <div className="bg-purple-100 text-black p-4 flex flex-col z-50 shadow-lg">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Attend Ease</h1>
        </div>
        <div className="md:hidden">
          {/* Hamburger Icon for small screens */}
          <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="focus:outline-none z-50 relative">
            {isMenuOpen ? (
              <XIcon className="h-6 w-6 text-black" />
            ) : (
              <MenuIcon className="h-6 w-6 text-black" />
            )}
          </button>
        </div>
        <div className="hidden md:flex items-center space-x-4">
          {isAuthenticated && role === 'student' && (
            <Link to="/tickets" className="mx-2 hover:text-gray-300 transition duration-300">
              <TicketIcon className="h-5 w-5 inline mr-1" /> Create Ticket
            </Link>
          )}
          <Link to="/dashboard" className="mx-2 hover:text-gray-300 transition duration-300">
            <ChartBarIcon className="h-5 w-5 inline mr-1" /> Dashboard
          </Link>
          {isAuthenticated && role === 'teacher' && (
            <>
              <Link to="/attendance" className="mx-2 hover:text-gray-300 transition duration-300">
                <PencilIcon className="h-5 w-5 inline mr-1" /> Mark Attendance
              </Link>

              <Link to="/attendance-overview" className="mx-2 hover:text-gray-300 transition duration-300">
                <ClipboardListIcon className="h-5 w-5 inline mr-1" /> Attendance Overview
              </Link>
            </>
          )}
          {!isAuthenticated && (
            <>
              <Link to="/register" className="mx-2 hover:text-gray-300 transition duration-300">
                Register
              </Link>
              <Link to="/login" className="mx-2 hover:text-gray-300 transition duration-300">
                Login
              </Link>
            </>
          )}
          {isAuthenticated && (
            <Menu as="div" className="relative inline-block text-left">
              <div>
                <Menu.Button className="inline-flex justify-center w-full rounded-md shadow-sm px-4 py-2 bg-purple-800 text-sm font-medium text-white hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-white">
                  <UserCircleIcon className="h-5 w-5 mr-1" />
                  Account
                  <ChevronDownIcon className="h-5 w-5 ml-2 -mr-1" aria-hidden="true" />
                </Menu.Button>
              </div>
              <Transition
                as={Fragment}
                enter="transition ease-out duration-100"
                enterFrom="transform opacity-0 scale-95"
                enterTo="transform opacity-100 scale-100"
                leave="transition ease-in duration-75"
                leaveFrom="transform opacity-100 scale-100"
                leaveTo="transform opacity-0 scale-95"
              >
                <Menu.Items className="origin-top-right absolute right-0 mt-2 w-56 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 focus:outline-none">
                  <div className="py-1">
                    <Menu.Item>
                      {({ active }) => (
                        <Link to="/profile" className={`flex w-full px-4 py-2 text-sm ${active ? 'bg-gray-100 text-gray-900' : 'text-gray-700'}`}>
                          <UserCircleIcon className="h-5 w-5 mr-2" />
                          Profile
                        </Link>
                      )}
                    </Menu.Item>
                    <Menu.Item>
                      {({ active }) => (
                        <button
                          onClick={onLogout}
                          className={`${
                            active ? 'bg-gray-100 text-gray-900' : 'text-gray-700'
                          } flex w-full px-4 py-2 text-sm`}
                        >
                          <LogoutIcon className="h-5 w-5 mr-2" />
                          Logout
                        </button>
                      )}
                    </Menu.Item>
                  </div>
                </Menu.Items>
              </Transition>
            </Menu>
          )}
        </div>
      </div>

      {/* Mobile Menu with Slide-in Animation */}
      <div
        className={`fixed top-0 right-0 h-full w-64 bg-purple-100 transform ${
          isMenuOpen ? 'translate-x-0' : 'translate-x-full'
        } transition-transform duration-300 ease-in-out md:hidden z-40 shadow-lg`}
      >
        {/* Close Button inside the slider */}
        <button 
          onClick={() => setIsMenuOpen(false)} 
          className="absolute top-4 right-4 z-50 focus:outline-none"
        >
          <XIcon className="h-6 w-6 text-black" />
        </button>

        <div className="flex flex-col p-4 space-y-2">
          {isAuthenticated && role === 'student' && (
            <Link to="/tickets" className="block px-4 py-2 hover:text-gray-300 transition duration-300">
              <TicketIcon className="h-5 w-5 inline mr-1" /> Create Ticket
            </Link>
          )}
          <Link to="/dashboard" className="block px-4 py-2 hover:text-gray-300 transition duration-300">
            <ChartBarIcon className="h-5 w-5 inline mr-1" /> Dashboard
          </Link>
          {isAuthenticated && role === 'teacher' && (
            <>
              <Link to="/attendance" className="block px-4 py-2 hover:text-gray-300 transition duration-300">
                <PencilIcon className="h-5 w-5 inline mr-1" /> Mark Attendance
              </Link>

              <Link to="/attendance-overview" className="block px-4 py-2 hover:text-gray-300 transition duration-300">
                <ClipboardListIcon className="h-5 w-5 inline mr-1" /> Attendance Overview
              </Link>
            </>
          )}
          {!isAuthenticated && (
            <>
              <Link to="/register" className="block px-4 py-2 hover:text-gray-300 transition duration-300">
                Register
              </Link>
              <Link to="/login" className="block px-4 py-2 hover:text-gray-300 transition duration-300">
                Login
              </Link>
            </>
          )}
          {isAuthenticated && (
            <div className="block px-4 py-2 hover:text-gray-300 transition duration-300">
              <button onClick={onLogout} className="flex w-full">
                <LogoutIcon className="h-5 w-5 mr-2" /> Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Header;
