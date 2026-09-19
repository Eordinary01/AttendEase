// src/components/Landing/LandingPage.jsx
// Aligned with docs/LANDING_PAGE_DESIGN_SPEC.md
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
} from 'lucide-react';
import RoleSelectorModal from './RoleSelectorModal';
import { useDemo } from '../../contexts/DemoContext';
import api from '../../utils/api';

gsap.registerPlugin(ScrollTrigger);

// ==========================================
// 0. WELCOME AND ENTRANCE SEQUENCE (Spec §4.2 & §7)
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
          setTimeout(() => {
            ScrollTrigger.refresh();
          }, 50);
        },
      });

      // 1. Welcome screen appears: calm first frame with mark and initial title
      tl.fromTo(
        markRef.current,
        { opacity: 0, scale: 0.92 },
        { opacity: 1, scale: 1, duration: 0.45 }
      )
      .fromTo(
        initialFormRef.current,
        { opacity: 0, y: 6 },
        { opacity: 1, y: 0, duration: 0.4 },
        '-=0.2'
      )
      .fromTo(
        tagRef.current,
        { opacity: 0 },
        { opacity: 1, duration: 0.35 },
        '-=0.15'
      )
      // 2. Animated transition of the application name from initial form into final "AttendEase" form
      .to(initialFormRef.current, {
        opacity: 0,
        y: -6,
        duration: 0.35,
        delay: 0.35,
      })
      .fromTo(
        finalFormRef.current,
        { opacity: 0, y: 6, scale: 0.98 },
        { opacity: 1, y: 0, scale: 1, duration: 0.45 },
        '-=0.1'
      )
      // 3. Welcome resolves smoothly into the landing page
      .to(containerRef.current, {
        opacity: 0,
        scale: 1.015,
        duration: 0.5,
        delay: 0.35,
      });
    }, containerRef);

    return () => ctx.revert();
  }, [onComplete]);

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-slate-950 text-white select-none transition-opacity"
      style={{
        backgroundImage: 'radial-gradient(circle, rgba(99,102,241,0.08) 1px, transparent 1px)',
        backgroundSize: '24px 24px',
      }}
      onClick={() => {
        onComplete();
        setTimeout(() => ScrollTrigger.refresh(), 50);
      }}
      role="region"
      aria-label="Welcome Introduction"
    >
      <div className="flex flex-col items-center text-center px-6 max-w-sm">
        {/* Brand emblem */}
        <div
          ref={markRef}
          className="w-16 h-16 bg-indigo-700 border border-indigo-500/40 rounded-2xl flex items-center justify-center mb-5 shadow-2xl shadow-indigo-900/60"
        >
          <GraduationCap className="w-8 h-8 text-white" />
        </div>

        {/* Application Name Transition Container */}
        <div className="relative h-10 w-full flex items-center justify-center mb-2">
          {/* Initial structured identity */}
          <div
            ref={initialFormRef}
            className="absolute inset-0 flex items-center justify-center text-xs uppercase font-semibold tracking-widest text-slate-300"
          >
            Institutional Operations
          </div>

          {/* Final "AttendEase" form */}
          <div
            ref={finalFormRef}
            className="absolute inset-0 flex items-center justify-center text-3xl font-extrabold tracking-tight text-white opacity-0"
          >
            <span className="text-white">Attend</span>
            <span className="text-indigo-400">Ease</span>
          </div>
        </div>

        <p ref={tagRef} className="text-xs text-slate-400 font-medium tracking-wide">
          Academic Platform & Operations
        </p>
      </div>

      <button
        onClick={(e) => {
          e.stopPropagation();
          onComplete();
          setTimeout(() => ScrollTrigger.refresh(), 50);
        }}
        className="absolute bottom-8 text-[11px] text-slate-500 hover:text-slate-300 transition-colors uppercase tracking-widest focus-visible:outline-none focus-visible:underline"
      >
        Skip intro
      </button>
    </div>
  );
};

// ==========================================
// LANDING PAGE — MAIN COMPONENT
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

  return (
    <div className="min-h-screen bg-white text-slate-900 selection:bg-indigo-100 selection:text-indigo-900">
      {/* Welcome and Entrance Sequence */}
      {!welcomeDone && (
        <WelcomeEntrance onComplete={() => setWelcomeDone(true)} />
      )}

      {/* Hero settle + reduced-motion override */}
      <style>{`
        @keyframes settle {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .hero-content  { animation: settle 0.65s ease-out both; }
        .hero-preview  { animation: settle 0.75s ease-out 0.12s both; }
        @media (prefers-reduced-motion: reduce) {
          .hero-content, .hero-preview { animation: none; opacity: 1; transform: none; }
        }
      `}</style>

      <Navbar
        isMenuOpen={isMenuOpen}
        setIsMenuOpen={setIsMenuOpen}
        scrollToSection={scrollToSection}
        navigate={navigate}
        openRoleModal={openRoleModal}
      />
      <HeroSection navigate={navigate} openRoleModal={openRoleModal} />
      <PlatformScopeSection />
      <WhatChangesSection />
      <DemoSandboxSection />
      <PricingSection navigate={navigate} />
      <CredibilitySection />
      <DeploymentSection />
      <FinalActionSection navigate={navigate} openRoleModal={openRoleModal} />
      <Footer scrollToSection={scrollToSection} navigate={navigate} />
      <RoleSelectorModal />
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

  // Restrained scroll-position cue — thin indigo progress bar
  useEffect(() => {
    const bar = progressRef.current;
    if (!bar) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(bar, { width: '0%' }, {
        width: '100%', ease: 'none',
        scrollTrigger: {
          trigger: document.documentElement,
          start: 'top top', end: 'bottom bottom', scrub: 0.15,
        },
      });
    });
    return () => ctx.revert();
  }, []);

  const navLinks = [
    { name: 'Platform', href: 'platform' },
    { name: 'How It Works', href: 'how-it-works' },
    { name: 'Demo', href: 'demo' },
    { name: 'Pricing', href: 'pricing' },
    { name: 'Credibility', href: 'credibility' },
  ];

  return (
    <nav
      className={`fixed w-full z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-white/92 backdrop-blur-md shadow-sm py-3.5 border-b border-slate-100'
          : 'bg-transparent py-5'
      }`}
    >
      {/* Scroll progress */}
      <div
        ref={progressRef}
        className="absolute top-0 left-0 h-[2px] bg-indigo-600 origin-left z-50"
        style={{ width: '0%' }}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center">
          {/* Logo */}
          <div
            className="flex items-center gap-2.5 cursor-pointer"
            onClick={() => scrollToSection('hero')}
          >
            <div className="w-9 h-9 bg-indigo-700 rounded-xl flex items-center justify-center shadow-sm">
              <GraduationCap className="w-5 h-5 text-white" />
            </div>
            <span className="text-lg font-bold text-indigo-900 tracking-tight">
              AttendEase
            </span>
          </div>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-6">
            {navLinks.map((link) => (
              <button
                key={link.name}
                onClick={() => scrollToSection(link.href)}
                className="text-slate-600 hover:text-indigo-700 transition-colors font-medium text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 rounded-md px-1 py-0.5"
              >
                {link.name}
              </button>
            ))}

            <div className="flex items-center gap-2.5 pl-3 border-l border-slate-200">
              <button
                onClick={() => navigate('/login')}
                className="px-3 py-2 text-slate-600 hover:text-indigo-700 transition-all duration-150 active:scale-[0.98] font-medium text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 rounded-md"
              >
                Login
              </button>
              <button
                onClick={openRoleModal}
                className="px-3.5 py-2 text-indigo-700 hover:text-indigo-800 hover:bg-indigo-50/70 border border-indigo-200 rounded-lg transition-all duration-150 active:scale-[0.98] font-semibold text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              >
                See a demo role
              </button>
              <button
                onClick={() => navigate('/register/tenant')}
                className="px-5 py-2 bg-indigo-700 text-white rounded-lg hover:bg-indigo-800 transition-all duration-150 active:scale-[0.98] hover:-translate-y-0.5 shadow-sm hover:shadow font-semibold text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2"
              >
                Start free trial
              </button>
            </div>
          </div>

          {/* Mobile menu toggle */}
          <button
            className="md:hidden p-2.5 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            aria-label="Toggle menu"
          >
            {isMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {isMenuOpen && (
        <div className="md:hidden bg-white/95 backdrop-blur-md border-b border-slate-100 shadow-lg">
          <div className="px-5 py-5 space-y-2">
            {navLinks.map((link) => (
              <button
                key={link.name}
                onClick={() => scrollToSection(link.href)}
                className="block w-full text-left px-4 py-2.5 text-slate-700 font-medium hover:bg-indigo-50 hover:text-indigo-700 rounded-lg transition"
              >
                {link.name}
              </button>
            ))}
            <div className="pt-3 border-t border-slate-100 flex flex-col gap-2">
              <button
                onClick={() => navigate('/login')}
                className="w-full px-4 py-2.5 text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 font-semibold transition-all duration-150 active:scale-[0.98] text-center text-sm"
              >
                Login
              </button>
              <button
                onClick={() => { setIsMenuOpen(false); openRoleModal(); }}
                className="w-full px-4 py-2.5 border border-indigo-200 text-indigo-700 hover:bg-indigo-50 rounded-lg font-semibold transition-all duration-150 active:scale-[0.98] text-center text-sm"
              >
                See a demo role
              </button>
              <button
                onClick={() => navigate('/register/tenant')}
                className="w-full px-4 py-2.5 bg-indigo-700 text-white rounded-lg font-semibold shadow-sm hover:bg-indigo-800 transition-all duration-150 active:scale-[0.98] text-center text-sm"
              >
                Start free trial
              </button>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
};

// ==========================================
// 2. HERO SECTION
// ==========================================
const HeroSection = ({ navigate, openRoleModal }) => {
  const heroRef = useRef(null);
  const headlineRef = useRef(null);
  const subheadRef = useRef(null);
  const buttonsRef = useRef(null);
  const previewRef = useRef(null);

  useEffect(() => {
    if (!heroRef.current) return;

    const ctx = gsap.context(() => {
      // 1. Hero content arrives in a composed sequence (Spec §4a, §7)
      // Headline = opacity + y-translate (reverses on scroll back)
      if (headlineRef.current) {
        gsap.fromTo(
          headlineRef.current,
          { opacity: 0.25, y: 20 },
          {
            opacity: 1,
            y: 0,
            duration: 0.5,
            ease: 'power3.inOut',
            scrollTrigger: {
              trigger: heroRef.current,
              start: 'top 80%',
              toggleActions: 'play reverse play reverse',
            },
          }
        );
      }

      // Subhead = opacity only (reverses on scroll back)
      if (subheadRef.current) {
        gsap.fromTo(
          subheadRef.current,
          { opacity: 0.25 },
          {
            opacity: 1,
            duration: 0.5,
            ease: 'power3.inOut',
            delay: 0.08,
            scrollTrigger: {
              trigger: heroRef.current,
              start: 'top 80%',
              toggleActions: 'play reverse play reverse',
            },
          }
        );
      }

      // Buttons = opacity + stagger (reverses on scroll back)
      if (buttonsRef.current) {
        gsap.fromTo(
          buttonsRef.current.children,
          { opacity: 0.25 },
          {
            opacity: 1,
            duration: 0.45,
            stagger: 0.08,
            ease: 'power3.inOut',
            delay: 0.14,
            scrollTrigger: {
              trigger: heroRef.current,
              start: 'top 80%',
              toggleActions: 'play reverse play reverse',
            },
          }
        );
      }

      // 2. Hero structural visual: paired framing shift as navbar transitions to solid (Spec §4a)
      // §4e Mobile budget: cut below 768px
      if (previewRef.current && (typeof window === 'undefined' || window.innerWidth >= 768)) {
        gsap.to(previewRef.current, {
          y: 12,
          scale: 0.995,
          duration: 0.45,
          ease: 'power3.inOut',
          scrollTrigger: {
            trigger: document.documentElement,
            start: '20px top',
            toggleActions: 'play none none reverse',
          },
        });
      }
    }, heroRef);
    return () => ctx.revert();
  }, []);

  return (
    <section id="hero" ref={heroRef} className="relative pt-28 pb-20 px-4 sm:px-6 lg:px-8 overflow-hidden bg-white">
      {/* Structured ambient element — subtle dot grid */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(55,48,163,0.035) 1px, transparent 1px)',
          backgroundSize: '22px 22px',
        }}
      />

      <div className="max-w-7xl mx-auto relative z-10">
        <div className="grid lg:grid-cols-12 gap-12 lg:gap-10 items-center">
          {/* Left — Pitch (composed sequence arrival per Spec §7) */}
          <div className="lg:col-span-6 text-left hero-content">
            <p className="text-sm font-medium text-indigo-600 mb-4 tracking-wide">
              Institutional Operations, Centralized
            </p>

            <h1
              ref={headlineRef}
              className="text-3xl sm:text-4xl xl:text-[2.65rem] font-bold text-slate-900 mb-5 leading-snug tracking-tight"
            >
              Run your institution from one place — mark attendance in seconds, run exams, collect fees, publish timetables, and keep parents informed without extra tools.
            </h1>

            <p
              ref={subheadRef}
              className="text-base sm:text-lg text-slate-600 mb-8 max-w-xl leading-relaxed"
            >
              Built for institutions that want their academic operations on a single, modern ERP instead of a pile of disconnected software.
            </p>

            <div ref={buttonsRef} className="flex flex-wrap gap-3">
              {/* Primary button: fill shift + y-translate (§4a, §4c) */}
              <button
                onClick={() => navigate('/register/tenant')}
                className="px-7 py-3.5 bg-indigo-700 hover:bg-indigo-800 text-white rounded-lg transition-all duration-150 active:scale-[0.98] active:translate-y-0 hover:-translate-y-0.5 shadow-md hover:shadow-lg font-semibold flex items-center gap-2 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2"
              >
                Start free trial
                <ArrowRight className="w-4 h-4" />
              </button>
              {/* Secondary button: border/color shift only, no translate (§4a, §4c) */}
              <button
                onClick={openRoleModal}
                className="px-6 py-3.5 text-indigo-700 border border-indigo-200 hover:border-indigo-300 hover:bg-indigo-50/70 rounded-lg transition-colors duration-150 active:scale-[0.98] font-semibold text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
              >
                See a demo role
              </button>
            </div>
          </div>

          {/* Right — Product Preview (Mini-Dashboard) */}
          <div ref={previewRef} className="lg:col-span-6 hero-preview">
            <div className="relative w-full bg-slate-900 rounded-2xl p-2.5 shadow-xl border border-slate-800">
              {/* Window chrome */}
              <div className="bg-slate-800 rounded-xl px-4 py-3 border-b border-slate-700/60 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-rose-400/80" />
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-400/80" />
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-400/80" />
                  <span className="ml-2 text-xs font-medium text-slate-400 flex items-center gap-1.5">
                    <GraduationCap className="w-3.5 h-3.5 text-indigo-400" />
                    AttendEase · Campus Dashboard
                  </span>
                </div>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-medium border border-emerald-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Live
                </span>
              </div>

              {/* Dashboard content */}
              <div className="bg-slate-950 rounded-xl p-5 border border-slate-800/60 mt-2 space-y-4">
                {/* KPI row */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-slate-900/80 rounded-lg p-3 border border-slate-800">
                    <p className="text-[11px] font-medium text-slate-400">Today's Attendance</p>
                    <p className="text-xl font-bold text-white mt-1">96.4%</p>
                    <span className="text-[10px] text-emerald-400 font-medium">↑ +2.1% vs avg</span>
                  </div>
                  <div className="bg-slate-900/80 rounded-lg p-3 border border-slate-800">
                    <p className="text-[11px] font-medium text-slate-400">Active Sections</p>
                    <p className="text-xl font-bold text-indigo-300 mt-1">48 / 50</p>
                    <span className="text-[10px] text-slate-400 font-medium">Semester 6</span>
                  </div>
                  <div className="bg-slate-900/80 rounded-lg p-3 border border-slate-800">
                    <p className="text-[11px] font-medium text-slate-400">Fee Collection</p>
                    <p className="text-xl font-bold text-amber-300 mt-1">₹4.8M</p>
                    <span className="text-[10px] text-amber-400 font-medium">92% collected</span>
                  </div>
                </div>

                {/* Class roster */}
                <div className="bg-slate-900/60 rounded-lg p-4 border border-slate-800">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Activity className="w-3.5 h-3.5 text-indigo-400" />
                      <span className="text-xs font-semibold text-slate-200">Active Class Rosters</span>
                    </div>
                    <span className="text-[10px] text-slate-500">Period 3 · 10:00 – 11:00 AM</span>
                  </div>
                  <div className="space-y-2">
                    {[
                      { code: 'CS-301', title: 'Data Structures & Algos', present: '58/60', rate: '96.7%', badge: 'Completed', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
                      { code: 'MATH-202', title: 'Discrete Mathematics', present: '54/55', rate: '98.2%', badge: 'Completed', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
                      { code: 'PHYS-101', title: 'Quantum Physics Lab', present: '42/48', rate: '87.5%', badge: 'In Progress', color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
                    ].map((row, idx) => (
                      <div key={idx} className="flex items-center justify-between p-2 rounded-md bg-slate-950/70 border border-slate-800/80 text-xs">
                        <div className="flex items-center gap-2.5">
                          <div className="w-6 h-6 rounded bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center font-bold text-[9px] text-indigo-300">
                            {row.code.split('-')[0]}
                          </div>
                          <div>
                            <p className="font-medium text-slate-200">{row.title}</p>
                            <p className="text-[10px] text-slate-500">{row.code} · Present: {row.present}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2.5">
                          <span className="font-mono font-semibold text-slate-300">{row.rate}</span>
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium border ${row.color}`}>
                            {row.badge}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between pt-1">
                  <span className="text-[10px] text-slate-500 flex items-center gap-1.5">
                    <Shield className="w-3 h-3 text-indigo-400" />
                    Automated biometric & QR verification active
                  </span>
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
// 3. PLATFORM SCOPE — Bento layout
// ==========================================
const PlatformScopeSection = () => {
  const scopeRef = useRef(null);
  const featuredBlockRef = useRef(null);
  const cardsRef = useRef([]);
  const progressBarRef = useRef(null);

  useEffect(() => {
    if (!scopeRef.current) return;
    // §4e Mobile budget: cut below 768px
    if (typeof window !== 'undefined' && window.innerWidth < 768) return;

    const ctx = gsap.context(() => {
      // 1. Featured block (Attendance): Position + scale entrance (Spec §4a)
      if (featuredBlockRef.current) {
        gsap.fromTo(
          featuredBlockRef.current,
          { y: 24, scale: 0.96, opacity: 0.6 },
          {
            y: 0,
            scale: 1,
            opacity: 1,
            duration: 0.5,
            ease: 'power3.inOut',
            scrollTrigger: {
              trigger: featuredBlockRef.current,
              start: 'top 80%',
              toggleActions: 'play reverse play reverse',
            },
          }
        );
      }

      // 2. Smaller module cards: Opacity + y-translate with slight per-card offset/timing variation (Spec §4a)
      const offsets = [18, 24, 20, 26, 22];
      cardsRef.current.forEach((card, idx) => {
        if (!card) return;
        gsap.fromTo(
          card,
          { opacity: 0.25, y: offsets[idx % offsets.length] },
          {
            opacity: 1,
            y: 0,
            duration: 0.44 + idx * 0.02,
            ease: 'power3.inOut',
            scrollTrigger: {
              trigger: card,
              start: 'top 85%',
              toggleActions: 'play reverse play reverse',
            },
          }
        );
      });

      // 3. Attendance session progress bar state swap
      if (progressBarRef.current) {
        gsap.fromTo(
          progressBarRef.current,
          { width: '15%' },
          {
            width: '98%',
            duration: 0.5,
            ease: 'power3.inOut',
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

  return (
    <section id="platform" ref={scopeRef} className="py-20 px-4 sm:px-6 lg:px-8 bg-white border-t border-slate-100">
      <div className="max-w-7xl mx-auto">
        <div className="mb-14 max-w-2xl">
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight leading-snug">
            What AttendEase covers
          </h2>
          <p className="mt-3 text-base text-slate-600 leading-relaxed">
            Six modules that run as one system, not six disconnected tools bolted together.
          </p>
        </div>

        {/* Bento grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-5">
          {/* Attendance — featured block (position + scale) */}
          <div
            ref={featuredBlockRef}
            className="md:col-span-7 md:row-span-2 bg-slate-900 rounded-2xl p-7 sm:p-8 text-white relative overflow-hidden"
          >
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-1">
                <Users className="w-5 h-5 text-indigo-300" />
                <span className="text-xs font-semibold text-indigo-300 uppercase tracking-wider">Attendance</span>
              </div>
              <h3 className="text-xl sm:text-2xl font-bold text-white mb-3">
                Subject-wise attendance marked in under 30 seconds
              </h3>
              <p className="text-slate-300 text-sm leading-relaxed mb-6 max-w-lg">
                Faculty mark attendance per subject with biometric or QR verification. Absent students trigger automatic SMS to parents within seconds. Every record is audit-logged.
              </p>

              {/* Mini attendance session UI */}
              <div className="bg-slate-800/80 rounded-xl p-4 border border-slate-700/60">
                <div className="flex items-center justify-between pb-2 text-xs mb-2">
                  <span className="font-semibold text-slate-200">CS-301 Attendance Session</span>
                  <span className="text-emerald-400 font-medium">98% Verified</span>
                </div>
                {/* Scroll-driven verified progress indicator */}
                <div className="w-full bg-slate-700/60 rounded-full h-1.5 mb-3 overflow-hidden">
                  <div
                    ref={progressBarRef}
                    className="bg-emerald-400 h-full rounded-full transition-all duration-75"
                    style={{ width: '15%' }}
                  />
                </div>
                <div className="space-y-2 text-xs">
                  {[
                    { name: 'Rahul Sharma (CS-01)', status: 'Present', statusColor: 'bg-emerald-500/15 text-emerald-300' },
                    { name: 'Ananya Verma (CS-02)', status: 'Present', statusColor: 'bg-emerald-500/15 text-emerald-300' },
                    { name: 'Dev Patel (CS-03)', status: 'SMS Sent', statusColor: 'bg-rose-500/15 text-rose-300' },
                  ].map((s, i) => (
                    <div key={i} className="flex items-center justify-between p-2 rounded-md bg-slate-900/60">
                      <span className="text-slate-300">{s.name}</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${s.statusColor}`}>{s.status}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Exams */}
          <div
            ref={(el) => (cardsRef.current[0] = el)}
            className="md:col-span-5 bg-white rounded-xl p-6 border border-slate-200 hover:border-indigo-200 transition-colors"
          >
            <div className="flex items-center gap-2 mb-1">
              <BookOpen className="w-4 h-4 text-indigo-600" />
              <span className="text-xs font-semibold text-indigo-600 uppercase tracking-wider">Exams</span>
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">Automated seating, hall tickets, and grading</h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              Anti-cheating seat allocation across halls. Instant hall ticket generation. SGPA and CGPA calculated automatically from exam results — no spreadsheets.
            </p>
          </div>

          {/* Fees */}
          <div
            ref={(el) => (cardsRef.current[1] = el)}
            className="md:col-span-5 bg-slate-50 rounded-xl p-6 border border-slate-200 hover:border-amber-200 transition-colors"
          >
            <div className="flex items-center gap-2 mb-1">
              <CreditCard className="w-4 h-4 text-amber-600" />
              <span className="text-xs font-semibold text-amber-600 uppercase tracking-wider">Fees</span>
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">Ledger, invoicing, receipts, and installments</h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              Automated invoice generation tied to student enrollment. Track installments, generate receipts, and reconcile collections in one view instead of separate tools.
            </p>
          </div>

          {/* Timetable */}
          <div
            ref={(el) => (cardsRef.current[2] = el)}
            className="md:col-span-4 bg-white rounded-xl p-5 border border-slate-200 hover:border-indigo-200 transition-colors"
          >
            <div className="flex items-center gap-2 mb-1">
              <Calendar className="w-4 h-4 text-indigo-600" />
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Timetable</span>
            </div>
            <h3 className="text-base font-bold text-slate-900 mb-1.5">Schedule generation and faculty assignment</h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              Build multi-semester timetables, assign faculty to subjects and sections, and push changes to all roles instantly.
            </p>
          </div>

          {/* Administration */}
          <div
            ref={(el) => (cardsRef.current[3] = el)}
            className="md:col-span-4 bg-white rounded-xl p-5 border border-slate-200 hover:border-indigo-200 transition-colors"
          >
            <div className="flex items-center gap-2 mb-1">
              <Shield className="w-4 h-4 text-indigo-600" />
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Administration</span>
            </div>
            <h3 className="text-base font-bold text-slate-900 mb-1.5">Departments, permissions, and oversight</h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              Configure departments, academic years, and role-based permissions. Institution owners see everything; faculty see their subjects.
            </p>
          </div>

          {/* Communication */}
          <div
            ref={(el) => (cardsRef.current[4] = el)}
            className="md:col-span-4 bg-white rounded-xl p-5 border border-slate-200 hover:border-amber-200 transition-colors"
          >
            <div className="flex items-center gap-2 mb-1">
              <MessageSquare className="w-4 h-4 text-amber-600" />
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Communication</span>
            </div>
            <h3 className="text-base font-bold text-slate-900 mb-1.5">Parent SMS, notices, and role portals</h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              Automatic absence SMS to parents. Broadcast notices to departments. Each role has a portal with the information they need.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

// ==========================================
// 4. WHAT CHANGES FOR THE INSTITUTION
// ==========================================
const WhatChangesSection = () => {
  const sectionRef = useRef(null);
  const beforeColRef = useRef(null);
  const afterColRef = useRef(null);

  useEffect(() => {
    if (!sectionRef.current || !beforeColRef.current || !afterColRef.current) return;
    // §4e Mobile budget: cut below 768px
    if (typeof window !== 'undefined' && window.innerWidth < 768) return;

    const ctx = gsap.context(() => {
      // Before column: Opacity + x-translate from left (Spec §4a)
      gsap.fromTo(
        beforeColRef.current,
        { opacity: 0.2, x: -36 },
        {
          opacity: 1,
          x: 0,
          duration: 0.5,
          ease: 'power3.inOut',
          scrollTrigger: {
            trigger: sectionRef.current,
            start: 'top 80%',
            toggleActions: 'play reverse play reverse',
          },
        }
      );

      // After column: Opacity + x-translate from right (mirrored, Spec §4a)
      gsap.fromTo(
        afterColRef.current,
        { opacity: 0.2, x: 36 },
        {
          opacity: 1,
          x: 0,
          duration: 0.5,
          ease: 'power3.inOut',
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

  const beforeItems = [
    'Paper registers passed between staff, tallied manually at month-end',
    'Fees tracked in separate receipt books and bank reconciliation spreadsheets',
    'Exam seating done in Excel, hall tickets formatted and printed one at a time',
    'Parents call the office to ask about attendance or fees',
    'Timetable changes communicated through notice boards and WhatsApp groups',
    'No unified view — the principal pieces together reports from five different sources',
  ];

  const afterItems = [
    { role: 'Faculty', text: 'Mark subject attendance in 30 seconds; absent parents notified instantly' },
    { role: 'Admin', text: 'One dashboard shows attendance, fees, exams, and department operations' },
    { role: 'Students', text: 'See real-time attendance stats, lecture schedule, and leave requests on their portal' },
    { role: 'Parents', text: 'Live visibility into attendance, fee dues, and institutional notices — no phone calls' },
    { role: 'Owner', text: 'Multi-tenant control, granular permissions, and complete audit trail across campuses' },
  ];

  return (
    <section id="how-it-works" ref={sectionRef} className="py-20 px-4 sm:px-6 lg:px-8 bg-slate-50 border-t border-slate-100">
      <div className="max-w-7xl mx-auto">
        <div className="mb-12 max-w-2xl">
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight leading-snug">
            What changes when you adopt AttendEase
          </h2>
          <p className="mt-3 text-base text-slate-600 leading-relaxed">
            One system for attendance, exams, fees, timetable, and communication — instead of separate tools and manual tracking.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 md:gap-8">
          {/* Before column (opacity + x from left) */}
          <div ref={beforeColRef} className="bg-white rounded-xl p-6 sm:p-7 border border-slate-200">
            <h3 className="text-sm font-semibold text-amber-700 uppercase tracking-wider mb-5 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              Without AttendEase
            </h3>
            <ul className="space-y-3.5">
              {beforeItems.map((item, i) => (
                <li key={i} className="flex items-start gap-3 text-sm text-slate-600 leading-relaxed">
                  <X className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* After column (opacity + x from right, mirrored) */}
          <div ref={afterColRef} className="bg-indigo-50/70 rounded-xl p-6 sm:p-7 border border-indigo-200 shadow-sm">
            <h3 className="text-sm font-semibold text-indigo-700 uppercase tracking-wider mb-5 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-indigo-600" />
              With AttendEase
            </h3>
            <ul className="space-y-4">
              {afterItems.map((item, i) => (
                <li key={i} className="flex items-start gap-3 text-sm leading-relaxed">
                  <Check className="w-4 h-4 text-indigo-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-indigo-800">{item.role}:</span>{' '}
                    <span className="text-slate-700">{item.text}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
};

// ==========================================
// 5. DEMO SANDBOX SHOWCASE — In-page role switcher
// ==========================================
const DEMO_ROLES = [
  { key: 'admin', name: 'Institution Admin', icon: Shield, color: 'indigo' },
  { key: 'teacher', name: 'Faculty', icon: BookOpen, color: 'indigo' },
  { key: 'student', name: 'Student', icon: GraduationCap, color: 'indigo' },
  { key: 'parent', name: 'Parent', icon: Users, color: 'amber' },
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
      // §4b Easing: power3.inOut, Duration: 400-600ms (0.45s) for layout recomposition
      gsap.fromTo(
        previewContentRef.current,
        { opacity: 0.25, y: 10 },
        { opacity: 1, y: 0, duration: 0.45, ease: 'power3.inOut' }
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
    // §4e Mobile budget: cut below 768px
    if (typeof window !== 'undefined' && window.innerWidth < 768) return;

    const ctx = gsap.context(() => {
      // Demo sandbox section: Opacity + scale entrance as composed preview (Spec §4a)
      gsap.fromTo(
        panelRef.current,
        { opacity: 0.35, scale: 0.97 },
        {
          opacity: 1,
          scale: 1,
          duration: 0.5,
          ease: 'power3.inOut',
          scrollTrigger: {
            trigger: panelRef.current,
            start: 'top 80%',
            toggleActions: 'play reverse play reverse',
          },
        }
      );
    }, panelRef);

    return () => ctx.revert();
  }, []);

  const selectedSlot = slotsStatus[selectedRole];
  const isOccupied = selectedSlot && selectedSlot.isAvailable === false;
  const remainingMin = selectedSlot?.remainingSeconds ? Math.ceil(selectedSlot.remainingSeconds / 60) : null;

  return (
    <section id="demo" ref={sandboxRef} className="py-20 px-4 sm:px-6 lg:px-8 bg-white border-t border-slate-100">
      <div className="max-w-7xl mx-auto">
        <div className="mb-10 max-w-2xl">
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight leading-snug">
            See what each role sees
          </h2>
          <p className="mt-3 text-base text-slate-600 leading-relaxed">
            Each role has its own interface. Switch between them to see how the platform looks for admins, teachers, students, and parents. Then enter the live demo to try it yourself.
          </p>
        </div>

        {/* Role selector bar */}
        <div className="flex flex-wrap gap-2 mb-6">
          {DEMO_ROLES.map((role) => {
            const Icon = role.icon;
            const isSelected = selectedRole === role.key;
            const slot = slotsStatus[role.key];
            const occupied = slot && slot.isAvailable === false;

            return (
              /* §4a: State-driven color/border only (available/occupied/selected). No scale, no bounce. */
              <button
                key={role.key}
                onClick={() => handleRoleSelect(role.key)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors duration-150 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2 ${
                  isSelected
                    ? 'bg-indigo-700 text-white shadow-sm border border-indigo-600'
                    : occupied
                    ? 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-amber-300/60'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200 hover:text-slate-900 border border-slate-200'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{role.name}</span>
                {occupied && (
                  <span className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" title="Slot occupied" />
                )}
              </button>
            );
          })}
        </div>

        {/* Preview panel */}
        <div ref={panelRef} className="bg-slate-900 rounded-2xl p-2.5 shadow-xl border border-slate-800 mb-5">
          {/* Window chrome */}
          <div className="bg-slate-800 rounded-xl px-4 py-2.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-rose-400/80" />
              <div className="w-2.5 h-2.5 rounded-full bg-amber-400/80" />
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-400/80" />
              <span className="ml-2 text-xs font-medium text-slate-400">
                AttendEase · {DEMO_ROLES.find(r => r.key === selectedRole)?.name} View
              </span>
            </div>
            {isOccupied ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <Clock className="w-3 h-3" />
                In use · ~{remainingMin}m left
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                Available
              </span>
            )}
          </div>

          {/* Role-specific preview content */}
          <div ref={previewContentRef} className="bg-slate-950 rounded-xl mt-2 border border-slate-800/60 min-h-[280px] sm:min-h-[320px] overflow-hidden">
            <AnimatePresence mode="wait">
              <motion.div
                key={selectedRole}
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.22, ease: 'easeOut' }}
                className="p-5"
              >
                {selectedRole === 'admin' && <AdminPreview />}
                {selectedRole === 'teacher' && <TeacherPreview />}
                {selectedRole === 'student' && <StudentPreview />}
                {selectedRole === 'parent' && <ParentPreview />}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {/* Action */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => claimDemoRole(selectedRole)}
            disabled={isOccupied || loading}
            className={`px-6 py-3 rounded-lg font-semibold text-sm flex items-center gap-2 transition-all duration-150 active:scale-[0.98] active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2 ${
              isOccupied
                ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                : 'bg-indigo-700 text-white hover:bg-indigo-800 shadow-sm hover:shadow hover:-translate-y-0.5'
            }`}
          >
            {loading ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Initializing…
              </>
            ) : isOccupied ? (
              <>
                <Clock className="w-4 h-4" />
                Slot busy · wait ~{remainingMin}m
              </>
            ) : (
              <>
                Enter {DEMO_ROLES.find(r => r.key === selectedRole)?.name} demo
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
          <span className="text-xs text-slate-500">
            15-minute isolated session · no sign-up required
          </span>
        </div>
      </div>
    </section>
  );
};

// --- Role preview sub-components ---

const AdminPreview = () => (
  <div className="space-y-4">
    <div className="flex items-center gap-2 mb-1">
      <Shield className="w-4 h-4 text-indigo-400" />
      <span className="text-xs font-semibold text-slate-300">Campus Overview · Demo Academy</span>
    </div>
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {[
        { label: 'Attendance Today', value: '96.4%', sub: '↑ 2.1% vs avg', subColor: 'text-emerald-400' },
        { label: 'Active Sections', value: '48 / 50', sub: 'Semester 6', subColor: 'text-slate-500' },
        { label: 'Fee Collection', value: '₹4.8M', sub: '92% collected', subColor: 'text-amber-400' },
        { label: 'At-Risk Students', value: '12', sub: '< 75% attendance', subColor: 'text-rose-400' },
      ].map((m, i) => (
        <div key={i} className="bg-slate-900/80 rounded-lg p-3 border border-slate-800">
          <p className="text-[10px] font-medium text-slate-500">{m.label}</p>
          <p className="text-lg font-bold text-white mt-0.5">{m.value}</p>
          <span className={`text-[10px] font-medium ${m.subColor}`}>{m.sub}</span>
        </div>
      ))}
    </div>
    <div className="bg-slate-900/60 rounded-lg p-3.5 border border-slate-800">
      <p className="text-xs font-semibold text-slate-300 mb-2.5">Department Performance</p>
      {[
        { dept: 'Computer Science', rate: '94.2%', w: '94%' },
        { dept: 'Electronics', rate: '91.7%', w: '92%' },
        { dept: 'Mechanical', rate: '89.3%', w: '89%' },
      ].map((d, i) => (
        <div key={i} className="flex items-center gap-3 mb-2 last:mb-0">
          <span className="text-[11px] text-slate-400 w-32 flex-shrink-0">{d.dept}</span>
          <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div className="h-full bg-indigo-500 rounded-full" style={{ width: d.w }} />
          </div>
          <span className="text-[11px] font-mono font-semibold text-slate-300 w-12 text-right">{d.rate}</span>
        </div>
      ))}
    </div>
  </div>
);

const TeacherPreview = () => (
  <div className="space-y-4">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <BookOpen className="w-4 h-4 text-indigo-400" />
        <span className="text-xs font-semibold text-slate-300">CS-301 · Data Structures & Algos</span>
      </div>
      <span className="text-[10px] text-slate-500">Period 3 · 10:00 – 11:00 AM</span>
    </div>
    <div className="bg-slate-900/60 rounded-lg border border-slate-800 overflow-hidden">
      <div className="px-3.5 py-2 bg-slate-800/50 text-[10px] font-semibold text-slate-400 flex items-center justify-between">
        <span>Student Roster (60 enrolled)</span>
        <span className="text-emerald-400">56 Present · 4 Absent</span>
      </div>
      <div className="divide-y divide-slate-800/60">
        {[
          { roll: 'CS-01', name: 'Rahul Sharma', status: 'Present', color: 'text-emerald-400' },
          { roll: 'CS-02', name: 'Ananya Verma', status: 'Present', color: 'text-emerald-400' },
          { roll: 'CS-03', name: 'Dev Patel', status: 'Absent · SMS Sent', color: 'text-rose-400' },
          { roll: 'CS-04', name: 'Priya Nair', status: 'Present', color: 'text-emerald-400' },
          { roll: 'CS-05', name: 'Karan Singh', status: 'Absent · SMS Sent', color: 'text-rose-400' },
        ].map((s, i) => (
          <div key={i} className="flex items-center justify-between px-3.5 py-2 text-xs">
            <div className="flex items-center gap-2.5">
              <span className="text-slate-500 font-mono w-8">{s.roll}</span>
              <span className="text-slate-300">{s.name}</span>
            </div>
            <span className={`text-[10px] font-medium ${s.color}`}>{s.status}</span>
          </div>
        ))}
      </div>
    </div>
    <div className="flex gap-2">
      <span className="px-3 py-1.5 rounded-md bg-indigo-600/20 text-indigo-300 text-[10px] font-semibold border border-indigo-500/20">Mark All Present</span>
      <span className="px-3 py-1.5 rounded-md bg-emerald-600/20 text-emerald-300 text-[10px] font-semibold border border-emerald-500/20">Submit Attendance</span>
    </div>
  </div>
);

const StudentPreview = () => (
  <div className="space-y-4">
    <div className="flex items-center gap-2 mb-1">
      <GraduationCap className="w-4 h-4 text-indigo-400" />
      <span className="text-xs font-semibold text-slate-300">My Attendance · Semester 6</span>
    </div>
    <div className="grid grid-cols-3 gap-3">
      <div className="bg-slate-900/80 rounded-lg p-3 border border-slate-800">
        <p className="text-[10px] text-slate-500">Overall</p>
        <p className="text-lg font-bold text-white">87.5%</p>
      </div>
      <div className="bg-slate-900/80 rounded-lg p-3 border border-slate-800">
        <p className="text-[10px] text-slate-500">Classes Today</p>
        <p className="text-lg font-bold text-white">4</p>
      </div>
      <div className="bg-slate-900/80 rounded-lg p-3 border border-slate-800">
        <p className="text-[10px] text-slate-500">Leaves Taken</p>
        <p className="text-lg font-bold text-amber-300">3 / 8</p>
      </div>
    </div>
    <div className="bg-slate-900/60 rounded-lg p-3.5 border border-slate-800">
      <p className="text-xs font-semibold text-slate-300 mb-2.5">Today's Schedule</p>
      {[
        { time: '09:00', subject: 'Data Structures', status: '✓', statusColor: 'text-emerald-400' },
        { time: '10:00', subject: 'Discrete Mathematics', status: '✓', statusColor: 'text-emerald-400' },
        { time: '11:00', subject: 'Physics Lab', status: '—', statusColor: 'text-slate-500' },
        { time: '14:00', subject: 'Technical English', status: '—', statusColor: 'text-slate-500' },
      ].map((s, i) => (
        <div key={i} className="flex items-center gap-3 mb-1.5 last:mb-0 text-xs">
          <span className="text-slate-500 font-mono w-10">{s.time}</span>
          <span className="text-slate-300 flex-1">{s.subject}</span>
          <span className={`font-semibold ${s.statusColor}`}>{s.status}</span>
        </div>
      ))}
    </div>
  </div>
);

const ParentPreview = () => (
  <div className="space-y-4">
    <div className="flex items-center gap-2 mb-1">
      <Users className="w-4 h-4 text-amber-400" />
      <span className="text-xs font-semibold text-slate-300">Ward: Arjun Mehta · CS-301</span>
    </div>
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      <div className="bg-slate-900/80 rounded-lg p-3 border border-slate-800">
        <p className="text-[10px] text-slate-500">This Week</p>
        <p className="text-lg font-bold text-white">92%</p>
        <span className="text-[10px] text-emerald-400">On track</span>
      </div>
      <div className="bg-slate-900/80 rounded-lg p-3 border border-slate-800">
        <p className="text-[10px] text-slate-500">Fee Status</p>
        <p className="text-lg font-bold text-amber-300">₹45K</p>
        <span className="text-[10px] text-slate-500">of ₹50K paid</span>
      </div>
      <div className="bg-slate-900/80 rounded-lg p-3 border border-slate-800 col-span-2 sm:col-span-1">
        <p className="text-[10px] text-slate-500">Semester</p>
        <p className="text-lg font-bold text-white">6th</p>
        <span className="text-[10px] text-slate-500">Computer Science</span>
      </div>
    </div>
    <div className="bg-slate-900/60 rounded-lg p-3.5 border border-slate-800">
      <p className="text-xs font-semibold text-slate-300 mb-2.5">Recent Activity</p>
      {[
        { day: 'Today', detail: 'Present (4/4 classes)', color: 'text-emerald-400' },
        { day: 'Yesterday', detail: 'Present (5/5 classes)', color: 'text-emerald-400' },
        { day: 'Monday', detail: 'Absent (1 class) · SMS notification sent', color: 'text-rose-400' },
      ].map((a, i) => (
        <div key={i} className="flex items-start gap-3 mb-1.5 last:mb-0 text-xs">
          <span className="text-slate-500 w-16 flex-shrink-0">{a.day}</span>
          <span className={a.color}>{a.detail}</span>
        </div>
      ))}
    </div>
  </div>
);

// ==========================================
// 6. PRICING (Section 6.6)
// ==========================================
const DEFAULT_PLANS = [
  {
    code: 'free',
    name: 'Free',
    description: 'For institutions getting started',
    pricing: { monthly: 0, yearly: 0, currency: 'INR' },
    limits: { maxStudents: 50, maxTeachers: 5, maxAdmins: 1, maxStorageMB: 1024 },
    modules: { attendance: true, timetable: false, examManagement: false, financeManagement: false, parentPortal: false, analytics: false },
    features: [
      { name: 'Core Attendance Tracking', included: true },
      { name: 'Subject-wise Rosters', included: true },
      { name: 'Standard CSV Data Export', included: true },
      { name: 'Community Email Support', included: true },
    ],
    isPopular: false,
    sortOrder: 1,
  },
  {
    code: 'basic',
    name: 'Basic',
    description: 'For small institutions',
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
    description: 'For growing institutions',
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
    description: 'For large institutions & universities',
    pricing: { monthly: 499, yearly: 4999, currency: 'INR' },
    limits: { maxStudents: 10000, maxTeachers: 1000, maxAdmins: 50, maxStorageMB: 512000 },
    modules: { attendance: true, timetable: true, examManagement: true, financeManagement: true, parentPortal: true, analytics: true },
    features: [
      { name: 'Everything in Professional', included: true },
      { name: 'Biometric & Hardware Sync', included: true },
      { name: 'Multi-Campus Tenant Consolidation', included: true },
      { name: 'HR & Library Management', included: true },
      { name: 'Dedicated SLA & Migration Support', included: true },
    ],
    isPopular: false,
    sortOrder: 4,
  },
];

const PricingSection = ({ navigate }) => {
  const [plans, setPlans] = useState(DEFAULT_PLANS);
  const [billingCycle, setBillingCycle] = useState('monthly');
  const pricingRef = useRef(null);
  const recommendedCardRef = useRef(null);
  const planCardsRef = useRef([]);

  useEffect(() => {
    let isMounted = true;
    const fetchPricing = async () => {
      try {
        const res = await api.get('/landing/pricing');
        if (isMounted && res.data && res.data.success && Array.isArray(res.data.data) && res.data.data.length > 0) {
          const sorted = [...res.data.data].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
          setPlans(sorted);
        }
      } catch (err) {
        // Fallback to verified DEFAULT_PLANS
      }
    };
    fetchPricing();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!pricingRef.current) return;
    // §4e Mobile budget: cut below 768px
    if (typeof window !== 'undefined' && window.innerWidth < 768) return;

    const ctx = gsap.context(() => {
      // 1. Differentiated 4 plan cards entrance (Spec §4a)
      // Each card has its own slight variation in timing/offset
      const cardOffsets = [18, 24, 30, 22];
      const cardDurations = [0.44, 0.48, 0.52, 0.46];

      planCardsRef.current.forEach((card, i) => {
        if (!card) return;
        gsap.fromTo(
          card,
          { opacity: 0.25, y: cardOffsets[i % cardOffsets.length] },
          {
            opacity: 1,
            y: 0,
            duration: cardDurations[i % cardDurations.length],
            ease: 'power3.inOut',
            scrollTrigger: {
              trigger: card,
              start: 'top 85%',
              toggleActions: 'play reverse play reverse',
            },
          }
        );
      });

      // 2. Recommended plan: one-time emphasis settle (Spec §4a, §4b back.out(1.2), 250-350ms)
      if (recommendedCardRef.current) {
        gsap.fromTo(
          recommendedCardRef.current,
          { scale: 0.99, borderColor: 'rgba(226, 232, 240, 1)' },
          {
            scale: 1,
            borderColor: 'rgba(245, 158, 11, 0.9)',
            duration: 0.3,
            ease: 'back.out(1.2)',
            scrollTrigger: {
              trigger: recommendedCardRef.current,
              start: 'top 75%',
              toggleActions: 'play reverse play reverse',
            },
          }
        );
      }
    }, pricingRef);
    return () => ctx.revert();
  }, [plans]);

  const formatStorage = (mb) => {
    if (mb >= 1024) return `${Math.round(mb / 1024)} GB`;
    return `${mb} MB`;
  };

  const formatLimit = (count) => {
    if (count === undefined || count === null) return 'Unlimited';
    return count.toLocaleString();
  };

  const getPlanFit = (plan) => {
    const code = (plan.code || plan.name || '').toLowerCase();
    if (code.includes('free')) return 'For institutions getting started with core attendance';
    if (code.includes('basic')) return 'For small institutions and growing academies';
    if (code.includes('prof')) return 'For growing institutions needing a complete ERP';
    if (code.includes('enter')) return 'For universities & multi-campus networks';
    return plan.description || 'Standard institutional deployment';
  };

  const getPlanFeatures = (plan) => {
    if (Array.isArray(plan.features) && plan.features.length > 0) {
      const included = plan.features.filter((f) => f.included !== false).map((f) => f.name);
      if (included.length >= 3) return included.slice(0, 5);
    }
    const code = (plan.code || plan.name || '').toLowerCase();
    if (code.includes('free')) {
      return [
        'Core Attendance Tracking',
        'Subject-wise Rosters',
        'Standard CSV Data Export',
        'Community Email Support',
      ];
    }
    if (code.includes('basic')) {
      return [
        'Full Attendance & Timetables',
        'Exam Management & Grades',
        'Department Analytics',
        'Priority Email Support',
      ];
    }
    if (code.includes('prof')) {
      return [
        'Everything in Basic',
        'Parent Portal & Instant SMS',
        'Fee Collection & Dues Tracking',
        'Custom Roles & Granular RBAC',
        'API Access & Webhooks',
      ];
    }
    if (code.includes('enter')) {
      return [
        'Everything in Professional',
        'Biometric & Hardware Sync',
        'Multi-Campus Consolidation',
        'HR & Library Management',
        'Dedicated SLA & Migration Support',
      ];
    }
    return ['Core Platform Access', 'Basic Analytics', 'Standard Support'];
  };

  return (
    <section id="pricing" ref={pricingRef} className="py-20 px-4 sm:px-6 lg:px-8 bg-white border-t border-slate-100">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-10">
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight leading-snug">
            Transparent institutional plans
          </h2>
          <p className="mt-3 text-base text-slate-600 leading-relaxed">
            Straightforward pricing tailored to institutional size and operational requirements — from standalone schools to multi-campus networks.
          </p>
        </div>

        {/* Billing cycle toggle */}
        <div className="flex items-center justify-center mb-12">
          <div className="inline-flex p-1 bg-slate-100 rounded-lg border border-slate-200">
            <button
              onClick={() => setBillingCycle('monthly')}
              className={`px-4 py-2 text-xs font-semibold rounded-md transition-all duration-150 active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 ${
                billingCycle === 'monthly'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Monthly billing
            </button>
            <button
              onClick={() => setBillingCycle('yearly')}
              className={`px-4 py-2 text-xs font-semibold rounded-md transition-all duration-150 active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 flex items-center gap-1.5 ${
                billingCycle === 'yearly'
                  ? 'bg-indigo-700 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Annual billing
              <span
                className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                  billingCycle === 'yearly'
                    ? 'bg-indigo-800 text-amber-300'
                    : 'bg-amber-100 text-amber-800'
                }`}
              >
                Save ~16%
              </span>
            </button>
          </div>
        </div>

        {/* Plan Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-stretch">
          {plans.map((plan, index) => {
            const isRecommended = Boolean(
              plan.isPopular || (plan.code && plan.code.toLowerCase() === 'professional')
            );
            const monthlyPrice = plan.pricing?.monthly ?? 0;
            const yearlyPrice = plan.pricing?.yearly ?? 0;
            const isFree = monthlyPrice === 0 && yearlyPrice === 0;

            const displayPrice = isFree
              ? '₹0'
              : billingCycle === 'monthly'
              ? `₹${monthlyPrice}`
              : `₹${yearlyPrice.toLocaleString()}`;

            const billingPeriod = isFree
              ? 'forever free'
              : billingCycle === 'monthly'
              ? '/ month'
              : '/ year';

            return (
              <div
                key={plan.code || plan._id || plan.name}
                ref={(el) => {
                  planCardsRef.current[index] = el;
                  if (isRecommended) recommendedCardRef.current = el;
                }}
                className={`rounded-xl p-6 transition-all duration-200 flex flex-col justify-between relative ${
                  isRecommended
                    ? 'border-2 border-amber-400/90 bg-white shadow-md ring-1 ring-amber-400/40'
                    : 'border border-slate-200 bg-white hover:border-slate-300 shadow-sm'
                }`}
              >
                {/* Recommended Badge */}
                {isRecommended && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 bg-amber-500 text-slate-950 font-bold text-[10px] rounded-full uppercase tracking-wider shadow-sm whitespace-nowrap">
                    Recommended
                  </div>
                )}

                <div>
                  {/* Plan Name & Target fit */}
                  <div className="mb-4">
                    <h3 className="text-lg font-bold text-slate-900">{plan.name}</h3>
                    <p className="text-xs text-slate-500 mt-1 min-h-[32px] leading-relaxed">
                      {getPlanFit(plan)}
                    </p>
                  </div>

                  {/* Price */}
                  <div className="mb-5 pb-5 border-b border-slate-100">
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-extrabold text-slate-900 tracking-tight">
                        {displayPrice}
                      </span>
                      <span className="text-xs font-medium text-slate-500">{billingPeriod}</span>
                    </div>
                    {!isFree && billingCycle === 'yearly' && (
                      <p className="text-[11px] text-amber-700 font-medium mt-1">
                        Effective ₹{Math.round(yearlyPrice / 12)}/mo billed annually
                      </p>
                    )}
                    {isFree && (
                      <p className="text-[11px] text-slate-400 mt-1">
                        No credit card required
                      </p>
                    )}
                  </div>

                  {/* Limits */}
                  <div className="space-y-2 py-3 border-b border-slate-100 mb-5 text-xs">
                    <div className="flex items-center justify-between text-slate-600">
                      <span className="text-slate-500">Max Students</span>
                      <span className="font-semibold text-slate-900">
                        {formatLimit(plan.limits?.maxStudents)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-slate-600">
                      <span className="text-slate-500">Max Faculty</span>
                      <span className="font-semibold text-slate-900">
                        {formatLimit(plan.limits?.maxTeachers)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-slate-600">
                      <span className="text-slate-500">Admin Seats</span>
                      <span className="font-semibold text-slate-900">
                        {formatLimit(plan.limits?.maxAdmins)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-slate-600">
                      <span className="text-slate-500">Cloud Storage</span>
                      <span className="font-semibold text-slate-900">
                        {formatStorage(plan.limits?.maxStorageMB)}
                      </span>
                    </div>
                  </div>

                  {/* Modules & Capabilities */}
                  <div className="space-y-2.5 mb-6">
                    <p className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">
                      Included Modules
                    </p>
                    {getPlanFeatures(plan).map((feat, idx) => (
                      <div key={idx} className="flex items-start gap-2 text-xs text-slate-700">
                        <Check
                          className={`w-3.5 h-3.5 mt-0.5 flex-shrink-0 ${
                            isRecommended ? 'text-amber-600 font-bold' : 'text-indigo-600'
                          }`}
                        />
                        <span className="leading-snug">{feat}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Call to action button */}
                <div className="pt-2">
                  <button
                    onClick={() =>
                      navigate(`/register/tenant?plan=${(plan.code || plan.name || '').toLowerCase()}`)
                    }
                    className={`w-full py-2.5 px-4 rounded-lg text-xs font-semibold transition-all duration-150 text-center active:scale-[0.98] hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2 ${
                      isRecommended
                        ? 'bg-indigo-700 hover:bg-indigo-800 text-white shadow-sm'
                        : 'bg-slate-50 hover:bg-indigo-50 text-slate-800 hover:text-indigo-700 border border-slate-200'
                    }`}
                  >
                    {plan.code === 'enterprise'
                      ? 'Contact enterprise team'
                      : isFree
                      ? 'Start free plan'
                      : 'Start 14-day trial'}
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
// 7. CREDIBILITY / EVIDENCE
// ==========================================
const CredibilitySection = () => {
  const sectionRef = useRef(null);
  const pointsRef = useRef([]);

  const proofPoints = [
    { value: '6', label: 'Modules', detail: 'Attendance, Exams, Fees, Timetable, Administration, Communication' },
    { value: '4', label: 'Role interfaces', detail: 'Admin, Teacher, Student, Parent — each with its own portal' },
    { value: '< 30s', label: 'Attendance marking', detail: 'Subject-wise with biometric or QR verification per class' },
    { value: 'Instant', label: 'Parent alerts', detail: 'Automatic SMS on absence — no manual follow-up needed' },
    { value: '✓', label: 'Multi-tenant', detail: 'Each institution gets isolated data, permissions, and branding' },
    { value: '✓', label: 'Audit-logged', detail: 'Every attendance record, fee transaction, and grade change is traceable' },
  ];

  useEffect(() => {
    if (!sectionRef.current) return;
    // §4e Mobile budget: cut below 768px
    if (typeof window !== 'undefined' && window.innerWidth < 768) return;

    const ctx = gsap.context(() => {
      // Credibility proof points: pure Opacity entrance with per-item timing variation (Spec §4a, §6.7)
      const durations = [0.42, 0.46, 0.50, 0.44, 0.48, 0.52];
      pointsRef.current.forEach((point, i) => {
        if (!point) return;
        gsap.fromTo(
          point,
          { opacity: 0.2 },
          {
            opacity: 1,
            duration: durations[i % durations.length],
            ease: 'power3.inOut',
            scrollTrigger: {
              trigger: point,
              start: 'top 85%',
              toggleActions: 'play reverse play reverse',
            },
          }
        );

        // Subtle value settle as part of the entrance (Spec §6.7)
        const valEl = point.querySelector('.proof-value');
        if (valEl) {
          gsap.fromTo(
            valEl,
            { opacity: 0.4, y: 4 },
            {
              opacity: 1,
              y: 0,
              duration: 0.42,
              ease: 'power3.inOut',
              delay: 0.06,
              scrollTrigger: {
                trigger: point,
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
    <section id="credibility" ref={sectionRef} className="py-20 px-4 sm:px-6 lg:px-8 bg-slate-50 border-t border-slate-100">
      <div className="max-w-7xl mx-auto">
        <div className="mb-12 max-w-2xl">
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight leading-snug">
            What AttendEase delivers
          </h2>
          <p className="mt-3 text-base text-slate-600 leading-relaxed">
            Product proof points — what the platform actually does, not aspirational marketing.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {proofPoints.map((point, i) => (
            <div
              key={i}
              ref={(el) => (pointsRef.current[i] = el)}
              className="bg-white rounded-xl p-5 border border-slate-200"
            >
              <div className="flex items-baseline gap-2 mb-1.5">
                <span className="proof-value text-2xl font-bold text-indigo-700">{point.value}</span>
                <span className="text-sm font-semibold text-slate-800">{point.label}</span>
              </div>
              <p className="text-sm text-slate-600 leading-relaxed">{point.detail}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

// ==========================================
// 7. DEPLOYMENT, SECURITY & OPERATIONAL CONFIDENCE
// ==========================================
const DeploymentSection = () => {
  const [openIndex, setOpenIndex] = useState(null);
  const sectionRef = useRef(null);
  const headersRef = useRef([]);

  const items = [
    {
      question: 'How is institutional data isolated?',
      answer: 'Each institution operates on a tenant-isolated database with dedicated schemas. No institution can access another\'s data. All operations are scoped to the tenant context at the API level.',
      icon: Lock,
    },
    {
      question: 'What encryption and backup protections exist?',
      answer: '256-bit AES encryption at rest and TLS 1.3 in transit. Automated daily backups with point-in-time recovery capability. Backup integrity is verified on a rolling schedule.',
      icon: Shield,
    },
    {
      question: 'How does onboarding work?',
      answer: 'Institutions are provisioned within 24–48 hours. Existing student, faculty, subject, and timetable records can be imported via CSV or Excel with automatic validation and duplicate detection.',
      icon: Upload,
    },
    {
      question: 'What role-based access controls are available?',
      answer: 'Granular permissions for Super Admin, Institution Admin, Faculty, Students, and Parents. Each role sees only what it should. Custom permission sets can be configured per institution.',
      icon: Users,
    },
    {
      question: 'What support and SLA is included?',
      answer: 'Starter plans include 24–48 hour email support. Professional and Enterprise tiers receive priority response windows (under 4 hours) with dedicated onboarding assistance and an account manager.',
      icon: Headphones,
    },
  ];

  useEffect(() => {
    if (!sectionRef.current) return;
    // §4e Mobile budget: cut below 768px
    if (typeof window !== 'undefined' && window.innerWidth < 768) return;

    const ctx = gsap.context(() => {
      // Accordion header row entrance on view enter with slight per-row variation (Spec §4a)
      const offsets = [14, 20, 16, 22, 18];
      headersRef.current.forEach((row, i) => {
        if (!row) return;
        gsap.fromTo(
          row,
          { opacity: 0.25, y: offsets[i % offsets.length] },
          {
            opacity: 1,
            y: 0,
            duration: 0.44 + i * 0.02,
            ease: 'power3.inOut',
            scrollTrigger: {
              trigger: row,
              start: 'top 85%',
              toggleActions: 'play reverse play reverse',
            },
          }
        );
      });
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section ref={sectionRef} className="py-20 px-4 sm:px-6 lg:px-8 bg-white border-t border-slate-100">
      <div className="max-w-3xl mx-auto">
        <div className="mb-12">
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight leading-snug">
            Deployment, security, and operations
          </h2>
          <p className="mt-3 text-base text-slate-600 leading-relaxed">
            Answers to the questions institution owners ask before running their campus on a new platform.
          </p>
        </div>

        <div className="space-y-3">
          {items.map((item, index) => {
            const isOpen = openIndex === index;
            const Icon = item.icon;
            return (
              <div
                key={index}
                ref={(el) => (headersRef.current[index] = el)}
                className="bg-slate-50 rounded-xl border border-slate-200 overflow-hidden"
              >
                <button
                  className="w-full px-5 py-4 text-left font-semibold text-slate-900 hover:bg-slate-100/60 flex items-center gap-3 transition-colors text-sm"
                  onClick={() => setOpenIndex(isOpen ? null : index)}
                >
                  <Icon className="w-4 h-4 text-indigo-600 flex-shrink-0" />
                  <span className="flex-1">{item.question}</span>
                  <ChevronRight
                    className={`w-4 h-4 text-slate-400 transition-transform duration-200 flex-shrink-0 ${
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
                      transition={{ duration: 0.3, ease: [0.45, 0, 0.55, 1] }}
                      className="overflow-hidden"
                    >
                      <div className="px-5 pb-4 pt-0 text-slate-600 text-sm leading-relaxed border-t border-slate-200/60 ml-7">
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
// 8. FINAL ACTION
// ==========================================
const FinalActionSection = ({ navigate, openRoleModal }) => {
  const sectionRef = useRef(null);
  const contentRef = useRef(null);

  useEffect(() => {
    if (!sectionRef.current || !contentRef.current) return;
    // §4e Mobile budget: cut below 768px
    if (typeof window !== 'undefined' && window.innerWidth < 768) return;

    const ctx = gsap.context(() => {
      // Final action section: Opacity + y-translate as a whole composition (Spec §4a)
      gsap.fromTo(
        contentRef.current,
        { opacity: 0.3, y: 28 },
        {
          opacity: 1,
          y: 0,
          duration: 0.5,
          ease: 'power3.inOut',
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
    <section ref={sectionRef} className="py-20 px-4 sm:px-6 lg:px-8 bg-indigo-900 text-white border-t border-indigo-800">
      {/* Structured ambient element */}
      <div className="relative">
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.04]"
          style={{
            backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.6) 1px, transparent 1px)',
            backgroundSize: '20px 20px',
          }}
        />

        <div ref={contentRef} className="max-w-3xl mx-auto text-center relative z-10">
          <h2 className="text-2xl sm:text-4xl font-bold text-white mb-4 tracking-tight leading-snug">
            Ready to run your institution from one place?
          </h2>

          <p className="text-base sm:text-lg text-indigo-200 mb-8 max-w-2xl mx-auto leading-relaxed">
            Start a 14-day trial with full access to all six modules. No credit card required. Deployment in 24–48 hours.
          </p>

          <div className="flex flex-wrap gap-3 justify-center">
            {/* Primary button: fill shift + y-translate (§4a, §4c) */}
            <button
              onClick={() => navigate('/register/tenant')}
              className="px-7 py-3.5 bg-white text-indigo-800 rounded-lg hover:bg-indigo-50 transition-all duration-150 font-bold text-base flex items-center gap-2 shadow-md active:scale-[0.98] hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-indigo-900"
            >
              Start free trial
              <ArrowRight className="w-4 h-4" />
            </button>
            {/* Secondary button: border/color shift only, no translate (§4a, §4c) */}
            <button
              onClick={openRoleModal}
              className="px-6 py-3.5 border border-indigo-400/40 text-white hover:bg-white/10 rounded-lg transition-colors duration-150 font-semibold text-base active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-indigo-900"
            >
              See a demo role
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};

// ==========================================
// 9. FOOTER
// ==========================================
const Footer = ({ scrollToSection, navigate }) => {
  return (
    <footer className="bg-slate-950 text-slate-400 py-14 px-4 sm:px-6 lg:px-8 border-t border-slate-900">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-12 gap-8 lg:gap-12">
          {/* Brand */}
          <div className="col-span-2 md:col-span-4">
            <div className="flex items-center gap-2.5 mb-3 cursor-pointer" onClick={() => scrollToSection('hero')}>
              <div className="w-8 h-8 bg-indigo-700 rounded-lg flex items-center justify-center">
                <GraduationCap className="w-4 h-4 text-white" />
              </div>
              <span className="text-lg font-bold text-white tracking-tight">AttendEase</span>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed max-w-xs">
              A unified ERP for universities, colleges, and K-12 institutions. Multi-tenant, automated, audit-logged.
            </p>
          </div>

          {/* Platform links */}
          <div className="col-span-1 md:col-span-2">
            <h4 className="font-semibold text-slate-300 text-xs uppercase tracking-wider mb-3">Platform</h4>
            <ul className="space-y-2 text-xs">
              <li><button onClick={() => scrollToSection('platform')} className="hover:text-white transition">Attendance</button></li>
              <li><button onClick={() => scrollToSection('platform')} className="hover:text-white transition">Exams & Grading</button></li>
              <li><button onClick={() => scrollToSection('platform')} className="hover:text-white transition">Fee Management</button></li>
              <li><button onClick={() => scrollToSection('demo')} className="hover:text-white transition">Live Demo</button></li>
              <li><button onClick={() => scrollToSection('pricing')} className="hover:text-white transition">Pricing Plans</button></li>
            </ul>
          </div>

          {/* Resources */}
          <div className="col-span-1 md:col-span-2">
            <h4 className="font-semibold text-slate-300 text-xs uppercase tracking-wider mb-3">Resources</h4>
            <ul className="space-y-2 text-xs">
              <li><button onClick={() => scrollToSection('how-it-works')} className="hover:text-white transition">How It Works</button></li>
              <li><button onClick={() => scrollToSection('credibility')} className="hover:text-white transition">Credibility</button></li>
              <li><button onClick={() => navigate('/login')} className="hover:text-white transition">Portal Login</button></li>
              <li><button onClick={() => navigate('/register/tenant')} className="hover:text-white transition">Register</button></li>
            </ul>
          </div>

          {/* Back to top */}
          <div className="col-span-2 md:col-span-4 flex flex-col justify-end">
            <button
              onClick={() => scrollToSection('hero')}
              className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-indigo-400 transition-colors self-start md:self-end"
            >
              <ArrowUp className="w-3.5 h-3.5" />
              Back to top
            </button>
          </div>
        </div>

        <div className="border-t border-slate-900 mt-10 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
          <p>&copy; {new Date().getFullYear()} AttendEase Platforms. All rights reserved.</p>
          <div className="flex gap-5">
            <span className="hover:text-slate-400 cursor-pointer">Privacy Policy</span>
            <span className="hover:text-slate-400 cursor-pointer">Terms of Service</span>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default LandingPage;