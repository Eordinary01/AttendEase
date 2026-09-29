// src/components/Landing/LandingPage.jsx
// Confident Authority Design System — Structural Overhaul
// Eliminates uniform card aesthetics with room-specific atmosphere, dark/light contrast shifts,
// spring physics choreography, animated split-reality contrast, and metric counters.
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import {
  GraduationCap,
  Users,
  BookOpen,
  Shield,
  ArrowRight,
  ArrowUp,
  Menu,
  X,
  CreditCard,
  Check,
  Clock,
  Calendar,
  MessageSquare,
  Lock,
  Upload,
  Headphones,
  ChevronRight,
  Activity,
  Sparkles,
  Building2,
  CheckCircle2,
  Zap,
  BarChart3,
  Star,
} from 'lucide-react';
import RoleSelectorModal from './RoleSelectorModal';
import { useDemo } from '../../contexts/DemoContext';
import api from '../../utils/api';

gsap.registerPlugin(ScrollTrigger);

// ==========================================
// 0. WELCOME AND IDENTITY TRANSITION
// ==========================================
const WelcomeEntrance = ({ onComplete }) => {
  const containerRef = useRef(null);
  const markRef = useRef(null);
  const initialFormRef = useRef(null);
  const finalFormRef = useRef(null);
  const tagRef = useRef(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        defaults: { ease: 'power3.inOut' },
        onComplete: () => {
          onComplete();
        },
      });

      tl.fromTo(
        markRef.current,
        { opacity: 0, scale: 0.86, rotation: -6 },
        { opacity: 1, scale: 1, rotation: 0, duration: 0.5 }
      )
        .fromTo(
          initialFormRef.current,
          { opacity: 0, letterSpacing: '0.3em', y: 8 },
          { opacity: 1, letterSpacing: '0.15em', y: 0, duration: 0.45 },
          '-=0.2'
        )
        .fromTo(
          tagRef.current,
          { opacity: 0, y: 4 },
          { opacity: 1, y: 0, duration: 0.35 },
          '-=0.15'
        )
        .to(initialFormRef.current, {
          opacity: 0,
          y: -8,
          duration: 0.35,
          delay: 0.3,
        })
        .fromTo(
          finalFormRef.current,
          { opacity: 0, y: 8, scale: 0.96, letterSpacing: '-0.04em' },
          { opacity: 1, y: 0, scale: 1, letterSpacing: '-0.02em', duration: 0.45 },
          '-=0.15'
        )
        .to(containerRef.current, {
          opacity: 0,
          scale: 1.02,
          duration: 0.5,
          delay: 0.35,
        });
    }, containerRef);

    return () => ctx.revert();
  }, [onComplete]);

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#070b14] text-white select-none transition-opacity"
      style={{
        backgroundImage: 'radial-gradient(circle, rgba(99,102,241,0.15) 1px, transparent 1px)',
        backgroundSize: '24px 24px',
      }}
      onClick={() => onComplete()}
      role="region"
      aria-label="Welcome Introduction"
    >
      <div className="flex flex-col items-center text-center px-6 max-w-sm">
        <div
          ref={markRef}
          className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-indigo-700 border border-indigo-400/40 rounded-2xl flex items-center justify-center mb-5 shadow-2xl shadow-indigo-900/60"
        >
          <GraduationCap className="w-8 h-8 text-white" />
        </div>

        <div className="relative h-11 w-full flex items-center justify-center mb-2">
          <div
            ref={initialFormRef}
            className="absolute inset-0 flex items-center justify-center text-[11px] uppercase font-semibold text-indigo-300 font-mono tracking-widest"
          >
            Institutional Operations
          </div>

          <div
            ref={finalFormRef}
            className="absolute inset-0 flex items-center justify-center text-3xl font-extrabold text-white opacity-0 font-sans tracking-tight"
          >
            <span>Attend</span>
            <span className="text-indigo-400">Ease</span>
          </div>
        </div>

        <p ref={tagRef} className="text-xs text-slate-400 font-medium tracking-wide">
          Academic Precision ERP Platform
        </p>
      </div>

      <button
        onClick={(e) => {
          e.stopPropagation();
          onComplete();
        }}
        className="absolute bottom-8 text-[11px] text-slate-500 hover:text-slate-300 transition-colors uppercase tracking-widest focus-visible:outline-none focus-visible:underline"
      >
        Skip intro
      </button>
    </div>
  );
};

// ==========================================
// MAIN LANDING PAGE CONTAINER
// ==========================================
const LandingPage = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [welcomeDone, setWelcomeDone] = useState(false);

  const navigate = useNavigate();
  const { openRoleModal } = useDemo();

  const scrollToSection = (sectionId) => {
    const section = document.getElementById(sectionId);
    if (section) {
      section.scrollIntoView({ behavior: 'smooth' });
    }
    setIsMenuOpen(false);
  };

  useEffect(() => {
    if (!welcomeDone) return;
    const timer = setTimeout(() => {
      ScrollTrigger.refresh();
    }, 100);
    return () => clearTimeout(timer);
  }, [welcomeDone]);

  return (
    <div className="min-h-screen bg-[#faf8ff] text-[#0f172a] selection:bg-indigo-500/20 selection:text-indigo-950 font-sans antialiased">
      {!welcomeDone ? (
        <WelcomeEntrance onComplete={() => setWelcomeDone(true)} />
      ) : (
        <>
          <Navbar
            isMenuOpen={isMenuOpen}
            setIsMenuOpen={setIsMenuOpen}
            scrollToSection={scrollToSection}
            navigate={navigate}
            openRoleModal={openRoleModal}
          />
          <main>
            <HeroSection navigate={navigate} openRoleModal={openRoleModal} />
            <PlatformScopeSection />
            <WhatChangesSection />
            <DemoSandboxSection />
            <PricingSection navigate={navigate} />
            <CredibilitySection />
            <DeploymentSection />
            <FinalActionSection navigate={navigate} openRoleModal={openRoleModal} />
          </main>
          <Footer scrollToSection={scrollToSection} navigate={navigate} />
          <RoleSelectorModal />
        </>
      )}
    </div>
  );
};

// ==========================================
// 1. NAVBAR
// ==========================================
const Navbar = ({ isMenuOpen, setIsMenuOpen, scrollToSection, navigate, openRoleModal }) => {
  const [scrolled, setScrolled] = useState(false);
  const progressRef = useRef(null);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const bar = progressRef.current;
    if (!bar) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        bar,
        { scaleX: 0 },
        {
          scaleX: 1,
          ease: 'none',
          scrollTrigger: {
            trigger: document.documentElement,
            start: 'top top',
            end: 'bottom bottom',
            scrub: 0.15,
          },
        }
      );
    });
    return () => ctx.revert();
  }, []);

  const navLinks = [
    { name: 'Platform', href: 'platform' },
    { name: 'How It Works', href: 'how-it-works' },
    { name: 'Live Sandbox', href: 'demo' },
    { name: 'Pricing', href: 'pricing' },
    { name: 'Proof Points', href: 'credibility' },
  ];

  return (
    <nav
      className={`fixed w-full z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-white/90 backdrop-blur-lg shadow-[0_4px_20px_-4px_rgba(15,23,42,0.08)] py-3 border-b border-slate-200/80'
          : 'bg-transparent py-5'
      }`}
    >
      {/* Precision progress bar */}
      <div
        ref={progressRef}
        className="absolute top-0 left-0 w-full h-[2.5px] bg-gradient-to-r from-indigo-600 via-purple-500 to-emerald-500 origin-left z-50 pointer-events-none"
        style={{ transform: 'scaleX(0)' }}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center">
          {/* Brand Logo */}
          <div
            className="flex items-center gap-2.5 cursor-pointer group"
            onClick={() => scrollToSection('hero')}
          >
            <div className="w-9 h-9 bg-gradient-to-br from-indigo-600 to-indigo-800 rounded-xl flex items-center justify-center shadow-md shadow-indigo-600/20 group-hover:scale-105 transition-transform">
              <GraduationCap className="w-5 h-5 text-white" />
            </div>
            <div className="flex flex-col">
              <span className="text-lg font-extrabold text-slate-900 tracking-tight leading-none">
                Attend<span className="text-indigo-600">Ease</span>
              </span>
              <span className="text-[10px] text-slate-500 font-medium tracking-wider uppercase">
                Enterprise ERP
              </span>
            </div>
          </div>

          {/* Desktop Navigation Links */}
          <div className="hidden md:flex items-center gap-7">
            {navLinks.map((link) => (
              <button
                key={link.name}
                onClick={() => scrollToSection(link.href)}
                className="text-slate-600 hover:text-indigo-600 font-medium text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 rounded-md px-1 py-1"
              >
                {link.name}
              </button>
            ))}

            <div className="flex items-center gap-3 pl-4 border-l border-slate-200">
              <button
                onClick={() => navigate('/login')}
                className="px-3.5 py-2 text-slate-700 hover:text-indigo-600 hover:bg-slate-100/80 transition-all font-semibold text-sm rounded-lg"
              >
                Sign In
              </button>
              <button
                onClick={openRoleModal}
                className="px-4 py-2 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50/60 border border-slate-300/80 rounded-lg transition-all font-semibold text-sm bg-white shadow-sm hover:shadow"
              >
                Demo Role
              </button>
              <button
                onClick={() => navigate('/register/tenant')}
                className="px-5 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 active:bg-indigo-800 transition-all font-semibold text-sm shadow-md shadow-indigo-600/25 hover:shadow-indigo-600/35 hover:-translate-y-0.5"
              >
                Start Free Trial
              </button>
            </div>
          </div>

          {/* Mobile Menu Toggle */}
          <button
            className="md:hidden p-2 rounded-lg hover:bg-slate-100 text-slate-700 transition-colors"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            aria-label="Toggle menu"
          >
            {isMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {isMenuOpen && (
        <div className="md:hidden bg-white/95 backdrop-blur-xl border-b border-slate-200 shadow-xl">
          <div className="px-5 py-5 space-y-2">
            {navLinks.map((link) => (
              <button
                key={link.name}
                onClick={() => scrollToSection(link.href)}
                className="block w-full text-left px-4 py-2.5 text-slate-800 font-medium hover:bg-slate-100 hover:text-indigo-600 rounded-lg transition"
              >
                {link.name}
              </button>
            ))}
            <div className="pt-4 border-t border-slate-200 flex flex-col gap-2.5">
              <button
                onClick={() => navigate('/login')}
                className="w-full px-4 py-2.5 text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 font-semibold text-center text-sm"
              >
                Sign In
              </button>
              <button
                onClick={() => {
                  setIsMenuOpen(false);
                  openRoleModal();
                }}
                className="w-full px-4 py-2.5 border border-indigo-200 text-indigo-600 bg-indigo-50/50 hover:bg-indigo-50 rounded-lg font-semibold text-center text-sm"
              >
                Demo Role
              </button>
              <button
                onClick={() => navigate('/register/tenant')}
                className="w-full px-4 py-2.5 bg-indigo-600 text-white rounded-lg font-semibold shadow-md hover:bg-indigo-700 text-center text-sm"
              >
                Start Free Trial
              </button>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
};

// ==========================================
// 2. HERO SECTION — THE COMMAND CENTER
// Metaphor: Cinematic Masked Text Reveal & 3D Interactive Console with Live Glow
// ==========================================
const HeroSection = ({ navigate, openRoleModal }) => {
  const heroRef = useRef(null);
  const headlineWordsRef = useRef([]);
  const subheadRef = useRef(null);
  const buttonsRef = useRef(null);
  const previewRef = useRef(null);
  const badgeRef = useRef(null);
  const consolePulseRef = useRef(null);

  useEffect(() => {
    if (!heroRef.current) return;
    const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 768;
    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const ctx = gsap.context(() => {
      if (!prefersReduced) {
        const tl = gsap.timeline({ defaults: { ease: 'power4.out' } });

        // 1. Badge pop
        tl.fromTo(
          badgeRef.current,
          { opacity: 0, y: 15, scale: 0.94 },
          { opacity: 1, y: 0, scale: 1, duration: 0.45 }
        )
          // 2. Editorial Masked Headline Reveal
          .fromTo(
            headlineWordsRef.current,
            { yPercent: 120, opacity: 0 },
            { yPercent: 0, opacity: 1, duration: 0.75, stagger: 0.04, ease: 'power4.out' },
            '-=0.2'
          )
          // 3. Subhead fade & rise
          .fromTo(
            subheadRef.current,
            { opacity: 0, y: 16 },
            { opacity: 1, y: 0, duration: 0.5, ease: 'power3.out' },
            '-=0.4'
          )
          // 4. Action buttons
          .fromTo(
            buttonsRef.current,
            { opacity: 0, y: 20 },
            { opacity: 1, y: 0, duration: 0.5, ease: 'back.out(1.4)' },
            '-=0.3'
          )
          // 5. 3D Perspective Console entrance with spring settle
          .fromTo(
            previewRef.current,
            {
              opacity: 0,
              scale: 0.92,
              transformPerspective: 1200,
              rotateX: 8,
              rotateY: -5,
              y: 40,
            },
            {
              opacity: 1,
              scale: 1,
              rotateX: 0,
              rotateY: 0,
              y: 0,
              duration: 0.85,
              ease: 'power3.out',
            },
            '-=0.55'
          );
      }

      // Scroll-driven subtle 3D tilt reaction on desktop
      if (isDesktop && !prefersReduced && previewRef.current) {
        gsap.to(previewRef.current, {
          rotateX: -3,
          y: 25,
          scale: 0.985,
          ease: 'power2.out',
          scrollTrigger: {
            trigger: heroRef.current,
            start: 'top top',
            end: 'bottom top',
            scrub: 0.4,
          },
        });
      }
    }, heroRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      id="hero"
      ref={heroRef}
      className="relative pt-36 pb-28 px-4 sm:px-6 lg:px-8 overflow-hidden bg-gradient-to-b from-[#faf8ff] via-[#f5f3ff] to-[#f8fafc]"
    >
      {/* Ambient background glow & structural pattern */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[650px] pointer-events-none -z-10">
        <div className="absolute top-10 left-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl" />
        <div className="absolute top-28 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
      </div>
      <div className="absolute inset-0 landing-dots-light pointer-events-none -z-10" />

      <div className="max-w-7xl mx-auto relative z-10">
        <div className="grid lg:grid-cols-12 gap-12 lg:gap-8 items-center">
          {/* Left: Editorial Pitch */}
          <div className="lg:col-span-6 text-left">
            <div
              ref={badgeRef}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold mb-6 shadow-sm"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Unified Institutional Education ERP
            </div>

            {/* Editorial Headline with Word-Level Masking */}
            <h1 className="text-3xl sm:text-5xl xl:text-[3.25rem] font-extrabold text-slate-900 mb-6 leading-[1.12] tracking-tight font-sans">
              <div className="overflow-hidden pb-1">
                <span
                  ref={(el) => (headlineWordsRef.current[0] = el)}
                  className="inline-block font-light text-slate-600"
                >
                  Run institutional operations
                </span>
              </div>
              <div className="overflow-hidden pb-1">
                <span
                  ref={(el) => (headlineWordsRef.current[1] = el)}
                  className="inline-block font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-600"
                >
                  with analytical precision
                </span>
              </div>
              <div className="overflow-hidden pb-1">
                <span
                  ref={(el) => (headlineWordsRef.current[2] = el)}
                  className="inline-block font-bold text-slate-900"
                >
                  and zero fragmentation.
                </span>
              </div>
            </h1>

            <p
              ref={subheadRef}
              className="text-base sm:text-lg text-slate-600 mb-8 max-w-xl leading-relaxed font-normal"
            >
              Mark attendance in seconds, automate conflict-free exams, reconcile fee ledgers, and synchronize role portals across departments on one consolidated architecture.
            </p>

            <div ref={buttonsRef} className="flex flex-wrap items-center gap-4">
              <button
                onClick={() => navigate('/register/tenant')}
                className="px-7 py-3.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-xl transition-all font-semibold flex items-center gap-2 text-base shadow-lg shadow-indigo-600/25 hover:shadow-indigo-600/40 hover:-translate-y-0.5 active:scale-[0.98]"
              >
                Start Free Trial
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                onClick={openRoleModal}
                className="px-6 py-3.5 bg-white text-slate-800 border border-slate-300 hover:border-slate-400 hover:bg-slate-50/80 rounded-xl transition-all font-semibold text-base shadow-sm hover:shadow active:scale-[0.98]"
              >
                Explore Live Demo
              </button>
            </div>

            <div className="mt-8 flex items-center gap-6 text-xs text-slate-500 font-medium">
              <span className="flex items-center gap-1.5">
                <Check className="w-4 h-4 text-emerald-600" /> Isolated tenant databases
              </span>
              <span className="flex items-center gap-1.5">
                <Check className="w-4 h-4 text-emerald-600" /> 24–48h rapid provisioning
              </span>
            </div>
          </div>

          {/* Right: 3D Perspective Live Console */}
          <div ref={previewRef} className="lg:col-span-6 relative [perspective:1200px]">
            {/* Atmospheric Glow behind console */}
            <div
              ref={consolePulseRef}
              className="absolute -inset-3 bg-gradient-to-tr from-indigo-500/20 via-purple-500/15 to-emerald-500/20 rounded-3xl blur-2xl -z-10 landing-glow-pulse pointer-events-none"
            />

            <div className="relative w-full bg-white rounded-2xl p-3.5 shadow-[0_20px_50px_-12px_rgba(15,23,42,0.15)] border border-slate-200/90 ring-1 ring-slate-100">
              {/* Window Header Chrome */}
              <div className="bg-slate-50 rounded-xl px-4 py-2.5 border border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-rose-400/80" />
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-400/80" />
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-400/80" />
                  <span className="ml-2 text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                    <GraduationCap className="w-3.5 h-3.5 text-indigo-600" />
                    AttendEase Console · Campus Live Operations
                  </span>
                </div>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-bold border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Live Sync Active
                </span>
              </div>

              {/* Console Body */}
              <div className="mt-3 bg-slate-50/70 rounded-xl p-4 border border-slate-200 space-y-3.5">
                {/* Metric Cards Row */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-white rounded-xl p-3 border border-slate-200/90 shadow-sm">
                    <p className="text-[11px] font-semibold text-slate-500">Today's Attendance</p>
                    <p className="text-2xl font-black text-slate-900 mt-1 tabular-nums font-sans">
                      96.4%
                    </p>
                    <span className="text-[10px] text-emerald-600 font-bold">↑ +2.1% benchmark</span>
                  </div>
                  <div className="bg-white rounded-xl p-3 border border-slate-200/90 shadow-sm">
                    <p className="text-[11px] font-semibold text-slate-500">Active Sessions</p>
                    <p className="text-2xl font-black text-indigo-600 mt-1 tabular-nums font-sans">
                      48 / 50
                    </p>
                    <span className="text-[10px] text-slate-500 font-medium">Semester 6 Roster</span>
                  </div>
                  <div className="bg-white rounded-xl p-3 border border-slate-200/90 shadow-sm">
                    <p className="text-[11px] font-semibold text-slate-500">Fee Ledger</p>
                    <p className="text-2xl font-black text-amber-600 mt-1 tabular-nums font-sans">
                      ₹4.8M
                    </p>
                    <span className="text-[10px] text-amber-600 font-bold">92% settled</span>
                  </div>
                </div>

                {/* Live Class Rosters Matrix */}
                <div className="bg-white rounded-xl p-3.5 border border-slate-200/90 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Activity className="w-4 h-4 text-indigo-600" />
                      <span className="text-xs font-bold text-slate-900">Active Course Rosters</span>
                    </div>
                    <span className="text-[11px] text-slate-500 font-mono">
                      Period 3 · 10:00–11:00 AM
                    </span>
                  </div>
                  <div className="space-y-2">
                    {[
                      {
                        code: 'CS-301',
                        title: 'Data Structures & Algorithms',
                        present: '58/60',
                        rate: '96.7%',
                        badge: 'Completed',
                        badgeStyle: 'text-emerald-700 bg-emerald-50 border-emerald-200',
                        iconBg: 'bg-indigo-50 text-indigo-600 border-indigo-200',
                      },
                      {
                        code: 'MATH-202',
                        title: 'Discrete Mathematics',
                        present: '54/55',
                        rate: '98.2%',
                        badge: 'Completed',
                        badgeStyle: 'text-emerald-700 bg-emerald-50 border-emerald-200',
                        iconBg: 'bg-emerald-50 text-emerald-600 border-emerald-200',
                      },
                      {
                        code: 'PHYS-101',
                        title: 'Quantum Physics Lab',
                        present: '42/48',
                        rate: '87.5%',
                        badge: 'In Progress',
                        badgeStyle: 'text-amber-700 bg-amber-50 border-amber-200',
                        iconBg: 'bg-amber-50 text-amber-600 border-amber-200',
                      },
                    ].map((row, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-200/80 text-xs hover:bg-slate-100/80 transition-colors"
                      >
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`w-7 h-7 rounded-lg ${row.iconBg} font-mono font-bold text-[10px] flex items-center justify-center border`}
                          >
                            {row.code.split('-')[0]}
                          </div>
                          <div>
                            <p className="font-semibold text-slate-800">{row.title}</p>
                            <p className="text-[11px] text-slate-500 font-mono">
                              {row.code} · Present: {row.present}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2.5">
                          <span className="font-bold text-slate-900 tabular-nums">{row.rate}</span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold border ${row.badgeStyle}`}
                          >
                            {row.badge}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Telemetry Bar */}
                <div className="flex items-center justify-between pt-1 text-[11px] text-slate-500">
                  <span className="flex items-center gap-1.5 font-medium">
                    <Shield className="w-3.5 h-3.5 text-indigo-600" />
                    Hardware biometric & encrypted QR verification active
                  </span>
                  <span className="font-mono text-emerald-600 font-bold">0 pending anomalies</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

// ==========================================
// 3. PLATFORM SCOPE — IMMERSIVE BENTO
// Metaphor: Spring physics snap, cursor spotlight, gradient border & distinct accent personalities
// ==========================================
const PlatformScopeSection = () => {
  const scopeRef = useRef(null);
  const featuredBlockRef = useRef(null);
  const cardsRef = useRef([]);
  const progressBarRef = useRef(null);

  useEffect(() => {
    if (!scopeRef.current) return;
    if (typeof window !== 'undefined' && window.innerWidth < 768) return;

    const ctx = gsap.context(() => {
      // 1. Featured card snap with spring physics
      if (featuredBlockRef.current) {
        gsap.fromTo(
          featuredBlockRef.current,
          { opacity: 0, y: 50, scale: 0.96 },
          {
            opacity: 1,
            y: 0,
            scale: 1,
            duration: 0.75,
            ease: 'back.out(1.4)',
            scrollTrigger: {
              trigger: featuredBlockRef.current,
              start: 'top 82%',
              toggleActions: 'play reverse play reverse',
            },
          }
        );
      }

      // 2. Smaller module cards: staggered spring entrance
      cardsRef.current.forEach((card, idx) => {
        if (!card) return;
        gsap.fromTo(
          card,
          {
            opacity: 0,
            y: 35,
            scale: 0.94,
          },
          {
            opacity: 1,
            y: 0,
            scale: 1,
            duration: 0.6,
            delay: idx * 0.08,
            ease: 'back.out(1.5)',
            scrollTrigger: {
              trigger: card,
              start: 'top 88%',
              toggleActions: 'play reverse play reverse',
            },
          }
        );
      });

      // 3. Live biometric fill progress
      if (progressBarRef.current) {
        gsap.fromTo(
          progressBarRef.current,
          { width: '15%' },
          {
            width: '98%',
            duration: 0.8,
            ease: 'power3.out',
            scrollTrigger: {
              trigger: scopeRef.current,
              start: 'top 70%',
              toggleActions: 'play reverse play reverse',
            },
          }
        );
      }
    }, scopeRef);

    return () => ctx.revert();
  }, []);

  const modules = [
    {
      title: 'Automated anti-cheating seating & GPA calculation',
      tag: 'Exams & Seating',
      desc: 'Generate room-wise hall tickets with anti-collision student seating. SGPA and CGPA calculated automatically from exam rosters.',
      icon: BookOpen,
      color: 'emerald',
      iconClass: 'text-emerald-600 bg-emerald-50 border-emerald-200',
      badgeClass: 'text-emerald-700 bg-emerald-50/80 border-emerald-200',
      hoverBorder: 'hover:border-emerald-300 hover:shadow-emerald-500/10',
      span: 'md:col-span-5',
    },
    {
      title: 'Automated invoicing, installments, and receipts',
      tag: 'Fee Ledgers',
      desc: 'Track multi-tier installment structures, generate digital receipts, and reconcile pending campus dues in one financial view.',
      icon: CreditCard,
      color: 'amber',
      iconClass: 'text-amber-600 bg-amber-50 border-amber-200',
      badgeClass: 'text-amber-700 bg-amber-50/80 border-amber-200',
      hoverBorder: 'hover:border-amber-300 hover:shadow-amber-500/10',
      span: 'md:col-span-5',
    },
    {
      title: 'Faculty schedule conflict resolution',
      tag: 'Timetable Matrix',
      desc: 'Assemble multi-semester schedules with zero faculty overlap. Changes propagate live across student and staff apps.',
      icon: Calendar,
      color: 'blue',
      iconClass: 'text-blue-600 bg-blue-50 border-blue-200',
      badgeClass: 'text-blue-700 bg-blue-50/80 border-blue-200',
      hoverBorder: 'hover:border-blue-300 hover:shadow-blue-500/10',
      span: 'md:col-span-4',
    },
    {
      title: 'Departments, academic years, and RBAC',
      tag: 'Governance & RBAC',
      desc: 'Configure granular permissions. Institution leadership monitors whole-campus analytics while faculty access their assigned sections.',
      icon: Shield,
      color: 'purple',
      iconClass: 'text-purple-600 bg-purple-50 border-purple-200',
      badgeClass: 'text-purple-700 bg-purple-50/80 border-purple-200',
      hoverBorder: 'hover:border-purple-300 hover:shadow-purple-500/10',
      span: 'md:col-span-4',
    },
    {
      title: 'Parent dispatches & departmental notices',
      tag: 'Guardian Dispatches',
      desc: 'Direct emergency broadcasts and attendance notices to guardian phones. Official portal notices keep campus communities informed.',
      icon: MessageSquare,
      color: 'rose',
      iconClass: 'text-rose-600 bg-rose-50 border-rose-200',
      badgeClass: 'text-rose-700 bg-rose-50/80 border-rose-200',
      hoverBorder: 'hover:border-rose-300 hover:shadow-rose-500/10',
      span: 'md:col-span-4',
    },
  ];

  return (
    <section
      id="platform"
      ref={scopeRef}
      className="py-28 px-4 sm:px-6 lg:px-8 bg-white border-t border-slate-200/90 relative"
    >
      <div className="max-w-7xl mx-auto">
        <div className="mb-16 max-w-2xl">
          <div className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 uppercase tracking-widest mb-3">
            <Building2 className="w-4 h-4" />
            Institutional Architecture
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight leading-snug">
            Six unified modules. One authoritative core.
          </h2>
          <p className="mt-4 text-base sm:text-lg text-slate-600 leading-relaxed font-normal">
            Eliminate fragmented software silos. Every administrative layer communicates in real time with the central academic ledger.
          </p>
        </div>

        {/* Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          {/* Featured Attendance Centerpiece with Gradient Rim */}
          <div
            ref={featuredBlockRef}
            className="md:col-span-7 md:row-span-2 p-[1px] rounded-2xl bg-gradient-to-br from-indigo-500/40 via-purple-500/20 to-emerald-500/30 shadow-2xl shadow-indigo-950/20"
          >
            <div className="h-full bg-slate-950 rounded-[15px] p-7 sm:p-9 text-white relative overflow-hidden flex flex-col justify-between">
              {/* Background ambient lighting */}
              <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

              <div className="relative z-10">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center">
                    <Users className="w-4 h-4 text-indigo-300" />
                  </div>
                  <span className="text-xs font-bold text-indigo-300 uppercase tracking-wider font-mono">
                    Module 01 · Attendance Engine
                  </span>
                </div>
                <h3 className="text-2xl sm:text-3xl font-extrabold text-white mb-3 tracking-tight">
                  Subject-wise attendance marked & verified in under 30 seconds
                </h3>
                <p className="text-slate-300 text-sm leading-relaxed mb-6 max-w-lg">
                  Faculty capture rosters via hardware biometric terminals or dynamic rotating QR tokens. Absentees automatically trigger encrypted SMS alerts to parents with zero manual friction.
                </p>

                {/* Attendance Sandbox Console */}
                <div className="bg-slate-900/90 rounded-xl p-4 border border-slate-800/90 shadow-inner">
                  <div className="flex items-center justify-between pb-2 text-xs mb-2">
                    <span className="font-semibold text-slate-200">CS-301 Attendance Session</span>
                    <span className="text-emerald-400 font-mono font-bold">
                      98% Verified
                    </span>
                  </div>
                  {/* Live Biometric Progress Fill */}
                  <div className="w-full bg-slate-800 rounded-full h-2 mb-3 overflow-hidden">
                    <div
                      ref={progressBarRef}
                      className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full rounded-full transition-all duration-75"
                      style={{ width: '15%' }}
                    />
                  </div>
                  <div className="space-y-2 text-xs">
                    {[
                      {
                        name: 'Rahul Sharma (CS-01)',
                        status: 'Verified (Biometric)',
                        statusColor: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
                      },
                      {
                        name: 'Ananya Verma (CS-02)',
                        status: 'Verified (QR Scan)',
                        statusColor: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
                      },
                      {
                        name: 'Dev Patel (CS-03)',
                        status: 'Absent · SMS Dispatched',
                        statusColor: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
                      },
                    ].map((s, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950/80 border border-slate-800/80"
                      >
                        <span className="text-slate-200 font-medium">{s.name}</span>
                        <span
                          className={`px-2.5 py-0.5 rounded text-[10px] font-bold border ${s.statusColor}`}
                        >
                          {s.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                <span>Hardware API + Tablet / Mobile app sync</span>
                <span className="text-indigo-400 font-semibold">100% Offline tolerant</span>
              </div>
            </div>
          </div>

          {/* Distinct Personality Module Cards */}
          {modules.map((m, idx) => {
            const Icon = m.icon;
            return (
              <div
                key={idx}
                ref={(el) => (cardsRef.current[idx] = el)}
                className={`${m.span} bg-white rounded-2xl p-6 sm:p-7 border border-slate-200/90 shadow-sm transition-all duration-200 ${m.hoverBorder} hover:shadow-lg flex flex-col justify-between`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center border ${m.iconClass}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <span className={`text-[11px] font-bold uppercase tracking-wider font-mono px-2.5 py-0.5 rounded-full border ${m.badgeClass}`}>
                      {m.tag}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 mb-2 leading-snug">
                    {m.title}
                  </h3>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    {m.desc}
                  </p>
                </div>
                <div className="pt-4 mt-4 border-t border-slate-100 flex items-center text-xs font-semibold text-slate-500">
                  <span>Included across all institutional tiers</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

// ==========================================
// 4. WHAT CHANGES — SPLIT REALITY CONTRAST
// Metaphor: Polarity Contrast, Strikethrough Animation & Top-Down Drawing Divider Line
// ==========================================
const WhatChangesSection = () => {
  const sectionRef = useRef(null);
  const beforeColRef = useRef(null);
  const afterColRef = useRef(null);
  const dividerLineRef = useRef(null);
  const checkIconsRef = useRef([]);

  useEffect(() => {
    if (!sectionRef.current) return;
    if (typeof window !== 'undefined' && window.innerWidth < 768) return;

    const ctx = gsap.context(() => {
      // 1. Drawing Divider Line
      if (dividerLineRef.current) {
        gsap.fromTo(
          dividerLineRef.current,
          { scaleY: 0 },
          {
            scaleY: 1,
            duration: 0.8,
            ease: 'power3.inOut',
            scrollTrigger: {
              trigger: sectionRef.current,
              start: 'top 75%',
              toggleActions: 'play reverse play reverse',
            },
          }
        );
      }

      // 2. Left Legacy Column Entrance
      gsap.fromTo(
        beforeColRef.current,
        { opacity: 0.3, x: -30 },
        {
          opacity: 1,
          x: 0,
          duration: 0.6,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: sectionRef.current,
            start: 'top 80%',
            toggleActions: 'play reverse play reverse',
          },
        }
      );

      // 3. Right AttendEase Column Entrance
      gsap.fromTo(
        afterColRef.current,
        { opacity: 0.3, x: 30, scale: 0.98 },
        {
          opacity: 1,
          x: 0,
          scale: 1,
          duration: 0.6,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: sectionRef.current,
            start: 'top 80%',
            toggleActions: 'play reverse play reverse',
          },
        }
      );

      // 4. Checkmarks popping with spring
      checkIconsRef.current.forEach((icon, idx) => {
        if (!icon) return;
        gsap.fromTo(
          icon,
          { scale: 0, opacity: 0, rotation: -45 },
          {
            scale: 1,
            opacity: 1,
            rotation: 0,
            duration: 0.4,
            delay: 0.15 + idx * 0.08,
            ease: 'back.out(1.7)',
            scrollTrigger: {
              trigger: afterColRef.current,
              start: 'top 80%',
              toggleActions: 'play reverse play reverse',
            },
          }
        );
      });
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  const beforeItems = [
    'Paper registers manually passed between staff and tallied at month-end',
    'Fees tracked across physical receipt books and disparate bank spreadsheets',
    'Exam seating plotted in Excel; hall tickets formatted and printed individually',
    'Parents constantly phone the administrative office for attendance inquiries',
    'Timetable updates distributed via paper bulletin boards and informal chats',
    'Leadership must manually stitch five disparate spreadsheets for monthly audits',
  ];

  const afterItems = [
    {
      role: 'Faculty',
      text: 'Mark rosters in 30 seconds; absent guardian dispatches trigger automatically',
    },
    {
      role: 'Admin',
      text: 'Unified dashboard displays live attendance, exam schedules, and collected fees',
    },
    {
      role: 'Students',
      text: 'Access live attendance analytics, class schedules, and leave filings on their portal',
    },
    {
      role: 'Parents',
      text: 'Direct transparency into attendance, fee deadlines, and official institutional notices',
    },
    {
      role: 'Leadership',
      text: 'Multi-campus oversight, granular role policies, and immutable audit logs',
    },
  ];

  return (
    <section
      id="how-it-works"
      ref={sectionRef}
      className="py-28 px-4 sm:px-6 lg:px-8 bg-[#f8fafc] border-t border-slate-200 relative overflow-hidden"
    >
      <div className="max-w-7xl mx-auto relative">
        <div className="mb-16 max-w-2xl">
          <div className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 uppercase tracking-widest mb-3">
            <Sparkles className="w-4 h-4" />
            Operational Transformation
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight leading-snug">
            What changes when your campus adopts AttendEase
          </h2>
          <p className="mt-4 text-base sm:text-lg text-slate-600 leading-relaxed font-normal">
            Transition from fragmented, error-prone manual records to an authoritative, real-time institutional operations center.
          </p>
        </div>

        {/* Split Reality Grid */}
        <div className="relative grid md:grid-cols-2 gap-8 lg:gap-12 items-stretch">
          {/* Animated Central Vertical Divider on desktop */}
          <div
            ref={dividerLineRef}
            className="hidden md:block absolute left-1/2 top-4 bottom-4 w-[2px] bg-gradient-to-b from-indigo-500/20 via-indigo-600 to-indigo-500/20 origin-top -translate-x-1/2 z-20 pointer-events-none"
            style={{ transform: 'scaleY(0)' }}
          />

          {/* Left: Legacy Disconnected Reality */}
          <div
            ref={beforeColRef}
            className="bg-slate-100/90 rounded-2xl p-7 sm:p-9 border border-rose-200/70 shadow-sm flex flex-col justify-between relative overflow-hidden"
          >
            <div className="absolute top-4 right-4 text-[10px] font-mono uppercase tracking-widest text-rose-500 font-bold bg-rose-50 px-2.5 py-1 rounded-md border border-rose-200">
              Legacy Approach
            </div>

            <div>
              <div className="flex items-center gap-2 mb-6 pb-4 border-b border-slate-200">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                <h3 className="text-xs font-bold text-rose-700 uppercase tracking-wider font-mono">
                  Fragmented Campus Operations
                </h3>
              </div>
              <ul className="space-y-4">
                {beforeItems.map((item, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-3 text-sm text-slate-600 leading-relaxed group"
                  >
                    <div className="w-5 h-5 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center flex-shrink-0 mt-0.5 border border-rose-200">
                      <X className="w-3 h-3 stroke-[2.5]" />
                    </div>
                    <span className="line-through decoration-rose-400/70 decoration-1 text-slate-500">
                      {item}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="mt-8 pt-4 border-t border-slate-200 text-xs text-rose-600/90 font-medium">
              ⚠ High manual labor · frequent calculation discrepancies · delayed notifications
            </div>
          </div>

          {/* Right: Modern AttendEase Unified Reality */}
          <div
            ref={afterColRef}
            className="bg-white rounded-2xl p-7 sm:p-9 border-2 border-emerald-500/40 shadow-xl shadow-emerald-950/5 ring-4 ring-emerald-500/5 flex flex-col justify-between relative overflow-hidden"
          >
            <div className="absolute top-4 right-4 text-[10px] font-mono uppercase tracking-widest text-emerald-700 font-bold bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              AttendEase Standard
            </div>

            <div>
              <div className="flex items-center gap-2 mb-6 pb-4 border-b border-slate-100">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <h3 className="text-xs font-bold text-emerald-800 uppercase tracking-wider font-mono">
                  Autonomous Central Ledger
                </h3>
              </div>
              <ul className="space-y-4">
                {afterItems.map((item, i) => (
                  <li key={i} className="flex items-start gap-3.5 text-sm leading-relaxed">
                    <div
                      ref={(el) => (checkIconsRef.current[i] = el)}
                      className="w-5 h-5 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0 mt-0.5 border border-emerald-300 shadow-sm"
                    >
                      <Check className="w-3 h-3 stroke-[2.5]" />
                    </div>
                    <div>
                      <span className="font-bold text-slate-900">{item.role}:</span>{' '}
                      <span className="text-slate-700">{item.text}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
            <div className="mt-8 pt-4 border-t border-emerald-50 text-xs text-emerald-700 font-bold flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              Automated audit trail across all academic, attendance, and fee transactions
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

// ==========================================
// 5. DEMO SANDBOX SHOWCASE — DRAMATIC DARK MODE SHIFT
// Room change: switches from bright slate to sleek dark obsidian space (#0a0f1d)
// ==========================================
const DEMO_ROLES = [
  { key: 'admin', name: 'Institution Admin', icon: Shield },
  { key: 'teacher', name: 'Faculty', icon: BookOpen },
  { key: 'student', name: 'Student', icon: GraduationCap },
  { key: 'parent', name: 'Parent', icon: Users },
];

const DemoSandboxSection = () => {
  const [selectedRole, setSelectedRole] = useState('admin');
  const { slotsStatus, fetchSlotStatus, claimDemoRole, loading } = useDemo();
  const sandboxRef = useRef(null);
  const panelRef = useRef(null);
  const previewContentRef = useRef(null);

  const handleRoleSelect = (roleKey) => {
    if (roleKey === selectedRole) return;
    setSelectedRole(roleKey);
    if (previewContentRef.current) {
      gsap.fromTo(
        previewContentRef.current,
        { filter: 'blur(6px)', opacity: 0.4, scale: 0.985 },
        { filter: 'blur(0px)', opacity: 1, scale: 1, duration: 0.35, ease: 'power2.out' }
      );
    }
  };

  useEffect(() => {
    fetchSlotStatus();
    const interval = setInterval(fetchSlotStatus, 12000);
    return () => clearInterval(interval);
  }, [fetchSlotStatus]);

  useEffect(() => {
    if (!panelRef.current) return;
    if (typeof window !== 'undefined' && window.innerWidth < 768) return;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        panelRef.current,
        { scale: 0.94, opacity: 0.3, y: 30 },
        {
          scale: 1,
          opacity: 1,
          y: 0,
          duration: 0.7,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: panelRef.current,
            start: 'top 82%',
            toggleActions: 'play reverse play reverse',
          },
        }
      );
    }, panelRef);

    return () => ctx.revert();
  }, []);

  const selectedSlot = slotsStatus[selectedRole];
  const isOccupied = selectedSlot && selectedSlot.isAvailable === false;
  const remainingMin = selectedSlot?.remainingSeconds
    ? Math.ceil(selectedSlot.remainingSeconds / 60)
    : null;

  return (
    <section
      id="demo"
      ref={sandboxRef}
      className="py-28 px-4 sm:px-6 lg:px-8 bg-[#0a0f1d] text-white border-t border-slate-800 relative overflow-hidden"
    >
      {/* Dark Room Ambient Background Grid Pattern & Radial Lighting */}
      <div className="absolute inset-0 landing-grid-pattern pointer-events-none opacity-60 -z-10" />
      <div className="absolute top-0 left-1/3 w-[500px] h-[500px] bg-indigo-600/10 rounded-full blur-3xl pointer-events-none -z-10" />

      <div className="max-w-7xl mx-auto relative z-10">
        <div className="mb-12 max-w-2xl">
          <div className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-400 uppercase tracking-widest mb-3 bg-indigo-500/15 border border-indigo-400/30 px-3 py-1 rounded-full">
            <Shield className="w-3.5 h-3.5 text-indigo-300" />
            Interactive Environment Sandbox
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight leading-snug">
            Inspect authentic role-based interfaces
          </h2>
          <p className="mt-4 text-base sm:text-lg text-slate-300 leading-relaxed font-normal">
            Every persona is equipped with an interface tailored to their exact operational scope. Switch tabs to preview each console, then claim a live 15-minute isolated sandbox.
          </p>
        </div>

        {/* Role Selector Capsule Tabs */}
        <div className="bg-slate-900/80 backdrop-blur-md border border-slate-800 p-1.5 rounded-2xl inline-flex flex-wrap gap-1.5 mb-8 shadow-xl">
          {DEMO_ROLES.map((role) => {
            const Icon = role.icon;
            const isSelected = selectedRole === role.key;
            const slot = slotsStatus[role.key];
            const occupied = slot && slot.isAvailable === false;

            return (
              <button
                key={role.key}
                onClick={() => handleRoleSelect(role.key)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-150 active:scale-[0.98] ${
                  isSelected
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 border border-indigo-400/40'
                    : occupied
                    ? 'text-slate-400 hover:text-white hover:bg-slate-800/60 border border-transparent'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/80 border border-transparent'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{role.name}</span>
                {occupied && (
                  <span
                    className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0 animate-pulse"
                    title="Slot occupied"
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* Dark Obsidian Console Preview Panel */}
        <div
          ref={panelRef}
          className="bg-slate-900/95 rounded-2xl p-3.5 shadow-2xl shadow-black/60 border border-slate-800 mb-8"
        >
          {/* Header Chrome */}
          <div className="bg-slate-950/80 rounded-xl px-4 py-3 border border-slate-800/80 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-slate-700" />
              <div className="w-2.5 h-2.5 rounded-full bg-slate-700" />
              <div className="w-2.5 h-2.5 rounded-full bg-slate-700" />
              <span className="ml-2 text-xs font-semibold text-slate-300 font-mono">
                AttendEase Console · {DEMO_ROLES.find((r) => r.key === selectedRole)?.name} View
              </span>
            </div>
            {isOccupied ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                <Clock className="w-3.5 h-3.5" />
                Slot in use · ~{remainingMin}m remaining
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Demo Slot Available
              </span>
            )}
          </div>

          {/* Role Preview Body with Dark Styling */}
          <div
            ref={previewContentRef}
            className="bg-slate-950/90 rounded-xl mt-3 p-5 sm:p-6 border border-slate-800/80 min-h-[320px] overflow-hidden"
          >
            {selectedRole === 'admin' && <AdminPreviewDark />}
            {selectedRole === 'teacher' && <TeacherPreviewDark />}
            {selectedRole === 'student' && <StudentPreviewDark />}
            {selectedRole === 'parent' && <ParentPreviewDark />}
          </div>
        </div>

        {/* Claim Sandbox Button Bar */}
        <div className="flex flex-wrap items-center gap-5">
          <button
            onClick={() => claimDemoRole(selectedRole)}
            disabled={isOccupied || loading}
            className={`px-7 py-3.5 rounded-xl font-bold text-sm flex items-center gap-2.5 transition-all duration-150 active:scale-[0.98] ${
              isOccupied
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                : 'bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white shadow-xl shadow-indigo-600/30 landing-glow-pulse hover:-translate-y-0.5'
            }`}
          >
            {loading ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Initializing Sandbox…
              </>
            ) : isOccupied ? (
              <>
                <Clock className="w-4 h-4" />
                Slot busy · ~{remainingMin}m wait
              </>
            ) : (
              <>
                Launch {DEMO_ROLES.find((r) => r.key === selectedRole)?.name} Live Sandbox
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
          <span className="text-xs text-slate-400">
            Isolated 15-minute operational instance · zero credentials or registration required
          </span>
        </div>
      </div>
    </section>
  );
};

// --- Dark Mode Role Preview Sub-components ---
const AdminPreviewDark = () => (
  <div className="space-y-4">
    <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
      <Shield className="w-4 h-4 text-indigo-400" />
      <span className="text-xs font-bold text-slate-200">Campus Master Command · Demo Institute</span>
    </div>
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {[
        { label: 'Attendance Today', value: '96.4%', sub: '↑ 2.1% benchmark', color: 'text-emerald-400' },
        { label: 'Active Sections', value: '48 / 50', sub: 'Semester 6', color: 'text-slate-400' },
        { label: 'Fee Collection', value: '₹4.8M', sub: '92% reconciled', color: 'text-amber-400' },
        { label: 'At-Risk Flags', value: '12', sub: '< 75% attendance', color: 'text-rose-400' },
      ].map((m, i) => (
        <div key={i} className="bg-slate-900/90 rounded-xl p-3.5 border border-slate-800 shadow-sm">
          <p className="text-[11px] font-semibold text-slate-400">{m.label}</p>
          <p className="text-xl font-bold text-white mt-1 tabular-nums font-sans">{m.value}</p>
          <span className={`text-[10px] font-bold ${m.color}`}>{m.sub}</span>
        </div>
      ))}
    </div>
    <div className="bg-slate-900/90 rounded-xl p-4 border border-slate-800 shadow-sm">
      <p className="text-xs font-bold text-slate-200 mb-3">Department Academic Efficiency</p>
      {[
        { dept: 'Computer Science & Engineering', rate: '94.2%', w: '94%' },
        { dept: 'Electronics & Communication', rate: '91.7%', w: '92%' },
        { dept: 'Mechanical Sciences', rate: '89.3%', w: '89%' },
      ].map((d, i) => (
        <div key={i} className="flex items-center gap-3 mb-2.5 last:mb-0">
          <span className="text-xs text-slate-300 w-48 flex-shrink-0 font-medium">{d.dept}</span>
          <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
            <div className="h-full bg-indigo-500 rounded-full" style={{ width: d.w }} />
          </div>
          <span className="text-xs font-bold text-slate-200 w-14 text-right tabular-nums">
            {d.rate}
          </span>
        </div>
      ))}
    </div>
  </div>
);

const TeacherPreviewDark = () => (
  <div className="space-y-4">
    <div className="flex items-center justify-between pb-2 border-b border-slate-800">
      <div className="flex items-center gap-2">
        <BookOpen className="w-4 h-4 text-indigo-400" />
        <span className="text-xs font-bold text-slate-200">CS-301 · Data Structures & Algorithms</span>
      </div>
      <span className="text-[11px] text-slate-400 font-mono">Period 3 · 10:00–11:00 AM</span>
    </div>
    <div className="bg-slate-900/90 rounded-xl border border-slate-800 overflow-hidden shadow-sm">
      <div className="px-4 py-2.5 bg-slate-950/60 text-[11px] font-bold text-slate-400 flex items-center justify-between border-b border-slate-800">
        <span>Student Roster (60 Enrolled)</span>
        <span className="text-emerald-400">56 Present · 4 Absent</span>
      </div>
      <div className="divide-y divide-slate-800/60">
        {[
          { roll: 'CS-01', name: 'Rahul Sharma', status: 'Present', color: 'text-emerald-400' },
          { roll: 'CS-02', name: 'Ananya Verma', status: 'Present', color: 'text-emerald-400' },
          { roll: 'CS-03', name: 'Dev Patel', status: 'Absent · SMS Alert', color: 'text-rose-400' },
          { roll: 'CS-04', name: 'Priya Nair', status: 'Present', color: 'text-emerald-400' },
        ].map((s, i) => (
          <div key={i} className="flex items-center justify-between px-4 py-2.5 text-xs">
            <div className="flex items-center gap-3">
              <span className="text-slate-500 font-mono w-10">{s.roll}</span>
              <span className="font-semibold text-slate-200">{s.name}</span>
            </div>
            <span className={`text-[11px] font-bold ${s.color}`}>{s.status}</span>
          </div>
        ))}
      </div>
    </div>
    <div className="flex gap-3">
      <button className="px-4 py-2 rounded-lg bg-emerald-500/15 text-emerald-300 text-xs font-bold border border-emerald-500/30">
        Mark All Present
      </button>
      <button className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-xs font-bold shadow-md">
        Submit Attendance Roster
      </button>
    </div>
  </div>
);

const StudentPreviewDark = () => (
  <div className="space-y-4">
    <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
      <GraduationCap className="w-4 h-4 text-indigo-400" />
      <span className="text-xs font-bold text-slate-200">Arjun Mehta · Semester 6 Roster</span>
    </div>
    <div className="grid grid-cols-3 gap-3">
      <div className="bg-slate-900/90 rounded-xl p-3 border border-slate-800">
        <p className="text-[11px] font-semibold text-slate-400">Cumulative Attendance</p>
        <p className="text-xl font-bold text-emerald-400 mt-1 tabular-nums font-sans">87.5%</p>
      </div>
      <div className="bg-slate-900/90 rounded-xl p-3 border border-slate-800">
        <p className="text-[11px] font-semibold text-slate-400">Lectures Today</p>
        <p className="text-xl font-bold text-white mt-1 tabular-nums font-sans">4</p>
      </div>
      <div className="bg-slate-900/90 rounded-xl p-3 border border-slate-800">
        <p className="text-[11px] font-semibold text-slate-400">Leave Quota</p>
        <p className="text-xl font-bold text-amber-400 mt-1 tabular-nums font-sans">3 / 8</p>
      </div>
    </div>
    <div className="bg-slate-900/90 rounded-xl p-3.5 border border-slate-800 text-xs">
      <p className="font-bold text-slate-200 mb-2.5">Today's Academic Timetable</p>
      {[
        { time: '09:00', subject: 'Data Structures & Algorithms', status: 'Verified', color: 'text-emerald-400' },
        { time: '10:00', subject: 'Discrete Mathematics', status: 'Verified', color: 'text-emerald-400' },
        { time: '11:00', subject: 'Physics Laboratory', status: 'Upcoming', color: 'text-slate-400' },
      ].map((s, i) => (
        <div key={i} className="flex items-center gap-3 py-2 border-b border-slate-800/80 last:border-0 text-xs">
          <span className="text-slate-500 font-mono w-12 font-medium">{s.time}</span>
          <span className="font-semibold text-slate-200 flex-1">{s.subject}</span>
          <span className={`font-bold ${s.color}`}>{s.status}</span>
        </div>
      ))}
    </div>
  </div>
);

const ParentPreviewDark = () => (
  <div className="space-y-4">
    <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
      <Users className="w-4 h-4 text-amber-400" />
      <span className="text-xs font-bold text-slate-200">Ward: Arjun Mehta · Roll: CS-01</span>
    </div>
    <div className="grid grid-cols-3 gap-3">
      <div className="bg-slate-900/90 rounded-xl p-3 border border-slate-800">
        <p className="text-[11px] font-semibold text-slate-400">Weekly Attendance</p>
        <p className="text-xl font-bold text-emerald-400 mt-1 tabular-nums font-sans">92%</p>
      </div>
      <div className="bg-slate-900/90 rounded-xl p-3 border border-slate-800">
        <p className="text-[11px] font-semibold text-slate-400">Fee Outstanding</p>
        <p className="text-xl font-bold text-amber-400 mt-1 tabular-nums font-sans">₹5,000</p>
      </div>
      <div className="bg-slate-900/90 rounded-xl p-3 border border-slate-800">
        <p className="text-[11px] font-semibold text-slate-400">Academic Standing</p>
        <p className="text-xl font-bold text-indigo-400 mt-1 tabular-nums font-sans">Good</p>
      </div>
    </div>
    <div className="bg-slate-900/90 rounded-xl p-3.5 border border-slate-800 text-xs">
      <p className="font-bold text-slate-200 mb-2">Automated Incident Feed</p>
      <div className="space-y-2">
        <div className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800 flex items-center justify-between">
          <span className="text-slate-300">Today · 4/4 Classes Attended</span>
          <span className="text-emerald-400 font-bold">Confirmed</span>
        </div>
        <div className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800 flex items-center justify-between">
          <span className="text-slate-300">Semester Fee Installment #2</span>
          <span className="text-emerald-400 font-bold">Paid (₹45,000)</span>
        </div>
      </div>
    </div>
  </div>
);

// ==========================================
// 6. PRICING SECTION — CLEAN SPOTLIGHT ELEVATION
// Metaphor: Single recommended plan spotlight, domino cascade arrival, tabular typography
// ==========================================
const DEFAULT_PLANS = [
  {
    code: 'free',
    name: 'Free',
    description: 'For testing and small community setups',
    pricing: { monthly: 0, yearly: 0, currency: 'INR' },
    limits: { maxStudents: 50, maxTeachers: 5, maxAdmins: 1, maxStorageMB: 1024 },
    modules: { attendance: true, timetable: false, examManagement: false, financeManagement: false, parentPortal: false, analytics: false },
    features: [
      { name: 'Core Attendance Tracking', included: true },
      { name: 'Subject-wise Rosters', included: true },
      { name: 'Standard CSV Data Export', included: true },
      { name: 'Community Support', included: true },
    ],
    isPopular: false,
    sortOrder: 1,
  },
  {
    code: 'basic',
    name: 'Basic',
    description: 'For small schools & coaching institutes',
    pricing: { monthly: 49, yearly: 499, currency: 'INR' },
    limits: { maxStudents: 200, maxTeachers: 20, maxAdmins: 3, maxStorageMB: 10240 },
    modules: { attendance: true, timetable: true, examManagement: true, financeManagement: false, parentPortal: false, analytics: true },
    features: [
      { name: 'Full Attendance & Timetables', included: true },
      { name: 'Exam Management & Grades', included: true },
      { name: 'Department Analytics', included: true },
      { name: 'Priority Email Support', included: true },
    ],
    isPopular: false,
    sortOrder: 2,
  },
  {
    code: 'professional',
    name: 'Professional',
    description: 'For standard universities & colleges',
    pricing: { monthly: 149, yearly: 1499, currency: 'INR' },
    limits: { maxStudents: 1000, maxTeachers: 100, maxAdmins: 10, maxStorageMB: 51200 },
    modules: { attendance: true, timetable: true, examManagement: true, financeManagement: true, parentPortal: true, analytics: true },
    features: [
      { name: 'Everything in Basic', included: true },
      { name: 'Parent Portal & Instant SMS', included: true },
      { name: 'Fee Collection & Dues Tracking', included: true },
      { name: 'Custom Roles & Granular RBAC', included: true },
      { name: 'API Access & Webhooks', included: true },
    ],
    isPopular: true,
    sortOrder: 3,
  },
  {
    code: 'enterprise',
    name: 'Enterprise',
    description: 'For university networks & institutes',
    pricing: { monthly: 499, yearly: 4999, currency: 'INR' },
    limits: { maxStudents: 10000, maxTeachers: 1000, maxAdmins: 50, maxStorageMB: 512000 },
    modules: { attendance: true, timetable: true, examManagement: true, financeManagement: true, parentPortal: true, analytics: true },
    features: [
      { name: 'Everything in Professional', included: true },
      { name: 'Biometric & Hardware Sync', included: true },
      { name: 'Multi-Campus Consolidation', included: true },
      { name: 'HR & Library Management', included: true },
      { name: 'Dedicated SLA & Migration', included: true },
    ],
    isPopular: false,
    sortOrder: 4,
  },
];

const PricingSection = ({ navigate }) => {
  const [plans, setPlans] = useState(DEFAULT_PLANS);
  const [billingCycle, setBillingCycle] = useState('monthly');
  const pricingRef = useRef(null);
  const planCardsRef = useRef([]);
  const priceNumbersRef = useRef([]);

  useEffect(() => {
    let isMounted = true;
    const fetchPricing = async () => {
      try {
        const res = await api.get('/landing/pricing');
        if (
          isMounted &&
          res.data &&
          res.data.success &&
          Array.isArray(res.data.data) &&
          res.data.data.length > 0
        ) {
          const sorted = [...res.data.data].sort(
            (a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)
          );
          setPlans(sorted);
        }
      } catch (err) {
        // Fallback to default plans safely
      }
    };
    fetchPricing();
    return () => {
      isMounted = false;
    };
  }, []);

  // Domino Cascade Entrance
  useEffect(() => {
    if (!pricingRef.current) return;
    if (typeof window !== 'undefined' && window.innerWidth < 768) return;

    const ctx = gsap.context(() => {
      planCardsRef.current.forEach((card, idx) => {
        if (!card) return;
        gsap.fromTo(
          card,
          { opacity: 0, y: 40 },
          {
            opacity: 1,
            y: 0,
            duration: 0.6,
            delay: idx * 0.1,
            ease: 'back.out(1.3)',
            scrollTrigger: {
              trigger: pricingRef.current,
              start: 'top 80%',
              toggleActions: 'play reverse play reverse',
            },
          }
        );
      });
    }, pricingRef);

    return () => ctx.revert();
  }, [plans]);

  // Split-flap flip on billing change
  useEffect(() => {
    priceNumbersRef.current.forEach((el) => {
      if (!el) return;
      gsap.fromTo(
        el,
        { rotateX: 60, opacity: 0.2 },
        { rotateX: 0, opacity: 1, duration: 0.3, ease: 'power2.out' }
      );
    });
  }, [billingCycle]);

  const formatLimit = (count) => {
    if (count === undefined || count === null) return 'Unlimited';
    return count.toLocaleString();
  };

  const formatStorage = (mb) => {
    if (mb >= 1024) return `${Math.round(mb / 1024)} GB`;
    return `${mb} MB`;
  };

  return (
    <section
      id="pricing"
      ref={pricingRef}
      className="py-28 px-4 sm:px-6 lg:px-8 bg-[#faf8ff] border-t border-slate-200"
    >
      <div className="max-w-7xl mx-auto">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <div className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 uppercase tracking-widest mb-3">
            <CreditCard className="w-4 h-4" />
            Predictable Institutional Licensing
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight leading-snug">
            Straightforward tiers. No hidden per-message markups.
          </h2>
          <p className="mt-4 text-base sm:text-lg text-slate-600 leading-relaxed font-normal">
            Predictable budgeting scaled to active student capacity. Includes unlimited administrative accounts and daily backups.
          </p>
        </div>

        {/* Billing Cycle Toggle */}
        <div className="flex items-center justify-center mb-16">
          <div className="inline-flex p-1.5 bg-slate-200/80 rounded-xl border border-slate-300/80 shadow-inner">
            <button
              onClick={() => setBillingCycle('monthly')}
              className={`px-5 py-2 text-xs sm:text-sm font-bold rounded-lg transition-all ${
                billingCycle === 'monthly'
                  ? 'bg-white text-slate-900 shadow-md'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Monthly Billing
            </button>
            <button
              onClick={() => setBillingCycle('yearly')}
              className={`px-5 py-2 text-xs sm:text-sm font-bold rounded-lg transition-all flex items-center gap-2 ${
                billingCycle === 'yearly'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Annual Billing
              <span
                className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                  billingCycle === 'yearly'
                    ? 'bg-indigo-800 text-yellow-300'
                    : 'bg-emerald-100 text-emerald-800'
                }`}
              >
                Save ~16%
              </span>
            </button>
          </div>
        </div>

        {/* Plan Cards Grid — Spotlight on Exactly ONE Recommended Card */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-7 items-stretch">
          {plans.map((plan, index) => {
            // Strictly enforce only ONE plan is recommended (Professional tier)
            const isRecommended =
              plan.code?.toLowerCase() === 'professional' ||
              (!plans.some((p) => p.code?.toLowerCase() === 'professional') && plan.isPopular);

            const monthlyPrice = plan.pricing?.monthly ?? 0;
            const yearlyPrice = plan.pricing?.yearly ?? 0;
            const isFree = monthlyPrice === 0 && yearlyPrice === 0;

            const displayPrice = isFree
              ? '₹0'
              : billingCycle === 'monthly'
              ? `₹${monthlyPrice}`
              : `₹${yearlyPrice.toLocaleString()}`;

            const billingPeriod = isFree
              ? 'forever'
              : billingCycle === 'monthly'
              ? '/ month'
              : '/ year';

            return (
              <div
                key={plan.code || plan._id || plan.name}
                ref={(el) => (planCardsRef.current[index] = el)}
                className={`rounded-2xl p-7 transition-all duration-200 flex flex-col justify-between relative ${
                  isRecommended
                    ? 'bg-white border-2 border-indigo-600 shadow-2xl shadow-indigo-600/15 ring-4 ring-indigo-500/10 lg:-translate-y-3 z-10'
                    : 'bg-white/90 border border-slate-200/90 hover:border-slate-300 shadow-sm hover:shadow-md'
                }`}
              >
                {/* Single Recommended Ribbon Badge */}
                {isRecommended && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 bg-gradient-to-r from-indigo-600 to-indigo-500 text-white font-extrabold text-[11px] rounded-full uppercase tracking-wider shadow-md shadow-indigo-600/30 flex items-center gap-1.5">
                    <Star className="w-3 h-3 fill-current" />
                    Most Popular Choice
                  </div>
                )}

                <div>
                  <div className="mb-4">
                    <h3 className="text-xl font-bold text-slate-900">{plan.name}</h3>
                    <p className="text-xs text-slate-500 mt-1.5 min-h-[36px] leading-relaxed">
                      {plan.description || 'Comprehensive campus operations'}
                    </p>
                  </div>

                  {/* Price Block */}
                  <div className="mb-6 pb-6 border-b border-slate-100 [perspective:600px]">
                    <div
                      ref={(el) => (priceNumbersRef.current[index] = el)}
                      className="flex items-baseline gap-1.5"
                    >
                      <span className="text-4xl font-extrabold text-slate-900 tracking-tight tabular-nums font-sans">
                        {displayPrice}
                      </span>
                      <span className="text-xs font-semibold text-slate-500">{billingPeriod}</span>
                    </div>
                    {!isFree && billingCycle === 'yearly' && (
                      <p className="text-[11px] text-emerald-600 font-bold mt-1.5">
                        Effective ₹{Math.round(yearlyPrice / 12)}/mo billed annually
                      </p>
                    )}
                    {isFree && (
                      <p className="text-[11px] text-slate-400 font-medium mt-1.5">
                        No credit card required
                      </p>
                    )}
                  </div>

                  {/* Resource Limits with Tabular Numbers (No Monospace) */}
                  <div className="space-y-2.5 py-3 border-b border-slate-100 mb-6 text-xs">
                    <div className="flex items-center justify-between text-slate-600">
                      <span>Max Student Capacity</span>
                      <span className="font-bold text-slate-900 tabular-nums">
                        {formatLimit(plan.limits?.maxStudents)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-slate-600">
                      <span>Faculty Seats</span>
                      <span className="font-bold text-slate-900 tabular-nums">
                        {formatLimit(plan.limits?.maxTeachers)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-slate-600">
                      <span>Admin Accounts</span>
                      <span className="font-bold text-slate-900 tabular-nums">
                        {formatLimit(plan.limits?.maxAdmins)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-slate-600">
                      <span>Storage Quota</span>
                      <span className="font-bold text-slate-900 tabular-nums">
                        {formatStorage(plan.limits?.maxStorageMB)}
                      </span>
                    </div>
                  </div>

                  {/* Capabilities List */}
                  <div className="space-y-3 mb-6">
                    <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400 font-mono">
                      Modules Included
                    </p>
                    {(plan.features || []).slice(0, 5).map((feat, idx) => (
                      <div key={idx} className="flex items-start gap-2.5 text-xs text-slate-700">
                        <Check
                          className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
                            isRecommended ? 'text-indigo-600 font-bold' : 'text-emerald-600'
                          }`}
                        />
                        <span className="leading-snug">{feat.name || feat}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Call to Action Button */}
                <div className="pt-3">
                  <button
                    onClick={() =>
                      navigate(
                        `/register/tenant?plan=${(plan.code || plan.name || '').toLowerCase()}`
                      )
                    }
                    className={`w-full py-3.5 px-4 rounded-xl text-xs font-bold transition-all text-center active:scale-[0.98] ${
                      isRecommended
                        ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-600/25 hover:shadow-indigo-600/40'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300/80'
                    }`}
                  >
                    {plan.code === 'enterprise'
                      ? 'Contact Enterprise Desk'
                      : isFree
                      ? 'Start Free Plan'
                      : 'Start 14-Day Free Trial'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

// ==========================================
// 7. CREDIBILITY SECTION — METRIC COUNTERS
// Metaphor: Numbers count up dynamically + custom accent colored progress bars fill on enter
// ==========================================
const CredibilitySection = () => {
  const sectionRef = useRef(null);
  const countersRef = useRef([]);
  const gaugeLinesRef = useRef([]);

  const proofPoints = [
    {
      targetNum: 6,
      prefix: '',
      suffix: '',
      label: 'Unified Modules',
      detail: 'Attendance, Exams, Fees, Timetable, Administration, and Guardian Portals in sync.',
      gaugeGradient: 'from-indigo-600 to-indigo-400',
    },
    {
      targetNum: 4,
      prefix: '',
      suffix: '',
      label: 'Role-Specific Portals',
      detail: 'Tailored consoles for Admins, Faculty, Students, and Parents with dedicated RBAC.',
      gaugeGradient: 'from-emerald-500 to-teal-400',
    },
    {
      targetNum: 30,
      prefix: '< ',
      suffix: 's',
      label: 'Roster Completion',
      detail: 'Biometric terminals and dynamic QR codes allow instant classroom capture.',
      gaugeGradient: 'from-amber-500 to-orange-400',
    },
    {
      targetNum: 100,
      prefix: '',
      suffix: '%',
      label: 'Traceable Audit Logs',
      detail: 'Every fee receipt, grade entry, and attendance edit is permanently logged.',
      gaugeGradient: 'from-purple-600 to-indigo-500',
    },
    {
      targetNum: 24,
      prefix: '',
      suffix: 'h',
      label: 'Rapid Deployment',
      detail: 'Isolated tenant database partitions and CSV ingestion pipelines active in 24–48h.',
      gaugeGradient: 'from-blue-600 to-cyan-400',
    },
    {
      targetNum: 99,
      prefix: '',
      suffix: '.9%',
      label: 'Infrastructure SLA',
      detail: 'Cloud resilience with daily rolling backups and TLS 1.3 encryption in transit.',
      gaugeGradient: 'from-rose-500 to-pink-500',
    },
  ];

  useEffect(() => {
    if (!sectionRef.current) return;
    if (typeof window !== 'undefined' && window.innerWidth < 768) return;

    const ctx = gsap.context(() => {
      proofPoints.forEach((point, i) => {
        const counterEl = countersRef.current[i];
        const gaugeEl = gaugeLinesRef.current[i];
        if (!counterEl) return;

        const proxy = { val: 0 };
        gsap.to(proxy, {
          val: point.targetNum,
          duration: 1.4,
          ease: 'power2.out',
          scrollTrigger: {
            trigger: counterEl,
            start: 'top 85%',
            toggleActions: 'play reverse play reverse',
          },
          onUpdate: () => {
            counterEl.innerText = `${point.prefix || ''}${Math.round(proxy.val)}${point.suffix || ''}`;
          },
        });

        if (gaugeEl) {
          gsap.fromTo(
            gaugeEl,
            { scaleX: 0 },
            {
              scaleX: 1,
              duration: 1.0,
              ease: 'power3.out',
              scrollTrigger: {
                trigger: counterEl,
                start: 'top 85%',
                toggleActions: 'play reverse play reverse',
              },
            }
          );
        }
      });
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      id="credibility"
      ref={sectionRef}
      className="py-28 px-4 sm:px-6 lg:px-8 bg-white border-t border-slate-200"
    >
      <div className="max-w-7xl mx-auto">
        <div className="mb-16 max-w-2xl">
          <div className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 uppercase tracking-widest mb-3">
            <CheckCircle2 className="w-4 h-4" />
            Verified Benchmarks
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight leading-snug">
            Institutional proof points
          </h2>
          <p className="mt-4 text-base sm:text-lg text-slate-600 leading-relaxed font-normal">
            Measurable operational capabilities engineered for educational dignity, regulatory audit, and scale.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-7">
          {proofPoints.map((point, i) => (
            <div
              key={i}
              className="bg-slate-50 rounded-2xl p-7 border border-slate-200/90 shadow-sm hover:shadow-md hover:border-slate-300 transition-all relative overflow-hidden group"
            >
              <div className="mb-3">
                <span
                  ref={(el) => (countersRef.current[i] = el)}
                  className="text-4xl sm:text-5xl font-black text-slate-900 font-sans tabular-nums tracking-tight"
                >
                  {point.prefix || ''}{point.targetNum}{point.suffix || ''}
                </span>
                <p className="text-base font-bold text-slate-800 mt-2">{point.label}</p>
              </div>

              {/* Accent colored progress line that fills on scroll */}
              <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden my-4">
                <div
                  ref={(el) => (gaugeLinesRef.current[i] = el)}
                  className={`h-full bg-gradient-to-r ${point.gaugeGradient} origin-left rounded-full`}
                  style={{ transform: 'scaleX(0)' }}
                />
              </div>

              <p className="text-xs text-slate-600 leading-relaxed font-normal">{point.detail}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

// ==========================================
// 8. DEPLOYMENT & GOVERNANCE ACCORDION
// Metaphor: Refined clean lines, spring physics, active left accent border
// ==========================================
const DeploymentSection = () => {
  const [openIndex, setOpenIndex] = useState(0);
  const sectionRef = useRef(null);

  const items = [
    {
      question: 'How is student and institutional data isolated?',
      answer:
        'Every institution operates on a tenant-isolated database partition with dedicated cryptographic schemas. Cross-institution data leakage is prevented by design at the API routing and database persistence layer.',
      icon: Lock,
    },
    {
      question: 'What encryption protocols and backup protections are active?',
      answer:
        'All database records utilize 256-bit AES encryption at rest, paired with TLS 1.3 in transit. Automated point-in-time daily backups are stored in geo-redundant vaults with periodic restoration tests.',
      icon: Shield,
    },
    {
      question: 'How does campus onboarding and legacy migration work?',
      answer:
        'New campus environments are deployed in 24–48 hours. Our automated CSV pipelines validate and ingest historical student records, course matrices, faculty rosters, and fee structures with duplicate resolution.',
      icon: Upload,
    },
    {
      question: 'What role-based access controls and audits are supported?',
      answer:
        'Granular permissions for Super Admin, Campus Admin, Department Heads, Faculty, Students, and Guardians. Every record mutation is immutably timestamped in audit logs for accreditation compliance.',
      icon: Users,
    },
    {
      question: 'What SLA guarantees and onboarding support are included?',
      answer:
        'Standard environments include 24-hour email turnarounds. Professional and Enterprise agreements feature a 4-hour priority response window, dedicated migration engineers, and personalized faculty training webinars.',
      icon: Headphones,
    },
  ];

  return (
    <section
      ref={sectionRef}
      className="py-28 px-4 sm:px-6 lg:px-8 bg-[#faf8ff] border-t border-slate-200"
    >
      <div className="max-w-3xl mx-auto">
        <div className="mb-14 text-center">
          <div className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 uppercase tracking-widest mb-3">
            <Shield className="w-4 h-4" />
            Governance & Compliance
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight leading-snug">
            Deployment, security, and operational confidence
          </h2>
          <p className="mt-3 text-base text-slate-600 leading-relaxed font-normal">
            Clear technical answers to the infrastructure questions institutional leadership asks before migrating.
          </p>
        </div>

        {/* Refined Accordion with Left Accent Border */}
        <div className="space-y-3.5">
          {items.map((item, index) => {
            const isOpen = openIndex === index;
            const Icon = item.icon;
            return (
              <div
                key={index}
                className={`bg-white rounded-xl border transition-all duration-200 overflow-hidden ${
                  isOpen
                    ? 'border-l-4 border-l-indigo-600 border-slate-300 shadow-md ring-1 ring-indigo-500/10'
                    : 'border-slate-200 hover:border-slate-300 shadow-sm'
                }`}
              >
                <button
                  className="w-full px-6 py-4 text-left font-bold text-slate-900 hover:bg-slate-50 flex items-center gap-4 transition-colors text-sm"
                  onClick={() => setOpenIndex(isOpen ? null : index)}
                >
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${
                      isOpen ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <span className="flex-1">{item.question}</span>
                  <ChevronRight
                    className={`w-4 h-4 text-slate-500 transition-transform duration-200 flex-shrink-0 ${
                      isOpen ? 'rotate-90 text-indigo-600' : ''
                    }`}
                  />
                </button>
                <AnimatePresence>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25, ease: 'easeOut' }}
                      className="overflow-hidden"
                    >
                      <div className="px-6 pb-5 pt-0 text-slate-600 text-sm leading-relaxed border-t border-slate-100 ml-12">
                        <div className="pt-3">{item.answer}</div>
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
// 9. FINAL CALL TO ACTION — GRADIENT DRAMA & NOISE
// Metaphor: Cinematic entrance, glowing CTA button, rich atmospheric contrast
// ==========================================
const FinalActionSection = ({ navigate, openRoleModal }) => {
  const sectionRef = useRef(null);
  const contentRef = useRef(null);

  useEffect(() => {
    if (!sectionRef.current) return;
    if (typeof window !== 'undefined' && window.innerWidth < 768) return;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        contentRef.current,
        { opacity: 0.3, y: 35 },
        {
          opacity: 1,
          y: 0,
          duration: 0.7,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: sectionRef.current,
            start: 'top 80%',
            toggleActions: 'play reverse play reverse',
          },
        }
      );
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={sectionRef}
      className="py-28 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-[#0c0f1d] via-[#1e1b4b] to-[#0a0d18] text-white relative overflow-hidden landing-noise border-t border-indigo-950"
    >
      {/* Ambient Breathing Radial Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[650px] h-[650px] bg-gradient-to-tr from-indigo-500/20 to-purple-600/20 rounded-full blur-3xl pointer-events-none -z-10" />

      <div ref={contentRef} className="max-w-3xl mx-auto text-center relative z-10">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 text-indigo-200 text-xs font-bold mb-8 border border-white/15 backdrop-blur-md">
          <Sparkles className="w-3.5 h-3.5 text-indigo-300" />
          Rapid 24–48 Hour Campus Provisioning
        </div>

        <h2 className="text-3xl sm:text-5xl font-black text-white mb-5 tracking-tight leading-tight">
          Ready to streamline your institution's operations?
        </h2>

        <p className="text-base sm:text-lg text-indigo-200/90 mb-10 max-w-2xl mx-auto leading-relaxed font-normal">
          Launch a 14-day institutional trial with full administrative modules. Isolated database partition. Zero payment card required.
        </p>

        <div className="flex flex-wrap gap-4 justify-center">
          <button
            onClick={() => navigate('/register/tenant')}
            className="px-9 py-4 bg-white text-indigo-950 rounded-xl hover:bg-indigo-50 transition-all font-bold text-base flex items-center gap-2.5 shadow-2xl shadow-white/20 active:scale-[0.98] hover:-translate-y-0.5 landing-glow-pulse"
          >
            Start Free Trial
            <ArrowRight className="w-4 h-4" />
          </button>
          <button
            onClick={openRoleModal}
            className="px-8 py-4 border border-indigo-300/40 text-white hover:bg-white/10 rounded-xl transition-all font-semibold text-base active:scale-[0.98]"
          >
            Explore Live Demo Role
          </button>
        </div>

        <p className="mt-10 text-xs text-indigo-300/70">
          Need custom multi-campus governance or bespoke SIS integration?{' '}
          <span
            onClick={() => navigate('/register/tenant?plan=enterprise')}
            className="text-white underline cursor-pointer hover:text-indigo-200 font-semibold"
          >
            Talk to our technical engineering team
          </span>
        </p>
      </div>
    </section>
  );
};

// ==========================================
// 10. FOOTER
// ==========================================
const Footer = ({ scrollToSection, navigate }) => {
  return (
    <footer className="bg-[#080d1a] text-slate-400 py-16 px-4 sm:px-6 lg:px-8 border-t border-slate-800/80">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-12 gap-8 lg:gap-12">
          {/* Brand Col */}
          <div className="col-span-2 md:col-span-4">
            <div
              className="flex items-center gap-2.5 mb-4 cursor-pointer"
              onClick={() => scrollToSection('hero')}
            >
              <div className="w-8 h-8 bg-indigo-600 rounded-xl flex items-center justify-center shadow-md">
                <GraduationCap className="w-4 h-4 text-white" />
              </div>
              <span className="text-xl font-extrabold text-white tracking-tight">AttendEase</span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed max-w-xs">
              Institutional precision ERP for universities, colleges, and academic networks. Multi-tenant, automated attendance, and audit-compliant governance.
            </p>
          </div>

          {/* Platform Navigation */}
          <div className="col-span-1 md:col-span-2">
            <h4 className="font-bold text-slate-200 text-xs uppercase tracking-wider mb-4 font-mono">
              Platform
            </h4>
            <ul className="space-y-2.5 text-xs">
              <li>
                <button onClick={() => scrollToSection('platform')} className="hover:text-white transition">
                  Attendance Engine
                </button>
              </li>
              <li>
                <button onClick={() => scrollToSection('platform')} className="hover:text-white transition">
                  Exams & Grading
                </button>
              </li>
              <li>
                <button onClick={() => scrollToSection('platform')} className="hover:text-white transition">
                  Fee Ledgers
                </button>
              </li>
              <li>
                <button onClick={() => scrollToSection('demo')} className="hover:text-white transition">
                  Role Sandboxes
                </button>
              </li>
              <li>
                <button onClick={() => scrollToSection('pricing')} className="hover:text-white transition">
                  Institutional Plans
                </button>
              </li>
            </ul>
          </div>

          {/* Resources */}
          <div className="col-span-1 md:col-span-2">
            <h4 className="font-bold text-slate-200 text-xs uppercase tracking-wider mb-4 font-mono">
              Resources
            </h4>
            <ul className="space-y-2.5 text-xs">
              <li>
                <button onClick={() => scrollToSection('how-it-works')} className="hover:text-white transition">
                  How It Works
                </button>
              </li>
              <li>
                <button onClick={() => scrollToSection('credibility')} className="hover:text-white transition">
                  Proof Points
                </button>
              </li>
              <li>
                <button onClick={() => navigate('/login')} className="hover:text-white transition">
                  Sign In
                </button>
              </li>
              <li>
                <button onClick={() => navigate('/register/tenant')} className="hover:text-white transition">
                  Register Campus
                </button>
              </li>
            </ul>
          </div>

          {/* Back to top */}
          <div className="col-span-2 md:col-span-4 flex flex-col justify-end">
            <button
              onClick={() => scrollToSection('hero')}
              className="inline-flex items-center gap-2 text-xs text-slate-400 hover:text-indigo-400 transition-colors self-start md:self-end"
            >
              <ArrowUp className="w-3.5 h-3.5" />
              Back to top
            </button>
          </div>
        </div>

        <div className="border-t border-slate-800 mt-12 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <p>&copy; {new Date().getFullYear()} AttendEase Platforms. All rights reserved.</p>
          <div className="flex gap-6">
            <span className="hover:text-slate-300 cursor-pointer">Privacy Framework</span>
            <span className="hover:text-slate-300 cursor-pointer">Terms of Service</span>
            <span className="hover:text-slate-300 cursor-pointer">Security Whitepaper</span>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default LandingPage;