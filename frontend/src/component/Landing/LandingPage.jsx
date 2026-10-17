import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Check,
  CheckCircle2,
  Clock,
  Shield,
  Users,
  BookOpen,
  Calendar,
  Lock,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  Menu,
  X,
  Building,
  GraduationCap,
  Sparkles,
  Send,
  Loader2,
  AlertCircle,
  Activity,
  Scan,
  RefreshCw,
  Palette,
  Layers,
  Database,
  Cpu,
  Fingerprint,
  School,
  Copy,
  ExternalLink
} from 'lucide-react';
import RoleSelectorModal from './RoleSelectorModal';
import WelcomeEntrance from './WelcomeEntrance';
import CampusSwitcherModal from './CampusSwitcherModal';
import { useDemo } from '../../contexts/DemoContext';
import api from '../../utils/api';
import {
  getActiveTenant,
  setActiveTenant as persistActiveTenant,
  getTenantLoginUrl,
  getFullTenantUrl
} from '../../utils/activeTenant';

const CANONICAL_PLANS = [
  {
    code: 'free',
    name: 'Free Trial',
    tagline: 'Standard evaluation deployment for single departments',
    price: { monthly: 0, annual: 0 },
    limits: { maxStudents: 50, maxTeachers: 5, maxAdmins: 1, maxSubjects: 20 },
    badge: '14-Day Evaluation',
    popular: false,
    cta: 'Start Free Trial',
    highlights: [
      'Basic Attendance Tracking',
      'Department Academic Structure',
      'Campus Announcements & Alerts',
      'Academic Calendar View',
      'Community Documentation Support'
    ],
    modules: {
      attendance: true,
      academicStructure: true,
      alerts: true,
      calendar: true,
      timetable: false,
      examManagement: false,
      financeManagement: false,
      customRoles: false,
      customBranding: false,
      biometricAttendance: false,
      whiteLabel: false,
    }
  },
  {
    code: 'basic',
    name: 'Campus Starter',
    tagline: 'Core academic management for growing schools & colleges',
    price: { monthly: 999, annual: 799 },
    limits: { maxStudents: 200, maxTeachers: 20, maxAdmins: 3, maxSubjects: 50 },
    badge: 'Standard Tier',
    popular: false,
    cta: 'Choose Starter',
    highlights: [
      'Timetable Management & Clashes',
      'Exam Schedules & Results',
      'Attendance Aggregation & Reports',
      'Data Export Capabilities',
      'Standard Email Support'
    ],
    modules: {
      attendance: true,
      academicStructure: true,
      alerts: true,
      calendar: true,
      timetable: true,
      timetableManagement: true,
      examManagement: true,
      analytics: true,
      reports: true,
      financeManagement: false,
      customRoles: false,
      customBranding: false,
      biometricAttendance: false,
      whiteLabel: false,
    }
  },
  {
    code: 'professional',
    name: 'Professional Campus',
    tagline: 'Complete institutional ERP suite with custom themes & finance',
    price: { monthly: 2499, annual: 1999 },
    limits: { maxStudents: 1000, maxTeachers: 100, maxAdmins: 10, maxSubjects: 200 },
    badge: 'Most Popular',
    popular: true,
    cta: 'Get Professional',
    highlights: [
      'Custom Institution Branding & Theme',
      'Fee Collection & Receipts Tracking',
      'Exam Hall & Seating Allocator',
      'Custom Staff Roles & Permissions',
      'Parent Portal & Priority Support'
    ],
    modules: {
      attendance: true,
      academicStructure: true,
      alerts: true,
      calendar: true,
      timetable: true,
      timetableManagement: true,
      examManagement: true,
      examSeating: true,
      financeManagement: true,
      libraryManagement: true,
      parentPortal: true,
      customRoles: true,
      roleManagement: true,
      customBranding: true,
      analytics: true,
      dataExport: true,
      apiAccess: true,
      prioritySupport: true,
      biometricAttendance: false,
      whiteLabel: false,
    }
  },
  {
    code: 'enterprise',
    name: 'Enterprise ERP',
    tagline: 'High-volume scale, biometric vectors, and dedicated SLA',
    price: { monthly: 4999, annual: 3999 },
    limits: { maxStudents: 10000, maxTeachers: 1000, maxAdmins: 50, maxSubjects: 1000 },
    badge: 'Institutional Scale',
    popular: false,
    cta: 'Request Enterprise Quote',
    highlights: [
      'Offline WASM Biometric Face Auth',
      'Full White-Labeling & Subdomains',
      'Bulk Operations & Data Ingestion',
      'Dedicated 99.99% Institutional SLA',
      'On-Premise or Private Cloud Gateway'
    ],
    modules: {
      attendance: true,
      academicStructure: true,
      alerts: true,
      calendar: true,
      timetable: true,
      timetableManagement: true,
      examManagement: true,
      examStructure: true,
      examSeating: true,
      financeManagement: true,
      libraryManagement: true,
      hrManagement: true,
      parentPortal: true,
      customRoles: true,
      roleManagement: true,
      customBranding: true,
      whiteLabel: true,
      analytics: true,
      dataExport: true,
      bulkOperations: true,
      bulkImport: true,
      apiAccess: true,
      biometricAttendance: true,
      prioritySupport: true,
      dedicatedSupport: true,
    }
  }
];

// Smooth counting hook for institutional ledger proof points
const useCountUp = (target, decimals = 0, duration = 1600) => {
  const [val, setVal] = useState(0);
  const [started, setStarted] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started) {
          setStarted(true);
        }
      },
      { threshold: 0.25 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [started]);

  useEffect(() => {
    if (!started) return;
    let startTimestamp = null;
    let animationFrame;
    const step = (timestamp) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setVal(eased * target);
      if (progress < 1) {
        animationFrame = window.requestAnimationFrame(step);
      }
    };
    animationFrame = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(animationFrame);
  }, [started, target, duration]);

  return [val.toFixed(decimals), ref];
};

export const LandingPage = () => {
  const navigate = useNavigate();
  const { openRoleModal } = useDemo();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeAccentTab, setActiveAccentTab] = useState('a'); // 'a' (deep teal), 'b' (forest green), 'c' (maroon)

  // Campus switcher & active tenant portal states
  const [isCampusModalOpen, setIsCampusModalOpen] = useState(false);
  const [activeTenant, setActiveTenantState] = useState(() => getActiveTenant());
  const [showCampusBanner, setShowCampusBanner] = useState(true);
  const [featuredCampuses, setFeaturedCampuses] = useState([]);
  const [copiedCampusSubdomain, setCopiedCampusSubdomain] = useState(null);

  // Welcome Screen state
  const [showWelcome, setShowWelcome] = useState(() => {
    try {
      return sessionStorage.getItem('attendease_welcome_seen') !== 'true';
    } catch (e) {
      return false;
    }
  });

  // Fetch featured active registered campuses for walkthrough
  useEffect(() => {
    let isMounted = true;
    api.get('/landing/search-tenants')
      .then((res) => {
        if (!isMounted) return;
        if (res.data?.success && Array.isArray(res.data.data)) {
          setFeaturedCampuses(res.data.data);
        }
      })
      .catch((err) => {
        console.warn('Unable to load featured campuses:', err);
      });
    return () => { isMounted = false; };
  }, []);

  const handleCopyCampusLink = (e, subdomain) => {
    e.stopPropagation();
    const url = getFullTenantUrl(subdomain);
    navigator.clipboard.writeText(url).then(() => {
      setCopiedCampusSubdomain(subdomain);
      setTimeout(() => setCopiedCampusSubdomain(null), 2000);
    });
  };

  // Top scroll-scrubbed hairline progress bar
  const [scrollProgress, setScrollProgress] = useState(0);
  useEffect(() => {
    const handleScroll = () => {
      const total = document.documentElement.scrollHeight - window.innerHeight;
      if (total > 0) {
        setScrollProgress((window.scrollY / total) * 100);
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Live Biometric & Session Simulation in Hero Ledger
  const [activeRosterRow, setActiveRosterRow] = useState(0);
  const [isVerifyingScan, setIsVerifyingScan] = useState(false);
  const [verifiedCount, setVerifiedCount] = useState(142);
  const [conflictStatus, setConflictStatus] = useState('Verified');
  const [isCheckingConflict, setIsCheckingConflict] = useState(false);

  // Auto-cycle through students in the ledger mockup
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveRosterRow((prev) => (prev + 1) % 4);
    }, 3200);
    return () => clearInterval(timer);
  }, []);

  const triggerScanSimulation = () => {
    if (isVerifyingScan) return;
    setIsVerifyingScan(true);
    setTimeout(() => {
      setIsVerifyingScan(false);
      setVerifiedCount((prev) => prev + 1);
      setActiveRosterRow(0);
    }, 700);
  };

  const triggerConflictSimulation = () => {
    if (isCheckingConflict) return;
    setIsCheckingConflict(true);
    setConflictStatus('Validating...');
    setTimeout(() => {
      setIsCheckingConflict(false);
      setConflictStatus('Verified (0 Clashes)');
    }, 800);
  };

  // Proof Metric Tickers
  const [complianceRate, complianceRef] = useCountUp(99.8, 1, 1400);
  const [authSpeed, authSpeedRef] = useCountUp(182, 0, 1200);
  const [activeRecords, recordsRef] = useCountUp(124, 0, 1600);
  const [uptimeSla, uptimeRef] = useCountUp(99.99, 2, 1500);

  // Inbound Lead Form State
  const [leadForm, setLeadForm] = useState({
    name: '',
    email: '',
    phone: '',
    institutionName: '',
    studentCount: '500 - 2000',
    notes: '',
  });
  const [leadSubmitting, setLeadSubmitting] = useState(false);
  const [leadSuccess, setLeadSuccess] = useState(false);
  const [leadError, setLeadError] = useState(null);

  const handleLeadSubmit = async (e) => {
    e.preventDefault();
    if (!leadForm.name || !leadForm.email || !leadForm.institutionName) {
      setLeadError('Please fill in your name, campus email, and institution name.');
      return;
    }
    setLeadSubmitting(true);
    setLeadError(null);
    try {
      await api.post('/landing/lead', {
        name: leadForm.name,
        email: leadForm.email,
        phone: leadForm.phone || undefined,
        institutionName: leadForm.institutionName,
        studentCount: leadForm.studentCount === 'Under 500' ? 250 :
                      leadForm.studentCount === '500 - 2000' ? 1000 :
                      leadForm.studentCount === '2000 - 10000' ? 5000 : 15000,
        notes: leadForm.notes || undefined,
        leadType: 'demo_request',
      });
      setLeadSuccess(true);
      setLeadForm({
        name: '',
        email: '',
        phone: '',
        institutionName: '',
        studentCount: '500 - 2000',
        notes: '',
      });
    } catch (err) {
      setLeadError(err?.response?.data?.message || err.message || 'Unable to submit inquiry. Please try again.');
    } finally {
      setLeadSubmitting(false);
    }
  };

  // Dynamic Pricing State
  const [plans, setPlans] = useState(CANONICAL_PLANS);
  const [billingCycle, setBillingCycle] = useState('monthly');
  const [showFullMatrix, setShowFullMatrix] = useState(false);
  const [plansLoading, setPlansLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;
    setPlansLoading(true);
    api.get('/landing/pricing')
      .then((res) => {
        if (!isMounted) return;
        if (res.data?.success && Array.isArray(res.data?.data) && res.data.data.length > 0) {
          const fetched = res.data.data.map((p) => {
            const code = (p.code || p.name || '').toLowerCase();
            const fallback = CANONICAL_PLANS.find((c) => c.code === code) || CANONICAL_PLANS[0];
            const basePrice = p.priceInr ?? p.price?.monthly ?? p.price ?? fallback.price.monthly;
            return {
              ...fallback,
              ...p,
              code: code || fallback.code,
              name: p.name || fallback.name,
              tagline: p.description || fallback.tagline,
              price: {
                monthly: basePrice,
                annual: Math.round(basePrice * 0.8), // 20% annual discount
              },
              limits: { ...fallback.limits, ...(p.limits || {}) },
              modules: { ...fallback.modules, ...(p.modules || {}) },
            };
          });
          setPlans(fetched);
        }
      })
      .catch(() => {
        // Fall back to CANONICAL_PLANS seamlessly
      })
      .finally(() => {
        if (isMounted) setPlansLoading(false);
      });
    return () => { isMounted = false; };
  }, []);

  const scrollTo = (id, targetPlan = null) => {
    setMobileMenuOpen(false);
    if (targetPlan && targetPlan === 'enterprise') {
      setLeadForm(prev => ({
        ...prev,
        notes: prev.notes || 'Interested in Enterprise Tier onboarding and quote.',
      }));
    }
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen bg-background font-body text-ink antialiased selection:bg-primary/20 selection:text-ink">
      {/* Welcome Entrance Intro Modal */}
      {showWelcome && <WelcomeEntrance onFinish={() => setShowWelcome(false)} />}

      {/* Top Scroll-Scrubbed Hairline Progress Indicator */}
      <div
        className="fixed top-0 left-0 h-[2px] bg-primary z-50 transition-all duration-75 origin-left"
        style={{ width: `${scrollProgress}%` }}
        role="progressbar"
        aria-valuenow={Math.round(scrollProgress)}
        aria-valuemin="0"
        aria-valuemax="100"
      />

      {/* Focusable Skip Link */}
      <a
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:bg-primary focus:text-white focus:px-4 focus:py-2 focus:rounded focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary text-xs font-medium"
        href="#main-content"
      >
        Skip to content
      </a>

      {/* Header Navigation */}
      <header className="fixed top-0 left-0 w-full z-40 bg-surface/95 backdrop-blur-xs border-b border-line">
        <div className="h-16 max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              className="flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded"
            >
              <span className="font-bold text-xl tracking-tight text-ink">
                Attend<span className="text-primary">Ease</span>
              </span>
            </button>
            <span className="hidden sm:inline-block h-4 w-px bg-line"></span>
            <span className="hidden sm:inline-block text-xs uppercase tracking-wider text-ink-muted font-mono font-medium">
              Academic ERP
            </span>
          </div>

          {/* Desktop Nav Links */}
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium">
            <button
              onClick={() => scrollTo('features')}
              className="text-ink-muted hover:text-ink transition-colors focus:outline-none focus:ring-1 focus:ring-primary rounded px-1"
            >
              Modules
            </button>
            <button
              onClick={() => scrollTo('how-it-works')}
              className="text-ink-muted hover:text-ink transition-colors focus:outline-none focus:ring-1 focus:ring-primary rounded px-1"
            >
              How it works
            </button>
            <button
              onClick={() => scrollTo('portals')}
              className="text-ink-muted hover:text-ink transition-colors focus:outline-none focus:ring-1 focus:ring-primary rounded px-1"
            >
              Portals
            </button>
            <button
              onClick={() => scrollTo('pricing')}
              className="text-ink-muted hover:text-ink transition-colors focus:outline-none focus:ring-1 focus:ring-primary rounded px-1"
            >
              Plans
            </button>
            <button
              onClick={() => scrollTo('contact')}
              className="text-ink-muted hover:text-ink transition-colors focus:outline-none focus:ring-1 focus:ring-primary rounded px-1"
            >
              Inquiry
            </button>
          </nav>

          {/* Desktop Action Buttons */}
          <div className="hidden md:flex items-center gap-2.5 text-xs font-medium">
            <button
              type="button"
              onClick={() => setIsCampusModalOpen(true)}
              className="h-9 inline-flex items-center gap-1.5 px-3 bg-surface hover:bg-surface-subtle text-ink rounded border border-line transition-colors focus:outline-none focus:ring-2 focus:ring-primary shadow-xs"
              title="Search institutional login portals"
            >
              <School className="w-3.5 h-3.5 text-primary" />
              <span>{activeTenant ? activeTenant.name : 'Campus Portals'}</span>
            </button>
            <button
              onClick={() => navigate('/login')}
              className="text-ink-muted hover:text-ink transition-colors px-2.5 py-1.5 rounded focus:outline-none focus:ring-1 focus:ring-primary"
            >
              Sign in
            </button>
            <button
              onClick={openRoleModal}
              className="h-9 inline-flex items-center justify-center px-3.5 bg-surface hover:bg-surface-subtle text-ink rounded border border-line transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
            >
              Explore Demo Sandbox
            </button>
            <button
              onClick={() => navigate('/register/tenant')}
              className="h-9 inline-flex items-center justify-center px-4 bg-primary hover:bg-primary-hover text-on-primary rounded border border-primary transition-colors focus:outline-none focus:ring-2 focus:ring-primary shadow-xs"
            >
              Start Free Trial
            </button>
          </div>

          {/* Mobile Hamburger Button */}
          <div className="flex items-center md:hidden">
            <button
              aria-label="Toggle navigation"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 text-ink-muted hover:text-ink focus:outline-none focus:ring-2 focus:ring-primary rounded"
              type="button"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden border-b border-line bg-surface px-4 pt-3 pb-6 space-y-3">
            <nav className="flex flex-col space-y-2 text-sm font-medium">
              <button
                onClick={() => scrollTo('features')}
                className="py-2 text-left text-ink-muted hover:text-ink"
              >
                Modules
              </button>
              <button
                onClick={() => scrollTo('how-it-works')}
                className="py-2 text-left text-ink-muted hover:text-ink"
              >
                How it works
              </button>
              <button
                onClick={() => scrollTo('portals')}
                className="py-2 text-left text-ink-muted hover:text-ink"
              >
                Portals &amp; Branding
              </button>
              <button
                onClick={() => scrollTo('pricing')}
                className="py-2 text-left text-ink-muted hover:text-ink"
              >
                Plans
              </button>
              <button
                onClick={() => scrollTo('contact')}
                className="py-2 text-left text-ink-muted hover:text-ink"
              >
                Campus Consultation
              </button>
              <button
                onClick={() => { setMobileMenuOpen(false); setIsCampusModalOpen(true); }}
                className="py-2 text-left text-primary font-medium flex items-center gap-2"
              >
                <School className="w-4 h-4" />
                <span>Find Campus Portal</span>
              </button>
              <button
                onClick={() => { setMobileMenuOpen(false); navigate('/login'); }}
                className="py-2 text-left text-ink-muted hover:text-ink"
              >
                Sign in
              </button>
            </nav>
            <div className="flex flex-col gap-2 pt-3 border-t border-line">
              <button
                onClick={() => { setMobileMenuOpen(false); openRoleModal(); }}
                className="h-9 inline-flex items-center justify-center px-4 bg-surface hover:bg-surface-subtle text-ink rounded border border-line text-xs font-medium"
              >
                Explore Demo Sandbox
              </button>
              <button
                onClick={() => { setMobileMenuOpen(false); navigate('/register/tenant'); }}
                className="h-9 inline-flex items-center justify-center px-4 bg-primary hover:bg-primary-hover text-on-primary rounded border border-primary text-xs font-medium"
              >
                Start Free Trial
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Main Content Area */}
      <main className="w-full pt-16" id="main-content">
        {/* 1. HERO SECTION */}
        <section className="w-full border-b border-line bg-background">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 md:py-16">
            {/* Active Campus Remembered Banner */}
            {activeTenant && showCampusBanner && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-8 p-3.5 sm:p-4 rounded-xl border border-primary/30 bg-primary-soft/50 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-lg bg-primary text-white flex items-center justify-center shrink-0 shadow-xs">
                    <School className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-ink">
                        Active Campus Portal: <span className="font-bold">{activeTenant.name}</span>
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-surface border border-line font-mono text-[10px] text-primary font-bold">
                        {activeTenant.subdomain}
                      </span>
                    </div>
                    <p className="text-xs text-ink-muted truncate font-mono mt-0.5">
                      {window.location.origin}/login/{activeTenant.subdomain}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap shrink-0">
                  <button
                    type="button"
                    onClick={() => navigate(getTenantLoginUrl(activeTenant.subdomain))}
                    className="h-8 px-3.5 bg-primary hover:bg-primary-hover text-on-primary rounded text-xs font-semibold flex items-center gap-1.5 shadow-xs transition"
                  >
                    <span>Enter Portal</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => handleCopyCampusLink(e, activeTenant.subdomain)}
                    className="h-8 px-2.5 bg-surface hover:bg-surface-subtle text-ink border border-line rounded text-xs font-medium flex items-center gap-1 transition"
                    title="Copy dedicated login link"
                  >
                    {copiedCampusSubdomain === activeTenant.subdomain ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="text-emerald-700">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-ink-muted" />
                        <span>Copy Link</span>
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsCampusModalOpen(true)}
                    className="h-8 px-2.5 text-xs text-ink-muted hover:text-ink hover:bg-surface rounded transition"
                  >
                    Switch
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCampusBanner(false)}
                    className="p-1 text-ink-muted hover:text-ink rounded transition"
                    aria-label="Dismiss banner"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            )}

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start"
            >
              {/* Left Column: Heading, Specs & CTAs */}
              <div className="lg:col-span-5 flex flex-col justify-center">
                <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded bg-surface border border-line text-xs text-ink-muted w-fit mb-4">
                  <span className="w-2 h-2 rounded-full bg-status-success-text animate-pulse"></span>
                  <span className="font-mono uppercase tracking-wider text-[11px] font-medium text-ink">Academic Release 2026 &bull; Active</span>
                </div>

                <h1 className="font-headline text-3xl sm:text-4xl lg:text-5xl font-bold text-ink tracking-tight mb-4 leading-tight">
                  Multi-tenant academic ERP for colleges and schools.
                </h1>
                <p className="text-base text-ink-muted mb-6 leading-relaxed">
                  AttendEase manages attendance, timetables, exams, fees, and custom staff roles across independent institution portals with strict tenant data isolation.
                </p>

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    onClick={() => navigate('/register/tenant')}
                    className="h-10 inline-flex items-center justify-center px-5 bg-primary hover:bg-primary-hover text-on-primary text-xs font-medium rounded border border-primary transition-colors focus:outline-none focus:ring-2 focus:ring-primary shadow-xs"
                  >
                    Start Free Trial
                  </button>
                  <button
                    onClick={openRoleModal}
                    className="h-10 inline-flex items-center justify-center px-5 bg-surface hover:bg-surface-subtle text-ink text-xs font-medium rounded border border-line transition-colors focus:outline-none focus:ring-2 focus:ring-primary shadow-xs"
                  >
                    Explore Sandbox
                  </button>
                  <button
                    onClick={() => scrollTo('contact')}
                    className="h-10 inline-flex items-center justify-center px-4 text-ink-muted hover:text-ink text-xs font-medium transition-colors"
                  >
                    Consultation &rarr;
                  </button>
                </div>

                <div className="mt-8 pt-6 border-t border-line grid grid-cols-2 gap-4">
                  <div>
                    <span className="block font-mono text-[11px] uppercase tracking-wider text-ink-muted mb-0.5">DATA RESIDENCY</span>
                    <span className="text-xs font-medium text-ink">Client-side offline vector auth</span>
                  </div>
                  <div>
                    <span className="block font-mono text-[11px] uppercase tracking-wider text-ink-muted mb-0.5">TENANCY MODEL</span>
                    <span className="text-xs font-medium text-ink">tenant-scoped data isolation</span>
                  </div>
                </div>
              </div>

              {/* Right Column: Registrar Console UI Ledger Mockup */}
              <div className="lg:col-span-7 bg-surface border border-line rounded-panel shadow-level1 overflow-hidden">
                <div className="h-10 bg-surface-subtle border-b border-line px-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-line"></span>
                    <span className="w-2.5 h-2.5 rounded-full bg-line"></span>
                    <span className="w-2.5 h-2.5 rounded-full bg-line"></span>
                    <span className="ml-2 font-mono text-xs text-ink-muted">REGISTRAR CONSOLE : SESSION 2026-27</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="hidden sm:inline font-mono text-xs text-ink-muted">INSTANCE: demo.attendease.app</span>
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-primary-soft border border-primary/20 text-primary font-mono text-[10px] font-bold">
                      DEMO SANDBOX
                    </span>
                  </div>
                </div>

                {/* Content Grid */}
                <div className="p-4 grid grid-cols-1 md:grid-cols-12 gap-4">
                  {/* Pane A: Attendance Registry Table */}
                  <div className="md:col-span-7 border border-line rounded overflow-hidden flex flex-col justify-between">
                    <div>
                      <div className="p-2.5 bg-surface-subtle border-b border-line flex items-center justify-between">
                        <span className="text-xs font-semibold text-ink uppercase tracking-wide">Attendance Registry</span>
                        <span className="font-mono text-[11px] text-ink-muted">MON 09:00 - 10:00</span>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-surface-subtle border-b border-line font-mono text-[11px] text-ink-muted">
                              <th className="py-1.5 px-2.5">Roll no.</th>
                              <th className="py-1.5 px-2.5">Student name</th>
                              <th className="py-1.5 px-2.5">Slot</th>
                              <th className="py-1.5 px-2.5 text-right">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-line text-xs font-mono">
                            <tr className={`transition-colors ${activeRosterRow === 0 ? 'bg-primary/5 font-semibold' : 'hover:bg-surface-subtle'}`}>
                              <td className="py-2 px-2.5 tnum">CS-101</td>
                              <td className="py-2 px-2.5 font-body">Aarav Sharma</td>
                              <td className="py-2 px-2.5 text-ink-muted tnum">09:00 - 10:00</td>
                              <td className="py-2 px-2.5 text-right font-body">
                                {isVerifyingScan ? (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-status-info-bg text-status-info-text border border-status-info-border text-[10px]">
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                    <span>Scanning</span>
                                  </span>
                                ) : (
                                  <span className="inline-block px-1.5 py-0.5 rounded bg-status-success-bg text-status-success-text border border-status-success-border text-[11px]">Present</span>
                                )}
                              </td>
                            </tr>
                            <tr className={`transition-colors ${activeRosterRow === 1 ? 'bg-primary/5 font-semibold' : 'hover:bg-surface-subtle'}`}>
                              <td className="py-2 px-2.5 tnum">CS-102</td>
                              <td className="py-2 px-2.5 font-body">Priya Nair</td>
                              <td className="py-2 px-2.5 text-ink-muted tnum">09:00 - 10:00</td>
                              <td className="py-2 px-2.5 text-right font-body">
                                <span className="inline-block px-1.5 py-0.5 rounded bg-status-error-bg text-status-error-text border border-status-error-border text-[11px]">Absent</span>
                              </td>
                            </tr>
                            <tr className={`transition-colors ${activeRosterRow === 2 ? 'bg-primary/5 font-semibold' : 'hover:bg-surface-subtle'}`}>
                              <td className="py-2 px-2.5 tnum">CS-103</td>
                              <td className="py-2 px-2.5 font-body">Rohan Desai</td>
                              <td className="py-2 px-2.5 text-ink-muted tnum">09:00 - 10:00</td>
                              <td className="py-2 px-2.5 text-right font-body">
                                <span className="inline-block px-1.5 py-0.5 rounded bg-status-warning-bg text-status-warning-text border border-status-warning-border text-[11px]">Leave</span>
                              </td>
                            </tr>
                            <tr className={`transition-colors ${activeRosterRow === 3 ? 'bg-primary/5 font-semibold' : 'hover:bg-surface-subtle'}`}>
                              <td className="py-2 px-2.5 tnum">CS-104</td>
                              <td className="py-2 px-2.5 font-body">Sneha Gupta</td>
                              <td className="py-2 px-2.5 text-ink-muted tnum">09:00 - 10:00</td>
                              <td className="py-2 px-2.5 text-right font-body">
                                <span className="inline-block px-1.5 py-0.5 rounded bg-status-success-bg text-status-success-text border border-status-success-border text-[11px]">Present</span>
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Interactive Scan Action Bar */}
                    <div className="p-2 border-t border-line bg-surface-subtle flex items-center justify-between">
                      <span className="font-mono text-[10px] text-ink-muted">
                        Verified: <strong className="text-ink">{verifiedCount}</strong> / 150
                      </span>
                      <button
                        onClick={triggerScanSimulation}
                        disabled={isVerifyingScan}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-primary text-white text-[11px] font-medium hover:bg-[#115E59] transition-colors cursor-pointer"
                        title="Simulate browser vector recognition"
                      >
                        <Scan className="w-3 h-3" />
                        <span>Simulate Scan</span>
                      </button>
                    </div>
                  </div>

                  {/* Pane B: Timetable Conflict Matrix Snippet */}
                  <div className="md:col-span-5 flex flex-col gap-3">
                    <div className="border border-line rounded p-3 bg-surface">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold text-ink uppercase tracking-wide">Conflict Verification</span>
                        <span className="font-mono text-[10px] px-1.5 py-0.5 bg-status-success-bg text-status-success-text border border-status-success-border rounded">
                          {conflictStatus}
                        </span>
                      </div>
                      <div className="space-y-1.5 pt-1 text-xs">
                        <div className="flex justify-between border-b border-line pb-1">
                          <span className="text-ink-muted">Section:</span>
                          <span className="font-mono font-medium tnum">B.Tech CS-3A</span>
                        </div>
                        <div className="flex justify-between border-b border-line pb-1">
                          <span className="text-ink-muted">Classroom:</span>
                          <span className="font-mono font-medium tnum">LH-102 (Cap: 60)</span>
                        </div>
                        <div className="flex justify-between border-b border-line pb-1">
                          <span className="text-ink-muted">Faculty Allocation:</span>
                          <span className="font-medium text-right">Dr. V. Rao</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-ink-muted">Slot Matrix:</span>
                          <span className="font-mono text-ink-muted tnum">MON 09:00 - 10:00</span>
                        </div>
                      </div>
                    </div>

                    <div className="border border-line rounded p-3 bg-surface-subtle flex flex-col justify-between">
                      <div>
                        <span className="text-[10px] uppercase tracking-wider text-ink-muted font-mono font-semibold block mb-1">Validation Engine</span>
                        <p className="text-xs text-ink leading-relaxed mb-3">
                          Timetable conflict detection active across teacher availability, room reservations, and cohorts.
                        </p>
                      </div>
                      <button
                        onClick={triggerConflictSimulation}
                        disabled={isCheckingConflict}
                        className="inline-flex items-center justify-center gap-1.5 px-2.5 py-1 rounded bg-surface hover:bg-surface-subtle text-ink border border-line text-[11px] font-medium transition cursor-pointer w-full"
                      >
                        <RefreshCw className={`w-3 h-3 ${isCheckingConflict ? 'animate-spin' : ''}`} />
                        <span>Run Clash Audit</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* ENTERPRISE ARCHITECTURAL SPECIFICATIONS */}
        <section className="w-full border-b border-line bg-surface-subtle py-8">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.5 }}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6"
            >
              {/* Pillar 1 */}
              <div className="border-l-2 border-primary pl-4 flex flex-col justify-between">
                <div>
                  <div className="font-mono text-xs font-bold text-primary uppercase tracking-wider mb-1 flex items-center gap-1.5">
                    <Cpu className="w-3.5 h-3.5" />
                    <span>Local Vector Auth</span>
                  </div>
                  <div className="text-sm font-semibold text-ink leading-snug">WASM Edge Verification</div>
                  <div className="text-xs text-ink-muted mt-1 leading-relaxed">
                    Zero raw biometric photos stored. 128-d feature embeddings evaluated client-side in browser memory.
                  </div>
                </div>
                <div className="mt-2 text-[11px] font-mono text-ink-muted">Privacy Invariant: 100% Client-Side</div>
              </div>

              {/* Pillar 2 */}
              <div className="border-l-2 border-secondary pl-4 flex flex-col justify-between">
                <div>
                  <div className="font-mono text-xs font-bold text-secondary uppercase tracking-wider mb-1 flex items-center gap-1.5">
                    <Database className="w-3.5 h-3.5" />
                    <span>Multi-Tenancy</span>
                  </div>
                  <div className="text-sm font-semibold text-ink leading-snug">Tenant Data Isolation</div>
                  <div className="text-xs text-ink-muted mt-1 leading-relaxed">
                    Tenant-scoped schema boundaries with automated subdomain dispatch and partitioned ledger indexing.
                  </div>
                </div>
                <div className="mt-2 text-[11px] font-mono text-ink-muted">Residency: Multi-Tenant Logical Separation</div>
              </div>

              {/* Pillar 3 */}
              <div className="border-l-2 border-primary pl-4 flex flex-col justify-between">
                <div>
                  <div className="font-mono text-xs font-bold text-primary uppercase tracking-wider mb-1 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Deterministic Engine</span>
                  </div>
                  <div className="text-sm font-semibold text-ink leading-snug">0-Clash Invariant Check</div>
                  <div className="text-xs text-ink-muted mt-1 leading-relaxed">
                    Strict mathematical validation guarantees zero room, instructor, or student cohort timetable clashes.
                  </div>
                </div>
                <div className="mt-2 text-[11px] font-mono text-ink-muted">Overlap Prevention: Automated</div>
              </div>

              {/* Pillar 4 */}
              <div className="border-l-2 border-secondary pl-4 flex flex-col justify-between">
                <div>
                  <div className="font-mono text-xs font-bold text-secondary uppercase tracking-wider mb-1 flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5" />
                    <span>Access & Audit</span>
                  </div>
                  <div className="text-sm font-semibold text-ink leading-snug">Granular RBAC Security</div>
                  <div className="text-xs text-ink-muted mt-1 leading-relaxed">
                    Least-privilege module authorizations with tamper-evident audit logging across academic operations.
                  </div>
                </div>
                <div className="mt-2 text-[11px] font-mono text-ink-muted">Audit Trail: Append-Only Immutable</div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* 2. CORE ACADEMIC MODULES */}
        <section className="w-full border-b border-line bg-surface py-14" id="features">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="mb-10 max-w-3xl">
              <h2 className="font-headline text-2xl font-bold text-ink tracking-tight mb-2">Core academic modules</h2>
              <p className="text-sm text-ink-muted">
                Engineered for deterministic institutional administration across integrated domains.
              </p>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.5 }}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
            >
              {/* Module 1: Attendance */}
              <div className="bg-background border border-line rounded-panel p-6 flex flex-col justify-between shadow-xs">
                <div>
                  <div className="w-8 h-8 rounded border border-line bg-surface flex items-center justify-center text-primary mb-4">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <h3 className="text-base font-semibold text-ink mb-2">Attendance</h3>
                  <p className="text-xs text-ink-muted mb-6 leading-relaxed">
                    Attendance marked against a scheduled timetable slot. Face-based attendance works offline in the browser, with face data stored only as numeric vectors, never as photos.
                  </p>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-mono tracking-wider text-ink-muted font-semibold block mb-2">Specifications</span>
                  <ul className="space-y-1.5 text-xs text-ink">
                    <li className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 bg-primary rounded-full"></span>
                      Attendance marked against a scheduled timetable slot
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 bg-primary rounded-full"></span>
                      Face-based attendance works offline in browser
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 bg-primary rounded-full"></span>
                      Face data stored only as numeric vectors, never photos
                    </li>
                  </ul>
                </div>
              </div>

              {/* Module 2: Timetable Conflict Detection */}
              <div className="bg-background border border-line rounded-panel p-6 flex flex-col justify-between shadow-xs">
                <div>
                  <div className="w-8 h-8 rounded border border-line bg-surface flex items-center justify-center text-primary mb-4">
                    <Calendar className="w-4 h-4" />
                  </div>
                  <h3 className="text-base font-semibold text-ink mb-2">Timetable conflict detection</h3>
                  <p className="text-xs text-ink-muted mb-6 leading-relaxed">
                    Timetable conflict detection prevents room double-booking, faculty overlaps, and section clashes across scheduled lecture slots.
                  </p>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-mono tracking-wider text-ink-muted font-semibold block mb-2">Specifications</span>
                  <ul className="space-y-1.5 text-xs text-ink">
                    <li className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 bg-primary rounded-full"></span>
                      Detection for teacher, room, and section clashes
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 bg-primary rounded-full"></span>
                      Timetable-linked attendance session mapping
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 bg-primary rounded-full"></span>
                      Automatic slot matrix synchronization
                    </li>
                  </ul>
                </div>
              </div>

              {/* Module 3: Exams */}
              <div className="bg-background border border-line rounded-panel p-6 flex flex-col justify-between shadow-xs">
                <div>
                  <div className="w-8 h-8 rounded border border-line bg-surface flex items-center justify-center text-primary mb-4">
                    <GraduationCap className="w-4 h-4" />
                  </div>
                  <h3 className="text-base font-semibold text-ink mb-2">Exams</h3>
                  <p className="text-xs text-ink-muted mb-6 leading-relaxed">
                    Exam scheduling on a date and shift grid, with invigilator assignment (maximum 2 per exam) and clash checks.
                  </p>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-mono tracking-wider text-ink-muted font-semibold block mb-2">Specifications</span>
                  <ul className="space-y-1.5 text-xs text-ink">
                    <li className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 bg-primary rounded-full"></span>
                      Exam scheduling on a date and shift grid
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 bg-primary rounded-full"></span>
                      Invigilator assignment (maximum 2 per exam)
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 bg-primary rounded-full"></span>
                      Clash checks across examination halls
                    </li>
                  </ul>
                </div>
              </div>

              {/* Module 4: Fees */}
              <div className="bg-background border border-line rounded-panel p-6 flex flex-col justify-between shadow-xs">
                <div>
                  <div className="w-8 h-8 rounded border border-line bg-surface flex items-center justify-center text-primary mb-4">
                    <Building className="w-4 h-4" />
                  </div>
                  <h3 className="text-base font-semibold text-ink mb-2">Fees</h3>
                  <p className="text-xs text-ink-muted mb-6 leading-relaxed">
                    Fee structures configured by course, fee collection tracking, waivers, and formal receipts configured across student records.
                  </p>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-mono tracking-wider text-ink-muted font-semibold block mb-2">Specifications</span>
                  <ul className="space-y-1.5 text-xs text-ink">
                    <li className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 bg-primary rounded-full"></span>
                      Fee structures configured by course
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 bg-primary rounded-full"></span>
                      Fee collection tracking and receipts
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 bg-primary rounded-full"></span>
                      Institutional fee waivers and audit logs
                    </li>
                  </ul>
                </div>
              </div>

              {/* Module 5: Roles and Permissions (Spans 2 cols on lg) */}
              <div className="md:col-span-2 lg:col-span-2 bg-background border border-line rounded-panel p-6 flex flex-col justify-between shadow-xs">
                <div>
                  <div className="w-8 h-8 rounded border border-line bg-surface flex items-center justify-center text-primary mb-4">
                    <Shield className="w-4 h-4" />
                  </div>
                  <h3 className="text-base font-semibold text-ink mb-2">Roles and permissions</h3>
                  <p className="text-xs text-ink-muted mb-6 leading-relaxed">
                    Custom roles with granular permissions per module. Provide role-specific views for admin, teacher, student, and parent.
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <span className="text-[10px] uppercase font-mono tracking-wider text-ink-muted font-semibold block mb-2">Access Control</span>
                    <ul className="space-y-1.5 text-xs text-ink">
                      <li className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 bg-primary rounded-full"></span>
                        Granular permissions per module
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 bg-primary rounded-full"></span>
                        tenant-scoped data isolation
                      </li>
                    </ul>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-mono tracking-wider text-ink-muted font-semibold block mb-2">Lifecycle &amp; Views</span>
                    <ul className="space-y-1.5 text-xs text-ink">
                      <li className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 bg-primary rounded-full"></span>
                        Role-specific views for admin, teacher, student, parent
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 bg-primary rounded-full"></span>
                        Automatic semester promotion and graduation
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* 3. STRUCTURED DEPLOYMENT WORKFLOW */}
        <section className="w-full border-b border-line bg-background py-14" id="how-it-works">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="mb-10">
              <h2 className="font-headline text-2xl font-bold text-ink tracking-tight">Structured deployment workflow</h2>
              <p className="text-sm text-ink-muted mt-1">Deterministic three-step onboarding process for campus administrators.</p>
            </div>
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.5 }}
              className="grid grid-cols-1 md:grid-cols-3 gap-6"
            >
              {/* Step 1 */}
              <div className="border border-line bg-surface rounded-panel p-6 shadow-xs">
                <div className="font-mono text-xs font-semibold text-primary mb-3">STEP 01</div>
                <h3 className="text-base font-semibold text-ink mb-2">Set up academic structure</h3>
                <p className="text-xs text-ink-muted leading-relaxed mb-4">
                  Configure departments, degree courses, semesters, classroom inventories, and fee structures by course.
                </p>
                <div className="p-2.5 bg-surface-subtle border border-line rounded font-mono text-[11px] text-ink-muted">
                  Entity Schema: Dept / Degree / Rooms / Ledger
                </div>
              </div>

              {/* Step 2 */}
              <div className="border border-line bg-surface rounded-panel p-6 shadow-xs">
                <div className="font-mono text-xs font-semibold text-primary mb-3">STEP 02</div>
                <h3 className="text-base font-semibold text-ink mb-2">Assign teachers and sections</h3>
                <p className="text-xs text-ink-muted leading-relaxed mb-4">
                  Allocate instructors, define student cohorts, and map scheduled lecture slots with clash detection.
                </p>
                <div className="p-2.5 bg-surface-subtle border border-line rounded font-mono text-[11px] text-ink-muted">
                  Validation: Teacher, Room, and Section Clashes
                </div>
              </div>

              {/* Step 3 */}
              <div className="border border-line bg-surface rounded-panel p-6 shadow-xs">
                <div className="font-mono text-xs font-semibold text-primary mb-3">STEP 03</div>
                <h3 className="text-base font-semibold text-ink mb-2">Start marking attendance</h3>
                <p className="text-xs text-ink-muted leading-relaxed mb-4">
                  Mark attendance against scheduled timetable slots using browser offline face vectors or manual rosters.
                </p>
                <div className="p-2.5 bg-surface-subtle border border-line rounded font-mono text-[11px] text-ink-muted">
                  Verification: Browser Vector Auth / Roster
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* 4. INSTITUTION BRANDING AND PORTALS */}
        <section className="w-full border-b border-line bg-surface py-14" id="portals">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="max-w-3xl mb-10">
              <h2 className="font-headline text-2xl font-bold text-ink tracking-tight mb-2">Institution branding and portals</h2>
              <p className="text-sm text-ink-muted">
                Per-institution branding and subdomain login with tenant-scoped data isolation across portals.
              </p>
            </div>

            {/* Interactive Campus Accent Switcher */}
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.5 }}
              className="grid grid-cols-1 md:grid-cols-3 gap-6"
            >
              {/* Instance A: Deep Teal */}
              <div
                onClick={() => setActiveAccentTab('a')}
                className={`border rounded-panel p-4 cursor-pointer transition-all ${
                  activeAccentTab === 'a' ? 'border-primary ring-2 ring-primary/20 bg-background' : 'border-line bg-background hover:border-line-hover'
                }`}
              >
                <div className="flex items-center justify-between pb-3 border-b border-line mb-4">
                  <span className="font-mono text-xs text-ink-muted">oxford.attendease.app</span>
                  <span className="w-3 h-3 rounded bg-primary"></span>
                </div>
                <div className="bg-surface border border-line rounded p-4 shadow-xs">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <span className="text-[10px] uppercase font-mono text-ink-muted font-medium block">Example Campus A</span>
                      <span className="text-xs font-semibold text-ink">Student Attendance Summary</span>
                    </div>
                    <span className="font-mono text-xs px-2 py-0.5 rounded bg-primary text-white font-medium tnum">Active</span>
                  </div>
                  <div className="space-y-2 border-t border-line pt-3 text-xs">
                    <div className="flex justify-between">
                      <span className="text-ink-muted">Enrolled Courses:</span>
                      <span className="font-mono font-medium tnum">6 Departments</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-ink-muted">Verified Sessions:</span>
                      <span className="font-mono font-medium tnum">142 Slots</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-ink-muted">Accent Configuration:</span>
                      <span className="font-mono text-primary font-medium">Default Primary</span>
                    </div>
                  </div>
                  <div className="mt-4 pt-3 border-t border-line">
                    <div className="h-1.5 w-full bg-line rounded overflow-hidden">
                      <div className="h-full bg-primary w-4/5"></div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Instance B: Forest Green */}
              <div
                onClick={() => setActiveAccentTab('b')}
                className={`border rounded-panel p-4 cursor-pointer transition-all ${
                  activeAccentTab === 'b' ? 'border-[#166534] ring-2 ring-[#166534]/20 bg-background' : 'border-line bg-background hover:border-line-hover'
                }`}
              >
                <div className="flex items-center justify-between pb-3 border-b border-line mb-4">
                  <span className="font-mono text-xs text-ink-muted">stjude.attendease.app</span>
                  <span className="w-3 h-3 rounded bg-[#166534]"></span>
                </div>
                <div className="bg-surface border border-line rounded p-4 shadow-xs">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <span className="text-[10px] uppercase font-mono text-ink-muted font-medium block">Example Campus B</span>
                      <span className="text-xs font-semibold text-ink">Student Attendance Summary</span>
                    </div>
                    <span className="font-mono text-xs px-2 py-0.5 rounded bg-[#166534] text-white font-medium tnum">Active</span>
                  </div>
                  <div className="space-y-2 border-t border-line pt-3 text-xs">
                    <div className="flex justify-between">
                      <span className="text-ink-muted">Enrolled Courses:</span>
                      <span className="font-mono font-medium tnum">8 Departments</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-ink-muted">Verified Sessions:</span>
                      <span className="font-mono font-medium tnum">188 Slots</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-ink-muted">Accent Configuration:</span>
                      <span className="font-mono text-[#166534] font-medium">Custom Emerald</span>
                    </div>
                  </div>
                  <div className="mt-4 pt-3 border-t border-line">
                    <div className="h-1.5 w-full bg-line rounded overflow-hidden">
                      <div className="h-full bg-[#166534] w-[92%]"></div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Instance C: Crimson Maroon */}
              <div
                onClick={() => setActiveAccentTab('c')}
                className={`border rounded-panel p-4 cursor-pointer transition-all ${
                  activeAccentTab === 'c' ? 'border-[#881337] ring-2 ring-[#881337]/20 bg-background' : 'border-line bg-background hover:border-line-hover'
                }`}
              >
                <div className="flex items-center justify-between pb-3 border-b border-line mb-4">
                  <span className="font-mono text-xs text-ink-muted">horizon.attendease.app</span>
                  <span className="w-3 h-3 rounded bg-[#881337]"></span>
                </div>
                <div className="bg-surface border border-line rounded p-4 shadow-xs">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <span className="text-[10px] uppercase font-mono text-ink-muted font-medium block">Example Campus C</span>
                      <span className="text-xs font-semibold text-ink">Student Attendance Summary</span>
                    </div>
                    <span className="font-mono text-xs px-2 py-0.5 rounded bg-[#881337] text-white font-medium tnum">Active</span>
                  </div>
                  <div className="space-y-2 border-t border-line pt-3 text-xs">
                    <div className="flex justify-between">
                      <span className="text-ink-muted">Enrolled Courses:</span>
                      <span className="font-mono font-medium tnum">12 Departments</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-ink-muted">Verified Sessions:</span>
                      <span className="font-mono font-medium tnum">254 Slots</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-ink-muted">Accent Configuration:</span>
                      <span className="font-mono text-[#881337] font-medium">Custom Maroon</span>
                    </div>
                  </div>
                  <div className="mt-4 pt-3 border-t border-line">
                    <div className="h-1.5 w-full bg-line rounded overflow-hidden">
                      <div className="h-full bg-[#881337] w-[85%]"></div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Live Registered Institution Portals Walkthrough */}
            <div className="mt-12 pt-10 border-t border-line">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
                <div>
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-primary-soft text-primary font-mono text-[11px] font-semibold mb-1">
                    <School className="w-3.5 h-3.5" />
                    <span>Campus Portals &amp; Registered Institutions</span>
                  </div>
                  <h3 className="font-headline text-lg sm:text-xl font-bold text-ink">
                    Direct Institutional Walkthrough Endpoints
                  </h3>
                  <p className="text-xs text-ink-muted mt-0.5 max-w-2xl">
                    Every enrolled campus receives its own secure subdomain and custom branded login portal with strict tenant-scoped data isolation.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCampusModalOpen(true)}
                  className="h-9 px-4 bg-primary hover:bg-primary-hover text-on-primary rounded text-xs font-semibold flex items-center gap-2 shadow-xs transition shrink-0"
                >
                  <School className="w-3.5 h-3.5" />
                  <span>Search Campus Portals</span>
                </button>
              </div>

              {/* Campus Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {featuredCampuses.length > 0 ? (
                  featuredCampuses.map((campus) => (
                    <div
                      key={campus.id || campus.subdomain}
                      className="bg-background border border-line rounded-panel p-4 flex flex-col justify-between hover:border-primary/40 hover:shadow-xs transition group"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-3">
                          {campus.logo ? (
                            <img
                              src={campus.logo}
                              alt={campus.name}
                              className="w-8 h-8 rounded object-contain border border-line bg-white p-0.5 shrink-0"
                            />
                          ) : (
                            <div
                              className="w-8 h-8 rounded flex items-center justify-center font-bold text-xs text-white shadow-xs shrink-0"
                              style={{ backgroundColor: campus.primaryColor || '#1e3a8a' }}
                            >
                              {(campus.name || campus.subdomain).charAt(0).toUpperCase()}
                            </div>
                          )}
                          <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-surface border border-line text-ink-muted truncate max-w-[120px]">
                            {campus.subdomain}
                          </span>
                        </div>
                        <h4 className="font-semibold text-sm text-ink group-hover:text-primary transition-colors truncate">
                          {campus.name}
                        </h4>
                        <p className="font-mono text-[11px] text-ink-muted truncate mt-1">
                          /login/{campus.subdomain}
                        </p>
                      </div>

                      <div className="pt-4 mt-4 border-t border-line flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            persistActiveTenant(campus);
                            setActiveTenantState(campus);
                            navigate(campus.loginUrl || `/login/${campus.subdomain}`);
                          }}
                          className="flex-1 h-8 bg-surface hover:bg-surface-subtle text-ink hover:text-primary border border-line rounded text-xs font-medium flex items-center justify-center gap-1.5 transition"
                        >
                          <span>Portal</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleCopyCampusLink(e, campus.subdomain)}
                          className="h-8 w-8 bg-surface hover:bg-surface-subtle text-ink-muted hover:text-ink border border-line rounded flex items-center justify-center transition"
                          title="Copy Direct Login Link"
                        >
                          {copiedCampusSubdomain === campus.subdomain ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  [
                    { name: 'DPS Global Academy', subdomain: 'dps', color: '#1e3a8a' },
                    { name: 'St. Xavier Institute', subdomain: 'xavier', color: '#0f766e' },
                    { name: 'National Public School', subdomain: 'nps', color: '#166534' },
                    { name: 'Horizon University', subdomain: 'horizon', color: '#881337' },
                  ].map((campus) => (
                    <div
                      key={campus.subdomain}
                      className="bg-background border border-line rounded-panel p-4 flex flex-col justify-between hover:border-primary/40 hover:shadow-xs transition group"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-3">
                          <div
                            className="w-8 h-8 rounded flex items-center justify-center font-bold text-xs text-white shadow-xs shrink-0"
                            style={{ backgroundColor: campus.color }}
                          >
                            {campus.subdomain.charAt(0).toUpperCase()}
                          </div>
                          <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-surface border border-line text-ink-muted">
                            {campus.subdomain}
                          </span>
                        </div>
                        <h4 className="font-semibold text-sm text-ink group-hover:text-primary transition-colors truncate">
                          {campus.name}
                        </h4>
                        <p className="font-mono text-[11px] text-ink-muted truncate mt-1">
                          /login/{campus.subdomain}
                        </p>
                      </div>

                      <div className="pt-4 mt-4 border-t border-line flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            const t = { name: campus.name, subdomain: campus.subdomain, primaryColor: campus.color };
                            persistActiveTenant(t);
                            setActiveTenantState(t);
                            navigate(`/login/${campus.subdomain}`);
                          }}
                          className="flex-1 h-8 bg-surface hover:bg-surface-subtle text-ink hover:text-primary border border-line rounded text-xs font-medium flex items-center justify-center gap-1.5 transition"
                        >
                          <span>Portal</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleCopyCampusLink(e, campus.subdomain)}
                          className="h-8 w-8 bg-surface hover:bg-surface-subtle text-ink-muted hover:text-ink border border-line rounded flex items-center justify-center transition"
                          title="Copy Direct Login Link"
                        >
                          {copiedCampusSubdomain === campus.subdomain ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </section>

        {/* 5. PRIVACY AND SECURITY ARCHITECTURE */}
        <section className="w-full border-b border-line bg-background py-14">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="max-w-3xl mb-10">
              <h2 className="font-headline text-2xl font-bold text-ink tracking-tight mb-2">Privacy and security architecture</h2>
              <p className="text-sm text-ink-muted">
                Technical specifications ensuring compliance, vector authentication privacy, and multi-tenant isolation.
              </p>
            </div>
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.5 }}
              className="grid grid-cols-1 md:grid-cols-3 gap-6"
            >
              <div className="bg-surface border border-line rounded-panel p-6 shadow-xs">
                <div className="w-8 h-8 rounded border border-line bg-surface-subtle flex items-center justify-center text-primary mb-4">
                  <Shield className="w-4 h-4" />
                </div>
                <h3 className="text-base font-semibold text-ink mb-2">Browser-based offline face attendance</h3>
                <p className="text-xs text-ink-muted leading-relaxed">
                  Biometric verification happens locally in browser memory. Face data is converted and stored solely as numeric feature vectors, never as raw photographs.
                </p>
              </div>

              <div className="bg-surface border border-line rounded-panel p-6 shadow-xs">
                <div className="w-8 h-8 rounded border border-line bg-surface-subtle flex items-center justify-center text-primary mb-4">
                  <Building className="w-4 h-4" />
                </div>
                <h3 className="text-base font-semibold text-ink mb-2">Multi-tenant data isolation</h3>
                <p className="text-xs text-ink-muted leading-relaxed">
                  Multi-tenant data isolation between institutions with tenant-scoped data isolation and subdomain authentication.
                </p>
              </div>

              <div className="bg-surface border border-line rounded-panel p-6 shadow-xs">
                <div className="w-8 h-8 rounded border border-line bg-surface-subtle flex items-center justify-center text-primary mb-4">
                  <Lock className="w-4 h-4" />
                </div>
                <h3 className="text-base font-semibold text-ink mb-2">Granular administrative control</h3>
                <p className="text-xs text-ink-muted leading-relaxed">
                  Custom roles with granular permissions per module ensure controlled data access across admin, teacher, student, and parent views.
                </p>
              </div>
            </motion.div>
          </div>
        </section>

        {/* 6. PLAN MATRIX AND FEATURE SPECIFICATIONS */}
        <section className="w-full border-b border-line bg-surface py-14" id="pricing">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.5 }}
              className="text-center max-w-3xl mx-auto mb-10"
            >
              <div className="font-mono text-xs uppercase tracking-wider text-primary font-semibold mb-2">
                Predictable Institutional Tiers
              </div>
              <h2 className="font-headline text-3xl font-bold text-ink tracking-tight mb-3">
                Deterministic module enablement across campus tiers
              </h2>
              <p className="text-sm text-ink-muted mb-6">
                Transparent scale limits and modular capability licensing. Choose a plan tailored to your institution.
              </p>

              {/* Monthly vs Annual Toggle */}
              <div className="inline-flex items-center gap-1 p-1 bg-surface-subtle border border-line rounded-lg shadow-xs">
                <button
                  type="button"
                  onClick={() => setBillingCycle('monthly')}
                  className={`px-3 py-1.5 text-xs font-medium rounded transition-all cursor-pointer ${
                    billingCycle === 'monthly'
                      ? 'bg-surface text-ink shadow-xs border border-line font-semibold'
                      : 'text-ink-muted hover:text-ink'
                  }`}
                >
                  Monthly billing
                </button>
                <button
                  type="button"
                  onClick={() => setBillingCycle('annual')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded transition-all cursor-pointer ${
                    billingCycle === 'annual'
                      ? 'bg-surface text-ink shadow-xs border border-line font-semibold'
                      : 'text-ink-muted hover:text-ink'
                  }`}
                >
                  <span>Annual billing</span>
                  <span className="px-1.5 py-0.2 bg-primary-soft text-primary font-mono text-[10px] font-bold rounded">
                    Save 20%
                  </span>
                </button>
              </div>
            </motion.div>

            {/* Pricing Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
              {plans.map((p, idx) => {
                const isPopular = p.popular || p.code === 'professional';
                const currentPrice = p.price ? p.price[billingCycle] : 0;

                return (
                  <motion.div
                    key={p.code || idx}
                    initial={{ opacity: 0, y: 24 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-40px" }}
                    transition={{ duration: 0.4, delay: idx * 0.1 }}
                    className={`bg-background rounded-panel p-6 flex flex-col justify-between border transition-all ${
                      isPopular
                        ? 'border-primary ring-2 ring-primary/20 shadow-md relative'
                        : 'border-line shadow-xs hover:border-line-strong'
                    }`}
                  >
                    <div>
                      {/* Top Badge */}
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <span className="font-mono text-[11px] uppercase tracking-wider text-ink-muted font-medium">
                          {p.badge || (p.code === 'enterprise' ? 'Enterprise' : 'Plan')}
                        </span>
                        {isPopular && (
                          <span className="px-2 py-0.5 rounded-full bg-primary text-white font-mono text-[10px] font-bold">
                            RECOMMENDED
                          </span>
                        )}
                      </div>

                      <h3 className="font-headline text-lg font-bold text-ink mb-1">{p.name}</h3>
                      <p className="text-xs text-ink-muted min-h-[36px] mb-4 leading-relaxed">
                        {p.tagline}
                      </p>

                      {/* Price Display */}
                      <div className="py-4 border-t border-b border-line mb-4">
                        <div className="flex items-baseline gap-1">
                          <span className="text-2xl sm:text-3xl font-extrabold text-ink font-mono tnum">
                            {currentPrice === 0 ? 'Free' : `₹${currentPrice.toLocaleString()}`}
                          </span>
                          {currentPrice > 0 && (
                            <span className="text-xs text-ink-muted font-normal">/ month</span>
                          )}
                        </div>
                        {currentPrice > 0 && billingCycle === 'annual' && (
                          <div className="text-[11px] text-primary font-mono font-medium mt-1">
                            Billed ₹{(currentPrice * 12).toLocaleString()}/year
                          </div>
                        )}
                        {currentPrice === 0 && (
                          <div className="text-[11px] text-ink-muted font-mono mt-1">
                            Zero credit card required
                          </div>
                        )}
                      </div>

                      {/* Quota Highlights */}
                      <div className="bg-surface border border-line rounded p-3 mb-4 space-y-1.5 text-xs font-mono">
                        <div className="flex justify-between">
                          <span className="text-ink-muted">Students:</span>
                          <span className="font-semibold text-ink tnum">
                            {p.limits?.maxStudents ? `${p.limits.maxStudents.toLocaleString()}` : 'Custom'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-ink-muted">Instructors:</span>
                          <span className="font-semibold text-ink tnum">
                            {p.limits?.maxTeachers ? `${p.limits.maxTeachers.toLocaleString()}` : 'Custom'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-ink-muted">Administrators:</span>
                          <span className="font-semibold text-ink tnum">
                            {p.limits?.maxAdmins ? `${p.limits.maxAdmins.toLocaleString()}` : 'Custom'}
                          </span>
                        </div>
                      </div>

                      {/* Included Feature Highlights */}
                      <div className="space-y-2 mb-6 text-xs text-ink">
                        {(p.highlights || []).map((h, i) => (
                          <div key={i} className="flex items-start gap-2">
                            <Check className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                            <span className="leading-snug">{h}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* CTA Button */}
                    <div className="pt-2">
                      {p.code === 'enterprise' ? (
                        <button
                          type="button"
                          onClick={() => scrollTo('contact', 'enterprise')}
                          className="w-full h-10 inline-flex items-center justify-center gap-1.5 px-4 rounded text-xs font-semibold bg-surface hover:bg-surface-subtle text-ink border border-line transition cursor-pointer"
                        >
                          <span>{p.cta || 'Request Enterprise Quote'}</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => navigate(`/register/tenant?plan=${p.code}`)}
                          className={`w-full h-10 inline-flex items-center justify-center gap-1.5 px-4 rounded text-xs font-semibold transition cursor-pointer ${
                            isPopular
                              ? 'bg-primary hover:bg-primary-hover text-on-primary shadow-xs'
                              : 'bg-surface hover:bg-surface-subtle text-ink border border-line'
                          }`}
                        >
                          <span>{p.cta || 'Start Trial'}</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {/* Expandable Module Comparison Matrix Toggle */}
            <div className="text-center mb-6">
              <button
                type="button"
                onClick={() => setShowFullMatrix(!showFullMatrix)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-surface border border-line hover:border-line-strong text-xs font-medium text-ink transition shadow-xs cursor-pointer"
              >
                <Layers className="w-3.5 h-3.5 text-primary" />
                <span>{showFullMatrix ? 'Collapse capability matrix' : 'Compare all 16+ module capabilities across tiers'}</span>
                {showFullMatrix ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            </div>

            {/* Collapsible Full Matrix Table */}
            <AnimatePresence>
              {showFullMatrix && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3 }}
                  className="overflow-hidden mb-8"
                >
                  <div className="border border-line rounded-panel overflow-x-auto bg-surface shadow-xs">
                    <table className="w-full text-left border-collapse min-w-[720px]">
                      <thead>
                        <tr className="bg-surface-subtle border-b border-line text-xs font-semibold text-ink">
                          <th className="py-3 px-4 w-2/6 uppercase tracking-wide">Capability / Module</th>
                          <th className="py-3 px-4 w-1/6 text-center">Free Trial</th>
                          <th className="py-3 px-4 w-1/6 text-center">Campus Starter</th>
                          <th className="py-3 px-4 w-1/6 text-center bg-primary-soft/40 border-l border-r border-line text-primary font-bold">
                            Professional
                          </th>
                          <th className="py-3 px-4 w-1/6 text-center">Enterprise ERP</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line text-xs font-mono">
                        {[
                          { name: 'Attendance Registry (Timetable Slot linked)', key: 'attendance' },
                          { name: 'Academic Structure & Course Schemas', key: 'academicStructure' },
                          { name: 'Announcements & Institutional Alerts', key: 'alerts' },
                          { name: 'Academic Calendar & Semester Terms', key: 'calendar' },
                          { name: 'Timetable Scheduling & Clash Prevention', key: 'timetable' },
                          { name: 'Exam Grid Scheduling & Hall Allocation', key: 'examManagement' },
                          { name: 'Automated Exam Seating Engine', key: 'examSeating' },
                          { name: 'Institutional Analytics & Custom Reports', key: 'analytics' },
                          { name: 'Fee Collection, Waivers & Receipt Ledger', key: 'financeManagement' },
                          { name: 'Parent & Student Dedicated Portals', key: 'parentPortal' },
                          { name: 'Custom Staff Roles & Module Permissions', key: 'customRoles' },
                          { name: 'Custom Subdomain & Per-Campus Theme/Branding', key: 'customBranding' },
                          { name: 'Offline Client-Side Biometric Face Auth', key: 'biometricAttendance' },
                          { name: 'Full White-Labeling & Domain Masking', key: 'whiteLabel' },
                          { name: 'Bulk Data Ingestion & Batch Operations', key: 'bulkOperations' },
                          { name: 'Priority Engineering Support & SLA', key: 'prioritySupport' },
                        ].map((row, rIdx) => (
                          <tr key={rIdx} className="hover:bg-surface-subtle transition-colors">
                            <td className="py-2.5 px-4 font-body font-medium text-ink">
                              {row.name}
                            </td>
                            {plans.map((p) => {
                              const hasModule = !!(p.modules && p.modules[row.key]);
                              const isPro = p.code === 'professional';

                              return (
                                <td
                                  key={p.code}
                                  className={`py-2.5 px-4 text-center ${
                                    isPro ? 'bg-primary-soft/20 border-l border-r border-line' : ''
                                  }`}
                                >
                                  {hasModule ? (
                                    <span className="inline-flex items-center gap-1 text-status-success-text font-semibold">
                                      <Check className="w-3.5 h-3.5" />
                                      <span>Included</span>
                                    </span>
                                  ) : (
                                    <span className="text-ink-muted">—</span>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-background border border-line rounded">
              <span className="text-xs text-ink-muted">
                Need customized compliance, SIS interoperability, or biometric hardware gateway integration?
              </span>
              <button
                type="button"
                onClick={() => scrollTo('contact', 'enterprise')}
                className="text-xs font-semibold text-primary hover:underline cursor-pointer"
              >
                Request Enterprise Campus Walkthrough &rarr;
              </button>
            </div>
          </div>
        </section>

        {/* 7. INBOUND PROSPECTIVE INQUIRY & CAMPUS CONSULTATION FORM */}
        <section className="w-full border-b border-line bg-background py-14" id="contact">
          <div className="max-w-4xl mx-auto px-4 sm:px-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="text-center max-w-2xl mx-auto mb-10"
            >
              <span className="text-[11px] font-mono uppercase tracking-wider text-primary font-semibold block mb-1">
                Registrar Consultation
              </span>
              <h2 className="font-headline text-2xl sm:text-3xl font-bold text-ink tracking-tight mb-2">
                Deploy AttendEase on Your Campus
              </h2>
              <p className="text-xs sm:text-sm text-ink-muted">
                Schedule a technical walkthrough or request institutional trial provisioning. Our engineering team responds within one business day.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.15 }}
              className="bg-surface border border-line rounded-panel p-6 sm:p-8 shadow-xs"
            >
              {leadSuccess ? (
                <div className="text-center py-8">
                  <div className="w-12 h-12 rounded-full bg-status-success-bg text-status-success-text border border-status-success-border flex items-center justify-center mx-auto mb-4">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-bold text-ink mb-1">Inquiry Submitted Successfully</h3>
                  <p className="text-xs text-ink-muted max-w-md mx-auto mb-6">
                    Thank you for reaching out. A campus onboarding specialist will review your institution’s requirements and contact you shortly.
                  </p>
                  <button
                    onClick={() => setLeadSuccess(false)}
                    className="h-9 px-4 bg-surface hover:bg-surface-subtle text-ink rounded border border-line text-xs font-medium"
                  >
                    Send Another Inquiry
                  </button>
                </div>
              ) : (
                <form onSubmit={handleLeadSubmit} className="space-y-4">
                  {leadError && (
                    <div className="p-3 bg-status-error-bg text-status-error-text border border-status-error-border rounded text-xs flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{leadError}</span>
                    </div>
                  )}

                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-ink mb-1">
                        Full Name <span className="text-rose-600">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={leadForm.name}
                        onChange={(e) => setLeadForm({ ...leadForm, name: e.target.value })}
                        placeholder="Dr. Eleanor Vance"
                        className="w-full h-9 px-3 bg-surface border border-line rounded text-xs text-ink placeholder:text-ink-muted/50 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-ink mb-1">
                        Campus Email <span className="text-rose-600">*</span>
                      </label>
                      <input
                        type="email"
                        required
                        value={leadForm.email}
                        onChange={(e) => setLeadForm({ ...leadForm, email: e.target.value })}
                        placeholder="registrar@oxford.edu"
                        className="w-full h-9 px-3 bg-surface border border-line rounded text-xs text-ink placeholder:text-ink-muted/50 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                      />
                    </div>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-ink mb-1">
                        Institution / University Name <span className="text-rose-600">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={leadForm.institutionName}
                        onChange={(e) => setLeadForm({ ...leadForm, institutionName: e.target.value })}
                        placeholder="Oxford Institute of Technology"
                        className="w-full h-9 px-3 bg-surface border border-line rounded text-xs text-ink placeholder:text-ink-muted/50 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-ink mb-1">
                        Contact Phone
                      </label>
                      <input
                        type="tel"
                        value={leadForm.phone}
                        onChange={(e) => setLeadForm({ ...leadForm, phone: e.target.value })}
                        placeholder="+1 (555) 234-5678"
                        className="w-full h-9 px-3 bg-surface border border-line rounded text-xs text-ink placeholder:text-ink-muted/50 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-ink mb-1">
                      Estimated Student Cohort Size
                    </label>
                    <select
                      value={leadForm.studentCount}
                      onChange={(e) => setLeadForm({ ...leadForm, studentCount: e.target.value })}
                      className="w-full h-9 px-3 bg-surface border border-line rounded text-xs text-ink focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                    >
                      <option value="Under 500">Under 500 students</option>
                      <option value="500 - 2000">500 - 2,000 students</option>
                      <option value="2000 - 10000">2,000 - 10,000 students</option>
                      <option value="10000+">10,000+ students (Enterprise)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-ink mb-1">
                      Notes &amp; Operational Priorities
                    </label>
                    <textarea
                      rows={3}
                      value={leadForm.notes}
                      onChange={(e) => setLeadForm({ ...leadForm, notes: e.target.value })}
                      placeholder="Outline any legacy SIS migration needs, custom fee schedules, or timetable clash challenges..."
                      className="w-full p-3 bg-surface border border-line rounded text-xs text-ink placeholder:text-ink-muted/50 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary resize-y"
                    ></textarea>
                  </div>

                  <div className="pt-2 flex items-center justify-between">
                    <span className="text-[11px] text-ink-muted">
                      Strictly confidential. No spam, ever.
                    </span>
                    <button
                      type="submit"
                      disabled={leadSubmitting}
                      className="h-9 px-5 bg-primary hover:bg-primary-hover text-on-primary rounded text-xs font-medium border border-primary transition-colors flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      {leadSubmitting ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Submitting...</span>
                        </>
                      ) : (
                        <>
                          <span>Submit Inquiry</span>
                          <Send className="w-3.5 h-3.5" />
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </motion.div>
          </div>
        </section>

        {/* 8. CLOSING CALL TO ACTION */}
        <section className="w-full bg-background py-16 border-b border-line">
          <motion.div
            initial={{ opacity: 0, scale: 0.98, y: 20 }}
            whileInView={{ opacity: 1, scale: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="max-w-4xl mx-auto px-4 sm:px-6 text-center"
          >
            <h2 className="font-headline text-2xl lg:text-3xl font-bold text-ink tracking-tight mb-4">
              Deploy AttendEase for your institution with dedicated tenant isolation and academic workflow management.
            </h2>
            <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
              <button
                onClick={() => navigate('/register/tenant')}
                className="h-10 inline-flex items-center justify-center px-6 bg-primary hover:bg-primary-hover text-on-primary text-xs font-medium rounded border border-primary transition-colors focus:outline-none focus:ring-2 focus:ring-primary shadow-xs"
              >
                Start Free Trial
              </button>
              <button
                onClick={openRoleModal}
                className="h-10 inline-flex items-center justify-center px-6 bg-surface hover:bg-surface-subtle text-ink text-xs font-medium rounded border border-line transition-colors focus:outline-none focus:ring-2 focus:ring-primary shadow-xs"
              >
                Explore Sandbox
              </button>
            </div>
          </motion.div>
        </section>
      </main>

      {/* SINGLE INSTITUTIONAL FOOTER */}
      <footer className="w-full bg-surface border-t border-line text-ink">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 pb-6 border-b border-line">
            <div>
              <span className="font-bold text-lg text-ink tracking-tight">
                Attend<span className="text-primary">Ease</span>
              </span>
              <span className="block mt-1 font-mono text-xs text-ink-muted">
                Multi-Tenant Academic ERP Infrastructure
              </span>
            </div>
            <nav className="flex flex-wrap items-center gap-6 text-xs text-ink-muted font-medium">
              <button onClick={() => scrollTo('features')} className="hover:text-ink transition-colors">
                Modules
              </button>
              <button onClick={() => scrollTo('how-it-works')} className="hover:text-ink transition-colors">
                How it works
              </button>
              <button onClick={() => scrollTo('portals')} className="hover:text-ink transition-colors">
                Portals
              </button>
              <button onClick={() => scrollTo('pricing')} className="hover:text-ink transition-colors">
                Plans
              </button>
              <button onClick={() => scrollTo('contact')} className="hover:text-ink transition-colors">
                Consultation
              </button>
              <button
                type="button"
                onClick={() => setIsCampusModalOpen(true)}
                className="hover:text-primary transition-colors flex items-center gap-1 font-medium"
              >
                <School className="w-3.5 h-3.5 text-primary" />
                <span>Campus Finder</span>
              </button>
              <button onClick={() => navigate('/login')} className="hover:text-ink transition-colors">
                Sign in
              </button>
            </nav>
          </div>
          <div className="pt-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-ink-muted">
            <p>&copy; {new Date().getFullYear()} AttendEase. All rights reserved.</p>
            <div className="font-mono text-xs">
              tenant-scoped data isolation &bull; WCAG AA compliant
            </div>
          </div>
        </div>
      </footer>

      {/* Interactive Role Sandbox Modal */}
      <RoleSelectorModal />

      {/* Campus Portal Finder & Institution Switcher Modal */}
      <CampusSwitcherModal
        isOpen={isCampusModalOpen}
        onClose={() => setIsCampusModalOpen(false)}
        onSelectTenant={(tenant) => {
          persistActiveTenant(tenant);
          setActiveTenantState(tenant);
          setShowCampusBanner(true);
          navigate(getTenantLoginUrl(tenant.subdomain));
        }}
      />
    </div>
  );
};

export default LandingPage;