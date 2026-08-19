// src/components/newLogin.jsx
import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useNavigate, useParams } from "react-router-dom";
import { Mail, Lock, ArrowRight, GraduationCap, School, Building2, Users, Link2, Eye, EyeOff } from "lucide-react";
import axios from "axios";
import { logError } from "../../utils/logger";

const fadeIn = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 }
};

const NewLogin = ({ onLogin }) => {
  const { subdomain: urlSubdomain } = useParams();
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    subdomain: ""
  });
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [loginType, setLoginType] = useState("tenant"); // "tenant", "parent", or "super"
  const [tenantBranding, setTenantBranding] = useState(null);
  const [subdomainLocked, setSubdomainLocked] = useState(false);
  const navigate = useNavigate();

  const API_URL = process.env.REACT_APP_API_URL || "http://localhost:8011";

  // Determine tenant subdomain from the URL (unique login link) or hostname
  const resolveSubdomain = () => {
    if (urlSubdomain) return urlSubdomain;
    const query = new URLSearchParams(window.location.search).get('subdomain');
    if (query) return query;
    const hostname = window.location.hostname;
    const parts = hostname.split('.');
    if (parts.length > 2 && parts[0] !== 'www' && parts[0] !== 'app') {
      return parts[0];
    }
    return '';
  };

  // Whether we arrived via an institution's unique login link
  const resolvedSubdomain = resolveSubdomain();
  const hasTenantContext = !!resolvedSubdomain;

  // Generic /login is reserved for super admins and tenant admins; students,
  // teachers and parents must log in through their institution's unique link.
  const loginTabs = hasTenantContext
    ? [
        { key: "tenant", label: "Institution Login", icon: School },
        { key: "parent", label: "Parent", icon: Users },
        { key: "super", label: "Super Admin", icon: Building2 },
      ]
    : [
        { key: "tenant", label: "Tenant Admin", icon: School },
        { key: "super", label: "Super Admin", icon: Building2 },
      ];

  // Fetch tenant branding from subdomain on mount
  useEffect(() => {
    const subdomain = resolveSubdomain();
    if (!subdomain) return;

    setFormData(prev => ({ ...prev, subdomain }));
    setSubdomainLocked(true);

    axios.get(`${API_URL}/auth/tenant-info?subdomain=${subdomain}`)
      .then(res => {
        if (res.data.success && res.data.tenant) {
          const t = res.data.tenant;
          setTenantBranding({
            name: t.name,
            primaryColor: t.branding?.primaryColor || '#7c3aed',
            secondaryColor: t.branding?.secondaryColor || '#6366f1',
            logo: t.branding?.logo || null,
          });
        }
      })
      .catch(() => {});
  }, [urlSubdomain, API_URL]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setMessage("");
  };

  // Super Admin Login
  const handleSuperAdminLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage("");

    if (!formData.email || !formData.password) {
      setMessage({ text: "Please enter both email and password", type: "error" });
      setIsLoading(false);
      return;
    }

    try {

      const response = await axios.post(`${API_URL}/auth/super-admin/login`, {
        email: formData.email.toLowerCase().trim(),
        password: formData.password
      });

      if (response.data.success && response.data.token) {
        const { token, user } = response.data;
        
        // Store token and user data
        localStorage.setItem("token", token);
        localStorage.setItem("userId", user.id);
        localStorage.setItem("userName", user.name);
        localStorage.setItem("userEmail", user.email);
        localStorage.setItem("role", user.role);
        localStorage.setItem("isSuperAdmin", "true");
        
        // Update parent state
        onLogin(token, user.role, user.id, user.name, user.email);

        setMessage({ text: `Super Admin login successful!`, type: "success" });

        // Navigate to dashboard
        setTimeout(() => {
          navigate("/dashboard");
        }, 1000);
      } else {
        throw new Error("Invalid response from server");
      }
    } catch (error) {
      logError("Super Admin login", error);
      
      let errorMessage = "An error occurred. Please try again.";
      
      if (error.response) {
        errorMessage = error.response.data.message || `Login failed (${error.response.status})`;
      } else if (error.request) {
        errorMessage = "No response from server. Please check your connection.";
      } else {
        errorMessage = error.message;
      }
      
      setMessage({ text: errorMessage, type: "error" });
    } finally {
      setIsLoading(false);
    }
  };

  // Tenant User Login (Student, Teacher, Admin)
  const handleTenantLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage("");

    if (!formData.email || !formData.password) {
      setMessage({ text: "Please enter both email and password", type: "error" });
      setIsLoading(false);
      return;
    }

    // Get subdomain from URL (unique login link) or form input
    const subdomain = formData.subdomain || resolveSubdomain();
    
    if (!subdomain) {
      setMessage({ text: "Institution domain not found. Please use your institution's unique login link.", type: "error" });
      setIsLoading(false);
      return;
    }

    try {
      
      const response = await axios.post(`${API_URL}/auth/login`, {
        email: formData.email.toLowerCase().trim(),
        password: formData.password,
        subdomain: subdomain
      });

      if (response.data.success && response.data.token) {
        const { token, user } = response.data;
        
        // Store token and user data
        localStorage.setItem("token", token);
        localStorage.setItem("userId", user.id);
        localStorage.setItem("userName", user.name);
        localStorage.setItem("userEmail", user.email);
        localStorage.setItem("role", user.role);
        localStorage.setItem("tenantId", user.tenantId || "");
        localStorage.setItem("tenantSubdomain", subdomain);
        localStorage.setItem("isSuperAdmin", "false");
        
        // Update parent state
        onLogin(token, user.role, user.id, user.name, user.email);

        setMessage({ text: `Login successful! Welcome ${user.name} (${user.role})`, type: "success" });

        // Navigate to dashboard
        setTimeout(() => {
          navigate("/dashboard");
        }, 1000);
      } else {
        throw new Error("Invalid response from server");
      }
    } catch (error) {
      logError("Tenant login", error);
      
      let errorMessage = "An error occurred. Please try again.";
      
      if (error.response) {
        errorMessage = error.response.data.message || `Login failed (${error.response.status})`;
        
        // Handle specific error cases
        if (error.response.status === 404) {
          errorMessage = "Institution not found. Please check your subdomain.";
        } else if (error.response.status === 403) {
          errorMessage = "Your account has been deactivated. Please contact your administrator.";
        }
      } else if (error.request) {
        errorMessage = "No response from server. Please check your connection.";
      } else {
        errorMessage = error.message;
      }
      
      setMessage({ text: errorMessage, type: "error" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleParentLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage("");

    if (!formData.email || !formData.password) {
      setMessage({ text: "Please enter your email and password", type: "error" });
      setIsLoading(false);
      return;
    }

    const subdomain = formData.subdomain || resolveSubdomain();
    if (!subdomain) {
      setMessage({ text: "Institution domain not found. Please use your institution's unique login link.", type: "error" });
      setIsLoading(false);
      return;
    }

    try {
      const response = await axios.post(`${API_URL}/auth/parent-login`, {
        email: formData.email.toLowerCase().trim(),
        password: formData.password,
        subdomain,
      });

      if (response.data.success && response.data.token) {
        const { token, user } = response.data;

        localStorage.setItem("token", token);
        localStorage.setItem("userId", user.id);
        localStorage.setItem("userName", user.studentName);
        localStorage.setItem("userEmail", user.email);
        localStorage.setItem("role", "parent");
        localStorage.setItem("studentName", user.studentName);
        localStorage.setItem("studentRollNo", user.studentRollNo);
        localStorage.setItem("tenantId", user.tenantId || "");
        localStorage.setItem("tenantSubdomain", subdomain);
        localStorage.setItem("isSuperAdmin", "false");
        localStorage.setItem("accessMode", "parent");

        onLogin(token, "parent", user.id, user.studentName, user.email);

        setMessage({ text: `Parent access granted. Welcome! Viewing ${user.studentName}'s progress.`, type: "success" });

        setTimeout(() => {
          navigate("/parent/dashboard");
        }, 1000);
      }
    } catch (error) {
      let errorMessage = "An error occurred. Please try again.";
      if (error.response) {
        errorMessage = error.response.data.message || `Login failed (${error.response.status})`;
      }
      setMessage({ text: errorMessage, type: "error" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = loginType === "super" ? handleSuperAdminLogin : loginType === "parent" ? handleParentLogin : handleTenantLogin;

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-purple-50 to-purple-100 text-gray-800 flex flex-col justify-center items-center p-6">
      <motion.div
        initial="hidden"
        animate="visible"
        variants={fadeIn}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <div className="bg-white shadow-xl rounded-2xl overflow-hidden border border-purple-100">
          {/* Header Section — dynamic branding */}
          <div
            className="text-white p-6"
            style={{
              background: `linear-gradient(135deg, ${tenantBranding?.primaryColor || '#7c3aed'}, ${tenantBranding?.secondaryColor || '#6366f1'})`
            }}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-3 mb-1">
                  {tenantBranding?.logo && (
                    <img src={tenantBranding.logo} alt="" className="h-10 w-10 rounded-lg object-contain bg-white/20" />
                  )}
                  <div>
                    <h1 className="text-2xl font-bold">{tenantBranding?.name || "AttendEase ERP"}</h1>
                    <p className="text-white/80 text-sm">
                      {tenantBranding?.name ? "Institution Portal" : "Multi-Tenant Education Platform"}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Login Type Toggle */}
          <div className="flex border-b border-gray-200">
            {loginTabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setLoginType(tab.key)}
                className={`flex-1 py-3 text-center font-medium transition ${
                  loginType === tab.key
                    ? "text-purple-600 border-b-2 border-purple-600 bg-purple-50"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                <tab.icon className="w-4 h-4 inline mr-2" />
                {tab.label}
              </button>
            ))}
          </div>

          {/* Main Content */}
          <div className="p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-2">
              {loginType === "super" ? "Super Admin Access" : loginType === "parent" ? "Parent Access" : hasTenantContext ? (tenantBranding?.name ? `Welcome to ${tenantBranding.name}` : "Welcome Back") : "Tenant Admin Access"}
            </h2>
            <p className="text-gray-600 mb-6">
              {loginType === "super" 
                ? "Platform administrator login" 
                : loginType === "parent"
                  ? "Enter the email your institution has linked to your child's record"
                  : hasTenantContext
                    ? (tenantBranding?.name ? "Sign in to your institution account" : "Sign in to your institution account")
                    : "Sign in as an institution administrator. Enter your institution subdomain below."}
            </p>

            {/* Message display */}
            {message && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`p-4 rounded-lg mb-6 ${
                  message.type === "success" 
                    ? "bg-green-50 border border-green-200 text-green-700" 
                    : "bg-red-50 border border-red-200 text-red-700"
                }`}
              >
                <div className="flex items-center">
                  {message.type === "success" ? (
                    <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  )}
                  <span>{message.text}</span>
                </div>
              </motion.div>
            )}
            
            {/* Login Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Subdomain Input (only for tenant login) */}
              {subdomainLocked ? (
                <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-purple-50 border border-purple-200 text-purple-700">
                  <Link2 className="h-5 w-5 flex-shrink-0" />
                  <div className="text-sm">
                    <span className="font-semibold">{formData.subdomain}</span>
                    <span className="text-purple-600/70"> · unique login link active</span>
                  </div>
                </div>
              ) : loginType === "tenant" && (
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Building2 className="h-5 w-5 text-purple-500" />
                  </div>
                  <input
                    type="text"
                    name="subdomain"
                    value={formData.subdomain}
                    onChange={handleChange}
                    placeholder="Institution Subdomain (e.g., 'myschool')"
                    className="w-full pl-10 pr-4 py-3 border border-purple-200 rounded-lg bg-white text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Or use your institution's unique login link
                  </p>
                </div>
              )}
              
              {/* Email Input */}
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-purple-500" />
                </div>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="Email Address"
                  required
                  className="w-full pl-10 pr-4 py-3 border border-purple-200 rounded-lg bg-white text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200"
                />
              </div>
              
              {/* Password Input */}
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-purple-500" />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Password"
                  required
                  className="w-full pl-10 pr-10 py-3 border border-purple-200 rounded-lg bg-white text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(prev => !prev)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-purple-600 focus:outline-none transition-colors"
                  title={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-5 w-5 text-purple-600" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>

              {/* Forgot Password Link */}
              <div className="flex justify-end pt-0.5">
                <button
                  type="button"
                  onClick={() => navigate("/forgot-password", { state: { returnTo: hasTenantContext && formData.subdomain ? `/login/${formData.subdomain}` : "/login" } })}
                  className="text-xs font-semibold text-purple-600 hover:text-purple-700 transition-colors"
                >
                  Forgot password?
                </button>
              </div>

              {/* Submit Button */}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                type="submit"
                disabled={isLoading}
                className="w-full py-3 px-6 rounded-lg text-white font-medium transition-all duration-200 flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
                style={{
                  background: `linear-gradient(135deg, ${tenantBranding?.primaryColor || '#7c3aed'}, ${tenantBranding?.secondaryColor || '#6366f1'})`,
                }}
              >
                {isLoading ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Signing In...
                  </span>
                ) : (
                  <>
                    <span>{loginType === "super" ? "Super Admin Login" : loginType === "parent" ? "Access Parent Portal" : hasTenantContext ? "Sign In" : "Tenant Admin Login"}</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </motion.button>
            </form>
            
            {/* Divider */}
            {hasTenantContext && loginType === "tenant" && (
              <>
                <div className="flex items-center my-6">
                  <div className="flex-grow border-t border-gray-200"></div>
                  <span className="flex-shrink mx-4 text-gray-500 text-sm">New here?</span>
                  <div className="flex-grow border-t border-gray-200"></div>
                </div>

                {/* Registration options — direct paths, no submenu */}
                <div className="space-y-3">
                  <button
                    onClick={() => navigate("/register", { state: { userType: "student" } })}
                    className="w-full py-3 px-6 border-2 border-blue-500 text-blue-600 hover:bg-blue-50 rounded-lg font-medium transition-all duration-200 flex items-center justify-center space-x-2"
                  >
                    <GraduationCap className="w-5 h-5" />
                    <span>Register as Student</span>
                  </button>

                  <button
                    onClick={() => navigate("/register", { state: { userType: "teacher" } })}
                    className="w-full py-3 px-6 border-2 border-purple-500 text-purple-600 hover:bg-purple-50 rounded-lg font-medium transition-all duration-200 flex items-center justify-center space-x-2"
                  >
                    <School className="w-5 h-5" />
                    <span>Activate Teacher Account</span>
                  </button>
                </div>
              </>
            )}
            
            {/* Role Information */}
            {/* <div className="mt-6 bg-gray-50 border border-gray-100 rounded-lg p-4">
              <h3 className="font-semibold text-gray-700 mb-3 flex items-center">
                <svg className="w-4 h-4 mr-2 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                Available Roles
              </h3>
              <div className="space-y-2">
                <div className="flex items-center text-sm">
                  <div className="w-2 h-2 rounded-full bg-red-500 mr-2"></div>
                  <span className="font-medium text-gray-700">Super Admin:</span>
                  <span className="text-gray-600 ml-1">Platform-wide access</span>
                </div>
                <div className="flex items-center text-sm">
                  <div className="w-2 h-2 rounded-full bg-orange-500 mr-2"></div>
                  <span className="font-medium text-gray-700">Admin:</span>
                  <span className="text-gray-600 ml-1">Institution management</span>
                </div>
                <div className="flex items-center text-sm">
                  <div className="w-2 h-2 rounded-full bg-blue-500 mr-2"></div>
                  <span className="font-medium text-gray-700">Teacher:</span>
                  <span className="text-gray-600 ml-1">Mark attendance, verify tickets</span>
                </div>
                <div className="flex items-center text-sm">
                  <div className="w-2 h-2 rounded-full bg-green-500 mr-2"></div>
                  <span className="font-medium text-gray-700">Student:</span>
                  <span className="text-gray-600 ml-1">Submit tickets, view attendance</span>
                </div>
              </div>
            </div> */}
          </div>

          {/* Footer */}
          <div className="bg-gray-50 px-6 py-4 border-t border-gray-100">
            <div className="flex justify-between items-center">
              <p className="text-xs text-gray-500">
                AttendEase Portal &copy; {new Date().getFullYear()}
              </p>
              <div className="text-xs text-gray-500">
                v2.0.0
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default NewLogin;