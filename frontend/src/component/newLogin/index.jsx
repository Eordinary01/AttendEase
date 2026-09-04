// src/components/newLogin.jsx
import React, { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { useNavigate, useParams } from "react-router-dom";
import { 
  Mail, Lock, ArrowRight, GraduationCap, School, Building2, 
  Users, Link2, Eye, EyeOff, ShieldCheck, 
  ScanFace, Calendar, BadgeCheck, Globe, MessageSquareQuote
} from "lucide-react";
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
  const resolveSubdomain = useCallback(() => {
    if (urlSubdomain) return urlSubdomain;
    const query = new URLSearchParams(window.location.search).get('subdomain');
    if (query) return query;
    const hostname = window.location.hostname;
    const parts = hostname.split('.');
    if (parts.length > 2 && parts[0] !== 'www' && parts[0] !== 'app') {
      return parts[0];
    }
    return '';
  }, [urlSubdomain]);

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

  // Fetch tenant branding and custom message from subdomain on mount
  useEffect(() => {
    const subdomain = resolveSubdomain();
    if (!subdomain) return;

    setFormData(prev => ({ ...prev, subdomain }));
    setSubdomainLocked(true);

    axios.get(`${API_URL}/auth/tenant-info?subdomain=${subdomain}`)
      .then(res => {
        if (res.data.success && res.data.tenant) {
          const t = res.data.tenant;
          const b = t.branding || {};
          const customMsg = b.customMessage || b.welcomeMessage || null;
          setTenantBranding({
            name: b.institutionName || t.name,
            primaryColor: b.primaryColor || '#7c3aed',
            secondaryColor: b.secondaryColor || '#6366f1',
            accentColor: b.accentColor || b.primaryColor || '#7c3aed',
            logo: b.logo || null,
            customMessage: customMsg ? customMsg.trim() : null,
            subdomain: t.subdomain || subdomain,
          });
        }
      })
      .catch((err) => {
        logError("Fetch Tenant Info", err);
      });
  }, [resolveSubdomain, API_URL]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setMessage("");
  };

  // Dynamic theme colors
  const primaryColor = tenantBranding?.primaryColor || '#7c3aed';
  const secondaryColor = tenantBranding?.secondaryColor || '#6366f1';

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

  // Parent Login
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
    <div 
      className="min-h-screen bg-background text-ink relative overflow-hidden flex flex-col justify-between p-4 sm:p-6 lg:p-8"
      style={{
        "--theme-primary": primaryColor,
        "--theme-secondary": secondaryColor,
      }}
    >
      {/* Background Ambient Glows & Grid */}
      <div className="absolute inset-0 pointer-events-none -z-10">
        <div 
          className="absolute -top-40 -left-40 w-96 h-96 rounded-full blur-3xl opacity-20"
          style={{ backgroundColor: primaryColor }}
        />
        <div 
          className="absolute top-1/2 -right-40 w-96 h-96 rounded-full blur-3xl opacity-20"
          style={{ backgroundColor: secondaryColor }}
        />
        <div 
          className="absolute -bottom-40 left-1/3 w-96 h-96 rounded-full blur-3xl opacity-10"
          style={{ backgroundColor: primaryColor }}
        />
        <div className="absolute inset-0 bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:24px_24px] opacity-40 dark:opacity-10" />
      </div>

      {/* Top Navigation Bar */}
      <header className="max-w-6xl w-full mx-auto flex items-center justify-between py-2">
        <div 
          onClick={() => navigate('/')}
          className="flex items-center gap-2.5 cursor-pointer group"
        >
          {hasTenantContext && tenantBranding?.logo ? (
            <img
              src={tenantBranding.logo}
              alt={tenantBranding.name || "Logo"}
              className="h-10 w-10 rounded-xl object-contain border border-line/60 p-1 bg-surface shadow-xs group-hover:scale-105 transition-transform"
            />
          ) : (
            <div 
              className="w-9 h-9 rounded-xl text-white flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform"
              style={{ backgroundColor: primaryColor }}
            >
              <GraduationCap className="w-5 h-5" />
            </div>
          )}
          <div>
            <span className="text-base font-black tracking-tight text-ink">
              {hasTenantContext && tenantBranding?.name ? tenantBranding.name : "AttendEase"}
            </span>
            <span 
              className="text-[10px] uppercase font-bold ml-1.5 px-1.5 py-0.5 rounded border"
              style={{
                color: primaryColor,
                backgroundColor: `${primaryColor}15`,
                borderColor: `${primaryColor}30`,
              }}
            >
              {hasTenantContext && tenantBranding?.subdomain
                ? `${tenantBranding.subdomain}.attendease.com`
                : "ERP Cloud"}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-ink-soft bg-surface border border-line/50 px-3 py-1.5 rounded-full shadow-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-semibold text-ink">System Online</span>
          </div>
          <button
            onClick={() => navigate('/')}
            className="text-xs font-bold text-ink-soft hover:text-ink hover:underline transition"
          >
            Platform Overview
          </button>
        </div>
      </header>

      {/* Main 2-Column Hero & Login Section */}
      <main className="max-w-6xl w-full mx-auto grid lg:grid-cols-12 gap-8 lg:gap-12 items-center my-auto py-8">
        {/* Left Column: Brand & Value Prop */}
        <div className="lg:col-span-7 space-y-6">
          <div className="space-y-3">
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-ink tracking-tight leading-tight">
              {hasTenantContext && tenantBranding?.name ? (
                <>
                  Welcome to <span style={{ color: primaryColor }}>{tenantBranding.name}</span>
                </>
              ) : (
                <>
                  Smart Attendance & <br className="hidden sm:inline" />
                  <span style={{ color: primaryColor }}>Campus ERP Engine</span>
                </>
              )}
            </h1>

            {/* Custom Notice Message from Tenant Admin (if configured) or Default Description */}
            {hasTenantContext && tenantBranding?.customMessage ? (
              <div className="p-4 rounded-2xl bg-surface/90 border border-line/70 shadow-sm relative overflow-hidden backdrop-blur-sm space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider" style={{ color: primaryColor }}>
                  <MessageSquareQuote className="w-4 h-4" />
                  <span>Administrative Message</span>
                </div>
                <p className="text-sm text-ink leading-relaxed font-medium">
                  {tenantBranding.customMessage}
                </p>
              </div>
            ) : (
              <p className="text-sm sm:text-base text-ink-soft max-w-xl leading-relaxed">
                {hasTenantContext && tenantBranding?.name
                  ? `Sign in to access your course attendance, timetables, academic proofs, and real-time class notifications.`
                  : `Empower your institution with continuous AI face recognition attendance, timetable scheduling, fee tracking, and multi-tenant administrative control.`}
              </p>
            )}
          </div>

          {/* Feature Highlights Bento */}
          <div className="grid sm:grid-cols-2 gap-3 pt-2">
            <div className="p-4 rounded-2xl bg-surface/80 border border-line/50 shadow-xs space-y-2 backdrop-blur-sm">
              <div 
                className="w-8 h-8 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: `${primaryColor}15`, color: primaryColor }}
              >
                <ScanFace className="w-4 h-4" />
              </div>
              <h3 className="text-xs font-bold text-ink uppercase tracking-wider">AI Face Biometrics</h3>
              <p className="text-xs text-ink-soft">
                Continuous 5-second auto-marking with anti-spoof liveness detection.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-surface/80 border border-line/50 shadow-xs space-y-2 backdrop-blur-sm">
              <div 
                className="w-8 h-8 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: `${primaryColor}15`, color: primaryColor }}
              >
                <Calendar className="w-4 h-4" />
              </div>
              <h3 className="text-xs font-bold text-ink uppercase tracking-wider">Timetables & Roster</h3>
              <p className="text-xs text-ink-soft">
                Live faculty queue, automated schedule conflict detection & proof verification.
              </p>
            </div>
          </div>

          {/* Trust Metric Row */}
          <div className="flex flex-wrap items-center gap-4 text-xs font-bold text-ink-soft pt-2">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Multi-Tenant Data Isolation</span>
            </div>
            <span>•</span>
            <div className="flex items-center gap-1.5">
              <BadgeCheck className="w-4 h-4" style={{ color: primaryColor }} />
              <span>Role-Based Permissions</span>
            </div>
            <span>•</span>
            <div className="flex items-center gap-1.5">
              <Globe className="w-4 h-4 text-sky-600" />
              <span>Instant Cloud Sync</span>
            </div>
          </div>
        </div>

        {/* Right Column: Interactive Login Card */}
        <div className="lg:col-span-5 w-full">
          <motion.div
            initial="hidden"
            animate="visible"
            variants={fadeIn}
            transition={{ duration: 0.4 }}
            className="w-full"
          >
            <div className="bg-surface rounded-3xl overflow-hidden border border-line/60 shadow-xl relative backdrop-blur-md">
              {/* Accent Top Bar */}
              <div
                className="h-1.5 w-full"
                style={{
                  background: `linear-gradient(90deg, ${primaryColor}, ${secondaryColor})`
                }}
              />

              {/* Card Header & Branding */}
              <div className="p-6 sm:p-7 pb-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {tenantBranding?.logo ? (
                      <img
                        src={tenantBranding.logo}
                        alt={tenantBranding.name || "Logo"}
                        className="h-11 w-11 rounded-xl object-contain border border-line/50 p-1.5 bg-background shadow-xs"
                      />
                    ) : (
                      <div 
                        className="w-11 h-11 rounded-xl border flex items-center justify-center shadow-xs"
                        style={{
                          backgroundColor: `${primaryColor}15`,
                          borderColor: `${primaryColor}30`,
                          color: primaryColor,
                        }}
                      >
                        {loginType === "super" ? (
                          <Building2 className="w-5 h-5" />
                        ) : loginType === "parent" ? (
                          <Users className="w-5 h-5" />
                        ) : (
                          <School className="w-5 h-5" />
                        )}
                      </div>
                    )}
                    <div className="min-w-0">
                      <h2 className="text-base font-bold text-ink tracking-tight truncate">
                        {tenantBranding?.name || (loginType === "super" ? "Super Admin Portal" : "Campus Admin Access")}
                      </h2>
                      <p className="text-xs text-ink-soft truncate">
                        {loginType === "super"
                          ? "Master infrastructure authentication"
                          : loginType === "parent"
                          ? "Parent progress & attendance access"
                          : tenantBranding?.customMessage
                          ? tenantBranding.customMessage
                          : hasTenantContext
                          ? "Enter your credentials to continue"
                          : "Institution administrator sign-in"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Login Type Segmented Toggle */}
                <div className="flex p-1 rounded-xl bg-background border border-line/50">
                  {loginTabs.map((tab) => {
                    const TabIcon = tab.icon;
                    const isActive = loginType === tab.key;
                    return (
                      <button
                        key={tab.key}
                        onClick={() => setLoginType(tab.key)}
                        className={`flex-1 py-2 text-center text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                          isActive
                            ? "bg-surface shadow-xs border border-line/60"
                            : "text-ink-soft hover:text-ink"
                        }`}
                        style={isActive ? { color: primaryColor } : undefined}
                      >
                        <TabIcon className="w-3.5 h-3.5" />
                        <span>{tab.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Card Body / Form */}
              <div className="px-6 sm:px-7 pb-6 space-y-4">
                {/* Status Message */}
                {message && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`p-3.5 rounded-xl text-xs flex items-center gap-2.5 font-medium ${
                      message.type === "success"
                        ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-600"
                        : "bg-rose-500/10 border border-rose-500/20 text-rose-600"
                    }`}
                  >
                    <span>{message.text}</span>
                  </motion.div>
                )}

                <form onSubmit={handleSubmit} className="space-y-3.5">
                  {/* Subdomain Input */}
                  {subdomainLocked ? (
                    <div 
                      className="flex items-center justify-between px-3.5 py-2.5 rounded-xl border text-xs"
                      style={{
                        backgroundColor: `${primaryColor}0c`,
                        borderColor: `${primaryColor}30`,
                        color: primaryColor,
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <Link2 className="h-4 w-4 shrink-0" />
                        <span className="font-bold font-mono">{formData.subdomain}</span>
                      </div>
                      <span className="text-[11px] font-semibold text-emerald-600">✓ Connected</span>
                    </div>
                  ) : (
                    loginType === "tenant" && (
                      <div className="space-y-1">
                        <label className="block text-xs font-bold text-ink-soft uppercase tracking-wider">
                          Institution Subdomain
                        </label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-ink-faint">
                            <Building2 className="h-4 w-4" />
                          </div>
                          <input
                            type="text"
                            name="subdomain"
                            value={formData.subdomain}
                            onChange={handleChange}
                            placeholder="e.g., apex-univ"
                            className="w-full pl-10 pr-4 py-2.5 border border-line/50 rounded-xl bg-background text-ink text-xs focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition"
                          />
                        </div>
                        <p className="text-[11px] text-ink-faint">
                          Or sign in directly using your institution's custom link
                        </p>
                      </div>
                    )
                  )}

                  {/* Email Input */}
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-ink-soft uppercase tracking-wider">
                      Email Address
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-ink-faint">
                        <Mail className="h-4 w-4" />
                      </div>
                      <input
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleChange}
                        placeholder={loginType === "super" ? "superadmin@attendease.com" : "admin@institution.edu"}
                        required
                        className="w-full pl-10 pr-4 py-2.5 border border-line/50 rounded-xl bg-background text-ink text-xs focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition"
                      />
                    </div>
                  </div>

                  {/* Password Input */}
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-ink-soft uppercase tracking-wider">
                      Password
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-ink-faint">
                        <Lock className="h-4 w-4" />
                      </div>
                      <input
                        type={showPassword ? "text" : "password"}
                        name="password"
                        value={formData.password}
                        onChange={handleChange}
                        placeholder="••••••••"
                        required
                        className="w-full pl-10 pr-10 py-2.5 border border-line/50 rounded-xl bg-background text-ink text-xs focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((prev) => !prev)}
                        className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-ink-faint hover:text-ink transition cursor-pointer"
                        title={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Forgot Password Link */}
                  <div className="flex justify-end pt-0.5">
                    <button
                      type="button"
                      onClick={() =>
                        navigate("/forgot-password", {
                          state: {
                            returnTo:
                              hasTenantContext && formData.subdomain
                                ? `/login/${formData.subdomain}`
                                : "/login",
                          },
                        })
                      }
                      className="text-xs font-bold hover:underline transition cursor-pointer"
                      style={{ color: primaryColor }}
                    >
                      Forgot password?
                    </button>
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-3 px-4 rounded-xl text-white text-xs font-bold transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-md hover:shadow-lg cursor-pointer mt-2"
                    style={{
                      background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})`
                    }}
                  >
                    {isLoading ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        <span>
                          {loginType === "super"
                            ? "Authorize Super Admin"
                            : loginType === "parent"
                            ? "Access Parent Portal"
                            : hasTenantContext
                            ? `Sign In to ${tenantBranding?.name ? tenantBranding.name : "Portal"}`
                            : "Sign In as Tenant Admin"}
                        </span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>

                {/* Direct Registration Shortcuts (For Tenant Context) */}
                {hasTenantContext && loginType === "tenant" && (
                  <>
                    <div className="flex items-center gap-3 my-3">
                      <div className="flex-1 border-t border-line/50"></div>
                      <span className="text-[10px] font-bold text-ink-faint uppercase tracking-wider">
                        New Campus Member?
                      </span>
                      <div className="flex-1 border-t border-line/50"></div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => navigate("/register", { state: { userType: "student" } })}
                        className="py-2.5 px-3 border border-line/50 hover:border-primary/40 rounded-xl text-xs font-bold text-ink hover:bg-background transition flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <GraduationCap className="w-3.5 h-3.5" style={{ color: primaryColor }} />
                        <span>Student Register</span>
                      </button>

                      <button
                        onClick={() => navigate("/register", { state: { userType: "teacher" } })}
                        className="py-2.5 px-3 border border-line/50 hover:border-primary/40 rounded-xl text-xs font-bold text-ink hover:bg-background transition flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <School className="w-3.5 h-3.5" style={{ color: primaryColor }} />
                        <span>Teacher Activate</span>
                      </button>
                    </div>
                  </>
                )}
              </div>

              {/* Card Footer */}
              <div className="bg-background/60 px-6 sm:px-7 py-3 border-t border-line/50 flex justify-between items-center text-[11px] text-ink-faint">
                <span className="flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                  <span>256-Bit TLS Secured</span>
                </span>
                <span className="font-mono">{tenantBranding?.subdomain ? `${tenantBranding.subdomain}.attendease` : "AttendEase Cloud"}</span>
              </div>
            </div>
          </motion.div>
        </div>
      </main>

      {/* Footer Copyright */}
      <footer className="max-w-6xl w-full mx-auto flex flex-col sm:flex-row items-center justify-between text-xs text-ink-soft py-2 border-t border-line/40 gap-2">
        <p>&copy; {new Date().getFullYear()} {tenantBranding?.name || "AttendEase Technologies Inc."}. All rights reserved.</p>
        <div className="flex items-center gap-4 text-xs">
          <span className="text-ink-faint">Privacy Policy</span>
          <span>•</span>
          <span className="text-ink-faint">Terms of Service</span>
          <span>•</span>
          <span className="text-ink-faint">Support</span>
        </div>
      </footer>
    </div>
  );
};

export default NewLogin;