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
  BookMarked,
  Building2,
  Shield,
  LifeBuoy,
  UserCog,
  Calendar,
  DollarSign,
  Package,
  FileText
} from 'lucide-react';

const Header = ({ isAuthenticated, onLogout, role, userName, userId }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [currentUserName, setCurrentUserName] = useState('');
  const [planModules, setPlanModules] = useState(null);
  const [themeColors, setThemeColors] = useState({
    primary: '#7c3aed',    // Default purple-600
    secondary: '#6d28d9',  // Default purple-700
    light: '#ede9fe',      // Default purple-100
    lighter: '#f5f3ff',    // Default purple-50
  });
  const navigate = useNavigate();
  const location = useLocation();

  // Don't show header on landing page
  const isLandingPage = location.pathname === '/';

  // Debug log
  useEffect(() => {
    // Header props updated
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

  useEffect(() => {
    // Fetch tenant colors when authenticated
    if (isAuthenticated) {
      fetchTenantColors();
      fetchPlanModules();
    }
  }, [isAuthenticated]);

  const fetchPlanModules = async () => {
    try {
      const token = localStorage.getItem('token');
      const API_URL = process.env.REACT_APP_API_URL;
      const res = await fetch(`${API_URL}/tenant/usage`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setPlanModules(data.data?.plan?.modules || {});
      }
    } catch (err) { /* ignore */ }
  };

  const fetchTenantColors = async () => {
    try {
      const token = localStorage.getItem('token');
      const API_URL = process.env.REACT_APP_API_URL;
      
      const response = await fetch(`${API_URL}/tenant/info`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        const branding = data.data?.tenant?.branding;
        
        if (branding) {
          const colors = {
            primary: branding.primaryColor || '#7c3aed',
            secondary: branding.secondaryColor || '#6d28d9',
            light: adjustColor(branding.primaryColor || '#7c3aed', 85),
            lighter: adjustColor(branding.primaryColor || '#7c3aed', 92),
          };
          setThemeColors(colors);
          
          // Apply CSS variables for global theming
          const root = document.documentElement;
          root.style.setProperty('--header-primary', colors.primary);
          root.style.setProperty('--header-secondary', colors.secondary);
          root.style.setProperty('--header-light', colors.light);
          root.style.setProperty('--header-lighter', colors.lighter);
        }
      }
    } catch (error) {
      // Silently fall back to default theme colors
    }
  };

  // Helper to adjust color brightness
  const adjustColor = (hex, percent) => {
    const num = parseInt(hex.replace('#', ''), 16);
    const amt = Math.round(2.55 * (100 - percent));
    const R = Math.min(255, Math.max(0, (num >> 16) + amt));
    const G = Math.min(255, Math.max(0, ((num >> 8) & 0x00FF) + amt));
    const B = Math.min(255, Math.max(0, (num & 0x0000FF) + amt));
    return `#${(1 << 24 | R << 16 | G << 8 | B).toString(16).slice(1)}`;
  };

  // Get the display name
  const displayName = userName || currentUserName || 
    (role ? role.charAt(0).toUpperCase() + role.slice(1) : 'Account');

  const handleLogoutClick = () => {
    onLogout();
    setIsMenuOpen(false);
    navigate('/login');
  };

  // Get the correct subjects route based on role
  const getSubjectsRoute = () => {
    switch(role) {
      case 'admin':
        return '/admin/manage-subjects';
      case 'teacher':
        return '/teacher/subjects';
      case 'student':
        return '/student/subjects';
      default:
        return '/subjects';
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
    return true;
  };

  // Get the display text for the role label
  const getRoleLabel = () => {
    switch(role) {
      case 'super_admin':
        return 'Super Admin';
      case 'admin':
        return 'Admin';
      case 'teacher':
        return 'Teacher';
      case 'student':
        return 'Student';
      default:
        return role ? role.charAt(0).toUpperCase() + role.slice(1) : 'Account';
    }
  };

  // Close mobile menu when route changes
  useEffect(() => {
    setIsMenuOpen(false);
  }, [location.pathname]);

  if (isLandingPage) {
    return null;
  }

  // Dynamic header styles
  const headerStyles = {
    background: `linear-gradient(135deg, ${themeColors.primary}, ${themeColors.secondary})`,
    boxShadow: `0 4px 20px ${themeColors.primary}40`,
  };

  const getButtonGradient = (primaryColor, secondaryColor) => {
    return `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})`;
  };

  return (
    <div 
      className="text-white p-4 flex flex-col z-50 shadow-lg sticky top-0 transition-all duration-300"
      style={headerStyles}
    >
      <div className="flex justify-between items-center max-w-7xl mx-auto w-full">
        {/* Logo */}
        <div className="flex items-center space-x-2">
          <GraduationCap className="h-8 w-8 text-white drop-shadow-md" />
          <h1 className="text-2xl font-bold text-white drop-shadow-md">
            AttendEase
          </h1>
        </div>

        {/* Mobile menu button */}
        <div className="md:hidden">
          <button 
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="p-2 hover:bg-white/20 rounded-full transition-colors duration-200"
            aria-label={isMenuOpen ? "Close menu" : "Open menu"}
          >
            {isMenuOpen ? (
              <X className="h-6 w-6 text-white" />
            ) : (
              <MenuIcon className="h-6 w-6 text-white" />
            )}
          </button>
        </div>

        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center space-x-6">
          {/* Dashboard link for all authenticated users */}
          {isAuthenticated && (
            <Link 
              to="/dashboard" 
              className="flex items-center space-x-2 hover:bg-white/20 transition-colors duration-200 px-3 py-2 rounded-lg"
            >
              <Home className="h-5 w-5" />
              <span>Dashboard</span>
            </Link>
          )}
          
          {/* TIMETABLE LINK - Available for everyone */}
          {isAuthenticated && role !== 'parent' && (
            <Link
              to="/timetable"
              className="flex items-center space-x-2 hover:bg-white/20 transition-colors duration-200 px-3 py-2 rounded-lg"
            >
              <Calendar className="h-5 w-5" />
              <span>Timetable</span>
            </Link>
          )}

          {/* SUBJECTS LINK - Available for everyone */}
          {isAuthenticated && (
            <Link 
              to={getSubjectsRoute()}
              className="flex items-center space-x-2 hover:bg-white/20 transition-colors duration-200 px-3 py-2 rounded-lg"
            >
              <BookMarked className="h-5 w-5" />
              <span>{getSubjectsText()}</span>
            </Link>
          )}
          
          {/* Parent-specific links (minimal nav) */}
          {isAuthenticated && role === 'parent' && (
            <>
              <Link
                to="/parent/dashboard"
                className="flex items-center space-x-2 hover:bg-white/20 transition-colors duration-200 px-3 py-2 rounded-lg"
              >
                <Home className="h-5 w-5" />
                <span>Dashboard</span>
              </Link>
              <Link
                to="/timetable"
                className="flex items-center space-x-2 hover:bg-white/20 transition-colors duration-200 px-3 py-2 rounded-lg"
              >
                <Calendar className="h-5 w-5" />
                <span>Timetable</span>
              </Link>
            </>
          )}

          {/* Student-specific links */}
          {isAuthenticated && role === 'student' && (
            <>
              <Link 
                to="/tickets" 
                className="flex items-center space-x-2 hover:bg-white/20 transition-colors duration-200 px-3 py-2 rounded-lg"
              >
                <Ticket className="h-5 w-5" />
                <span>Create Ticket</span>
              </Link>
              {(planModules === null || planModules.examManagement) && (
              <Link
                to="/exams"
                className="flex items-center space-x-2 hover:bg-white/20 transition-colors duration-200 px-3 py-2 rounded-lg"
              >
                <FileText className="h-5 w-5" />
                <span>Exams</span>
              </Link>
              )}
              {(planModules === null || planModules.financeManagement) && (
              <Link
                to="/fees"
                className="flex items-center space-x-2 hover:bg-white/20 transition-colors duration-200 px-3 py-2 rounded-lg"
              >
                <DollarSign className="h-5 w-5" />
                <span>My Fees</span>
              </Link>
              )}
            </>
          )}
          
          {/* Teacher-specific links */}
          {isAuthenticated && role === 'teacher' && (
            <>
              {shouldShowLink('/attendance') && (
                <Link 
                  to="/attendance" 
                  className="flex items-center space-x-2 hover:bg-white/20 transition-colors duration-200 px-3 py-2 rounded-lg"
                >
                  <PenSquare className="h-5 w-5" />
                  <span>Mark Attendance</span>
                </Link>
              )}

              {shouldShowLink('/attendance-overview') && (
                <Link 
                  to="/attendance-overview" 
                  className="flex items-center space-x-2 hover:bg-white/20 transition-colors duration-200 px-3 py-2 rounded-lg"
                >
                  <ClipboardCheck className="h-5 w-5" />
                  <span>Overview</span>
                </Link>
              )}

              {(planModules === null || planModules.examManagement) && (
              <Link
                to="/exams"
                className="flex items-center space-x-2 hover:bg-white/20 transition-colors duration-200 px-3 py-2 rounded-lg"
              >
                <FileText className="h-5 w-5" />
                <span>Exams</span>
              </Link>
              )}

              {(planModules === null || planModules.financeManagement) && (
              <Link
                to="/fees"
                className="flex items-center space-x-2 hover:bg-white/20 transition-colors duration-200 px-3 py-2 rounded-lg"
              >
                <DollarSign className="h-5 w-5" />
                <span>Fees</span>
              </Link>
              )}
            </>
          )}
          
          {/* Super Admin-specific links */}
          {isAuthenticated && role === 'super_admin' && (
            <>
              <Link 
                to="/super-admin/dashboard" 
                className="flex items-center space-x-2 hover:bg-white/20 transition-colors duration-200 px-3 py-2 rounded-lg"
              >
                <Home className="h-5 w-5" />
                <span>Dashboard</span>
              </Link>
              {shouldShowLink('/super-admin/tenants') && (
                <Link 
                  to="/super-admin/tenants" 
                  className="flex items-center space-x-2 hover:bg-white/20 transition-colors duration-200 px-3 py-2 rounded-lg"
                >
                  <Building2 className="h-5 w-5" />
                  <span>Tenants</span>
                </Link>
              )}
              <Link 
                to="/super-admin/support" 
                className="flex items-center space-x-2 hover:bg-white/20 transition-colors duration-200 px-3 py-2 rounded-lg"
              >
                <LifeBuoy className="h-5 w-5" />
                <span>Support</span>
              </Link>
              <Link
                to="/super-admin/plans"
                className="flex items-center space-x-2 hover:bg-white/20 transition-colors duration-200 px-3 py-2 rounded-lg"
              >
                <Package className="h-5 w-5" />
                <span>Plans</span>
              </Link>
            </>
          )}
          
          {/* Admin-specific links */}
          {isAuthenticated && role === 'admin' && (
            <>
              {shouldShowLink('/admin/upload-enrollments') && (
                <Link 
                  to="/admin/upload-enrollments" 
                  className="flex items-center space-x-2 hover:bg-white/20 transition-colors duration-200 px-3 py-2 rounded-lg"
                >
                  <Upload className="h-5 w-5" />
                  <span>Upload</span>
                </Link>
              )}

              {shouldShowLink('/admin/manage-teachers') && (
                <Link 
                  to="/admin/manage-teachers" 
                  className="flex items-center space-x-2 hover:bg-white/20 transition-colors duration-200 px-3 py-2 rounded-lg"
                >
                  <Users className="h-5 w-5" />
                  <span>Teachers</span>
                </Link>
              )}

              {shouldShowLink('/admin/roles') && (
                <Link
                  to="/admin/roles"
                  className="flex items-center space-x-2 hover:bg-white/20 transition-colors duration-200 px-3 py-2 rounded-lg"
                >
                  <UserCog className="h-5 w-5" />
                  <span>Roles</span>
                </Link>
              )}

              {shouldShowLink('/admin/timetable') && (
                <Link
                  to="/admin/timetable"
                  className="flex items-center space-x-2 hover:bg-white/20 transition-colors duration-200 px-3 py-2 rounded-lg"
                >
                  <Calendar className="h-5 w-5" />
                  <span>Timetable</span>
                </Link>
              )}

              {(planModules === null || planModules.financeManagement) && shouldShowLink('/admin/fees') && (
                <Link
                  to="/admin/fees"
                  className="flex items-center space-x-2 hover:bg-white/20 transition-colors duration-200 px-3 py-2 rounded-lg"
                >
                  <DollarSign className="h-5 w-5" />
                  <span>Fees</span>
                </Link>
              )}

              {shouldShowLink('/admin/assign-subjects') && (
                <Link 
                  to="/admin/assign-subjects" 
                  className="flex items-center space-x-2 hover:bg-white/20 transition-colors duration-200 px-3 py-2 rounded-lg"
                >
                  <Settings className="h-5 w-5" />
                  <span>Assign</span>
                </Link>
              )}

              {/* Settings link */}
              <Link 
                to="/admin/settings" 
                className="flex items-center space-x-2 hover:bg-white/20 transition-colors duration-200 px-3 py-2 rounded-lg"
              >
                <Settings className="h-5 w-5" />
                <span>Settings</span>
              </Link>

              {/* Support Link */}
              <Link 
                to="/admin/support" 
                className="flex items-center space-x-2 hover:bg-white/20 transition-colors duration-200 px-3 py-2 rounded-lg"
              >
                <LifeBuoy className="h-5 w-5" />
                <span>Support</span>
              </Link>
            </>
          )}

          {/* Authentication buttons */}
          {!isAuthenticated ? (
            <div className="flex items-center space-x-4">
              <Link 
                to="/login" 
                className="px-4 py-2 rounded-full text-white hover:shadow-lg transition-all duration-200"
                style={{
                  background: getButtonGradient(themeColors.primary, themeColors.secondary),
                  boxShadow: `0 4px 15px ${themeColors.primary}60`,
                }}
              >
                Login
              </Link>
            </div>
          ) : (
            <div className="flex items-center space-x-4">
              {/* Account dropdown */}
              <Menu as="div" className="relative inline-block text-left">
                <Menu.Button 
                  className="flex items-center space-x-2 px-4 py-2 rounded-full text-white hover:shadow-lg transition-all duration-200"
                  style={{
                    background: getButtonGradient(themeColors.primary, themeColors.secondary),
                    boxShadow: `0 4px 15px ${themeColors.primary}60`,
                  }}
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
                      <div 
                        className="px-3 py-2 text-sm font-medium border-b border-gray-100"
                        style={{ color: themeColors.primary }}
                      >
                        {role === 'super_admin' ? 'Super Admin Account' :
                         role === 'admin' ? 'Admin Account' : 
                         role === 'teacher' ? 'Teacher Account' : 
                         'Student Account'}
                      </div>
                      
                      {/* Profile link */}
                      <Menu.Item>
                        {({ active }) => (
                          <Link
                            to="/profile"
                            className={`${
                              active ? 'bg-purple-50' : ''
                            } group flex items-center rounded-md px-3 py-2 text-sm mt-1 text-gray-700`}
                            onClick={() => setIsMenuOpen(false)}
                          >
                            <User className="h-4 w-4 mr-2" />
                            Profile
                          </Link>
                        )}
                      </Menu.Item>
                      
                      {/* Subjects link in dropdown */}
                      <Menu.Item>
                        {({ active }) => (
                          <Link
                            to={getSubjectsRoute()}
                            className={`${
                              active ? 'bg-purple-50' : ''
                            } group flex items-center rounded-md px-3 py-2 text-sm text-gray-700`}
                            onClick={() => setIsMenuOpen(false)}
                          >
                            <BookMarked className="h-4 w-4 mr-2" />
                            {getSubjectsText()}
                          </Link>
                        )}
                      </Menu.Item>
                      
                      {/* Admin Settings & Support link in dropdown */}
                      {role === 'admin' && (
                        <>
                          <Menu.Item>
                            {({ active }) => (
                              <Link
                                to="/admin/settings"
                                className={`${
                                  active ? 'bg-purple-50' : ''
                                } group flex items-center rounded-md px-3 py-2 text-sm text-gray-700`}
                                onClick={() => setIsMenuOpen(false)}
                              >
                                <Settings className="h-4 w-4 mr-2" />
                                Settings
                              </Link>
                            )}
                          </Menu.Item>
                          <Menu.Item>
                            {({ active }) => (
                              <Link
                                to="/admin/support"
                                className={`${
                                  active ? 'bg-purple-50' : ''
                                } group flex items-center rounded-md px-3 py-2 text-sm text-gray-700`}
                                onClick={() => setIsMenuOpen(false)}
                              >
                                <LifeBuoy className="h-4 w-4 mr-2" />
                                Support
                              </Link>
                            )}
                          </Menu.Item>
                        </>
                      )}

                      {/* Super Admin Support link in dropdown */}
                      {role === 'super_admin' && (
                        <Menu.Item>
                          {({ active }) => (
                            <Link
                              to="/super-admin/support"
                              className={`${
                                active ? 'bg-purple-50' : ''
                              } group flex items-center rounded-md px-3 py-2 text-sm text-gray-700`}
                              onClick={() => setIsMenuOpen(false)}
                            >
                              <LifeBuoy className="h-4 w-4 mr-2" />
                              Support
                            </Link>
                          )}
                        </Menu.Item>
                      )}
                      
                      {/* Logout button */}
                      <Menu.Item>
                        {({ active }) => (
                          <button
                            onClick={handleLogoutClick}
                            className={`${
                              active ? 'bg-red-50 text-red-700' : 'text-gray-700'
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
            <div 
              className="px-3 py-2 border-b border-gray-100"
              style={{ borderColor: `${themeColors.primary}30` }}
            >
              <p className="font-medium text-gray-900">{displayName}</p>
              <p className="text-sm" style={{ color: themeColors.primary }}>
                {getRoleLabel()}
              </p>
            </div>
          )}

          {/* Dashboard link */}
          {isAuthenticated && (
            <Link 
              to="/dashboard" 
              className="flex items-center space-x-2 text-gray-700 hover:bg-purple-50 px-3 py-2 rounded-lg transition"
              onClick={() => setIsMenuOpen(false)}
            >
              <Home className="h-5 w-5" />
              <span>Dashboard</span>
            </Link>
          )}

          {/* Subjects link */}
          {isAuthenticated && (
            <Link 
              to={getSubjectsRoute()}
              className="flex items-center space-x-2 text-gray-700 hover:bg-purple-50 px-3 py-2 rounded-lg transition"
              onClick={() => setIsMenuOpen(false)}
            >
              <BookMarked className="h-5 w-5" />
              <span>{getSubjectsText()}</span>
            </Link>
          )}

          {/* Student-specific mobile links */}
          {isAuthenticated && role === 'student' && (
            <>
              <Link 
                to="/tickets" 
                className="flex items-center space-x-2 text-gray-700 hover:bg-purple-50 px-3 py-2 rounded-lg transition"
                onClick={() => setIsMenuOpen(false)}
              >
                <Ticket className="h-5 w-5" />
                <span>Create Ticket</span>
              </Link>
              {(planModules === null || planModules.examManagement) && (
              <Link
                to="/exams"
                className="flex items-center space-x-2 text-gray-700 hover:bg-purple-50 px-3 py-2 rounded-lg transition"
                onClick={() => setIsMenuOpen(false)}
              >
                <FileText className="h-5 w-5" />
                <span>Exams</span>
              </Link>
              )}
              {(planModules === null || planModules.financeManagement) && (
              <Link
                to="/fees"
                className="flex items-center space-x-2 text-gray-700 hover:bg-purple-50 px-3 py-2 rounded-lg transition"
                onClick={() => setIsMenuOpen(false)}
              >
                <DollarSign className="h-5 w-5" />
                <span>My Fees</span>
              </Link>
              )}
            </>
          )}

          {/* Teacher-specific mobile links */}
          {isAuthenticated && role === 'teacher' && (
            <>
              <Link 
                to="/attendance" 
                className="flex items-center space-x-2 text-gray-700 hover:bg-purple-50 px-3 py-2 rounded-lg transition"
                onClick={() => setIsMenuOpen(false)}
              >
                <PenSquare className="h-5 w-5" />
                <span>Mark Attendance</span>
              </Link>

              <Link 
                to="/attendance-overview" 
                className="flex items-center space-x-2 text-gray-700 hover:bg-purple-50 px-3 py-2 rounded-lg transition"
                onClick={() => setIsMenuOpen(false)}
              >
                <ClipboardCheck className="h-5 w-5" />
                <span>Overview</span>
              </Link>

              {(planModules === null || planModules.examManagement) && (
              <Link
                to="/exams"
                className="flex items-center space-x-2 text-gray-700 hover:bg-purple-50 px-3 py-2 rounded-lg transition"
                onClick={() => setIsMenuOpen(false)}
              >
                <FileText className="h-5 w-5" />
                <span>Exams</span>
              </Link>
              )}

              {(planModules === null || planModules.financeManagement) && (
              <Link
                to="/fees"
                className="flex items-center space-x-2 text-gray-700 hover:bg-purple-50 px-3 py-2 rounded-lg transition"
                onClick={() => setIsMenuOpen(false)}
              >
                <DollarSign className="h-5 w-5" />
                <span>Fees</span>
              </Link>
              )}
            </>
          )}
          
          {/* Super Admin-specific mobile links */}
          {isAuthenticated && role === 'super_admin' && (
            <>
              <Link 
                to="/super-admin/dashboard" 
                className="flex items-center space-x-2 text-gray-700 hover:bg-purple-50 px-3 py-2 rounded-lg transition"
                onClick={() => setIsMenuOpen(false)}
              >
                <Home className="h-5 w-5" />
                <span>Dashboard</span>
              </Link>
              <Link 
                to="/super-admin/tenants" 
                className="flex items-center space-x-2 text-gray-700 hover:bg-purple-50 px-3 py-2 rounded-lg transition"
                onClick={() => setIsMenuOpen(false)}
              >
                <Building2 className="h-5 w-5" />
                <span>All Tenants</span>
              </Link>
              <Link 
                to="/super-admin/support" 
                className="flex items-center space-x-2 text-gray-700 hover:bg-purple-50 px-3 py-2 rounded-lg transition"
                onClick={() => setIsMenuOpen(false)}
              >
                <LifeBuoy className="h-5 w-5" />
                <span>Support</span>
              </Link>
              <Link
                to="/super-admin/plans"
                className="flex items-center space-x-2 text-gray-700 hover:bg-purple-50 px-3 py-2 rounded-lg transition"
                onClick={() => setIsMenuOpen(false)}
              >
                <Package className="h-5 w-5" />
                <span>Plans</span>
              </Link>
            </>
          )}

          {/* Admin-specific mobile links */}
          {isAuthenticated && role === 'admin' && (
            <>
              <Link 
                to="/admin/upload-enrollments" 
                className="flex items-center space-x-2 text-gray-700 hover:bg-purple-50 px-3 py-2 rounded-lg transition"
                onClick={() => setIsMenuOpen(false)}
              >
                <Upload className="h-5 w-5" />
                <span>Upload Enrollments</span>
              </Link>

              <Link 
                to="/admin/manage-teachers" 
                className="flex items-center space-x-2 text-gray-700 hover:bg-purple-50 px-3 py-2 rounded-lg transition"
                onClick={() => setIsMenuOpen(false)}
              >
                <Users className="h-5 w-5" />
                <span>Manage Teachers</span>
              </Link>

              <Link 
                to="/admin/assign-subjects" 
                className="flex items-center space-x-2 text-gray-700 hover:bg-purple-50 px-3 py-2 rounded-lg transition"
                onClick={() => setIsMenuOpen(false)}
              >
                <Settings className="h-5 w-5" />
                <span>Assign Subjects</span>
              </Link>

              <Link 
                to="/admin/settings" 
                className="flex items-center space-x-2 text-gray-700 hover:bg-purple-50 px-3 py-2 rounded-lg transition"
                onClick={() => setIsMenuOpen(false)}
              >
                <Settings className="h-5 w-5" />
                <span>Settings</span>
              </Link>

              <Link 
                to="/admin/support" 
                className="flex items-center space-x-2 text-gray-700 hover:bg-purple-50 px-3 py-2 rounded-lg transition"
                onClick={() => setIsMenuOpen(false)}
              >
                <LifeBuoy className="h-5 w-5" />
                <span>Support</span>
              </Link>

              {(planModules === null || planModules.financeManagement) && (
              <Link
                to="/admin/fees"
                className="flex items-center space-x-2 text-gray-700 hover:bg-purple-50 px-3 py-2 rounded-lg transition"
                onClick={() => setIsMenuOpen(false)}
              >
                <DollarSign className="h-5 w-5" />
                <span>Fee Management</span>
              </Link>
              )}
            </>
          )}

          {/* Profile link in mobile */}
          {isAuthenticated && (
            <Link 
              to="/profile" 
              className="flex items-center space-x-2 text-gray-700 hover:bg-purple-50 px-3 py-2 rounded-lg transition"
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
                className="w-full px-4 py-3 rounded-lg text-white text-center transition"
                style={{
                  background: getButtonGradient(themeColors.primary, themeColors.secondary),
                }}
                onClick={() => setIsMenuOpen(false)}
              >
                Login
              </Link>
            </div>
          ) : (
            <button 
              onClick={handleLogoutClick}
              className="flex items-center space-x-2 text-red-600 hover:bg-red-50 px-3 py-3 rounded-lg transition mt-4 border-t border-gray-100 pt-4"
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