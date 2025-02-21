import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Menu, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import {
  User,
  LogOut,
  Ticket,
  BarChart3,
  ClipboardCheck,
  PenSquare,
  Menu as MenuIcon,
  X,
  GraduationCap,
  ChevronDown,
  Bell
} from 'lucide-react';

const Header = ({ isAuthenticated, onLogout, role }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  
  return (
    <div className="bg-gradient-to-r from-purple-100 to-purple-200 text-purple-900 p-4 flex flex-col z-50 shadow-lg sticky top-0">
      <div className="flex justify-between items-center max-w-7xl mx-auto w-full">
        <div className="flex items-center space-x-2">
          <GraduationCap className="h-8 w-8 text-purple-700" />
          <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-700 to-purple-900 bg-clip-text text-transparent">
            Attend Ease
          </h1>
        </div>

        <div className="md:hidden">
          <button 
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="p-2 hover:bg-purple-200 rounded-full transition-colors duration-200"
          >
            {isMenuOpen ? (
              <X className="h-6 w-6 text-purple-700" />
            ) : (
              <MenuIcon className="h-6 w-6 text-purple-700" />
            )}
          </button>
        </div>

        <div className="hidden md:flex items-center space-x-6">
          {isAuthenticated && role === 'student' && (
            <Link 
              to="/tickets" 
              className="flex items-center space-x-2 hover:text-purple-700 transition-colors duration-200"
            >
              <Ticket className="h-5 w-5" />
              <span>Create Ticket</span>
            </Link>
          )}
          
          <Link 
            to="/dashboard" 
            className="flex items-center space-x-2 hover:text-purple-700 transition-colors duration-200"
          >
            <BarChart3 className="h-5 w-5" />
            <span>Dashboard</span>
          </Link>

          {isAuthenticated && role === 'teacher' && (
            <>
              <Link 
                to="/attendance" 
                className="flex items-center space-x-2 hover:text-purple-700 transition-colors duration-200"
              >
                <PenSquare className="h-5 w-5" />
                <span>Mark Attendance</span>
              </Link>

              <Link 
                to="/attendance-overview" 
                className="flex items-center space-x-2 hover:text-purple-700 transition-colors duration-200"
              >
                <ClipboardCheck className="h-5 w-5" />
                <span>Overview</span>
              </Link>
            </>
          )}

          {!isAuthenticated ? (
            <div className="flex items-center space-x-4">
              <Link 
                to="/register" 
                className="px-4 py-2 rounded-full bg-purple-700 text-white hover:bg-purple-800 transition-colors duration-200"
              >
                Register
              </Link>
              <Link 
                to="/login" 
                className="px-4 py-2 rounded-full border-2 border-purple-700 text-purple-700 hover:bg-purple-700 hover:text-white transition-colors duration-200"
              >
                Login
              </Link>
            </div>
          ) : (
            <div className="flex items-center space-x-4">
              <button className="p-2 hover:bg-purple-200 rounded-full transition-colors duration-200">
                <Bell className="h-5 w-5 text-purple-700" />
              </button>
              
              <Menu as="div" className="relative inline-block text-left">
                <Menu.Button className="flex items-center space-x-2 px-4 py-2 rounded-full bg-purple-700 text-white hover:bg-purple-800 transition-colors duration-200">
                  <User className="h-5 w-5" />
                  <span>Account</span>
                  <ChevronDown className="h-4 w-4 ml-1" />
                </Menu.Button>

                <Transition
                  as={Fragment}
                  enter="transition ease-out duration-100"
                  enterFrom="transform opacity-0 scale-95"
                  enterTo="transform opacity-100 scale-100"
                  leave="transition ease-in duration-75"
                  leaveFrom="transform opacity-100 scale-100"
                  leaveTo="transform opacity-0 scale-95"
                >
                  <Menu.Items className="absolute right-0 mt-2 w-56 origin-top-right rounded-lg bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                    <div className="p-1">
                      <div className="px-3 py-2 text-sm text-purple-900/60 font-medium">
                        My Account
                      </div>
                      <Menu.Item>
                        {({ active }) => (
                          <Link
                            to="/profile"
                            className={`${
                              active ? 'bg-purple-50 text-purple-900' : 'text-purple-800'
                            } group flex items-center rounded-md px-3 py-2 text-sm`}
                          >
                            <User className="h-4 w-4 mr-2" />
                            Profile
                          </Link>
                        )}
                      </Menu.Item>
                      <Menu.Item>
                        {({ active }) => (
                          <button
                            onClick={onLogout}
                            className={`${
                              active ? 'bg-purple-50 text-purple-900' : 'text-purple-800'
                            } group flex w-full items-center rounded-md px-3 py-2 text-sm`}
                          >
                            <LogOut className="h-4 w-4 mr-2" />
                            Logout
                          </button>
                        )}
                      </Menu.Item>
                    </div>
                  </Menu.Items>
                </Transition>
              </Menu>
            </div>
          )}
        </div>
      </div>

      {/* Mobile Menu */}
      <div
        className={`fixed inset-y-0 right-0 w-64 bg-white/95 backdrop-blur-sm transform ${
          isMenuOpen ? 'translate-x-0' : 'translate-x-full'
        } transition-transform duration-300 ease-in-out md:hidden z-40 shadow-lg p-6`}
      >
        <div className="flex flex-col space-y-6 mt-16">
          {isAuthenticated && role === 'student' && (
            <Link 
              to="/tickets" 
              className="flex items-center space-x-2 text-purple-900 hover:text-purple-700"
              onClick={() => setIsMenuOpen(false)}
            >
              <Ticket className="h-5 w-5" />
              <span>Create Ticket</span>
            </Link>
          )}

          <Link 
            to="/dashboard" 
            className="flex items-center space-x-2 text-purple-900 hover:text-purple-700"
            onClick={() => setIsMenuOpen(false)}
          >
            <BarChart3 className="h-5 w-5" />
            <span>Dashboard</span>
          </Link>

          {isAuthenticated && role === 'teacher' && (
            <>
              <Link 
                to="/attendance" 
                className="flex items-center space-x-2 text-purple-900 hover:text-purple-700"
                onClick={() => setIsMenuOpen(false)}
              >
                <PenSquare className="h-5 w-5" />
                <span>Mark Attendance</span>
              </Link>

              <Link 
                to="/attendance-overview" 
                className="flex items-center space-x-2 text-purple-900 hover:text-purple-700"
                onClick={() => setIsMenuOpen(false)}
              >
                <ClipboardCheck className="h-5 w-5" />
                <span>Overview</span>
              </Link>
            </>
          )}

          {!isAuthenticated ? (
            <div className="flex flex-col space-y-4">
              <Link 
                to="/register" 
                className="w-full px-4 py-2 rounded-full bg-purple-700 text-white text-center hover:bg-purple-800"
                onClick={() => setIsMenuOpen(false)}
              >
                Register
              </Link>
              <Link 
                to="/login" 
                className="w-full px-4 py-2 rounded-full border-2 border-purple-700 text-purple-700 text-center hover:bg-purple-700 hover:text-white"
                onClick={() => setIsMenuOpen(false)}
              >
                Login
              </Link>
            </div>
          ) : (
            <>
              <Link 
                to="/profile" 
                className="flex items-center space-x-2 text-purple-900 hover:text-purple-700"
                onClick={() => setIsMenuOpen(false)}
              >
                <User className="h-5 w-5" />
                <span>Profile</span>
              </Link>
              <button 
                onClick={() => {
                  onLogout();
                  setIsMenuOpen(false);
                }}
                className="flex items-center space-x-2 text-purple-900 hover:text-purple-700"
              >
                <LogOut className="h-5 w-5" />
                <span>Logout</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Header;