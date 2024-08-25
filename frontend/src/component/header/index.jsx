import React from 'react';
import { Link } from 'react-router-dom';
import { Menu, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import { ChevronDownIcon, UserCircleIcon, LogoutIcon, TicketIcon, ChartBarIcon, ClipboardListIcon, PencilIcon } from '@heroicons/react/outline';
// import AttendanceTable from '../AttendanceTable'; // Import the AttendanceTable component

const Header = ({ isAuthenticated, onLogout, isRegistered, role }) => {
  return (
    <div className="bg-purple-900 p-4 flex flex-col z-50 shadow-lg">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-white text-2xl font-bold">Attend Ease</h1>
        </div>
        <div className="flex items-center space-x-4">
          {isAuthenticated && role === 'student' && (
            <Link to="/tickets" className="text-white mx-2 hover:text-gray-300 transition duration-300">
              <TicketIcon className="h-5 w-5 inline mr-1" /> Create Ticket
            </Link>
          )}
          <Link to="/dashboard" className="text-white mx-2 hover:text-gray-300 transition duration-300">
            <ChartBarIcon className="h-5 w-5 inline mr-1" /> Dashboard
          </Link>
          {isAuthenticated && role === 'teacher' && (
            <>
            <Link to="/attendance" className="text-white mx-2 hover:text-gray-300 transition duration-300">
              <PencilIcon className="h-5 w-5 inline mr-1" /> Mark Attendance
            </Link>

            <Link to="/attendance-overview" className="text-white mx-2 hover:text-gray-300 transition duration-300">
              <ClipboardListIcon className="h-5 w-5 inline mr-1" /> Attendance Overview
            </Link> 

            </>
          )}
          {!isAuthenticated && (
            <>
              <Link to="/register" className="text-white mx-2 hover:text-gray-300 transition duration-300">
                Register
              </Link>
              <Link to="/login" className="text-white mx-2 hover:text-gray-300 transition duration-300">
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
      
    </div>
  );
};

export default Header;