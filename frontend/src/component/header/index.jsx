import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
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
  Bell,
  Users,
  BookOpen,
  Settings,
  Upload,
  Home,
  BookMarked // Added for Subjects icon
} from 'lucide-react';

const Header = ({ isAuthenticated, onLogout, role, userName, userId }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [currentUserName, setCurrentUserName] = useState('');
  const navigate = useNavigate();
  const location = useLocation();

  // Debug log
  useEffect(() => {
    console.log('🔍 Header props:', { isAuthenticated, role, userName, userId });
  }, [isAuthenticated, role, userName, userId]);

  useEffect(() => {
    // Get userName from localStorage if not passed as prop
    if (!userName && isAuthenticated) {
      const storedName = localStorage.getItem('userName');
      if (storedName) {
        setCurrentUserName(storedName);
      }
    }
  }, [userName, isAuthenticated]);

  // Get the display name
  const displayName = userName || currentUserName || 
    (role ? role.charAt(0).toUpperCase() + role.slice(1) : 'Account');

  const handleLogoutClick = () => {
    console.log('🚪 Logging out from header');
    onLogout();
    setIsMenuOpen(false);
    navigate('/login');
  };

  // Get the correct subjects route based on role
  const getSubjectsRoute = () => {
    switch(role) {
      case 'admin':
        return '/admin/manage-subjects'; // Admin goes to management page
      case 'teacher':
        return '/teacher/subjects'; // Teacher goes to their subjects view
      case 'student':
        return '/student/subjects'; // Student goes to their subjects view
      default:
        return '/subjects'; // Fallback to general subjects page
    }
  };

  // Get the display text for subjects link
  const getSubjectsText = () => {
    switch(role) {
      case 'admin':
        return 'Manage Subjects';
      case 'teacher':
        return 'My Subjects';
      case 'student':
        return 'My Subjects';
      default:
        return 'Subjects';
    }
  };

  // Check if route exists before showing it
  const shouldShowLink = (path) => {
    // For now, just return true. You can implement actual route checking here
    return true;
  };

  // Close mobile menu when route changes
  useEffect(() => {
    setIsMenuOpen(false);
  }, [location.pathname]);

  return (
    <div className="bg-gradient-to-r from-purple-100 to-purple-200 text-purple-900 p-4 flex flex-col z-50 shadow-lg sticky top-0">
      <div className="flex justify-between items-center max-w-7xl mx-auto w-full">
        {/* Logo */}
        <div className="flex items-center space-x-2">
          <GraduationCap className="h-8 w-8 text-purple-700" />
          <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-700 to-purple-900 bg-clip-text text-transparent">
            Attend Ease
          </h1>
        </div>

        {/* Mobile menu button */}
        <div className="md:hidden">
          <button 
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="p-2 hover:bg-purple-200 rounded-full transition-colors duration-200"
            aria-label={isMenuOpen ? "Close menu" : "Open menu"}
          >
            {isMenuOpen ? (
              <X className="h-6 w-6 text-purple-700" />
            ) : (
              <MenuIcon className="h-6 w-6 text-purple-700" />
            )}
          </button>
        </div>

        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center space-x-6">
          {/* Dashboard link for all authenticated users */}
          {isAuthenticated && (
            <Link 
              to="/dashboard" 
              className="flex items-center space-x-2 hover:text-purple-700 transition-colors duration-200 px-3 py-2 rounded-lg hover:bg-purple-50"
            >
              <Home className="h-5 w-5" />
              <span>Dashboard</span>
            </Link>
          )}
          
          {/* SUBJECTS LINK - Now available for everyone */}
          {isAuthenticated && (
            <Link 
              to={getSubjectsRoute()}
              className="flex items-center space-x-2 hover:text-purple-700 transition-colors duration-200 px-3 py-2 rounded-lg hover:bg-purple-50"
            >
              <BookMarked className="h-5 w-5" />
              <span>{getSubjectsText()}</span>
            </Link>
          )}
          
          {/* Student-specific links */}
          {isAuthenticated && role === 'student' && (
            <Link 
              to="/tickets" 
              className="flex items-center space-x-2 hover:text-purple-700 transition-colors duration-200 px-3 py-2 rounded-lg hover:bg-purple-50"
            >
              <Ticket className="h-5 w-5" />
              <span>Create Ticket</span>
            </Link>
          )}
          
          {/* Teacher-specific links */}
          {isAuthenticated && role === 'teacher' && (
            <>
              {shouldShowLink('/attendance') && (
                <Link 
                  to="/attendance" 
                  className="flex items-center space-x-2 hover:text-purple-700 transition-colors duration-200 px-3 py-2 rounded-lg hover:bg-purple-50"
                >
                  <PenSquare className="h-5 w-5" />
                  <span>Mark Attendance</span>
                </Link>
              )}

              {shouldShowLink('/attendance-overview') && (
                <Link 
                  to="/attendance-overview" 
                  className="flex items-center space-x-2 hover:text-purple-700 transition-colors duration-200 px-3 py-2 rounded-lg hover:bg-purple-50"
                >
                  <ClipboardCheck className="h-5 w-5" />
                  <span>Overview</span>
                </Link>
              )}
            </>
          )}
          
          {/* Admin-specific links */}
          {isAuthenticated && role === 'admin' && (
            <>
              {shouldShowLink('/admin/upload-enrollments') && (
                <Link 
                  to="/admin/upload-enrollments" 
                  className="flex items-center space-x-2 hover:text-purple-700 transition-colors duration-200 px-3 py-2 rounded-lg hover:bg-purple-50"
                >
                  <Upload className="h-5 w-5" />
                  <span>Upload</span>
                </Link>
              )}

              {shouldShowLink('/admin/manage-teachers') && (
                <Link 
                  to="/admin/manage-teachers" 
                  className="flex items-center space-x-2 hover:text-purple-700 transition-colors duration-200 px-3 py-2 rounded-lg hover:bg-purple-50"
                >
                  <Users className="h-5 w-5" />
                  <span>Teachers</span>
                </Link>
              )}

              {/* Note: Manage Subjects is already covered by the general Subjects link above */}
              
              {shouldShowLink('/admin/assign-subjects') && (
                <Link 
                  to="/admin/assign-subjects" 
                  className="flex items-center space-x-2 hover:text-purple-700 transition-colors duration-200 px-3 py-2 rounded-lg hover:bg-purple-50"
                >
                  <Settings className="h-5 w-5" />
                  <span>Assign</span>
                </Link>
              )}
            </>
          )}

          {/* Authentication buttons */}
          {!isAuthenticated ? (
            <div className="flex items-center space-x-4">
              <Link 
                to="/login" 
                className="px-4 py-2 rounded-full bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:from-purple-700 hover:to-blue-700 transition-colors duration-200"
              >
                Login
              </Link>
            </div>
          ) : (
            <div className="flex items-center space-x-4">
              {/* Account dropdown */}
              <Menu as="div" className="relative inline-block text-left">
                <Menu.Button 
                  className="flex items-center space-x-2 px-4 py-2 rounded-full bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:from-purple-700 hover:to-blue-700 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2"
                  aria-label="Account menu"
                >
                  <User className="h-5 w-5" />
                  <span className="font-medium">{displayName}</span>
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
                  <Menu.Items className="absolute right-0 mt-2 w-56 origin-top-right rounded-lg bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-50">
                    <div className="p-1">
                      <div className="px-3 py-2 text-sm text-purple-900/60 font-medium border-b border-purple-100">
                        {role === 'admin' ? 'Admin Account' : 
                         role === 'teacher' ? 'Teacher Account' : 
                         'Student Account'}
                      </div>
                      
                      {/* Profile link */}
                      <Menu.Item>
                        {({ active }) => (
                          <Link
                            to="/profile"
                            className={`${
                              active ? 'bg-purple-50 text-purple-900' : 'text-purple-800'
                            } group flex items-center rounded-md px-3 py-2 text-sm mt-1`}
                            onClick={() => setIsMenuOpen(false)}
                          >
                            <User className="h-4 w-4 mr-2" />
                            Profile
                          </Link>
                        )}
                      </Menu.Item>
                      
                      {/* Subjects link in dropdown as well for easy access */}
                      <Menu.Item>
                        {({ active }) => (
                          <Link
                            to={getSubjectsRoute()}
                            className={`${
                              active ? 'bg-purple-50 text-purple-900' : 'text-purple-800'
                            } group flex items-center rounded-md px-3 py-2 text-sm`}
                            onClick={() => setIsMenuOpen(false)}
                          >
                            <BookMarked className="h-4 w-4 mr-2" />
                            {getSubjectsText()}
                          </Link>
                        )}
                      </Menu.Item>
                      
                      {/* Logout button */}
                      <Menu.Item>
                        {({ active }) => (
                          <button
                            onClick={handleLogoutClick}
                            className={`${
                              active ? 'bg-purple-50 text-purple-900' : 'text-purple-800'
                            } group flex w-full items-center rounded-md px-3 py-2 text-sm mt-1`}
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
          {/* User info in mobile menu */}
          {isAuthenticated && (
            <div className="px-3 py-2 border-b border-purple-100">
              <p className="font-medium text-purple-900">{displayName}</p>
              <p className="text-sm text-purple-600">{role?.charAt(0).toUpperCase() + role?.slice(1)}</p>
            </div>
          )}

          {/* Dashboard link for all authenticated users */}
          {isAuthenticated && (
            <Link 
              to="/dashboard" 
              className="flex items-center space-x-2 text-purple-900 hover:text-purple-700 px-3 py-2 rounded-lg hover:bg-purple-50"
              onClick={() => setIsMenuOpen(false)}
            >
              <Home className="h-5 w-5" />
              <span>Dashboard</span>
            </Link>
          )}

          {/* SUBJECTS LINK - Mobile version for everyone */}
          {isAuthenticated && (
            <Link 
              to={getSubjectsRoute()}
              className="flex items-center space-x-2 text-purple-900 hover:text-purple-700 px-3 py-2 rounded-lg hover:bg-purple-50"
              onClick={() => setIsMenuOpen(false)}
            >
              <BookMarked className="h-5 w-5" />
              <span>{getSubjectsText()}</span>
            </Link>
          )}

          {/* Student-specific mobile links */}
          {isAuthenticated && role === 'student' && (
            <Link 
              to="/tickets" 
              className="flex items-center space-x-2 text-purple-900 hover:text-purple-700 px-3 py-2 rounded-lg hover:bg-purple-50"
              onClick={() => setIsMenuOpen(false)}
            >
              <Ticket className="h-5 w-5" />
              <span>Create Ticket</span>
            </Link>
          )}

          {/* Teacher-specific mobile links */}
          {isAuthenticated && role === 'teacher' && (
            <>
              <Link 
                to="/attendance" 
                className="flex items-center space-x-2 text-purple-900 hover:text-purple-700 px-3 py-2 rounded-lg hover:bg-purple-50"
                onClick={() => setIsMenuOpen(false)}
              >
                <PenSquare className="h-5 w-5" />
                <span>Mark Attendance</span>
              </Link>

              <Link 
                to="/attendance-overview" 
                className="flex items-center space-x-2 text-purple-900 hover:text-purple-700 px-3 py-2 rounded-lg hover:bg-purple-50"
                onClick={() => setIsMenuOpen(false)}
              >
                <ClipboardCheck className="h-5 w-5" />
                <span>Overview</span>
              </Link>
            </>
          )}
          
          {/* Admin-specific mobile links */}
          {isAuthenticated && role === 'admin' && (
            <>
              <Link 
                to="/admin/upload-enrollments" 
                className="flex items-center space-x-2 text-purple-900 hover:text-purple-700 px-3 py-2 rounded-lg hover:bg-purple-50"
                onClick={() => setIsMenuOpen(false)}
              >
                <Upload className="h-5 w-5" />
                <span>Upload Enrollments</span>
              </Link>

              <Link 
                to="/admin/manage-teachers" 
                className="flex items-center space-x-2 text-purple-900 hover:text-purple-700 px-3 py-2 rounded-lg hover:bg-purple-50"
                onClick={() => setIsMenuOpen(false)}
              >
                <Users className="h-5 w-5" />
                <span>Manage Teachers</span>
              </Link>

              {/* Note: Manage Subjects is already covered above */}

              <Link 
                to="/admin/assign-subjects" 
                className="flex items-center space-x-2 text-purple-900 hover:text-purple-700 px-3 py-2 rounded-lg hover:bg-purple-50"
                onClick={() => setIsMenuOpen(false)}
              >
                <Settings className="h-5 w-5" />
                <span>Assign Subjects</span>
              </Link>
            </>
          )}

          {/* Profile link in mobile */}
          {isAuthenticated && (
            <Link 
              to="/profile" 
              className="flex items-center space-x-2 text-purple-900 hover:text-purple-700 px-3 py-2 rounded-lg hover:bg-purple-50"
              onClick={() => setIsMenuOpen(false)}
            >
              <User className="h-5 w-5" />
              <span>Profile</span>
            </Link>
          )}

          {/* Auth buttons in mobile */}
          {!isAuthenticated ? (
            <div className="flex flex-col space-y-4 pt-4">
              <Link 
                to="/login" 
                className="w-full px-4 py-3 rounded-lg bg-gradient-to-r from-purple-600 to-blue-600 text-white text-center hover:from-purple-700 hover:to-blue-700"
                onClick={() => setIsMenuOpen(false)}
              >
                Login
              </Link>
            </div>
          ) : (
            <button 
              onClick={handleLogoutClick}
              className="flex items-center space-x-2 text-purple-900 hover:text-purple-700 px-3 py-3 rounded-lg hover:bg-purple-50 mt-4 border-t border-purple-100 pt-4"
            >
              <LogOut className="h-5 w-5" />
              <span>Logout</span>
            </button>
          )}
        </div>
      </div>

      {/* Overlay for mobile menu */}
      {isMenuOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-30 md:hidden"
          onClick={() => setIsMenuOpen(false)}
          aria-hidden="true"
        />
      )}
    </div>
  );
};

export default Header;