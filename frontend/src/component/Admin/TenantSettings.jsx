// src/components/Admin/TenantSettings.jsx
import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Building2,
  Mail,
  Phone,
  MapPin,
  Globe,
  Palette,
  Settings as SettingsIcon,
  Save,
  X,
  Check,
  AlertCircle,
  Loader2,
  RefreshCw,
  User,
  CreditCard,
  Database,
  Shield,
  Bell,
  Moon,
  Sun,
  Languages,
  Clock,
  Calendar,
  Users,
  BookOpen,
  Award,
  Upload,
  Image as ImageIcon,
  Trash2,
  Edit2,
  Eye,
  EyeOff,
  Lock,
  Key,
  Smartphone,
  Globe2,
  Server,
  Cloud,
  Zap,
  TrendingUp,
  PieChart,
  BarChart3,
  Activity,
  Crown,
  ArrowUpRight,
} from "lucide-react";
import api from "../../utils/api";
import { logError } from "../../utils/logger";
import Card from "../common/ui/Card";
import Badge from "../common/ui/Badge";
import Button from "../common/ui/Button";
import PageHeader from "../common/ui/PageHeader";
import EmptyState from "../common/ui/EmptyState";
import Input, { Select } from "../common/ui/Input";
import PricingModal from "../common/PricingModal";
import { useUpgradeModal } from "../../utils/billing";
import { useTheme } from '../../contexts/ThemeContexts';

const TenantSettings = () => {
  const { colors } = useTheme();
  
  const themeColors = {
    primary: colors?.primary || '#6366f1',
    secondary: colors?.secondary || '#8b5cf6',
    lighter: colors?.primary ? `${colors.primary}10` : '#f5f3ff',
  };
  const { modalProps, openUpgrade, setPlanCode } = useUpgradeModal();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [activeTab, setActiveTab] = useState("general");
  const [tenantInfo, setTenantInfo] = useState(null);
  const [usage, setUsage] = useState(null);
  // plan modules from the usage endpoint — used to gate feature toggles
  const [planModules, setPlanModules] = useState({});
  const [availablePlans, setAvailablePlans] = useState([]);
  // live upload previews for logo / favicon
  const [logoPreview, setLogoPreview] = useState(null);
  const [faviconPreview, setFaviconPreview] = useState(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingFavicon, setUploadingFavicon] = useState(false);
  const [reloginRequired, setReloginRequired] = useState(false);
  const [formData, setFormData] = useState({
    // Branding
    branding: {
      institutionName: "",
      primaryColor: "#6366f1",
      secondaryColor: "#8b5cf6",
      logo: "",
      favicon: "",
    },
    // Contact
    contact: {
      email: "",
      phone: "",
      address: "",
      city: "",
      state: "",
      country: "India",
      pincode: "",
    },
    // Settings
    settings: {
      language: "en",
      timezone: "Asia/Kolkata",
      academicYearStart: "",
      academicYearEnd: "",
      enableParentPortal: false,
      enableOnlinePayments: false,
      lateFeePerDay: 1000,
    },
    // College Metadata
    collegeMetadata: {
      institutionType: "private",
      ugcCode: "",
      naacGrade: "",
      nirfEligible: false,
      aicteApproved: false,
    },
  });

  // Security state
  const [passwords, setPasswords] = useState({ currentPassword: "", newPassword: "", confirmNewPassword: "" });
  const [passwordMsg, setPasswordMsg] = useState(null);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [twoFAEnabled, setTwoFAEnabled] = useState(false);
  const [twoFASecret, setTwoFASecret] = useState(null);
  const [qrCode, setQrCode] = useState(null);
  const [twoFAToken, setTwoFAToken] = useState("");
  const [twoFAMsg, setTwoFAMsg] = useState(null);
  const [twoFALoading, setTwoFALoading] = useState(false);
  const [sessions, setSessions] = useState([]);
  const [sessionMsg, setSessionMsg] = useState(null);
  const [sessionLoading, setSessionLoading] = useState(false);



  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [infoRes, usageRes, plansRes] = await Promise.all([
        api.get('/tenant/info'),
        api.get('/tenant/usage'),
        api.get('/billing/plans').catch(() => ({ data: { data: [] } })),
      ]);
      if (plansRes.data?.data) setAvailablePlans(plansRes.data.data);

      if (infoRes.data.success) {
        const tenant = infoRes.data.data.tenant;
        setTenantInfo(tenant);
        setFormData({
          branding: tenant.branding || {
            institutionName: tenant.name,
            primaryColor: "#6366f1",
            secondaryColor: "#8b5cf6",
          },
          contact: tenant.contact || {
            email: "",
            phone: "",
            address: "",
            city: "",
            state: "",
            country: "India",
            pincode: "",
          },
          settings: tenant.settings || {
            language: "en",
            timezone: "Asia/Kolkata",
            academicYearStart: "",
            academicYearEnd: "",
            enableParentPortal: false,
            enableOnlinePayments: false,
          },
          collegeMetadata: tenant.collegeMetadata || {
            institutionType: "private",
            ugcCode: "",
            naacGrade: "",
            nirfEligible: false,
            aicteApproved: false,
          },
        });
      }

      if (usageRes.data.success) {
        const usageData = usageRes.data.data;
        setUsage(usageData);
        setPlanCode(usageData?.tenant?.subscription?.plan || null);
        // Store plan modules so feature toggles can gate based on plan
        setPlanModules(usageData?.plan?.modules || {});
      }

      const [twofaRes, sessionsRes] = await Promise.all([
        api.get('/auth/2fa/status').catch(() => ({ data: { data: { twoFactorEnabled: false } } })),
        api.get('/auth/sessions').catch(() => ({ data: { data: [] } })),
      ]);
      setTwoFAEnabled(twofaRes.data?.data?.twoFactorEnabled || false);
      setSessions(sessionsRes.data?.data || []);
    } catch (err) {
      logError("Fetch Settings Data", err);
      setError(err.response?.data?.message || "Failed to load settings");
    } finally {
      setLoading(false);
    }
  }, [setPlanCode]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!reloginRequired) return;
    const timer = setTimeout(() => {
      localStorage.removeItem("token");
      window.location.href = "/login";
    }, 3000);
    return () => clearTimeout(timer);
  }, [reloginRequired]);

  const handleInputChange = (section, field, value) => {
    setFormData((prev) => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: value,
      },
    }));
  };

  const handleColorChange = (field, color) => {
    setFormData((prev) => ({
      ...prev,
      branding: {
        ...prev.branding,
        [field]: color,
      },
    }));
  };

  /**
   * Plan-aware toggle: if the feature is NOT in the current plan's modules,
   * open the upgrade modal instead of toggling.
   */
  const handleFeatureToggle = (section, field, planModuleKey) => {
    const currentValue = formData[section][field];
    if (currentValue || planModules[planModuleKey]) {
      setFormData((prev) => ({
        ...prev,
        [section]: { ...prev[section], [field]: !prev[section][field] },
      }));
    } else {
      openUpgrade({
        resourceType: planModuleKey,
        message: "This feature requires a higher plan. Upgrade to unlock it.",
        requiredPlan: getMinPlanForModule(planModuleKey),
      });
    }
  };

  /** Finds the cheapest plan whose modules include the given feature */
  const getMinPlanForModule = (moduleKey) => {
    if (!availablePlans.length) return "basic";
    const sorted = [...availablePlans].sort((a, b) => (a.pricing?.monthly || 0) - (b.pricing?.monthly || 0));
    for (const plan of sorted) {
      if (plan.modules?.[moduleKey]) return plan.code;
    }
    return "basic";
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const payload = {
        branding: formData.branding,
        settings: formData.settings,
        contact: formData.contact,
        collegeMetadata: formData.collegeMetadata,
      };

      const response = await api.put('/tenant/settings', payload);

      if (response.data.success) {
        setSuccess("Settings updated successfully!");
        if (response.data.data?.settings) {
          setFormData(prev => ({
            ...prev,
            settings: response.data.data.settings,
            branding: response.data.data.branding || prev.branding,
            contact: response.data.data.contact || prev.contact,
            collegeMetadata: response.data.data.collegeMetadata || prev.collegeMetadata,
          }));
        }
        if (activeTab === "branding") {
          setTimeout(() => setReloginRequired(true), 1000);
        } else {
          setTimeout(() => setSuccess(null), 5000);
        }
      }
    } catch (err) {
      logError("Save Settings", err);
      setError(err.response?.data?.message || "Failed to save settings");
      setTimeout(() => setError(null), 5000);
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPasswordLoading(true);
    setPasswordMsg(null);
    try {
      await api.post('/auth/change-password', passwords);
      setPasswordMsg({ type: "success", text: "Password changed successfully" });
      setPasswords({ currentPassword: "", newPassword: "", confirmNewPassword: "" });
      setTimeout(() => setReloginRequired(true), 1000);
    } catch (err) {
      setPasswordMsg({ type: "error", text: err.response?.data?.message || "Failed to change password" });
    } finally { setPasswordLoading(false); }
  };

  const handleSetup2FA = async () => {
    setTwoFALoading(true);
    setTwoFAMsg(null);
    try {
      const res = await api.post('/auth/2fa/setup');
      setTwoFASecret(res.data.data.secret);
      setQrCode(res.data.data.qrCode);
    } catch (err) {
      setTwoFAMsg({ type: "error", text: err.response?.data?.message || "Failed to setup 2FA" });
    } finally { setTwoFALoading(false); }
  };

  const handleVerify2FA = async () => {
    if (!twoFAToken) return;
    setTwoFALoading(true);
    setTwoFAMsg(null);
    try {
      await api.post('/auth/2fa/verify', { token: twoFAToken });
      setTwoFAEnabled(true);
      setTwoFASecret(null);
      setQrCode(null);
      setTwoFAToken("");
      setTwoFAMsg({ type: "success", text: "2FA enabled successfully" });
      setTimeout(() => setReloginRequired(true), 1000);
    } catch (err) {
      setTwoFAMsg({ type: "error", text: err.response?.data?.message || "Failed to verify 2FA" });
    } finally { setTwoFALoading(false); }
  };

  const handleDisable2FA = async () => {
    if (!window.confirm("Disable two-factor authentication?")) return;
    setTwoFALoading(true);
    try {
      await api.post('/auth/2fa/disable');
      setTwoFAEnabled(false);
      setTwoFAMsg({ type: "success", text: "2FA disabled" });
      setTimeout(() => setReloginRequired(true), 1000);
    } catch (err) {
      setTwoFAMsg({ type: "error", text: err.response?.data?.message || "Failed to disable 2FA" });
    } finally { setTwoFALoading(false); }
  };

  const handleLogoutAllSessions = async () => {
    if (!window.confirm("Log out all other sessions? You will be logged out and need to sign in again.")) return;
    setSessionLoading(true);
    setSessionMsg(null);
    try {
      await api.post('/auth/sessions/logout-all');
      setSessionMsg({ type: "success", text: "Sessions logged out. Please log in again." });
      setTimeout(() => {
        localStorage.clear();
        window.location.href = "/login";
      }, 2000);
    } catch (err) {
      setSessionMsg({ type: "error", text: err.response?.data?.message || "Failed to logout sessions" });
    } finally { setSessionLoading(false); }
  };

  const tabs = [
    { id: "general", label: "General", icon: <SettingsIcon className="w-4 h-4" /> },
    { id: "branding", label: "Branding", icon: <Palette className="w-4 h-4" /> },
    { id: "contact", label: "Contact", icon: <Building2 className="w-4 h-4" /> },
    { id: "metadata", label: "Accreditation", icon: <Award className="w-4 h-4" /> },
    { id: "usage", label: "Usage & Plans", icon: <Database className="w-4 h-4" /> },
    { id: "security", label: "Security", icon: <Shield className="w-4 h-4" /> },
  ];

  const currentPlan = usage?.tenant?.subscription?.plan || "free";
  const currentPlanStatus = usage?.tenant?.subscription?.status || "active";

  // ── Plan-aware feature row component ────────────────────────────────────────
  const FeatureRow = ({ title, description, settingsField, planModuleKey }) => {
    const isEnabled = formData.settings[settingsField];
    const isAvailable = !!planModules[planModuleKey];
    const minPlan = getMinPlanForModule(planModuleKey);
    return (
      <div className="flex items-center justify-between p-3 hover:bg-background rounded-lg transition">
        <div className="flex-1 mr-4">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-medium text-ink">{title}</p>
            {!isAvailable && (
              <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium bg-primary-soft text-primary-dark">
                <Crown className="w-3 h-3" />
                {minPlan.charAt(0).toUpperCase() + minPlan.slice(1)}+
              </span>
            )}
          </div>
          <p className="text-sm text-ink-soft mt-0.5">{description}</p>
          {!isAvailable && (
            <button
              type="button"
              onClick={() => openUpgrade({ resourceType: planModuleKey, message: "This feature requires a higher plan.", requiredPlan: minPlan })}
              className="mt-1 text-xs font-medium flex items-center gap-1 hover:underline text-primary"
            >
              <ArrowUpRight className="w-3 h-3" /> Upgrade to unlock
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={() => handleFeatureToggle("settings", settingsField, planModuleKey)}
          className={`relative flex-shrink-0 w-12 h-6 rounded-full transition-all duration-300 ${isEnabled && isAvailable ? 'bg-primary' : !isAvailable ? 'bg-primary/30' : 'bg-line'}`}
        >
          <div className={`absolute top-1 left-1 w-4 h-4 bg-surface rounded-full shadow-sm transition-transform duration-300 ${isEnabled && isAvailable ? "translate-x-6" : ""}`} />
          {!isAvailable && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Crown className="w-3 h-3 text-white/60" />
            </div>
          )}
        </button>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-12 h-12 text-primary animate-spin" />
          <p className="text-ink-soft">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <PageHeader
        icon={SettingsIcon}
        title="Settings"
        subtitle="Manage your institution settings and preferences"
        actions={
          <>
            <Button variant="outline" leftIcon={RefreshCw} onClick={fetchData}>
              Refresh
            </Button>
            <Button variant="primary" leftIcon={Save} onClick={handleSubmit} disabled={saving} loading={saving}>
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </>
        }
      />

      {/* Error/Success Messages */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
          <AlertCircle className="w-5 h-5" />
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-green-700">
          <Check className="w-5 h-5" />
          {success}
        </div>
      )}

      {reloginRequired && (
        <div className="mb-4 p-4 bg-amber-50 border border-amber-300 rounded-lg flex items-center gap-3 text-amber-800">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <div className="flex-1">
            <p className="font-semibold">Settings updated. Redirecting to login…</p>
            <p className="text-sm">Please log in again to apply the changes.</p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-line mb-8 overflow-x-auto hide-scrollbar">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`relative px-6 py-4 font-medium text-sm transition-colors whitespace-nowrap flex items-center gap-2 ${activeTab === tab.id ? 'text-primary' : 'text-ink-faint hover:text-ink-soft'}`}
          >
            {tab.icon}
            {tab.label}
            {activeTab === tab.id && (
              <motion.div
                layoutId="activeTab"
                className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t-full bg-primary"
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
              />
            )}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit}>
        <AnimatePresence mode="wait">
          {/* General Settings */}
          {activeTab === "general" && (
            <motion.div
              key="general"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <Card>
                <h3 className="text-lg font-semibold text-ink mb-4">
                  Institution Information
                </h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <Input
                    label="Institution Name"
                    value={formData.branding.institutionName}
                    onChange={(e) =>
                      handleInputChange("branding", "institutionName", e.target.value)
                    }
                  />
                  <Input
                    label="Subdomain"
                    value={tenantInfo?.subdomain || ""}
                    disabled
                    hint="Subdomain cannot be changed"
                  />
                </div>

                <div className="grid md:grid-cols-2 gap-4 mt-4">
                  <Input
                    label="Academic Year Start"
                    type="date"
                    value={formData.settings.academicYearStart?.split('T')[0] || ""}
                    onChange={(e) =>
                      handleInputChange("settings", "academicYearStart", e.target.value)
                    }
                  />
                  <Input
                    label="Academic Year End"
                    type="date"
                    value={formData.settings.academicYearEnd?.split('T')[0] || ""}
                    onChange={(e) =>
                      handleInputChange("settings", "academicYearEnd", e.target.value)
                    }
                  />
                </div>
              </Card>

              <Card>
                <h3 className="text-lg font-semibold text-ink mb-4">
                  Language & Timezone
                </h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <Select
                    label="Language"
                    value={formData.settings.language}
                    onChange={(e) =>
                      handleInputChange("settings", "language", e.target.value)
                    }
                  >
                    <option value="en">English</option>
                    <option value="hi">Hindi</option>
                    <option value="es">Spanish</option>
                    <option value="fr">French</option>
                  </Select>
                  <Select
                    label="Timezone"
                    value={formData.settings.timezone}
                    onChange={(e) =>
                      handleInputChange("settings", "timezone", e.target.value)
                    }
                  >
                    <option value="Asia/Kolkata">Asia/Kolkata (UTC+5:30)</option>
                    <option value="Asia/Dubai">Asia/Dubai (UTC+4)</option>
                    <option value="Europe/London">Europe/London (UTC+0)</option>
                    <option value="America/New_York">America/New_York (UTC-5)</option>
                    <option value="America/Los_Angeles">America/Los_Angeles (UTC-8)</option>
                    <option value="Australia/Sydney">Australia/Sydney (UTC+11)</option>
                  </Select>
                </div>
              </Card>

              <Card>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-semibold text-ink">Features</h3>
                  <Badge tone="secondary">
                    <Crown className="w-3.5 h-3.5" />
                    {currentPlan.charAt(0).toUpperCase() + currentPlan.slice(1)} Plan
                  </Badge>
                </div>
                <p className="text-sm text-ink-soft mb-4">
                  Feature availability depends on your current plan. Features marked with a crown require an upgrade.
                </p>
                <div className="space-y-1 divide-y divide-line">
                  <FeatureRow
                    title="Parent Portal"
                    description="Allow parents to track their children's progress and attendance"
                    settingsField="enableParentPortal"
                    planModuleKey="parentPortal"
                  />
                  <FeatureRow
                    title="Online Payments"
                    description="Enable online fee collection and payment gateway integration"
                    settingsField="enableOnlinePayments"
                    planModuleKey="financeManagement"
                  />
                  <div className="flex items-center justify-between py-3 px-1">
                    <div>
                      <p className="text-sm font-medium text-ink">Late Fee Per Day (INR)</p>
                      <p className="text-xs text-ink-faint">Penalty charged per day after the fee due date</p>
                    </div>
                    <input
                      type="number"
                      min="0"
                      step="100"
                      value={formData.settings.lateFeePerDay ?? 1000}
                      onChange={(e) => setFormData((s) => ({ ...s, settings: { ...s.settings, lateFeePerDay: Number(e.target.value) } }))}
                      className="w-28 rounded-xl border border-line bg-surface px-3 py-1.5 text-sm text-ink text-right focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>
                </div>
              </Card>
            </motion.div>
          )}

          {/* Branding Settings */}
          {activeTab === "branding" && (
            <motion.div
              key="branding"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              {!planModules.customBranding ? (
                <Card>
                  <EmptyState
                    icon={Lock}
                    title="Custom Branding"
                    description="Customize your institution's colors, logo, and favicon. This feature requires a plan upgrade."
                    action={
                      <Button
                        type="button"
                        variant="primary"
                        leftIcon={Crown}
                        onClick={() => openUpgrade({ resourceType: "customBranding", message: "Upgrade to Professional to unlock custom branding.", requiredPlan: "professional" })}
                      >
                        Upgrade to Unlock
                      </Button>
                    }
                  />
                </Card>
              ) : (
              <>
              <Card>
                <h3 className="text-lg font-semibold text-ink mb-4">
                  Branding
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-ink-soft mb-1">
                      Primary Color
                    </label>
                    <div className="flex items-center gap-4">
                      <input
                        type="color"
                        value={formData.branding.primaryColor}
                        onChange={(e) => handleColorChange("primaryColor", e.target.value)}
                        className="w-12 h-12 rounded-lg cursor-pointer border border-line bg-surface p-1"
                      />
                      <Input
                        value={formData.branding.primaryColor}
                        onChange={(e) => handleColorChange("primaryColor", e.target.value)}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-ink-soft mb-1">
                      Secondary Color
                    </label>
                    <div className="flex items-center gap-4">
                      <input
                        type="color"
                        value={formData.branding.secondaryColor}
                        onChange={(e) => handleColorChange("secondaryColor", e.target.value)}
                        className="w-12 h-12 rounded-lg cursor-pointer border border-line bg-surface p-1"
                      />
                      <Input
                        value={formData.branding.secondaryColor}
                        onChange={(e) => handleColorChange("secondaryColor", e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="mt-4 p-4 bg-background rounded-lg border border-line">
                    <p className="text-sm text-ink-soft mb-2">Preview:</p>
                    <div className="flex gap-4">
                      <div
                        className="px-4 py-2 rounded-lg text-white"
                        style={{ backgroundColor: formData.branding.primaryColor }}
                      >
                        Primary Button
                      </div>
                      <div
                        className="px-4 py-2 rounded-lg text-white"
                        style={{ backgroundColor: formData.branding.secondaryColor }}
                      >
                        Secondary Button
                      </div>
                    </div>
                  </div>
                </div>
              </Card>

              <Card>
                <h3 className="text-lg font-semibold text-ink mb-4">
                  Logo & Favicon
                </h3>
                <div className="space-y-4">
                  <div className="border-2 border-dashed border-line rounded-lg p-8 text-center">
                    <Upload className="w-12 h-12 text-ink-faint mx-auto mb-4" />
                    <p className="text-ink-soft mb-2">Institution Logo</p>
                    {logoPreview || formData.branding.logo ? (
                      <div className="mx-auto mb-4">
                        <img
                          src={logoPreview || formData.branding.logo}
                          alt="Logo preview"
                          className="mx-auto h-20 w-20 object-contain rounded-xl border border-line bg-white p-2"
                          onError={(e) => { e.target.style.display = "none"; }}
                        />
                        <button
                          type="button"
                          onClick={() => setLogoPreview(null)}
                          className="mt-2 text-xs text-ink-faint hover:text-red-600 underline"
                        >
                          Clear preview
                        </button>
                      </div>
                    ) : (
                      <p className="text-sm text-ink-faint mb-4">No logo uploaded yet</p>
                    )}
                    <label className="cursor-pointer inline-block px-4 py-2 bg-primary text-white rounded-lg text-sm hover:bg-primary-dark transition">
                      {uploadingLogo ? "Uploading..." : "Choose File"}
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/gif"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          setLogoPreview(URL.createObjectURL(file));
                          setUploadingLogo(true);
                          const form = new FormData();
                          form.append("image", file);
                          form.append("type", "logo");
                          try {
                            const res = await api.post('/tenant/branding/upload', form);
                            if (res.data.success) {
                              setFormData(prev => ({ ...prev, branding: { ...prev.branding, logo: res.data.data.logo } }));
                              setLogoPreview(null);
                              window.dispatchEvent(new CustomEvent("attendease:branding-updated"));
                              setSuccess("Logo uploaded");
                              setTimeout(() => setSuccess(null), 5000);
                            }
                          } catch (err) { setError(err.response?.data?.message || "Upload failed"); setTimeout(() => setError(null), 5000); }
                          finally { setUploadingLogo(false); e.target.value = ""; }
                        }}
                      />
                    </label>
                    <p className="text-xs text-ink-faint mt-1">PNG, JPG, GIF (Max 2MB)</p>
                  </div>
                  <div className="border-2 border-dashed border-line rounded-lg p-8 text-center">
                    <ImageIcon className="w-12 h-12 text-ink-faint mx-auto mb-4" />
                    <p className="text-ink-soft mb-2">Favicon</p>
                    {faviconPreview || formData.branding.favicon ? (
                      <div className="mx-auto mb-4">
                        <img
                          src={faviconPreview || formData.branding.favicon}
                          alt="Favicon preview"
                          className="mx-auto h-16 w-16 object-contain rounded-lg border border-line bg-white p-1"
                          onError={(e) => { e.target.style.display = "none"; }}
                        />
                        <button
                          type="button"
                          onClick={() => setFaviconPreview(null)}
                          className="mt-2 text-xs text-ink-faint hover:text-red-600 underline"
                        >
                          Clear preview
                        </button>
                      </div>
                    ) : (
                      <p className="text-sm text-ink-faint mb-4">No favicon uploaded yet</p>
                    )}
                    <label className="cursor-pointer inline-block px-4 py-2 bg-primary text-white rounded-lg text-sm hover:bg-primary-dark transition">
                      {uploadingFavicon ? "Uploading..." : "Choose File"}
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/gif"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          setFaviconPreview(URL.createObjectURL(file));
                          setUploadingFavicon(true);
                          const form = new FormData();
                          form.append("image", file);
                          form.append("type", "favicon");
                          try {
                            const res = await api.post('/tenant/branding/upload', form);
                            if (res.data.success) {
                              setFormData(prev => ({ ...prev, branding: { ...prev.branding, favicon: res.data.data.favicon } }));
                              setFaviconPreview(null);
                              window.dispatchEvent(new CustomEvent("attendease:branding-updated"));
                              setSuccess("Favicon uploaded");
                              setTimeout(() => setSuccess(null), 5000);
                            }
                          } catch (err) { setError(err.response?.data?.message || "Upload failed"); setTimeout(() => setError(null), 5000); }
                          finally { setUploadingFavicon(false); e.target.value = ""; }
                        }}
                      />
                    </label>
                    <p className="text-xs text-ink-faint mt-1">PNG, JPG (Max 100KB)</p>
                  </div>
                </div>
              </Card>
              </>
              )}
            </motion.div>
          )}

          {/* Contact Settings */}
          {activeTab === "contact" && (
            <motion.div
              key="contact"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <Card>
                <h3 className="text-lg font-semibold text-ink mb-4">
                  Contact Information
                </h3>
                <div className="space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-ink-soft mb-1">
                        Email Address
                      </label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-ink-faint" />
                        <input
                          type="email"
                          value={formData.contact.email}
                          onChange={(e) =>
                            handleInputChange("contact", "email", e.target.value)
                          }
                          className="w-full pl-10 pr-4 py-2.5 border border-line rounded-lg bg-surface text-ink placeholder:text-ink-faint focus:ring-2 focus:ring-primary focus:border-primary focus:outline-none"
                          placeholder="admin@institution.com"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-ink-soft mb-1">
                        Phone Number
                      </label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-ink-faint" />
                        <input
                          type="tel"
                          value={formData.contact.phone}
                          onChange={(e) =>
                            handleInputChange("contact", "phone", e.target.value)
                          }
                          className="w-full pl-10 pr-4 py-2.5 border border-line rounded-lg bg-surface text-ink placeholder:text-ink-faint focus:ring-2 focus:ring-primary focus:border-primary focus:outline-none"
                          placeholder="+91 1234567890"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-ink-soft mb-1">
                      Address
                    </label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-3 w-4 h-4 text-ink-faint" />
                      <textarea
                        value={formData.contact.address}
                        onChange={(e) =>
                          handleInputChange("contact", "address", e.target.value)
                        }
                        rows="2"
                        className="w-full pl-10 pr-4 py-2.5 border border-line rounded-lg bg-surface text-ink placeholder:text-ink-faint focus:ring-2 focus:ring-primary focus:border-primary focus:outline-none"
                        placeholder="Street address"
                      />
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <Input
                      label="City"
                      value={formData.contact.city}
                      onChange={(e) =>
                        handleInputChange("contact", "city", e.target.value)
                      }
                      placeholder="City"
                    />
                    <Input
                      label="State"
                      value={formData.contact.state}
                      onChange={(e) =>
                        handleInputChange("contact", "state", e.target.value)
                      }
                      placeholder="State"
                    />
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <Select
                      label="Country"
                      value={formData.contact.country}
                      onChange={(e) =>
                        handleInputChange("contact", "country", e.target.value)
                      }
                    >
                      <option value="India">India</option>
                      <option value="United States">United States</option>
                      <option value="United Kingdom">United Kingdom</option>
                      <option value="Canada">Canada</option>
                      <option value="Australia">Australia</option>
                    </Select>
                    <Input
                      label="PIN Code"
                      value={formData.contact.pincode}
                      onChange={(e) =>
                        handleInputChange("contact", "pincode", e.target.value)
                      }
                      placeholder="110001"
                    />
                  </div>
                </div>
              </Card>
            </motion.div>
          )}

          {/* College Accreditation & Metadata Settings */}
          {activeTab === "metadata" && (
            <motion.div
              key="metadata"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <Card>
                <div className="flex items-center gap-3 mb-6">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: themeColors.lighter }}
                  >
                    <Award className="w-5 h-5" style={{ color: themeColors.primary }} />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-ink">
                      College Compliance & Accreditation
                    </h3>
                    <p className="text-xs text-ink-soft">
                      Manage official university UGC codes, NAAC grading, and statutory AICTE / NIRF approvals
                    </p>
                  </div>
                </div>

                <div className="space-y-5">
                  <div className="grid md:grid-cols-2 gap-4">
                    <Select
                      label="Institution Type"
                      value={formData.collegeMetadata.institutionType || "private"}
                      onChange={(e) =>
                        handleInputChange("collegeMetadata", "institutionType", e.target.value)
                      }
                    >
                      <option value="private">Private Institution</option>
                      <option value="govt">Government / Public</option>
                      <option value="autonomous">Autonomous College</option>
                      <option value="deemed">Deemed University</option>
                      <option value="other">Other</option>
                    </Select>

                    <Select
                      label="NAAC Grade"
                      value={formData.collegeMetadata.naacGrade || ""}
                      onChange={(e) =>
                        handleInputChange("collegeMetadata", "naacGrade", e.target.value)
                      }
                    >
                      <option value="">Not Accredited / NA</option>
                      <option value="A++">A++ (CGPA 3.51 - 4.00)</option>
                      <option value="A+">A+ (CGPA 3.26 - 3.50)</option>
                      <option value="A">A (CGPA 3.01 - 3.25)</option>
                      <option value="B++">B++ (CGPA 2.76 - 3.00)</option>
                      <option value="B+">B+ (CGPA 2.51 - 2.75)</option>
                      <option value="B">B (CGPA 2.01 - 2.50)</option>
                      <option value="C">C (CGPA 1.51 - 2.00)</option>
                    </Select>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <Input
                      label="UGC Code / Institution Registration Code"
                      value={formData.collegeMetadata.ugcCode || ""}
                      onChange={(e) =>
                        handleInputChange("collegeMetadata", "ugcCode", e.target.value)
                      }
                      placeholder="e.g. UGC-IND-9821"
                    />
                  </div>

                  <div className="pt-4 border-t border-line space-y-3">
                    <h4 className="text-sm font-semibold text-ink">Statutory Approvals & Ranking Status</h4>

                    <div className="flex items-center justify-between p-3.5 rounded-xl border border-line bg-surface">
                      <div>
                        <p className="text-sm font-medium text-ink">AICTE Approved</p>
                        <p className="text-xs text-ink-faint">Approved by All India Council for Technical Education</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={Boolean(formData.collegeMetadata.aicteApproved)}
                        onChange={(e) =>
                          handleInputChange("collegeMetadata", "aicteApproved", e.target.checked)
                        }
                        className="w-5 h-5 rounded border-line text-primary focus:ring-primary cursor-pointer"
                      />
                    </div>

                    <div className="flex items-center justify-between p-3.5 rounded-xl border border-line bg-surface">
                      <div>
                        <p className="text-sm font-medium text-ink">NIRF Eligible / Participating</p>
                        <p className="text-xs text-ink-faint">Participating in National Institutional Ranking Framework</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={Boolean(formData.collegeMetadata.nirfEligible)}
                        onChange={(e) =>
                          handleInputChange("collegeMetadata", "nirfEligible", e.target.checked)
                        }
                        className="w-5 h-5 rounded border-line text-primary focus:ring-primary cursor-pointer"
                      />
                    </div>
                  </div>
                </div>
              </Card>
            </motion.div>
          )}

          {/* Usage & Plans */}
          {activeTab === "usage" && (
            <motion.div
              key="usage"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              {/* Current Plan Card — single upgrade button */}
              <Card>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: `linear-gradient(135deg, ${themeColors.primary}, ${themeColors.secondary})` }}
                    >
                      <Crown className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-ink-faint uppercase tracking-wider">Current Plan</p>
                      <p className="text-xl font-bold text-ink capitalize">{currentPlan}</p>
                      <Badge
                        className="mt-1.5"
                        tone={currentPlanStatus === "active" ? "success" : currentPlanStatus === "trial" ? "warning" : "danger"}
                      >
                        {currentPlanStatus.charAt(0).toUpperCase() + currentPlanStatus.slice(1)}
                      </Badge>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="primary"
                    leftIcon={TrendingUp}
                    onClick={() => openUpgrade()}
                  >
                    {currentPlan === "free" ? "Upgrade Plan" : "Change Plan"}
                  </Button>
                </div>
              </Card>

              {/* Resource Usage Meters */}
              <Card>
                <h3 className="text-lg font-semibold text-ink mb-5">Resource Usage</h3>
                {usage && (
                  <div className="space-y-5">
                    {[
                      { label: "Students", key: "students", color: "#6366f1" },
                      { label: "Teachers", key: "teachers", color: "#10b981" },
                      { label: "Subjects", key: "subjects", color: "#8b5cf6" },
                      { label: "Storage (MB)", key: "storage", color: "#f59e0b" },
                    ].map(({ label, key, color }) => {
                      const u = usage.usage?.[key];
                      if (!u) return null;
                      const pct = Math.min(u.percentage || 0, 100);
                      const isCritical = pct >= 95;
                      const isWarning = pct >= 80;
                      return (
                        <div key={key}>
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-sm font-medium text-ink-soft">{label}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-ink-soft">{u.current} / {u.limit}</span>
                              {isCritical && (
                                <Badge tone="danger">Critical</Badge>
                              )}
                              {isWarning && !isCritical && (
                                <Badge tone="warning">High</Badge>
                              )}
                            </div>
                          </div>
                          <div className="w-full bg-background rounded-full h-2.5 overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${pct}%` }}
                              transition={{ duration: 0.8, ease: "easeOut" }}
                              className="h-2.5 rounded-full"
                              style={{ backgroundColor: isCritical ? "#ef4444" : isWarning ? "#f59e0b" : color }}
                            />
                          </div>
                          <p className="text-xs text-ink-faint mt-1">{u.remaining} remaining</p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>

              {/* Warnings */}
              {usage?.warnings && usage.warnings.length > 0 && (
                <Card>
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <h4 className="font-semibold text-ink mb-2">Usage Warnings</h4>
                      <ul className="space-y-1.5">
                        {usage.warnings.map((warning, i) => (
                          <li key={i} className="text-sm text-amber-700 flex items-start gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 flex-shrink-0" />
                            {warning.message}
                          </li>
                        ))}
                      </ul>
                      <button
                        type="button"
                        onClick={() => openUpgrade()}
                        className="mt-3 text-sm font-semibold flex items-center gap-1.5 hover:underline text-primary"
                      >
                        <ArrowUpRight className="w-4 h-4" />
                        Upgrade to increase limits
                      </button>
                    </div>
                  </div>
                </Card>
              )}

              {/* Plan features overview */}
              {Object.keys(planModules).length > 0 && (
                <Card>
                  <h3 className="text-lg font-semibold text-ink mb-4">Plan Features</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {Object.entries(planModules).map(([key, enabled]) => (
                      <div
                        key={key}
                        className={`flex items-center gap-2 p-2.5 rounded-lg text-xs ${enabled ? "bg-emerald-50 text-emerald-700" : "bg-background text-ink-faint"}`}
                      >
                        {enabled ? (
                          <Check className="w-3.5 h-3.5 flex-shrink-0 text-emerald-500" />
                        ) : (
                          <X className="w-3.5 h-3.5 flex-shrink-0 text-ink-faint" />
                        )}
                        <span className="capitalize">{key.replace(/([A-Z])/g, " $1").trim()}</span>
                      </div>
                    ))}
                  </div>
                </Card>
              )}
            </motion.div>
          )}
          {activeTab === "security" && (
            <motion.div
              key="security"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <Card>
                <h3 className="text-lg font-semibold text-ink mb-4">
                  Password & Security
                </h3>
                <form onSubmit={handleChangePassword} className="space-y-4">
                  {passwordMsg && (
                    <div className={`p-3 rounded-lg text-sm flex items-center gap-2 ${passwordMsg.type === "success" ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
                      {passwordMsg.type === "success" ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                      {passwordMsg.text}
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-ink-soft mb-1">Current Password</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-ink-faint" />
                      <input
                        type="password"
                        value={passwords.currentPassword}
                        onChange={e => setPasswords(p => ({ ...p, currentPassword: e.target.value }))}
                        className="w-full pl-10 pr-4 py-2.5 border border-line rounded-lg bg-surface text-ink placeholder:text-ink-faint focus:ring-2 focus:ring-primary focus:border-primary focus:outline-none"
                        placeholder="Enter current password"
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-ink-soft mb-1">New Password</label>
                    <div className="relative">
                      <Key className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-ink-faint" />
                      <input
                        type="password"
                        value={passwords.newPassword}
                        onChange={e => setPasswords(p => ({ ...p, newPassword: e.target.value }))}
                        className="w-full pl-10 pr-4 py-2.5 border border-line rounded-lg bg-surface text-ink placeholder:text-ink-faint focus:ring-2 focus:ring-primary focus:border-primary focus:outline-none"
                        placeholder="Enter new password"
                        required
                        minLength={6}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-ink-soft mb-1">Confirm New Password</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-ink-faint" />
                      <input
                        type="password"
                        value={passwords.confirmNewPassword}
                        onChange={e => setPasswords(p => ({ ...p, confirmNewPassword: e.target.value }))}
                        className="w-full pl-10 pr-4 py-2.5 border border-line rounded-lg bg-surface text-ink placeholder:text-ink-faint focus:ring-2 focus:ring-primary focus:border-primary focus:outline-none"
                        placeholder="Confirm new password"
                        required
                      />
                    </div>
                  </div>
                  <Button
                    type="submit"
                    variant="primary"
                    disabled={passwordLoading}
                    loading={passwordLoading}
                  >
                    Change Password
                  </Button>
                </form>
              </Card>

              <Card>
                <h3 className="text-lg font-semibold text-ink mb-4">
                  Two-Factor Authentication
                </h3>
                {twoFAMsg && (
                  <div className={`mb-4 p-3 rounded-lg text-sm flex items-center gap-2 ${twoFAMsg.type === "success" ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
                    {twoFAMsg.type === "success" ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                    {twoFAMsg.text}
                  </div>
                )}
                <div className="space-y-4">
                  {twoFAEnabled ? (
                    <div className="flex items-center justify-between gap-4 flex-wrap">
                      <div>
                        <p className="font-medium text-ink">2FA is enabled</p>
                        <p className="text-sm text-ink-soft">Your account has an extra layer of security</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge tone="success" dot>Enabled</Badge>
                        <Button
                          type="button"
                          variant="dangerSubtle"
                          onClick={handleDisable2FA}
                          disabled={twoFALoading}
                        >
                          {twoFALoading ? "Disabling..." : "Disable 2FA"}
                        </Button>
                      </div>
                    </div>
                  ) : twoFASecret ? (
                    <div className="space-y-4">
                      <p className="text-sm text-ink-soft">Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.)</p>
                      {qrCode && <img src={qrCode} alt="2FA QR Code" className="mx-auto w-48 h-48" />}
                      <div>
                        <p className="text-xs text-ink-soft mb-1">Or enter this secret manually:</p>
                        <code className="block p-2 bg-background rounded text-xs break-all font-mono text-ink-soft">{twoFASecret}</code>
                      </div>
                      <div className="flex items-center gap-3">
                        <input
                          type="text"
                          value={twoFAToken}
                          onChange={e => setTwoFAToken(e.target.value)}
                          placeholder="Enter 6-digit code"
                          className="flex-1 px-3 py-2.5 border border-line rounded-lg text-sm text-center tracking-widest bg-surface text-ink placeholder:text-ink-faint focus:ring-2 focus:ring-primary focus:border-primary focus:outline-none"
                          maxLength={6}
                        />
                        <Button
                          type="button"
                          variant="primary"
                          onClick={handleVerify2FA}
                          disabled={twoFALoading || twoFAToken.length < 6}
                          loading={twoFALoading}
                        >
                          {twoFALoading ? "Verifying..." : "Verify"}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-4 flex-wrap">
                      <div>
                        <p className="font-medium text-ink flex items-center gap-2">2FA Status <Badge tone="neutral">Disabled</Badge></p>
                        <p className="text-sm text-ink-soft">Add an extra layer of security to your account</p>
                      </div>
                      <Button
                        type="button"
                        variant="primary"
                        onClick={handleSetup2FA}
                        disabled={twoFALoading}
                        loading={twoFALoading}
                      >
                        {twoFALoading ? "Setting up..." : "Enable 2FA"}
                      </Button>
                    </div>
                  )}
                </div>
              </Card>

              <Card>
                <h3 className="text-lg font-semibold text-ink mb-4">
                  Session Management
                </h3>
                {sessionMsg && (
                  <div className={`mb-4 p-3 rounded-lg text-sm flex items-center gap-2 ${sessionMsg.type === "success" ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
                    {sessionMsg.type === "success" ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                    {sessionMsg.text}
                  </div>
                )}
                <div className="space-y-3">
                  {sessions.length > 0 ? sessions.map(s => (
                    <div key={s.id} className="flex items-center justify-between p-3 bg-background rounded-lg">
                      <div>
                        <p className="font-medium text-ink">{s.isCurrent ? "Current Session" : "Other Session"}</p>
                        <p className="text-sm text-ink-soft">{s.device?.substring(0, 60)}</p>
                      </div>
                      <Badge tone={s.isCurrent ? "success" : "neutral"}>
                        {s.isCurrent ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                  )) : (
                    <div className="flex items-center justify-between p-3 bg-background rounded-lg">
                      <div>
                        <p className="font-medium text-ink">Current Session</p>
                        <p className="text-sm text-ink-soft">Active session</p>
                      </div>
                      <Badge tone="success">Active</Badge>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={handleLogoutAllSessions}
                    disabled={sessionLoading}
                    className="text-red-600 hover:text-red-700 text-sm font-medium disabled:opacity-50"
                  >
                    {sessionLoading ? "Logging out..." : "Logout All Other Sessions"}
                  </button>
                </div>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </form>

      {/* Pricing / Upgrade Modal — single instance, no hard reload */}
      <PricingModal
        {...modalProps}
        onPlanChanged={() => { fetchData(); setTimeout(() => setReloginRequired(true), 1000); }}
      />
    </motion.div>
  );
};

export default TenantSettings;
