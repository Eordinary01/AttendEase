// src/components/newLogin.jsx
import React, { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { useNavigate, useParams, Link } from "react-router-dom";
import { 
  Mail, Lock, ArrowRight, GraduationCap, School, Building2, 
  Users, Link2, Eye, EyeOff, ShieldCheck, 
  ScanFace, Calendar, BadgeCheck, Globe, MessageSquareQuote
} from "lucide-react";
import axios from "axios";
import { logError } from "../../utils/logger";
import { getApiBaseUrl } from "../../utils/api";
import { DEFAULT_PRIMARY, DEFAULT_SECONDARY } from "../../utils/theme";
import { useTheme } from "../../contexts/ThemeContexts";
import { setActiveTenant as persistActiveTenant } from "../../utils/activeTenant";

const fadeIn = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 }
};

const NewLogin = ({ onLogin }) => {
  const { subdomain: urlSubdomain } = useParams();
  const { applyThemeColors } = useTheme();
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    subdomain: ""
  });
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [tenantBranding, setTenantBranding] = useState(null);
  const [subdomainLocked, setSubdomainLocked] = useState(false);
  const navigate = useNavigate();

  const apiBase = getApiBaseUrl();
  const API_URL = apiBase.endsWith('/api') ? apiBase : `${apiBase}/api`;

  // Determine tenant subdomain from the URL param, query param, or explicit hostname opt-in
  const resolveSubdomain = useCallback(() => {
    if (urlSubdomain) return urlSubdomain;
    const query = new URLSearchParams(window.location.search).get('subdomain');
    if (query) return query;

    const enableHostnameSubdomain =
      process.env.REACT_APP_ENABLE_HOSTNAME_SUBDOMAIN === 'true';
    if (!enableHostnameSubdomain) return '';

    const hostname = window.location.hostname;
    const parts = hostname.split('.');
    if (parts.length > 2 && parts[0] !== 'www' && parts[0] !== 'app') {
      return parts[0];
    }
    return '';
  }, [urlSubdomain]);

  const resolvedSubdomain = resolveSubdomain();
  const hasTenantContext = !!resolvedSubdomain;
  const isSuperAdminLoginRoute = !urlSubdomain && !resolvedSubdomain;

  // Initialize and synchronize loginType based on route mode
  const [loginType, setLoginType] = useState(() => (isSuperAdminLoginRoute ? "super" : "tenant"));

  useEffect(() => {
    if (isSuperAdminLoginRoute) {
      setLoginType("super");
    } else {
      setLoginType((prev) => (prev === "parent" ? "parent" : "tenant"));
    }
  }, [isSuperAdminLoginRoute]);

  // Strict route-level tab isolation:
  // /login -> Super Admin ONLY
  // /login/:subdomain -> Institution Members & Parents ONLY
  const loginTabs = isSuperAdminLoginRoute
    ? [{ key: "super", label: "Super Admin", icon: Building2 }]
    : [
        { key: "tenant", label: "Institution Login", icon: School },
        { key: "parent", label: "Parent", icon: Users },
      ];

  // Fetch tenant branding and custom message from subdomain on mount
  useEffect(() => {
    // If on master platform super admin route, ensure default colors
    if (isSuperAdminLoginRoute) {
      if (applyThemeColors) {
        applyThemeColors({ primary: DEFAULT_PRIMARY, secondary: DEFAULT_SECONDARY });
      }
      return;
    }

    const subdomain = resolveSubdomain();
    if (!subdomain) return;
    if (subdomain === 'demo') {
      navigate('/', { replace: true });
      return;
    }

    setFormData(prev => ({ ...prev, subdomain }));
    setSubdomainLocked(true);

    axios.get(`${API_URL}/auth/tenant-info?subdomain=${subdomain}`)
      .then(res => {
        if (res.data.success && res.data.tenant) {
          const t = res.data.tenant;
          const b = t.branding || {};
          const customMsg = b.customMessage || b.welcomeMessage || null;

          // Check if tenant's plan allows custom branding OR if tenant is in active trial, AND custom colors were specified
          const isTrial = t.subscription?.status === 'trial' || Boolean(t.trialEndsAt);
          const planAllowsBranding = isTrial || (t.hasCustomBranding ?? ['professional', 'enterprise'].includes(t.plan || t.subscription?.plan));
          const hasCustomColors = planAllowsBranding && b.primaryColor && b.primaryColor.trim() !== '';

          const effectivePrimary = hasCustomColors ? b.primaryColor.trim() : DEFAULT_PRIMARY;
          const effectiveSecondary = (hasCustomColors && b.secondaryColor && b.secondaryColor.trim() !== '')
            ? b.secondaryColor.trim()
            : DEFAULT_SECONDARY;

          setTenantBranding({
            name: b.institutionName || t.name,
            primaryColor: effectivePrimary,
            secondaryColor: effectiveSecondary,
            accentColor: effectivePrimary,
            logo: b.logo || null,
            customMessage: customMsg ? customMsg.trim() : null,
            subdomain: t.subdomain || subdomain,
            hasCustomBranding: planAllowsBranding,
          });

          // Apply tenant's custom theme to document root CSS variables
          if (applyThemeColors) {
            applyThemeColors({
              primary: effectivePrimary,
              secondary: effectiveSecondary,
            });
          }

          // Persist active campus for walkthrough and switcher recognition
          persistActiveTenant({
            subdomain: t.subdomain || subdomain,
            name: b.institutionName || t.name,
            logo: b.logo || null,
            primaryColor: effectivePrimary,
          });
        }
      })
      .catch((err) => {
        logError("Fetch Tenant Info", err);
      });
  }, [resolveSubdomain, API_URL, isSuperAdminLoginRoute, applyThemeColors, navigate]);

  // Clean up and restore default institutional theme when navigating away
  useEffect(() => {
    return () => {
      if (applyThemeColors) {
        applyThemeColors({
          primary: DEFAULT_PRIMARY,
          secondary: DEFAULT_SECONDARY,
        });
      }
    };
  }, [applyThemeColors]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setMessage("");
  };

  // Dynamic theme colors
  const primaryColor = tenantBranding?.primaryColor || DEFAULT_PRIMARY;
  const secondaryColor = tenantBranding?.secondaryColor || DEFAULT_SECONDARY;

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
      const response = await axios.post(
        `${API_URL}/auth/super-admin/login`,
        {
          email: formData.email.toLowerCase().trim(),
          password: formData.password
        },
        { withCredentials: true }
      );

      if (response.data.success && (response.data.user || response.data.token)) {
        const { token, user } = response.data;
        
        if (token) {
          localStorage.setItem("token", token);
        }
        localStorage.removeItem("refreshToken");
        localStorage.setItem("userId", user.id);
        localStorage.setItem("userName", user.name);
        localStorage.setItem("userEmail", user.email);
        localStorage.setItem("role", user.role);
        localStorage.setItem("isSuperAdmin", "true");
        
        // Update parent state
        onLogin(token || null, user.role, user.id, user.name, user.email);

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
      const response = await axios.post(
        `${API_URL}/auth/login`,
        {
          email: formData.email.toLowerCase().trim(),
          password: formData.password,
          subdomain: subdomain
        },
        { withCredentials: true }
      );

      if (response.data.success && (response.data.user || response.data.token)) {
        const { token, user } = response.data;
        
        if (token) {
          localStorage.setItem("token", token);
        }
        localStorage.setItem("user", JSON.stringify(user));
        localStorage.setItem("userId", user.id || user._id);
        localStorage.setItem("userName", user.name);
        localStorage.setItem("userEmail", user.email);
        localStorage.setItem("userSection", user.section || "");
        localStorage.setItem("userRollNo", user.rollNo || "");
        localStorage.setItem("role", user.role);
        localStorage.setItem("tenantId", user.tenantId || "");
        localStorage.setItem("tenantSubdomain", subdomain);
        localStorage.setItem("isSuperAdmin", "false");
        
        // Update parent state
        onLogin(token || null, user.role, user.id, user.name, user.email);

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
      const response = await axios.post(
        `${API_URL}/auth/parent-login`,
        {
          email: formData.email.toLowerCase().trim(),
          password: formData.password,
          subdomain,
        },
        { withCredentials: true }
      );

      if (response.data.success && (response.data.user || response.data.token)) {
        const { token, user } = response.data;

        if (token) {
          localStorage.setItem("token", token);
        }
        localStorage.removeItem("refreshToken");
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

        onLogin(token || null, "parent", user.id, user.studentName, user.email);

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

  const handleSubmit = isSuperAdminLoginRoute
    ? handleSuperAdminLogin
    : loginType === "parent"
    ? handleParentLogin
    : handleTenantLogin;

  return (
    <div 
      className="min-h-screen bg-background text-ink relative overflow-hidden flex flex-col justify-between"
      style={{
        "--theme-primary": primaryColor,
        "--theme-secondary": secondaryColor,
      }}
    >
      {/* Top 3px Architectural Institutional Roofline Strip */}
      <div className="w-full h-[3px] bg-gradient-to-r from-primary via-primary-light to-secondary shrink-0" />

      {/* Atmospheric Subtle Ambient Brand Wash & Graph Grid */}
      <div className="absolute inset-0 pointer-events-none -z-10 bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,rgba(var(--color-primary),0.07),transparent_70%)]" />
      <div className="absolute inset-0 pointer-events-none -z-10 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:24px_24px] opacity-60 dark:opacity-10" />

      <div className="p-4 sm:p-6 lg:p-8 flex-1 flex flex-col justify-between">
        {/* Top Navigation Bar */}
        <header className="max-w-6xl w-full mx-auto flex items-center justify-between py-2 border-b border-line mb-4">
          <div 
            onClick={() => navigate('/')}
            className="flex items-center gap-2.5 cursor-pointer group"
          >
            {!isSuperAdminLoginRoute && hasTenantContext && tenantBranding?.logo ? (
              <img
                src={tenantBranding.logo}
                alt={tenantBranding.name || "Logo"}
                className="h-9 w-9 rounded object-contain border border-primary/30 ring-2 ring-primary/15 p-1 bg-surface shadow-xs transition-transform group-hover:scale-105"
              />
            ) : (
              <div 
                className="w-8 h-8 rounded bg-primary text-on-primary flex items-center justify-center shadow-xs transition-transform group-hover:scale-105"
              >
                {isSuperAdminLoginRoute ? <Building2 className="w-4 h-4" /> : <GraduationCap className="w-4 h-4" />}
              </div>
            )}
            <div>
              <span className="text-sm font-bold tracking-tight text-ink group-hover:text-primary transition-colors">
                {!isSuperAdminLoginRoute && hasTenantContext && tenantBranding?.name
                  ? tenantBranding.name
                  : "AttendEase"}
              </span>
              <span 
                className="text-[10px] uppercase font-mono font-medium ml-2 px-2 py-0.5 rounded border border-primary/25 bg-primary-soft text-primary-ink shadow-xs"
              >
                {isSuperAdminLoginRoute
                  ? "Super Admin"
                  : hasTenantContext && tenantBranding?.subdomain
                  ? `${tenantBranding.subdomain}.attendease.app`
                  : "Academic ERP"}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-ink-muted bg-surface border border-line px-2.5 py-1 rounded shadow-xs font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-status-success-text" />
              <span>OPERATIONAL</span>
            </div>
            <button
              onClick={() => navigate('/')}
              className="text-xs font-medium text-ink-muted hover:text-primary transition-colors cursor-pointer"
            >
              &larr; Platform Overview
            </button>
          </div>
        </header>

        {/* Main 2-Column Hero & Login Section */}
        <main className="max-w-6xl w-full mx-auto grid lg:grid-cols-12 gap-8 lg:gap-12 items-center my-auto py-4">
          {/* Left Column: Brand & Value Prop */}
          <div className="lg:col-span-7 space-y-6">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded bg-primary-soft/80 border border-primary/25 text-xs text-primary-ink w-fit shadow-xs">
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
                <span className="font-mono uppercase tracking-wider text-[11px] font-semibold">
                  {isSuperAdminLoginRoute ? "Platform Management" : "Institutional Access"}
                </span>
              </div>

              <h1 className="font-headline text-3xl sm:text-4xl lg:text-5xl font-bold text-ink tracking-tight leading-tight">
                {isSuperAdminLoginRoute ? (
                  <>
                    AttendEase Platform <br className="hidden sm:inline" />
                    <span className="text-primary font-extrabold">Super Admin Portal</span>
                  </>
                ) : hasTenantContext && tenantBranding?.name ? (
                  <>
                    Welcome to <br className="hidden sm:inline" />
                    <span className="text-primary font-extrabold">{tenantBranding.name}</span>
                  </>
                ) : (
                  <>
                    Unified Academic ERP & <br className="hidden sm:inline" />
                    <span className="text-primary font-extrabold">Registrar Engine</span>
                  </>
                )}
              </h1>

              {/* Custom Notice Message from Tenant Admin (if configured) or Default Description */}
              {!isSuperAdminLoginRoute && hasTenantContext && tenantBranding?.customMessage ? (
                <div className="p-4 rounded-panel bg-primary-soft/30 border border-primary/20 border-l-4 border-l-primary shadow-xs space-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-primary font-mono">
                    <MessageSquareQuote className="w-3.5 h-3.5" />
                    <span>Administrative Notice</span>
                  </div>
                  <p className="text-xs text-ink leading-relaxed">
                    {tenantBranding.customMessage}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-ink-muted max-w-xl leading-relaxed">
                  {isSuperAdminLoginRoute
                    ? "Centralized multi-tenant infrastructure control, tenant provisioning, global telemetry monitoring, and institutional plan licensing."
                    : hasTenantContext && tenantBranding?.name
                    ? `Sign in to access official course rosters, timetables, academic proof registers, and verified attendance audits.`
                    : `Deterministic academic administration with verified biometric attendance, timetable clash auditing, fee ledger records, and multi-tenant data isolation.`}
                </p>
              )}
            </div>

            {/* Feature Highlights Bento */}
            <div className="grid sm:grid-cols-2 gap-3 pt-1">
              <div className="p-3.5 rounded-panel bg-surface border border-line hover:border-primary/40 transition-colors shadow-xs space-y-1.5 group">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded bg-primary-soft border border-primary/25 text-primary flex items-center justify-center transition-transform group-hover:scale-105">
                    {isSuperAdminLoginRoute ? <Building2 className="w-3.5 h-3.5" /> : <ScanFace className="w-3.5 h-3.5" />}
                  </div>
                  <h3 className="text-xs font-semibold text-ink group-hover:text-primary transition-colors uppercase tracking-wide">
                    {isSuperAdminLoginRoute ? "Multi-Tenant Cloud" : "Local Vector Auth"}
                  </h3>
                </div>
                <p className="text-xs text-ink-muted leading-relaxed">
                  {isSuperAdminLoginRoute
                    ? "Tenant lifecycle provisioning, subscription controls, and strict database isolation."
                    : "Continuous automated verification with client-side biometric vector matching."}
                </p>
              </div>

              <div className="p-3.5 rounded-panel bg-surface border border-line hover:border-secondary/40 transition-colors shadow-xs space-y-1.5 group">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded bg-secondary-soft border border-secondary/25 text-secondary flex items-center justify-center transition-transform group-hover:scale-105">
                    {isSuperAdminLoginRoute ? <Globe className="w-3.5 h-3.5" /> : <Calendar className="w-3.5 h-3.5" />}
                  </div>
                  <h3 className="text-xs font-semibold text-ink group-hover:text-secondary transition-colors uppercase tracking-wide">
                    {isSuperAdminLoginRoute ? "System Observability" : "Timetable & Roster"}
                  </h3>
                </div>
                <p className="text-xs text-ink-muted leading-relaxed">
                  {isSuperAdminLoginRoute
                    ? "Real-time error traces, platform telemetry, and global tenant activity inspection."
                    : "Automated schedule clash auditing, room allocation checks, and session registers."}
                </p>
              </div>
            </div>

            {/* Trust Metric Row */}
            <div className="flex flex-wrap items-center gap-3 text-xs font-mono text-ink-muted pt-1">
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-status-success-text" />
                <span>Tenant Data Isolation</span>
              </div>
              <span className="text-line">&bull;</span>
              <div className="flex items-center gap-1.5">
                <BadgeCheck className="w-3.5 h-3.5 text-primary" />
                <span>RBAC Permissions</span>
              </div>
              <span className="text-line">&bull;</span>
              <div className="flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-secondary" />
                <span>WCAG AA Certified</span>
              </div>
            </div>
          </div>

        {/* Right Column: Interactive Login Card */}
        <div className="lg:col-span-5 w-full">
          <motion.div
            initial="hidden"
            animate="visible"
            variants={fadeIn}
            transition={{ duration: 0.3 }}
            className="w-full"
          >
            <div className="bg-surface rounded-panel overflow-hidden border border-line hover:border-primary/30 transition-colors shadow-level2 relative">
              {/* Institutional Accent Top Roofline Strip */}
              <div className="h-[3px] w-full bg-gradient-to-r from-primary via-primary-light to-secondary" />

              {/* Card Header & Branding */}
              <div className="p-5 sm:p-6 pb-3 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {!isSuperAdminLoginRoute && tenantBranding?.logo ? (
                      <img
                        src={tenantBranding.logo}
                        alt={tenantBranding.name || "Logo"}
                        className="h-10 w-10 rounded object-contain border border-primary/30 ring-2 ring-primary/20 p-1 bg-background shadow-xs"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded border border-primary/25 bg-primary-soft text-primary flex items-center justify-center shadow-xs">
                        {isSuperAdminLoginRoute ? (
                          <Building2 className="w-5 h-5" />
                        ) : loginType === "parent" ? (
                          <Users className="w-5 h-5" />
                        ) : (
                          <School className="w-5 h-5" />
                        )}
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h2 className="text-sm font-bold text-ink tracking-tight truncate">
                          {isSuperAdminLoginRoute
                            ? "Super Admin Portal"
                            : tenantBranding?.name || "Campus Portal Access"}
                        </h2>
                      </div>
                      <p className="text-xs text-ink-muted truncate">
                        {isSuperAdminLoginRoute
                          ? "Master infrastructure authentication"
                          : loginType === "parent"
                          ? "Parent progress & attendance access"
                          : "Enter institutional credentials to continue"}
                      </p>
                      {!isSuperAdminLoginRoute && hasTenantContext && (
                        <span className="inline-block mt-1 px-1.5 py-0.5 rounded bg-primary-soft text-primary-ink font-mono text-[10px] font-semibold border border-primary/20">
                          Verified Campus Portal
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Login Type Segmented Toggle */}
                {!isSuperAdminLoginRoute ? (
                  <div className="flex p-0.5 rounded bg-surface-subtle border border-line">
                    {loginTabs.map((tab) => {
                      const TabIcon = tab.icon;
                      const isActive = loginType === tab.key;
                      return (
                        <button
                          key={tab.key}
                          type="button"
                          onClick={() => setLoginType(tab.key)}
                          className={`flex-1 py-1.5 text-center text-xs font-medium rounded transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                            isActive
                              ? "bg-surface shadow-xs border border-primary/30 text-primary-ink font-semibold border-b-2 border-b-primary"
                              : "text-ink-muted hover:text-ink hover:bg-surface/50"
                          }`}
                        >
                          <TabIcon className="w-3.5 h-3.5" />
                          <span>{tab.label}</span>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 px-2.5 py-1 rounded bg-primary-soft border border-primary/25 text-xs font-mono font-semibold text-primary-ink w-fit">
                    <Building2 className="w-3.5 h-3.5 text-primary" />
                    <span>MASTER_CONTROL_PLANE</span>
                  </div>
                )}
              </div>

              {/* Card Body / Form */}
              <div className="px-5 sm:px-6 pb-5 space-y-3">
                {/* Status Message */}
                {message && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`p-2.5 rounded text-xs flex items-center gap-2 font-medium border ${
                      message.type === "success"
                        ? "bg-status-success-bg border-status-success-border text-status-success-text"
                        : "bg-status-error-bg border-status-error-border text-status-error-text"
                    }`}
                  >
                    <span>{message.text}</span>
                  </motion.div>
                )}

                <form onSubmit={handleSubmit} className="space-y-3">
                  {/* Subdomain Input */}
                  {!isSuperAdminLoginRoute && (
                    subdomainLocked ? (
                      <div className="flex items-center justify-between px-3 py-2 rounded border border-primary/25 bg-primary-soft/40 text-xs">
                        <div className="flex items-center gap-2">
                          <Link2 className="h-3.5 w-3.5 shrink-0 text-primary" />
                          <span className="font-mono font-semibold text-ink">{formData.subdomain}</span>
                        </div>
                        <span className="text-[11px] font-mono text-primary font-semibold">Verified</span>
                      </div>
                    ) : (
                      loginType === "tenant" && (
                        <div className="space-y-1">
                          <label className="block text-xs font-medium text-ink uppercase tracking-wide">
                            Institution Subdomain
                          </label>
                          <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-ink-muted">
                              <Building2 className="h-3.5 w-3.5" />
                            </div>
                            <input
                              type="text"
                              name="subdomain"
                              value={formData.subdomain}
                              onChange={handleChange}
                              placeholder="e.g., oxford"
                              className="w-full pl-9 pr-3 h-9 border border-line rounded bg-surface text-ink text-xs focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition font-mono"
                            />
                          </div>
                          <p className="text-[11px] text-ink-muted">
                            Or sign in directly using your institution's custom portal link
                          </p>
                        </div>
                      )
                    )
                  )}

                  {/* Email Input */}
                  <div className="space-y-1">
                    <label className="block text-xs font-medium text-ink uppercase tracking-wide">
                      Email Address
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-ink-muted">
                        <Mail className="h-3.5 w-3.5" />
                      </div>
                      <input
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleChange}
                        placeholder={isSuperAdminLoginRoute ? "superadmin@attendease.com" : loginType === "parent" ? "parent@example.com" : "user@institution.edu"}
                        required
                        className="w-full pl-9 pr-3 h-9 border border-line rounded bg-surface text-ink text-xs focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition"
                      />
                    </div>
                  </div>

                  {/* Password Input */}
                  <div className="space-y-1">
                    <label className="block text-xs font-medium text-ink uppercase tracking-wide">
                      Password
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-ink-muted">
                        <Lock className="h-3.5 w-3.5" />
                      </div>
                      <input
                        type={showPassword ? "text" : "password"}
                        name="password"
                        value={formData.password}
                        onChange={handleChange}
                        placeholder="••••••••"
                        required
                        className="w-full pl-9 pr-9 h-9 border border-line rounded bg-surface text-ink text-xs focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((prev) => !prev)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-ink-muted hover:text-ink transition cursor-pointer"
                        title={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
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
                              !isSuperAdminLoginRoute && hasTenantContext && formData.subdomain
                                ? `/login/${formData.subdomain}`
                                : "/login",
                          },
                        })
                      }
                      className="text-xs font-medium text-primary hover:text-primary-hover hover:underline transition cursor-pointer"
                    >
                      Forgot password?
                    </button>
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full h-10 px-4 rounded bg-primary hover:bg-primary-hover text-on-primary text-xs font-semibold transition flex items-center justify-center gap-2 disabled:opacity-50 shadow-xs hover:shadow cursor-pointer mt-2 active:scale-[0.99]"
                  >
                    {isLoading ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded animate-spin" />
                    ) : (
                      <>
                        <span>
                          {isSuperAdminLoginRoute
                            ? "Authorize Super Admin"
                            : loginType === "parent"
                            ? "Access Parent Portal"
                            : hasTenantContext
                            ? `Sign In to ${tenantBranding?.name ? tenantBranding.name : "Portal"}`
                            : "Sign In to Portal"}
                        </span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </>
                    )}
                  </button>
                </form>

                {/* Notice for non-super admins landing on /login */}
                {isSuperAdminLoginRoute && (
                  <div className="mt-3 p-3 rounded bg-surface-subtle border border-line space-y-1.5 text-xs">
                    <div className="flex items-center gap-1.5 font-semibold text-ink">
                      <School className="w-3.5 h-3.5 text-primary shrink-0" />
                      <span>Looking for your institution's portal?</span>
                    </div>
                    <p className="text-ink-muted leading-relaxed text-[11px]">
                      Campus administrators, faculty, students, and parents must sign in via their institution's unique login link (e.g. <span className="font-mono font-medium text-ink">/login/your-institution</span>).
                    </p>
                    <button
                      type="button"
                      onClick={() => navigate('/')}
                      className="text-[11px] font-medium text-primary hover:underline flex items-center gap-1 pt-0.5 cursor-pointer"
                    >
                      <span>Return to Home Overview &rarr;</span>
                    </button>
                  </div>
                )}

                {/* Direct Registration Shortcuts (For Tenant Context) */}
                {!isSuperAdminLoginRoute && hasTenantContext && loginType === "tenant" && (
                  <>
                    <div className="flex items-center gap-3 my-2">
                      <div className="flex-1 border-t border-line"></div>
                      <span className="text-[10px] font-mono text-ink-muted uppercase tracking-wider">
                        New Campus Member?
                      </span>
                      <div className="flex-1 border-t border-line"></div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => navigate("/register", { state: { userType: "student", subdomain: formData.subdomain || resolvedSubdomain } })}
                        className="h-8 px-2.5 border border-line hover:border-primary/40 bg-surface hover:bg-primary-soft/30 rounded text-xs font-medium text-ink hover:text-primary transition flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <GraduationCap className="w-3.5 h-3.5 text-primary" />
                        <span>Student Register</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => navigate("/register", { state: { userType: "teacher", subdomain: formData.subdomain || resolvedSubdomain } })}
                        className="h-8 px-2.5 border border-line hover:border-secondary/40 bg-surface hover:bg-secondary-soft/30 rounded text-xs font-medium text-ink hover:text-secondary transition flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <School className="w-3.5 h-3.5 text-secondary" />
                        <span>Teacher Activate</span>
                      </button>
                    </div>
                  </>
                )}
              </div>

              {/* Card Footer */}
              <div className="bg-surface-subtle px-5 py-2.5 border-t border-line flex justify-between items-center text-[11px] text-ink-muted font-mono">
                <span className="flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-status-success-text" />
                  <span>256-Bit TLS Secured</span>
                </span>
                <span className="text-primary font-medium">
                  {isSuperAdminLoginRoute
                    ? "MASTER_PLANE"
                    : tenantBranding?.subdomain
                    ? `${tenantBranding.subdomain}.attendease`
                    : "ATTENDEASE_CLOUD"}
                </span>
              </div>
            </div>
          </motion.div>
        </div>
      </main>

      {/* Footer Copyright */}
      <footer className="max-w-6xl w-full mx-auto flex flex-col sm:flex-row items-center justify-between text-xs text-ink-soft py-2 border-t border-line/40 gap-2">
        <p>&copy; {new Date().getFullYear()} {tenantBranding?.name || "AttendEase Technologies Inc."}. All rights reserved.</p>
        <div className="flex items-center gap-4 text-xs">
          <Link to="/privacy" className="text-ink-faint hover:text-ink transition-colors">Privacy Policy</Link>
          <span>•</span>
          <Link to="/terms" className="text-ink-faint hover:text-ink transition-colors">Terms of Service</Link>
          <span>•</span>
          <Link to="/support" className="text-ink-faint hover:text-ink transition-colors">Support</Link>
        </div>
      </footer>
    </div>
  </div>
  );
};

export default NewLogin;