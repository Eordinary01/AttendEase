// src/components/Landing/LandingPage.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { logError } from '../../utils/logger';
import Reveal from '../common/ui/Reveal';
import {
  GraduationCap,
  Users,
  BookOpen,
  BarChart3,
  Shield,
  Smartphone,
  CheckCircle,
  ChevronRight,
  ArrowRight,
  ArrowUp,
  Mail,
  Twitter,
  Linkedin,
  Facebook,
  Instagram,
  Menu,
  X,
  CreditCard,
  Sparkles,
  Zap,
  Database,
  Loader2,
  Building2,
  Check,
  Minus,
  Activity,
  Layers,
  Award
} from 'lucide-react';

gsap.registerPlugin(ScrollTrigger);

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8011';

const LandingPage = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [plans, setPlans] = useState([]);
  const [features, setFeatures] = useState(null);
  const [loading, setLoading] = useState(true);
  const [contactForm, setContactForm] = useState({
    name: '',
    email: '',
    phone: '',
    institutionName: '',
    message: ''
  });
  const [demoRequest, setDemoRequest] = useState({
    name: '',
    email: '',
    phone: '',
    institutionName: '',
    studentCount: ''
  });
  const [contactSubmitting, setContactSubmitting] = useState(false);
  const [demoSubmitting, setDemoSubmitting] = useState(false);
  const [contactSuccess, setContactSuccess] = useState(null);
  const [demoSuccess, setDemoSuccess] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [pricingRes, featuresRes] = await Promise.all([
        axios.get(`${API_URL}/landing/pricing`),
        axios.get(`${API_URL}/landing/features`)
      ]);
      setPlans(pricingRes.data.data || []);
      setFeatures(featuresRes.data.data);
    } catch (error) {
      logError("Fetch Landing Data", error);
    } finally {
      setLoading(false);
    }
  };

  const handleContactSubmit = async (e) => {
    e.preventDefault();
    setContactSubmitting(true);
    setContactSuccess(null);

    try {
      const response = await axios.post(`${API_URL}/landing/contact`, contactForm);
      if (response.data.success) {
        setContactSuccess('success');
        setContactForm({ name: '', email: '', phone: '', institutionName: '', message: '' });
        setTimeout(() => setContactSuccess(null), 5000);
      }
    } catch (error) {
      setContactSuccess('error');
      setTimeout(() => setContactSuccess(null), 5000);
    } finally {
      setContactSubmitting(false);
    }
  };

  const handleDemoRequest = async (e) => {
    e.preventDefault();
    setDemoSubmitting(true);
    setDemoSuccess(null);

    try {
      const response = await axios.post(`${API_URL}/landing/demo-request`, demoRequest);
      if (response.data.success) {
        setDemoSuccess('success');
        setDemoRequest({ name: '', email: '', phone: '', institutionName: '', studentCount: '' });
        setTimeout(() => setDemoSuccess(null), 5000);
      }
    } catch (error) {
      setDemoSuccess('error');
      setTimeout(() => setDemoSuccess(null), 5000);
    } finally {
      setDemoSubmitting(false);
    }
  };

  const scrollToSection = (sectionId) => {
    const section = document.getElementById(sectionId);
    if (section) {
      section.scrollIntoView({ behavior: 'smooth' });
    }
    setIsMenuOpen(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 gap-4">
        <div className="w-12 h-12 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin"></div>
        <p className="text-sm font-medium text-slate-500">Loading AttendEase Platform...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans selection:bg-purple-100 selection:text-purple-900">
      <Navbar isMenuOpen={isMenuOpen} setIsMenuOpen={setIsMenuOpen} scrollToSection={scrollToSection} />
      <HeroSection navigate={navigate} />
      <MarqueeSection />
      <FeaturesSection features={features} />
      <HowItWorksSection />
      <PricingSection plans={plans} navigate={navigate} />
      <ContactSection
        contactForm={contactForm}
        setContactForm={setContactForm}
        handleContactSubmit={handleContactSubmit}
        contactSubmitting={contactSubmitting}
        contactSuccess={contactSuccess}
        demoRequest={demoRequest}
        setDemoRequest={setDemoRequest}
        handleDemoRequest={handleDemoRequest}
        demoSubmitting={demoSubmitting}
        demoSuccess={demoSuccess}
      />
      <FAQSection />
      <CTASection navigate={navigate} />
      <Footer />
    </div>
  );
};

// ==========================================
// 1. REUSABLE SECTION HEADER COMPONENT
// ==========================================
const SectionHeader = ({
  badge,
  badgeIcon: BadgeIcon = Sparkles,
  title,
  highlight,
  description,
  align = "center",
  variant = "label"
}) => {
  const isCenter = align === "center";

  return (
    <Reveal className={`mb-16 ${isCenter ? 'text-center' : 'text-left'}`}>
      <div>
        {variant === "label" && badge && (
          <div className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-purple-50 text-purple-700 text-xs font-semibold uppercase tracking-wider mb-4 border border-purple-100/80 shadow-sm ${isCenter ? 'mx-auto' : ''}`}>
            <BadgeIcon className="w-3.5 h-3.5 text-purple-600" />
            <span>{badge}</span>
          </div>
        )}

        {variant === "subdued" && badge && (
          <div className="text-xs font-bold uppercase tracking-widest text-purple-600 mb-2">
            {badge}
          </div>
        )}

        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-900 tracking-tight leading-tight">
          {title}{' '}
          {highlight && (
            <span className="bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 bg-clip-text text-transparent">
              {highlight}
            </span>
          )}
        </h2>

        {description && (
          <p className={`mt-4 text-base sm:text-lg text-slate-600 leading-relaxed ${isCenter ? 'max-w-2xl mx-auto' : 'max-w-xl'}`}>
            {description}
          </p>
        )}
      </div>
    </Reveal>
  );
};

// ==========================================
// 2. NAVBAR COMPONENT
// ==========================================
const Navbar = ({ isMenuOpen, setIsMenuOpen, scrollToSection }) => {
  const [scrolled, setScrolled] = useState(false);
  const progressRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // GSAP scroll progress bar
  useEffect(() => {
    const bar = progressRef.current;
    if (!bar) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        bar,
        { width: "0%" },
        {
          width: "100%",
          ease: "none",
          scrollTrigger: {
            start: 0,
            end: "max",
            scrub: 0.3,
          },
        }
      );
    }, bar);
    return () => ctx.revert();
  }, []);

  const navLinks = [
    { name: 'Features', href: 'features' },
    { name: 'How It Works', href: 'how-it-works' },
    { name: 'Pricing', href: 'pricing' },
    { name: 'Contact', href: 'contact' },
    { name: 'FAQ', href: 'faq' },
  ];

  return (
    <motion.nav
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className={`fixed w-full z-50 transition-all duration-300 ${
        scrolled ? 'bg-white/90 backdrop-blur-md shadow-sm py-3.5 border-b border-slate-100' : 'bg-transparent py-5'
      }`}
    >
      {/* Scroll progress bar */}
      <div
        ref={progressRef}
        className="absolute top-0 left-0 h-1 bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-600 origin-left z-50"
        style={{ width: "0%" }}
      />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center">
          <div
            className="flex items-center gap-3 cursor-pointer group"
            onClick={() => scrollToSection('hero')}
          >
            <div className="w-10 h-10 bg-gradient-to-tr from-purple-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-md shadow-purple-500/20 group-hover:scale-105 transition-transform">
              <GraduationCap className="w-5 h-5 text-white" />
            </div>
            <div className="flex flex-col">
              <span className="text-xl font-bold bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent leading-none">
                AttendEase
              </span>
              <span className="text-[10px] font-semibold tracking-widest uppercase text-slate-400">
                Education ERP
              </span>
            </div>
          </div>

          <div className="hidden md:flex items-center space-x-7">
            {navLinks.map((link) => (
              <button
                key={link.name}
                onClick={() => scrollToSection(link.href)}
                className="text-slate-600 hover:text-purple-600 transition-colors font-medium text-sm hover:-translate-y-0.5 transform duration-150"
              >
                {link.name}
              </button>
            ))}
            <div className="flex items-center gap-3 pl-2">
              <button
                onClick={() => navigate('/login')}
                className="px-4 py-2 text-slate-700 hover:text-purple-600 rounded-xl hover:bg-slate-50 transition-all font-semibold text-sm"
              >
                Login
              </button>
              <button
                onClick={() => navigate('/register/tenant')}
                className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl hover:from-purple-700 hover:to-indigo-700 transition-all font-semibold text-sm shadow-md shadow-purple-500/20 hover:shadow-lg hover:shadow-purple-500/30 hover:-translate-y-0.5 active:translate-y-0"
              >
                Get Started
              </button>
            </div>
          </div>

          <button
            className="md:hidden p-2.5 rounded-xl hover:bg-slate-100 text-slate-600 transition-colors"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            aria-label="Toggle menu"
          >
            {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {isMenuOpen && (
        <div className="md:hidden bg-white/95 backdrop-blur-md border-b border-slate-100 shadow-xl animate-in slide-in-from-top-4 duration-200">
          <div className="px-5 py-5 space-y-3">
            {navLinks.map((link) => (
              <button
                key={link.name}
                onClick={() => scrollToSection(link.href)}
                className="block w-full text-left px-4 py-2.5 text-slate-700 font-medium hover:bg-purple-50 hover:text-purple-700 rounded-xl transition"
              >
                {link.name}
              </button>
            ))}
            <div className="pt-3 border-t border-slate-100 flex flex-col gap-2">
              <button
                onClick={() => navigate('/login')}
                className="w-full px-4 py-2.5 text-slate-700 border border-slate-200 rounded-xl hover:bg-slate-50 font-semibold transition text-center"
              >
                Login
              </button>
              <button
                onClick={() => navigate('/register/tenant')}
                className="w-full px-4 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl font-semibold shadow-md transition text-center"
              >
                Get Started Free
              </button>
            </div>
          </div>
        </div>
      )}
    </motion.nav>
  );
};

// ==========================================
// 3. HERO SECTION WITH REAL MINI-DASHBOARD & LIVE STATS
// ==========================================
const HeroSection = ({ navigate }) => {
  const heroRef = useRef(null);

  // Entrance + parallax
  useEffect(() => {
    const ctx = gsap.context(() => {
      // Entrance timeline for left column
      gsap.from(".hero-headline", {
        opacity: 0,
        y: 35,
        duration: 0.85,
        ease: "power3.out",
        stagger: 0.12,
        delay: 0.1,
      });
      // Mockup entrance
      gsap.from(".hero-mockup", {
        opacity: 0,
        y: 50,
        scale: 0.95,
        duration: 0.95,
        ease: "power3.out",
        delay: 0.25,
      });
      // Floating badges entrance
      gsap.from(".hero-float", {
        opacity: 0,
        scale: 0.8,
        duration: 0.6,
        ease: "back.out(1.7)",
        stagger: 0.15,
        delay: 0.6,
      });
      // Parallax on background blobs
      gsap.to(".hero-blob-1", {
        yPercent: 15,
        ease: "none",
        scrollTrigger: { trigger: heroRef.current, start: "top top", end: "bottom top", scrub: true },
      });
      gsap.to(".hero-blob-2", {
        yPercent: -15,
        ease: "none",
        scrollTrigger: { trigger: heroRef.current, start: "top top", end: "bottom top", scrub: true },
      });

      // Stats counter animation on scroll-in
      const statEls = document.querySelectorAll(".hero-stat-val");
      statEls.forEach((el) => {
        const target = parseInt(el.getAttribute("data-target"), 10);
        if (isNaN(target)) return;
        const rawSuffix = el.getAttribute("data-suffix") || "+";
        const obj = { val: 0 };
        gsap.to(obj, {
          val: target,
          duration: 1.4,
          ease: "power2.out",
          scrollTrigger: { trigger: el, start: "top 90%", once: true },
          onUpdate: () => {
            el.textContent = Math.floor(obj.val).toLocaleString() + rawSuffix;
          },
        });
      });
    }, heroRef.current);
    return () => ctx.revert();
  }, []);

  return (
    <section id="hero" ref={heroRef} className="relative pt-32 pb-20 px-4 sm:px-6 lg:px-8 overflow-hidden bg-white">
      {/* Soft Background Gradients */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
        <div className="hero-blob-1 absolute -top-[15%] -left-[10%] w-[55%] h-[55%] rounded-full bg-purple-100/40 blur-[130px]" />
        <div className="hero-blob-2 absolute top-[25%] -right-[10%] w-[45%] h-[55%] rounded-full bg-indigo-100/40 blur-[130px]" />
      </div>

      <div className="max-w-7xl mx-auto relative z-10">
        <div className="grid lg:grid-cols-12 gap-12 lg:gap-8 items-center">
          {/* Left Column */}
          <div className="lg:col-span-6 xl:col-span-6 text-left">
            <div className="hero-headline inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-purple-50 text-purple-700 text-xs sm:text-sm font-semibold mb-6 border border-purple-100 shadow-sm">
              <Sparkles className="w-4 h-4 text-purple-600" />
              <span>The Next-Gen Education ERP</span>
            </div>

            <h1 className="hero-headline text-4xl sm:text-5xl xl:text-6xl font-extrabold text-slate-900 mb-6 leading-[1.12] tracking-tight">
              Manage Your Institution with <br className="hidden sm:block" />
              <span className="bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 bg-clip-text text-transparent">
                Ease & Efficiency
              </span>
            </h1>

            <p className="hero-headline text-lg sm:text-xl text-slate-600 mb-8 max-w-lg leading-relaxed">
              A comprehensive cloud platform for modern educational institutions. Streamline multi-mode attendance, automated exams, dynamic fee management, and parent communication.
            </p>

            <div className="hero-headline flex flex-wrap gap-3.5">
              <button
                onClick={() => navigate('/register/tenant')}
                className="px-7 py-3.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl hover:from-purple-700 hover:to-indigo-700 transition-all shadow-lg shadow-purple-500/25 hover:shadow-xl hover:shadow-purple-500/35 hover:-translate-y-0.5 font-semibold flex items-center justify-center gap-2 group w-full sm:w-auto text-base"
              >
                Start Free Trial
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
              <button
                onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}
                className="px-6 py-3.5 bg-white text-slate-700 border border-slate-200 hover:border-slate-300 rounded-xl hover:bg-slate-50 transition-all font-semibold shadow-sm w-full sm:w-auto justify-center text-base"
              >
                Explore Features
              </button>
            </div>

            {/* Live Stats Row (Replaces 4 generic avatar circles) */}
            <div className="hero-headline grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6 mt-12 pt-8 border-t border-slate-100">
              <div>
                <div className="flex items-center gap-1.5 text-purple-600 mb-1">
                  <Building2 className="w-4 h-4" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Campuses</span>
                </div>
                <div className="hero-stat-val text-2xl font-extrabold text-slate-900" data-target="500" data-suffix="+">
                  500+
                </div>
                <p className="text-xs text-slate-500 mt-0.5">Institutions</p>
              </div>

              <div>
                <div className="flex items-center gap-1.5 text-indigo-600 mb-1">
                  <GraduationCap className="w-4 h-4" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Students</span>
                </div>
                <div className="hero-stat-val text-2xl font-extrabold text-slate-900" data-target="50000" data-suffix="+">
                  50,000+
                </div>
                <p className="text-xs text-slate-500 mt-0.5">Enrolled</p>
              </div>

              <div>
                <div className="flex items-center gap-1.5 text-emerald-600 mb-1">
                  <CheckCircle className="w-4 h-4" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Logs</span>
                </div>
                <div className="hero-stat-val text-2xl font-extrabold text-slate-900" data-target="10" data-suffix="M+">
                  10M+
                </div>
                <p className="text-xs text-slate-500 mt-0.5">Records</p>
              </div>

              <div>
                <div className="flex items-center gap-1.5 text-amber-600 mb-1">
                  <Users className="w-4 h-4" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Faculty</span>
                </div>
                <div className="hero-stat-val text-2xl font-extrabold text-slate-900" data-target="4000" data-suffix="+">
                  4,000+
                </div>
                <p className="text-xs text-slate-500 mt-0.5">Teachers</p>
              </div>
            </div>
          </div>

          {/* Right Column: High Fidelity Mini-Dashboard Preview */}
          <div className="lg:col-span-6 xl:col-span-6 hero-mockup relative flex items-center justify-center">
            <div className="relative w-full bg-slate-900/90 rounded-2xl p-2.5 shadow-2xl border border-slate-800/80 backdrop-blur-xl">
              {/* Window Header */}
              <div className="bg-slate-800/90 rounded-xl px-4 py-3 border-b border-slate-700/60 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-rose-500/80"></div>
                  <div className="w-3 h-3 rounded-full bg-amber-500/80"></div>
                  <div className="w-3 h-3 rounded-full bg-emerald-500/80"></div>
                  <span className="ml-2 text-xs font-semibold text-slate-400 flex items-center gap-1.5">
                    <GraduationCap className="w-3.5 h-3.5 text-purple-400" />
                    AttendEase ERP · St. Xavier's Campus
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-semibold border border-emerald-500/20">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    Live Sync
                  </span>
                </div>
              </div>

              {/* Dashboard Content Canvas */}
              <div className="bg-slate-950/95 rounded-xl p-5 border border-slate-800/60 mt-2 space-y-4">
                {/* KPI Metrics Row */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-slate-900/80 rounded-lg p-3 border border-slate-800">
                    <p className="text-[11px] font-medium text-slate-400">Today's Attendance</p>
                    <p className="text-xl font-bold text-white mt-1">96.4%</p>
                    <span className="text-[10px] text-emerald-400 font-medium">↑ +2.1% vs avg</span>
                  </div>
                  <div className="bg-slate-900/80 rounded-lg p-3 border border-slate-800">
                    <p className="text-[11px] font-medium text-slate-400">Active Sections</p>
                    <p className="text-xl font-bold text-purple-300 mt-1">48 / 50</p>
                    <span className="text-[10px] text-slate-400 font-medium">Semester 6</span>
                  </div>
                  <div className="bg-slate-900/80 rounded-lg p-3 border border-slate-800">
                    <p className="text-[11px] font-medium text-slate-400">Fee Inflow</p>
                    <p className="text-xl font-bold text-indigo-300 mt-1">₹4.8M</p>
                    <span className="text-[10px] text-indigo-400 font-medium">92% Collected</span>
                  </div>
                </div>

                {/* Live Class Attendance Stream */}
                <div className="bg-slate-900/60 rounded-xl p-4 border border-slate-800">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Activity className="w-4 h-4 text-purple-400" />
                      <span className="text-xs font-bold text-slate-200">Active Class Rosters</span>
                    </div>
                    <span className="text-[10px] text-slate-400">Period 3 (10:00 - 11:00 AM)</span>
                  </div>

                  <div className="space-y-2.5">
                    {[
                      { code: "CS-301", title: "Data Structures & Algos", present: "58/60", rate: "96.7%", badge: "Completed", color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" },
                      { code: "MATH-202", title: "Discrete Mathematics", present: "54/55", rate: "98.2%", badge: "Completed", color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" },
                      { code: "PHYS-101", title: "Quantum Physics Lab", present: "42/48", rate: "87.5%", badge: "In Progress", color: "text-amber-400 bg-amber-500/10 border-amber-500/20" },
                    ].map((row, idx) => (
                      <div key={idx} className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950/70 border border-slate-800/80 text-xs">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-md bg-purple-500/10 border border-purple-500/20 flex items-center justify-center font-bold text-[10px] text-purple-300">
                            {row.code.split('-')[0]}
                          </div>
                          <div>
                            <p className="font-semibold text-slate-200">{row.title}</p>
                            <p className="text-[10px] text-slate-400">{row.code} · Present: {row.present}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-mono font-bold text-slate-200">{row.rate}</span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-medium border ${row.color}`}>
                            {row.badge}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Mini Action Footer */}
                <div className="flex items-center justify-between pt-1">
                  <span className="text-[11px] text-slate-400 flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5 text-indigo-400" />
                    Automated biometric & QR verification active
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-medium text-purple-400 hover:text-purple-300 transition-colors">
                      View Full Terminal →
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Floating Live Badges */}
            <motion.div
              animate={{ y: [0, -8, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              className="hero-float absolute -bottom-5 left-0 sm:-left-6 bg-white rounded-xl shadow-xl border border-slate-100 p-3 sm:p-4 flex items-center gap-3.5 z-20"
            >
              <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center text-emerald-600">
                <CheckCircle className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Attendance Rate</p>
                <p className="text-base font-extrabold text-slate-900">99.4% Verified</p>
              </div>
            </motion.div>

            <motion.div
              animate={{ y: [0, 8, 0] }}
              transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
              className="hero-float absolute -top-5 right-0 sm:-right-6 bg-white rounded-xl shadow-xl border border-slate-100 p-3 sm:p-4 flex items-center gap-3.5 z-20"
            >
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center text-purple-600">
                <BarChart3 className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Exam Automation</p>
                <p className="text-base font-extrabold text-slate-900">Instant SGPA / Seating</p>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
};

// ==========================================
// 4. SOCIAL PROOF MARQUEE SECTION
// ==========================================
const MarqueeSection = () => {
  const institutions = [
    { name: "Apex University of Technology", location: "Bangalore", students: "12,000+ Students" },
    { name: "St. Xavier's College of Arts & Science", location: "Mumbai", students: "6,500+ Students" },
    { name: "Horizon International Institute", location: "Delhi NCR", students: "8,200+ Students" },
    { name: "Oakridge Global Academy", location: "Hyderabad", students: "4,400+ Students" },
    { name: "Cambridge Valley Campus", location: "Pune", students: "9,100+ Students" },
    { name: "Trinity Engineering Institute", location: "Chennai", students: "7,800+ Students" },
    { name: "Stanford Modern Academy", location: "Chandigarh", students: "5,300+ Students" },
  ];

  return (
    <section className="py-8 bg-slate-50/80 border-y border-slate-100 overflow-hidden relative">
      <style>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .marquee-track {
          display: flex;
          width: max-content;
          animation: marquee 35s linear infinite;
        }
        .marquee-track:hover {
          animation-play-state: paused;
        }
      `}</style>

      <div className="max-w-7xl mx-auto px-4 mb-4 text-center">
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
          Trusted by Premier Educational Institutions Nationwide
        </p>
      </div>

      <div className="overflow-hidden w-full relative">
        <div className="marquee-track flex items-center gap-6">
          {[...institutions, ...institutions].map((item, idx) => (
            <div
              key={idx}
              className="inline-flex items-center gap-3 px-5 py-2.5 rounded-xl bg-white border border-slate-200/70 shadow-sm text-sm text-slate-700 whitespace-nowrap hover:border-purple-200 transition-colors"
            >
              <div className="w-7 h-7 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
                <Building2 className="w-4 h-4" />
              </div>
              <div className="text-left">
                <span className="font-bold text-slate-900">{item.name}</span>
                <span className="text-xs text-slate-400 ml-2">· {item.students}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

// ==========================================
// 5. FEATURES SECTION (SPOTLIGHT + CATEGORIZED GRID)
// ==========================================
const FeaturesSection = ({ features }) => {
  const defaultFeatures = [
    { name: "Multi-Mode Attendance", description: "Subject-wise marking with biometric integration, QR scanning, and automated parent SMS notifications.", category: "Core", icon: <Users className="w-6 h-6" /> },
    { name: "Academic Planning & Timetable", description: "Automated schedule generators, faculty subject assignment, and multi-semester course structuring.", category: "Academic", icon: <BookOpen className="w-6 h-6" /> },
    { name: "Dynamic Fee Ledger & Invoicing", description: "Automated invoice generation, payment receipts, installment tracking, and bank reconciliations.", category: "Finance", icon: <CreditCard className="w-6 h-6" /> },
    { name: "Exam Seating & Results Engine", description: "Automated hall ticket generation, anti-cheating roll allocation, and instant SGPA/CGPA grade calculation.", category: "Exams", icon: <Award className="w-6 h-6" /> },
    { name: "Role-Based Security & Permissions", description: "Multi-tenant isolation with granular permissions for SuperAdmins, Principals, Faculty, and Parents.", category: "Security", icon: <Shield className="w-6 h-6" /> },
    { name: "Parent & Student Mobile Portal", description: "Real-time access to daily attendance, fee dues, academic hall tickets, and leave request tickets.", category: "Portal", icon: <Smartphone className="w-6 h-6" /> }
  ];

  const allFeatures = features && typeof features === 'object' ? [
    ...(features.core || []).map(f => ({ ...f, category: 'Core' })),
    ...(features.academic || []).map(f => ({ ...f, category: 'Academic' })),
    ...(features.finance || []).map(f => ({ ...f, category: 'Finance' })),
    ...(features.communication || []).map(f => ({ ...f, category: 'Communication' })),
    ...(features.analytics || []).map(f => ({ ...f, category: 'Analytics' }))
  ] : defaultFeatures;

  const displayFeatures = (allFeatures && allFeatures.length >= 6 ? allFeatures : defaultFeatures).slice(0, 6);

  const getCategoryIcon = (index) => {
    const icons = [
      <Users className="w-6 h-6" />,
      <BookOpen className="w-6 h-6" />,
      <CreditCard className="w-6 h-6" />,
      <Award className="w-6 h-6" />,
      <Shield className="w-6 h-6" />,
      <Smartphone className="w-6 h-6" />
    ];
    return icons[index % icons.length];
  };

  return (
    <section id="features" className="py-24 px-4 sm:px-6 lg:px-8 bg-white border-t border-slate-100">
      <div className="max-w-7xl mx-auto">
        <SectionHeader
          badge="Platform Capabilities"
          badgeIcon={Layers}
          title="Engineered for"
          highlight="Complete Institutional Control"
          description="A cohesive operating system built to automate administration, empower teachers, and keep parents informed."
        />

        {/* Feature Spotlight Banner */}
        <div className="mb-12 bg-gradient-to-br from-slate-900 to-indigo-950 rounded-3xl p-8 sm:p-12 text-white shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none"></div>
          <div className="grid lg:grid-cols-12 gap-8 items-center relative z-10">
            <div className="lg:col-span-7">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/20 text-purple-300 text-xs font-bold uppercase tracking-wider mb-4 border border-purple-500/30">
                <Sparkles className="w-3.5 h-3.5" /> Flagship Module
              </div>
              <h3 className="text-2xl sm:text-3xl font-extrabold text-white mb-4">
                Smart Attendance with Real-Time Parent Alerts
              </h3>
              <p className="text-slate-300 text-base leading-relaxed mb-6 max-w-xl">
                Eliminate paper registers and manual tallying. Faculty mark subject attendance in under 30 seconds with automatic instant triggers to parents for absenteeism.
              </p>
              <div className="grid sm:grid-cols-3 gap-4 pt-2">
                <div className="bg-white/5 rounded-xl p-3 border border-white/10">
                  <p className="text-xs text-purple-200">Processing Speed</p>
                  <p className="text-xl font-bold text-white mt-1">&lt; 30 sec</p>
                </div>
                <div className="bg-white/5 rounded-xl p-3 border border-white/10">
                  <p className="text-xs text-purple-200">Alert Latency</p>
                  <p className="text-xl font-bold text-white mt-1">Instant SMS</p>
                </div>
                <div className="bg-white/5 rounded-xl p-3 border border-white/10">
                  <p className="text-xs text-purple-200">Accuracy Record</p>
                  <p className="text-xl font-bold text-white mt-1">100% Audit</p>
                </div>
              </div>
            </div>

            <div className="lg:col-span-5 bg-slate-900/80 rounded-2xl p-5 border border-slate-700/60 shadow-inner">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800 text-xs">
                <span className="font-bold text-slate-200">CS-301 Attendance Session</span>
                <span className="text-emerald-400 font-medium">98% Verified</span>
              </div>
              <div className="space-y-2 mt-3 text-xs">
                <div className="flex items-center justify-between p-2 rounded-lg bg-slate-800/60">
                  <span className="text-slate-300">Rahul Sharma (CS-01)</span>
                  <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">Present</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-slate-800/60">
                  <span className="text-slate-300">Ananya Verma (CS-02)</span>
                  <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">Present</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-slate-800/60">
                  <span className="text-slate-300">Dev Patel (CS-03)</span>
                  <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 text-[10px] font-bold">SMS Sent</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Feature Cards Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {displayFeatures.map((feature, index) => (
            <div
              key={index}
              className="bg-slate-50/60 rounded-2xl p-8 border border-slate-200/80 hover:bg-white hover:border-purple-200 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group"
            >
              <div className="flex items-center justify-between mb-6">
                <motion.div
                  initial={{ scale: 0.6, opacity: 0 }}
                  whileInView={{ scale: 1, opacity: 1 }}
                  viewport={{ once: true, margin: "-50px" }}
                  transition={{ duration: 0.4, delay: index * 0.05 }}
                  className="w-12 h-12 bg-white rounded-xl shadow-sm border border-slate-100 flex items-center justify-center text-purple-600 group-hover:bg-purple-600 group-hover:text-white transition-colors duration-300"
                >
                  {getCategoryIcon(index)}
                </motion.div>
                <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md bg-purple-50 text-purple-700 border border-purple-100/60">
                  {feature.category || "Module"}
                </span>
              </div>

              <h3 className="text-xl font-bold text-slate-900 mb-3 group-hover:text-purple-600 transition-colors">
                {feature.name || feature.title}
              </h3>
              <p className="text-slate-600 text-sm leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

// ==========================================
// 6. HOW IT WORKS SECTION (SCROLLY NARRATIVE)
// ==========================================
const HowItWorksSection = () => {
  const howItWorksRef = useRef(null);
  const lineRef = useRef(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      if (lineRef.current && howItWorksRef.current) {
        gsap.fromTo(
          lineRef.current,
          { scaleX: 0 },
          {
            scaleX: 1,
            transformOrigin: "left center",
            ease: "none",
            scrollTrigger: {
              trigger: howItWorksRef.current,
              start: "top 70%",
              end: "bottom 30%",
              scrub: 0.5,
            },
          }
        );
      }
    }, howItWorksRef.current);

    return () => ctx.revert();
  }, []);

  const steps = [
    {
      step: "01",
      title: "Create Your Campus Space",
      description: "Sign up your institution in 60 seconds. Configure departments, academic years, semesters, and custom course structures.",
      icon: <Building2 className="w-6 h-6" />,
      detail: "Fast tenant provisioning with isolated database schema."
    },
    {
      step: "02",
      title: "Bulk Upload & Configure",
      description: "Seamlessly import teachers, students, subjects, and timetable schedules via CSV/Excel or automated sync engines.",
      icon: <Database className="w-6 h-6" />,
      detail: "Automatic validation with duplicate conflict protection."
    },
    {
      step: "03",
      title: "Automate & Monitor",
      description: "Faculty start marking attendance instantly. Track fee collections, schedule exams, and view live institutional KPIs.",
      icon: <Zap className="w-6 h-6" />,
      detail: "Real-time analytics and automated alerts on any device."
    }
  ];

  return (
    <section id="how-it-works" ref={howItWorksRef} className="py-24 px-4 sm:px-6 lg:px-8 bg-slate-50/60 relative overflow-hidden border-t border-slate-100">
      <div className="max-w-7xl mx-auto relative z-10">
        <SectionHeader
          badge="Seamless Onboarding"
          badgeIcon={Zap}
          title="Up and Running in"
          highlight="3 Simple Steps"
          description="We've made transitioning from legacy spreadsheets or old ERP systems effortless and fast."
        />

        <div className="relative mt-16">
          {/* Animated Connecting Line (Desktop) */}
          <div className="hidden md:block absolute top-28 left-[12%] right-[12%] h-1 bg-slate-200 rounded-full z-0 overflow-hidden">
            <div
              ref={lineRef}
              className="h-full bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-600 origin-left"
              style={{ transform: "scaleX(0)" }}
            />
          </div>

          <div className="grid md:grid-cols-3 gap-8 relative z-10">
            {steps.map((item, index) => (
              <div key={index} className="relative group">
                <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-200/80 hover:shadow-xl hover:border-purple-200 transition-all duration-300 flex flex-col h-full">
                  {/* Step Badge */}
                  <div className="flex items-center justify-between mb-6">
                    <motion.div
                      whileHover={{ scale: 1.08, rotate: 3 }}
                      className="w-14 h-14 bg-gradient-to-br from-purple-50 to-indigo-50 rounded-2xl flex items-center justify-center text-purple-600 shadow-sm border border-purple-100 group-hover:from-purple-600 group-hover:to-indigo-600 group-hover:text-white transition-all duration-300"
                    >
                      {item.icon}
                    </motion.div>
                    <span className="text-3xl font-black text-slate-200 group-hover:text-purple-600 transition-colors">
                      {item.step}
                    </span>
                  </div>

                  <h3 className="text-xl font-bold text-slate-900 mb-3">{item.title}</h3>
                  <p className="text-slate-600 text-sm leading-relaxed mb-6 flex-1">
                    {item.description}
                  </p>

                  <div className="pt-4 border-t border-slate-100 text-xs font-semibold text-purple-600 flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5" />
                    <span>{item.detail}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

// ==========================================
// 7. PRICING SECTION (COMPARISON TABLE + FEATURED CARD)
// ==========================================
const formatPrice = (amount, currency = 'INR') => {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency, minimumFractionDigits: 0 }).format(amount || 0);
};

const PricingSection = ({ plans, navigate }) => {
  const [billingCycle, setBillingCycle] = useState('monthly');

  const defaultPlans = [
    {
      code: "FREE",
      name: "Starter",
      description: "Ideal for small institutes and pilot trial batches.",
      pricing: { monthly: 0, yearly: 0, currency: "INR" },
      isPopular: false,
      features: [
        { name: "Up to 150 Students" },
        { name: "Core Attendance Marking" },
        { name: "Timetable Management" },
        { name: "Standard Email Support" }
      ]
    },
    {
      code: "PRO",
      name: "Professional",
      description: "Complete ERP automation for modern colleges and high schools.",
      pricing: { monthly: 4999, yearly: 47990, currency: "INR" },
      isPopular: true,
      features: [
        { name: "Up to 2,000 Students" },
        { name: "Biometric & QR Attendance" },
        { name: "Fee Management & Invoicing" },
        { name: "Exam Seating & Hall Tickets" },
        { name: "Parent & Student Mobile Portal" },
        { name: "Priority Support & Training" }
      ]
    },
    {
      code: "ENTERPRISE",
      name: "Enterprise",
      description: "Custom scalability for multi-branch universities & trusts.",
      pricing: { monthly: 14999, yearly: 143990, currency: "INR" },
      isPopular: false,
      features: [
        { name: "Unlimited Students" },
        { name: "Multi-Campus Administration" },
        { name: "Custom API & SIS Integrations" },
        { name: "Dedicated Account Manager" },
        { name: "SLA Guarantees (99.9%)" },
        { name: "On-Premise / Custom Cloud" }
      ]
    }
  ];

  const activePlans = plans && plans.length > 0 ? plans : defaultPlans;

  const comparisonRows = [
    { title: "Student Capacity", free: "150 Students", pro: "2,000 Students", enterprise: "Unlimited" },
    { title: "Multi-Mode Attendance (QR/Biometric)", free: false, pro: true, enterprise: true },
    { title: "Parent SMS & Email Notifications", free: false, pro: true, enterprise: true },
    { title: "Academic Structure & Timetables", free: true, pro: true, enterprise: true },
    { title: "Fee Ledger, Invoicing & Receipts", free: false, pro: true, enterprise: true },
    { title: "Exam Seating Engine & SGPA Calculation", free: false, pro: true, enterprise: true },
    { title: "Multi-Campus SuperAdmin Support", free: false, pro: false, enterprise: true },
    { title: "Support Response SLA", free: "48h Standard", pro: "4h Priority", enterprise: "Dedicated Manager" }
  ];

  return (
    <section id="pricing" className="py-24 px-4 sm:px-6 lg:px-8 bg-white border-t border-slate-100">
      <div className="max-w-7xl mx-auto">
        <SectionHeader
          badge="Transparent Pricing"
          badgeIcon={CreditCard}
          title="Simple, Scalable Plans with"
          highlight="Zero Hidden Fees"
          description="Start with our 14-day full feature trial. Upgrade or downgrade anytime."
        />

        {/* Monthly / Yearly Toggle */}
        <div className="flex justify-center mb-16">
          <div className="inline-flex items-center bg-slate-100 rounded-full p-1.5 relative border border-slate-200/80 shadow-inner">
            <button
              onClick={() => setBillingCycle('monthly')}
              className={`relative z-10 px-6 sm:px-8 py-2.5 rounded-full font-semibold text-sm transition-colors duration-200 ${
                billingCycle === 'monthly' ? 'text-slate-900' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Monthly Billing
            </button>
            <button
              onClick={() => setBillingCycle('yearly')}
              className={`relative z-10 px-6 sm:px-8 py-2.5 rounded-full font-semibold text-sm transition-colors duration-200 flex items-center gap-2 ${
                billingCycle === 'yearly' ? 'text-slate-900' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Yearly Billing
              <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold">
                Save 20%
              </span>
            </button>
            <motion.div
              className="absolute top-1.5 bottom-1.5 bg-white rounded-full shadow-sm"
              initial={false}
              animate={{
                left: billingCycle === 'monthly' ? '6px' : 'calc(50% + 2px)',
                width: 'calc(50% - 8px)'
              }}
              transition={{ type: "spring", stiffness: 350, damping: 30 }}
            />
          </div>
        </div>

        {/* Pricing Cards Grid */}
        <div className="grid lg:grid-cols-3 gap-8 max-w-6xl mx-auto mb-20 items-stretch">
          {activePlans.map((plan) => {
            const price = billingCycle === 'monthly'
              ? (plan.pricing?.monthly ?? 0)
              : (plan.pricing?.yearly ?? 0);

            return (
              <div
                key={plan.code}
                className={`relative bg-white rounded-3xl p-8 flex flex-col transition-all duration-300 ${
                  plan.isPopular
                    ? 'border-2 border-purple-600 shadow-2xl scale-[1.03] z-10'
                    : 'border border-slate-200/90 shadow-sm hover:shadow-lg'
                }`}
              >
                {plan.isPopular && (
                  <div className="absolute -top-4 left-0 right-0 flex justify-center">
                    <span className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-xs font-extrabold px-4 py-1.5 rounded-full uppercase tracking-wider shadow-md">
                      Most Popular Choice
                    </span>
                  </div>
                )}

                <div className="mb-6">
                  <h3 className="text-2xl font-bold text-slate-900">{plan.name}</h3>
                  <p className="text-slate-500 text-sm mt-2 min-h-[40px]">{plan.description}</p>
                </div>

                <div className="mb-8">
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl sm:text-5xl font-extrabold text-slate-900 tracking-tight">
                      {formatPrice(price, plan.pricing?.currency || 'INR')}
                    </span>
                    <span className="text-slate-500 text-sm font-medium">
                      /{billingCycle === 'monthly' ? 'month' : 'year'}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => navigate('/register/tenant')}
                  className={`w-full py-3.5 rounded-xl font-bold text-sm transition-all mb-8 shadow-sm ${
                    plan.isPopular
                      ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:from-purple-700 hover:to-indigo-700 shadow-purple-500/25 hover:shadow-md hover:-translate-y-0.5'
                      : 'bg-slate-50 text-slate-800 border border-slate-200 hover:bg-slate-100 hover:text-purple-600'
                  }`}
                >
                  Start 14-Day Free Trial
                </button>

                <div className="space-y-3.5 flex-1">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">What's Included</p>
                  {plan.features?.map((feature, idx) => (
                    <div key={idx} className="flex items-start gap-3 text-sm text-slate-600">
                      <CheckCircle className="w-4 h-4 text-purple-600 flex-shrink-0 mt-0.5" />
                      <span>{feature.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Detailed Feature Comparison Table */}
        <div className="max-w-5xl mx-auto bg-slate-50/70 rounded-3xl p-6 sm:p-10 border border-slate-200">
          <h3 className="text-xl font-bold text-slate-900 mb-6 text-center">
            Detailed Capability Matrix
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="pb-4 font-bold text-slate-900 w-1/2">Key Feature</th>
                  <th className="pb-4 font-bold text-slate-700 text-center">Starter</th>
                  <th className="pb-4 font-bold text-purple-700 text-center bg-purple-50/50 rounded-t-xl">Professional</th>
                  <th className="pb-4 font-bold text-slate-700 text-center">Enterprise</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/80">
                {comparisonRows.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-100/50 transition-colors">
                    <td className="py-3.5 font-medium text-slate-700">{row.title}</td>
                    <td className="py-3.5 text-center text-slate-600">
                      {typeof row.free === "boolean" ? (
                        row.free ? <Check className="w-4 h-4 text-emerald-600 mx-auto" /> : <Minus className="w-4 h-4 text-slate-300 mx-auto" />
                      ) : (
                        <span className="text-xs font-semibold">{row.free}</span>
                      )}
                    </td>
                    <td className="py-3.5 text-center font-bold text-purple-900 bg-purple-50/50">
                      {typeof row.pro === "boolean" ? (
                        row.pro ? <Check className="w-4 h-4 text-purple-600 mx-auto" /> : <Minus className="w-4 h-4 text-slate-300 mx-auto" />
                      ) : (
                        <span className="text-xs font-bold text-purple-700">{row.pro}</span>
                      )}
                    </td>
                    <td className="py-3.5 text-center text-slate-600">
                      {typeof row.enterprise === "boolean" ? (
                        row.enterprise ? <Check className="w-4 h-4 text-emerald-600 mx-auto" /> : <Minus className="w-4 h-4 text-slate-300 mx-auto" />
                      ) : (
                        <span className="text-xs font-semibold">{row.enterprise}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
};

// ==========================================
// 8. CONTACT & DEMO SECTION
// ==========================================
const ContactSection = ({
  contactForm,
  setContactForm,
  handleContactSubmit,
  contactSubmitting,
  contactSuccess,
  demoRequest,
  setDemoRequest,
  handleDemoRequest,
  demoSubmitting,
  demoSuccess
}) => {
  return (
    <section id="contact" className="py-24 px-4 sm:px-6 lg:px-8 bg-slate-50/60 border-t border-slate-100">
      <div className="max-w-7xl mx-auto">
        <SectionHeader
          badge="Get in Touch"
          badgeIcon={Mail}
          title="Let's Discuss Your"
          highlight="Institution's Needs"
          description="Have questions or need a tailored rollout plan? Our campus success advisors are ready to help."
        />

        <div className="grid lg:grid-cols-12 gap-8 items-start max-w-6xl mx-auto">
          {/* Contact Inquiries Form */}
          <div className="lg:col-span-6 bg-white rounded-3xl p-8 shadow-sm border border-slate-200/90">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                <Mail className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-900">Direct Inquiries</h3>
                <p className="text-xs text-slate-500">Expect a response within 4 hours</p>
              </div>
            </div>

            <form onSubmit={handleContactSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Full Name <span className="text-purple-600">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Dr. Rajesh Khanna"
                  value={contactForm.name}
                  onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:bg-white text-sm outline-none transition"
                  required
                />
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Email Address <span className="text-purple-600">*</span>
                  </label>
                  <input
                    type="email"
                    placeholder="name@institution.edu"
                    value={contactForm.email}
                    onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:bg-white text-sm outline-none transition"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    placeholder="+91 98765 43210"
                    value={contactForm.phone}
                    onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:bg-white text-sm outline-none transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Institution Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Apex Institute of Technology"
                  value={contactForm.institutionName}
                  onChange={(e) => setContactForm({ ...contactForm, institutionName: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:bg-white text-sm outline-none transition"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Message <span className="text-purple-600">*</span>
                </label>
                <textarea
                  placeholder="Tell us about your campus requirements..."
                  rows="3"
                  value={contactForm.message}
                  onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:bg-white text-sm outline-none transition"
                  required
                ></textarea>
              </div>

              {contactSuccess === 'success' && (
                <div className="p-3 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-semibold flex items-center gap-2">
                  <CheckCircle className="w-4 h-4" />
                  Thank you! Your message has been sent successfully.
                </div>
              )}
              {contactSuccess === 'error' && (
                <div className="p-3 bg-rose-50 text-rose-700 border border-rose-200 rounded-xl text-xs font-semibold">
                  Something went wrong. Please try again.
                </div>
              )}

              <button
                type="submit"
                disabled={contactSubmitting}
                className="w-full py-3.5 bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition font-semibold text-sm shadow-md disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {contactSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Submit Inquiry'}
              </button>
            </form>
          </div>

          {/* Interactive Demo Request Form */}
          <div className="lg:col-span-6 bg-gradient-to-br from-purple-700 via-indigo-700 to-purple-800 rounded-3xl p-8 text-white shadow-xl">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-white/10 text-white flex items-center justify-center border border-white/20">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-xl font-bold">Request a Live Demo</h3>
                <p className="text-xs text-purple-200">1-on-1 walkthrough with an ERP Specialist</p>
              </div>
            </div>

            <form onSubmit={handleDemoRequest} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-purple-200 uppercase tracking-wider mb-1.5">
                  Your Name <span className="text-white">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Prof. Sunita Sharma"
                  value={demoRequest.name}
                  onChange={(e) => setDemoRequest({ ...demoRequest, name: e.target.value })}
                  className="w-full px-4 py-3 bg-white/10 border border-purple-400/40 rounded-xl focus:ring-2 focus:ring-white text-white placeholder-purple-300 text-sm outline-none transition"
                  required
                />
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-purple-200 uppercase tracking-wider mb-1.5">
                    Official Email <span className="text-white">*</span>
                  </label>
                  <input
                    type="email"
                    placeholder="sunita@university.edu"
                    value={demoRequest.email}
                    onChange={(e) => setDemoRequest({ ...demoRequest, email: e.target.value })}
                    className="w-full px-4 py-3 bg-white/10 border border-purple-400/40 rounded-xl focus:ring-2 focus:ring-white text-white placeholder-purple-300 text-sm outline-none transition"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-purple-200 uppercase tracking-wider mb-1.5">
                    Contact Number
                  </label>
                  <input
                    type="tel"
                    placeholder="+91 98111 22233"
                    value={demoRequest.phone}
                    onChange={(e) => setDemoRequest({ ...demoRequest, phone: e.target.value })}
                    className="w-full px-4 py-3 bg-white/10 border border-purple-400/40 rounded-xl focus:ring-2 focus:ring-white text-white placeholder-purple-300 text-sm outline-none transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-purple-200 uppercase tracking-wider mb-1.5">
                  Institution Name <span className="text-white">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Delhi International University"
                  value={demoRequest.institutionName}
                  onChange={(e) => setDemoRequest({ ...demoRequest, institutionName: e.target.value })}
                  className="w-full px-4 py-3 bg-white/10 border border-purple-400/40 rounded-xl focus:ring-2 focus:ring-white text-white placeholder-purple-300 text-sm outline-none transition"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-purple-200 uppercase tracking-wider mb-1.5">
                  Estimated Student Strength
                </label>
                <input
                  type="text"
                  placeholder="e.g. 1,500 Students"
                  value={demoRequest.studentCount}
                  onChange={(e) => setDemoRequest({ ...demoRequest, studentCount: e.target.value })}
                  className="w-full px-4 py-3 bg-white/10 border border-purple-400/40 rounded-xl focus:ring-2 focus:ring-white text-white placeholder-purple-300 text-sm outline-none transition"
                />
              </div>

              {demoSuccess === 'success' && (
                <div className="p-3 bg-emerald-500/20 text-emerald-200 border border-emerald-400/30 rounded-xl text-xs font-semibold flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-300" />
                  Demo scheduled! Our team will contact you within 24 hours.
                </div>
              )}
              {demoSuccess === 'error' && (
                <div className="p-3 bg-rose-500/20 text-rose-200 border border-rose-400/30 rounded-xl text-xs font-semibold">
                  Something went wrong. Please try again.
                </div>
              )}

              <button
                type="submit"
                disabled={demoSubmitting}
                className="w-full py-3.5 bg-white text-purple-700 rounded-xl hover:bg-purple-50 transition font-bold text-sm shadow-lg disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {demoSubmitting ? <Loader2 className="w-4 h-4 animate-spin text-purple-700" /> : 'Schedule Live Demo'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
};

// ==========================================
// 9. FAQ SECTION
// ==========================================
const FAQSection = () => {
  const [openIndex, setOpenIndex] = useState(0);

  const faqs = [
    {
      topic: "Setup & Onboarding",
      question: "How long does tenant provisioning take for an institution?",
      answer: "Most campuses can be fully provisioned within 24 to 48 hours. Our automated CSV import tools allow you to import existing faculty, student, and timetable records seamlessly."
    },
    {
      topic: "Free Trial",
      question: "Is there a free trial period available?",
      answer: "Yes, we provide a 14-day comprehensive trial with complete access to attendance tracking, exam seating engines, and fee management with zero credit card commitment."
    },
    {
      topic: "Security & Isolation",
      question: "How is institutional data isolated and secured?",
      answer: "AttendEase utilizes dedicated tenant-isolated databases with 256-bit encryption at rest and in transit. Automated daily backups ensure zero data loss."
    },
    {
      topic: "Biometric & Hardware",
      question: "Does AttendEase support existing biometric or RFID scanners?",
      answer: "Yes. AttendEase provides an open hardware sync API and QR verification client that integrates directly with standard biometric devices and faculty mobile terminals."
    },
    {
      topic: "Support & SLA",
      question: "What support SLA is included with our subscription?",
      answer: "Starter plans include 24-48h email assistance, while Professional and Enterprise tiers receive priority SLA response windows (under 4 hours) plus dedicated account onboarding."
    }
  ];

  return (
    <section id="faq" className="py-24 px-4 sm:px-6 lg:px-8 bg-white border-t border-slate-100">
      <div className="max-w-3xl mx-auto">
        <SectionHeader
          badge="Frequently Asked Questions"
          badgeIcon={Shield}
          title="Everything You Need"
          highlight="To Know"
          description="Clear answers about setup, security, hardware compatibility, and deployment."
        />

        <div className="space-y-4">
          {faqs.map((faq, index) => {
            const isOpen = openIndex === index;
            return (
              <div
                key={index}
                className="bg-slate-50/70 rounded-2xl border border-slate-200/80 overflow-hidden transition-colors"
              >
                <button
                  className="w-full px-6 py-5 text-left font-bold text-slate-900 hover:bg-slate-100/60 flex justify-between items-center transition-colors"
                  onClick={() => setOpenIndex(isOpen ? null : index)}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-100">
                      {faq.topic}
                    </span>
                    <span className="text-base text-slate-900">{faq.question}</span>
                  </div>
                  <ChevronRight
                    className={`w-5 h-5 text-purple-600 transition-transform duration-300 flex-shrink-0 ml-4 ${
                      isOpen ? 'rotate-90' : ''
                    }`}
                  />
                </button>
                <AnimatePresence>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25 }}
                      className="overflow-hidden"
                    >
                      <div className="px-6 pb-6 pt-1 text-slate-600 text-sm leading-relaxed border-t border-slate-200/60">
                        {faq.answer}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

// ==========================================
// 10. CTA SECTION (CLIMAX OF SCROLL NARRATIVE)
// ==========================================
const CTASection = ({ navigate }) => {
  return (
    <section className="py-24 px-4 sm:px-6 lg:px-8 bg-gradient-to-r from-purple-700 via-indigo-700 to-purple-800 relative overflow-hidden text-white">
      <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_bottom,_var(--tw-gradient-stops))] from-white/10 via-transparent to-transparent opacity-60 pointer-events-none"></div>

      <div className="max-w-4xl mx-auto text-center relative z-10">
        <Reveal direction="zoom">
          <div>
            <h2 className="text-3xl sm:text-5xl font-extrabold text-white mb-6 tracking-tight leading-tight">
              Ready to Modernize Your Campus Operations?
            </h2>

            <p className="text-base sm:text-xl text-purple-100 mb-8 max-w-2xl mx-auto leading-relaxed">
              Join over 500+ forward-thinking schools, colleges, and universities streamlining attendance and administration with AttendEase ERP.
            </p>

            {/* Trust Line */}
            <div className="flex flex-wrap justify-center items-center gap-4 sm:gap-6 mb-10 text-xs sm:text-sm text-purple-200 font-medium">
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4 text-emerald-400" /> 14-Day Free Trial
              </span>
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4 text-emerald-400" /> No Credit Card Required
              </span>
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4 text-emerald-400" /> 24–48h Deployment
              </span>
            </div>

            <div className="flex flex-wrap gap-4 justify-center">
              <button
                onClick={() => navigate('/register/tenant')}
                className="px-8 py-4 bg-white text-purple-700 rounded-xl hover:bg-purple-50 transition-all font-bold shadow-xl hover:shadow-2xl hover:-translate-y-0.5 text-base flex items-center justify-center gap-2"
              >
                Start Free Trial
                <ArrowRight className="w-5 h-5 text-purple-700" />
              </button>
              <button
                onClick={() => document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' })}
                className="px-8 py-4 border border-purple-300/50 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-all font-bold text-base"
              >
                Talk to Sales
              </button>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
};

// ==========================================
// 11. FOOTER COMPONENT
// ==========================================
const Footer = () => {
  const navigate = useNavigate();

  const socials = [
    { name: 'Twitter', icon: <Twitter className="w-4 h-4" />, href: 'https://twitter.com' },
    { name: 'LinkedIn', icon: <Linkedin className="w-4 h-4" />, href: 'https://linkedin.com' },
    { name: 'Facebook', icon: <Facebook className="w-4 h-4" />, href: 'https://facebook.com' },
    { name: 'Instagram', icon: <Instagram className="w-4 h-4" />, href: 'https://instagram.com' },
  ];

  const scrollTo = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });

  return (
    <footer className="bg-slate-950 text-slate-400 py-16 px-4 sm:px-6 lg:px-8 border-t border-slate-900">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-12 gap-8 lg:gap-12">
          {/* Brand Col */}
          <div className="col-span-2 md:col-span-4">
            <div className="flex items-center gap-3 mb-4 cursor-pointer" onClick={() => scrollTo('hero')}>
              <div className="w-9 h-9 bg-gradient-to-tr from-purple-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-md">
                <GraduationCap className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold text-white tracking-tight">AttendEase ERP</span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed max-w-sm mb-6">
              The unified cloud ERP system engineered for universities, colleges, and K-12 institutions. Multi-tenant, automated, and secure.
            </p>
            <div className="flex gap-3">
              {socials.map((social) => (
                <a
                  key={social.name}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={social.name}
                  className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 hover:text-white hover:border-purple-500 transition-colors"
                >
                  {social.icon}
                </a>
              ))}
            </div>
          </div>

          {/* Product Links */}
          <div className="col-span-1 md:col-span-2">
            <h4 className="font-bold text-slate-200 text-xs uppercase tracking-wider mb-4">Product</h4>
            <ul className="space-y-2.5 text-xs">
              <li><button onClick={() => scrollTo('features')} className="hover:text-white transition">Attendance Engine</button></li>
              <li><button onClick={() => scrollTo('features')} className="hover:text-white transition">Exam Automation</button></li>
              <li><button onClick={() => scrollTo('pricing')} className="hover:text-white transition">Pricing Plans</button></li>
              <li><button onClick={() => scrollTo('how-it-works')} className="hover:text-white transition">How It Works</button></li>
            </ul>
          </div>

          {/* Solutions */}
          <div className="col-span-1 md:col-span-2">
            <h4 className="font-bold text-slate-200 text-xs uppercase tracking-wider mb-4">Solutions</h4>
            <ul className="space-y-2.5 text-xs">
              <li><button onClick={() => scrollTo('features')} className="hover:text-white transition">Higher Education</button></li>
              <li><button onClick={() => scrollTo('features')} className="hover:text-white transition">K-12 Schools</button></li>
              <li><button onClick={() => scrollTo('features')} className="hover:text-white transition">Multi-Campus Trusts</button></li>
              <li><button onClick={() => scrollTo('faq')} className="hover:text-white transition">Security & SLA</button></li>
            </ul>
          </div>

          {/* Company */}
          <div className="col-span-1 md:col-span-2">
            <h4 className="font-bold text-slate-200 text-xs uppercase tracking-wider mb-4">Company</h4>
            <ul className="space-y-2.5 text-xs">
              <li><button onClick={() => scrollTo('hero')} className="hover:text-white transition">About AttendEase</button></li>
              <li><button onClick={() => scrollTo('contact')} className="hover:text-white transition">Contact Us</button></li>
              <li><button onClick={() => scrollTo('faq')} className="hover:text-white transition">Help Center</button></li>
              <li><button onClick={() => navigate('/login')} className="hover:text-white transition">Portal Login</button></li>
            </ul>
          </div>

          {/* Fast Back To Top */}
          <div className="col-span-1 md:col-span-2 flex flex-col justify-between">
            <div>
              <h4 className="font-bold text-slate-200 text-xs uppercase tracking-wider mb-4">Status</h4>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                All Systems Normal
              </div>
            </div>
            <button
              onClick={() => scrollTo('hero')}
              className="mt-6 inline-flex items-center gap-2 text-xs text-slate-400 hover:text-purple-400 transition-colors"
            >
              <ArrowUp className="w-3.5 h-3.5" /> Back to top
            </button>
          </div>
        </div>

        <div className="border-t border-slate-900 mt-12 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <p>&copy; {new Date().getFullYear()} AttendEase ERP Platforms Inc. All rights reserved.</p>
          <div className="flex gap-6">
            <span className="hover:text-slate-400 cursor-pointer">Privacy Policy</span>
            <span className="hover:text-slate-400 cursor-pointer">Terms of Service</span>
            <span className="hover:text-slate-400 cursor-pointer">GDPR Compliance</span>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default LandingPage;