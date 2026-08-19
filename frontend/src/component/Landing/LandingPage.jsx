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
  Loader2
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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-blue-50">
        <div className="w-16 h-16 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <Navbar isMenuOpen={isMenuOpen} setIsMenuOpen={setIsMenuOpen} scrollToSection={scrollToSection} />
      <HeroSection navigate={navigate} />
      <FeaturesSection features={features} />
      <HowItWorksSection />
      <PricingSection plans={plans} navigate={navigate} />
      {/* <TestimonialsSection /> */}
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

// Navbar Component
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
      className={`fixed w-full z-50 transition-all duration-300 ${scrolled ? 'bg-white/80 backdrop-blur-md shadow-sm py-3 border-b border-gray-100' : 'bg-transparent py-5'
        }`}
    >
      {/* Scroll progress bar */}
      <div ref={progressRef} className="absolute top-0 left-0 h-1 bg-gradient-to-r from-purple-600 to-indigo-600 origin-left" style={{ width: "0%" }} />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center">
          <div className="flex items-center cursor-pointer" onClick={() => scrollToSection('hero')}>
            <div className="w-10 h-10 bg-gradient-to-r from-purple-600 to-indigo-600 rounded-xl flex items-center justify-center">
              <GraduationCap className="w-6 h-6 text-white" />
            </div>
            <span className="ml-2 text-xl font-bold bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent">
              AttendEase ERP
            </span>
          </div>

          <div className="hidden md:flex items-center space-x-8">
            {navLinks.map((link) => (
              <button
                key={link.name}
                onClick={() => scrollToSection(link.href)}
                className="text-gray-700 hover:text-purple-600 transition-colors font-medium"
              >
                {link.name}
              </button>
            ))}
            <button
              onClick={() => navigate('/login')}
              className="px-5 py-2 border-2 border-purple-600 text-purple-600 rounded-lg hover:bg-purple-50 transition-colors font-medium"
            >
              Login
            </button>
            <button
              onClick={() => navigate('/register/tenant')}
              className="px-5 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:from-purple-700 hover:to-indigo-700 transition-all font-medium shadow-lg hover:shadow-xl"
            >
              Get Started
            </button>
          </div>

          <button
            className="md:hidden p-2 rounded-lg hover:bg-gray-100"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {isMenuOpen && (
        <div className="md:hidden bg-white shadow-lg">
          <div className="px-4 py-4 space-y-3">
            {navLinks.map((link) => (
              <button
                key={link.name}
                onClick={() => scrollToSection(link.href)}
                className="block w-full text-left px-4 py-2 text-gray-700 hover:bg-purple-50 rounded-lg transition"
              >
                {link.name}
              </button>
            ))}
            <hr className="my-2" />
            <button
              onClick={() => navigate('/login')}
              className="w-full px-4 py-2 text-purple-600 border border-purple-600 rounded-lg hover:bg-purple-50 transition"
            >
              Login
            </button>
            <button
              onClick={() => navigate('/register/tenant')}
              className="w-full px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:from-purple-700 hover:to-indigo-700 transition"
            >
              Get Started
            </button>
          </div>
        </div>
      )}
    </motion.nav>
  );
};

// Hero Section
const HeroSection = ({ navigate }) => {
  const heroRef = useRef(null);

  // Entrance + parallax
  useEffect(() => {
    const ctx = gsap.context(() => {
      // Entrance timeline for left column
      gsap.from(".hero-headline", {
        opacity: 0,
        y: 40,
        duration: 0.9,
        ease: "power3.out",
        stagger: 0.12,
        delay: 0.1,
      });
      // Mockup entrance
      gsap.from(".hero-mockup", {
        opacity: 0,
        y: 60,
        scale: 0.94,
        duration: 1,
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
        yPercent: 20,
        ease: "none",
        scrollTrigger: { trigger: heroRef.current, start: "top top", end: "bottom top", scrub: true },
      });
      gsap.to(".hero-blob-2", {
        yPercent: -20,
        ease: "none",
        scrollTrigger: { trigger: heroRef.current, start: "top top", end: "bottom top", scrub: true },
      });
    }, heroRef.current);
    return () => ctx.revert();
  }, []);

  return (
    <section id="hero" ref={heroRef} className="relative pt-32 pb-20 px-4 overflow-hidden bg-white">
      {/* Animated Background Gradients */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0">
        <div className="hero-blob-1 absolute -top-[20%] -left-[10%] w-[50%] h-[50%] rounded-full bg-purple-200/50 blur-[120px] animate-pulse" />
        <div className="hero-blob-2 absolute top-[20%] -right-[10%] w-[40%] h-[60%] rounded-full bg-indigo-200/50 blur-[120px] animate-pulse delay-700" />
      </div>

      <div className="max-w-7xl mx-auto relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-8 items-center">
          <div>
            <div className="hero-headline inline-flex items-center px-4 py-2 rounded-full bg-purple-50 text-purple-700 text-sm font-semibold mb-6 border border-purple-100 shadow-sm">
              <Sparkles className="w-4 h-4 mr-2 text-purple-500" />
              The Next-Gen Education ERP
            </div>
            <h1 className="hero-headline text-4xl sm:text-5xl lg:text-7xl font-extrabold text-gray-900 mb-6 leading-tight tracking-tight">
              Manage Your Institution with <br className="hidden lg:block" />
              <span className="bg-gradient-to-r from-purple-600 via-indigo-500 to-purple-600 bg-[length:200%_auto] animate-gradient bg-clip-text text-transparent">
                Ease & Efficiency
              </span>
            </h1>
            <p className="hero-headline text-lg sm:text-xl text-gray-600 mb-8 max-w-lg leading-relaxed">
              A comprehensive platform for modern educational institutions. Streamline attendance, exams, fees, and communication.
            </p>
            <div className="hero-headline flex flex-wrap gap-4">
              <button
                onClick={() => navigate('/register/tenant')}
                className="px-8 py-4 bg-gray-900 text-white rounded-xl hover:bg-gray-800 transition-all shadow-xl hover:shadow-2xl hover:-translate-y-1 font-semibold flex items-center gap-2 group w-full sm:w-auto justify-center"
              >
                Start Free Trial
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>
              <button
                onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}
                className="px-8 py-4 bg-white text-gray-900 border border-gray-200 rounded-xl hover:border-gray-300 hover:bg-gray-50 transition-all font-semibold shadow-sm w-full sm:w-auto justify-center"
              >
                Explore Features
              </button>
            </div>
            <div className="hero-headline flex items-center gap-6 mt-10">
              <div className="flex -space-x-4">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className={`w-10 h-10 rounded-full border-2 border-white bg-gradient-to-br from-purple-${(i % 2 === 0 ? 500 : 400)} to-indigo-${(i % 2 !== 0 ? 500 : 400)} flex items-center justify-center`}>
                    <Users className="w-4 h-4 text-white opacity-70" />
                  </div>
                ))}
              </div>
              <div className="text-sm text-gray-600">
                <span className="font-bold text-gray-900">500+</span> institutions onboarded
              </div>
            </div>
          </div>

          <div className="hero-mockup relative lg:h-[600px] flex items-center justify-center">
            {/* Dashboard Mockup Component */}
            <div className="relative w-full max-w-md lg:max-w-none aspect-square md:aspect-video lg:aspect-square bg-gray-50 rounded-2xl border border-gray-200 shadow-2xl overflow-hidden flex flex-col">
              {/* Header */}
              <div className="h-12 border-b border-gray-200 bg-white flex items-center px-4 gap-2">
                <div className="w-3 h-3 rounded-full bg-red-400"></div>
                <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
                <div className="w-3 h-3 rounded-full bg-green-400"></div>
              </div>
              {/* Body */}
              <div className="flex-1 p-6 flex flex-col gap-4 bg-slate-50/50">
                <div className="flex justify-between items-center mb-2">
                  <div className="h-6 w-32 bg-gray-200 rounded-md"></div>
                  <div className="h-8 w-8 bg-purple-100 rounded-full flex items-center justify-center text-purple-600 text-xs font-bold">A</div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="h-24 bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                    <div className="h-4 w-16 bg-gray-100 rounded mb-4"></div>
                    <div className="h-8 w-24 bg-purple-50 rounded"></div>
                  </div>
                  <div className="h-24 bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                    <div className="h-4 w-16 bg-gray-100 rounded mb-4"></div>
                    <div className="h-8 w-24 bg-indigo-50 rounded"></div>
                  </div>
                </div>
                <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-100 p-4 mt-2 relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 to-indigo-500"></div>
                  <div className="space-y-4 mt-4">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="flex gap-4 items-center">
                        <div className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center"><Users className="w-4 h-4 text-gray-400" /></div>
                        <div className="flex-1 space-y-2">
                          <div className="h-2 w-full bg-gray-100 rounded"></div>
                          <div className="h-2 w-2/3 bg-gray-50 rounded"></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Floating badges */}
            <motion.div
              animate={{ y: [0, -10, 0] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              className="hero-float absolute -bottom-6 left-2 sm:-left-6 bg-white rounded-2xl shadow-xl border border-gray-100 p-3 sm:p-4 flex items-center gap-4 z-20"
            >
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-green-100 rounded-full flex items-center justify-center text-green-600">
                <CheckCircle className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <div>
                <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider">Attendance</p>
                <p className="text-lg font-bold text-gray-900">Marked 100%</p>
              </div>
            </motion.div>

            <motion.div
              animate={{ y: [0, 10, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              className="hero-float absolute top-8 right-2 sm:-right-8 bg-white rounded-2xl shadow-xl border border-gray-100 p-3 sm:p-4 flex items-center gap-4 z-20"
            >
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-purple-100 rounded-full flex items-center justify-center text-purple-600">
                <BarChart3 className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <div>
                <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider">Analytics</p>
                <p className="text-lg font-bold text-gray-900">Live Insights</p>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
};

// Features Section
const FeaturesSection = ({ features }) => {
  const defaultFeatures = [
    { name: "Attendance Tracking", description: "Real-time attendance with automated alerts.", icon: <Users className="w-6 h-6" /> },
    { name: "Academic Planning", description: "Schedules, subjects, and curriculum management.", icon: <BookOpen className="w-6 h-6" /> },
    { name: "Fee Management", description: "Automated billing and online payments.", icon: <CreditCard className="w-6 h-6" /> },
    { name: "Live Analytics", description: "Detailed insights into performance and attendance.", icon: <BarChart3 className="w-6 h-6" /> },
    { name: "Secure Access", description: "Role-based access control and data encryption.", icon: <Shield className="w-6 h-6" /> },
    { name: "Mobile App", description: "Access anywhere, anytime on any device.", icon: <Smartphone className="w-6 h-6" /> }
  ];

  const allFeatures = features && typeof features === 'object' ? [
    ...(features.core || []),
    ...(features.academic || []),
    ...(features.finance || []),
    ...(features.communication || []),
    ...(features.analytics || [])
  ] : defaultFeatures;

  const displayFeatures = (allFeatures || []).slice(0, 6);

  const getIcon = (index) => {
    const icons = [
      <Users className="w-6 h-6" />, <BookOpen className="w-6 h-6" />,
      <CreditCard className="w-6 h-6" />, <BarChart3 className="w-6 h-6" />,
      <Shield className="w-6 h-6" />, <Smartphone className="w-6 h-6" />
    ];
    return icons[index % icons.length];
  };

  return (
    <section id="features" className="py-24 px-4 bg-gray-50 border-t border-gray-100">
      <div className="max-w-7xl mx-auto">
        <Reveal className="text-center mb-16">
          <div>
            <h2 className="text-base text-purple-600 font-semibold tracking-wide uppercase">Core Features</h2>
            <p className="mt-2 text-4xl leading-8 font-extrabold tracking-tight text-gray-900 sm:text-5xl">
              Everything you need
            </p>
            <p className="mt-4 max-w-2xl text-xl text-gray-500 mx-auto">
              A complete toolkit designed to automate workflows and empower your educators.
            </p>
          </div>
        </Reveal>

        <Reveal direction="up" stagger={0.1} className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {displayFeatures.map((feature, index) => (
            <div
              key={index}
              className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group"
            >
              <div className="w-14 h-14 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center mb-6 group-hover:bg-purple-600 group-hover:text-white transition-colors duration-300">
                {getIcon(index)}
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3 group-hover:text-purple-600 transition-colors">{feature.name || feature.title}</h3>
              <p className="text-gray-600 leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </Reveal>
      </div>
    </section>
  );
};


// How It Works Section
const HowItWorksSection = () => {
  const steps = [
    {
      step: "01",
      title: "Sign Up",
      description: "Create your institution account and choose your plan",
      icon: <Users className="w-8 h-8" />
    },
    {
      step: "02",
      title: "Setup",
      description: "Add your teachers, students, and subjects",
      icon: <Database className="w-8 h-8" />
    },
    {
      step: "03",
      title: "Start Using",
      description: "Begin marking attendance and managing your institution",
      icon: <Zap className="w-8 h-8" />
    }
  ];

  return (
    <section id="how-it-works" className="py-24 px-4 bg-white relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-purple-50 via-white to-white opacity-60"></div>

      <div className="max-w-7xl mx-auto relative z-10">
        <Reveal className="text-center mb-20">
          <div>
            <h2 className="text-base text-purple-600 font-semibold tracking-wide uppercase">Onboarding</h2>
            <p className="mt-2 text-4xl leading-8 font-extrabold tracking-tight text-gray-900 sm:text-5xl">
              How It Works
            </p>
            <p className="mt-4 max-w-2xl text-xl text-gray-500 mx-auto">
              Get started in just a few simple steps. We've made the transition seamless.
            </p>
          </div>
        </Reveal>

        <Reveal direction="up" stagger={0.15} className="grid md:grid-cols-3 gap-8 relative">
          <div className="hidden md:block absolute top-24 left-[15%] right-[15%] h-0.5 bg-gradient-to-r from-purple-200 via-indigo-200 to-purple-200 z-0"></div>

          {steps.map((step, index) => (
            <div
              key={index}
              className="relative z-10"
            >
              <div className="bg-white rounded-3xl p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 text-center hover:shadow-xl transition-all duration-300 group overflow-hidden">
                <div className="absolute -right-4 -top-4 text-8xl font-black text-gray-50 opacity-50 group-hover:text-purple-50 transition-colors duration-300 select-none">
                  {step.step}
                </div>

                <motion.div
                  whileHover={{ scale: 1.1, rotate: 5 }}
                  className="w-20 h-20 bg-gradient-to-br from-purple-50 to-indigo-50 rounded-2xl flex items-center justify-center mx-auto mb-6 text-purple-600 group-hover:from-purple-600 group-hover:to-indigo-600 group-hover:text-white transition-all duration-500 relative z-10 shadow-sm"
                >
                  {step.icon}
                </motion.div>

                <h3 className="text-2xl font-bold text-gray-900 mb-3 relative z-10">{step.title}</h3>
                <p className="text-gray-600 relative z-10">{step.description}</p>
              </div>
            </div>
          ))}
        </Reveal>
      </div>
    </section>
  );
};

// Pricing Section
const formatPrice = (amount, currency = 'INR') => {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency, minimumFractionDigits: 0 }).format(amount || 0);
};

const PricingSection = ({ plans, navigate }) => {
  const [billingCycle, setBillingCycle] = useState('monthly');

  if (!plans.length) return null;

  return (
    <section id="pricing" className="py-24 px-4 bg-white relative overflow-hidden">
      <div className="absolute top-0 right-0 -mr-20 -mt-20 w-96 h-96 rounded-full bg-purple-50 opacity-50 blur-3xl"></div>

<div className="max-w-7xl mx-auto relative z-10">
        <Reveal className="text-center mb-16">
          <div>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 mb-4 tracking-tight">
              Simple, Transparent Pricing
            </h2>
            <p className="text-lg sm:text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
              Start free and scale as your institution grows. No hidden fees.
            </p>

            <div className="inline-flex items-center bg-gray-100 rounded-full p-1 relative">
              <button
                onClick={() => setBillingCycle('monthly')}
                className={`relative z-10 px-6 sm:px-8 py-3 rounded-full font-semibold text-sm transition-colors duration-300 ${billingCycle === 'monthly' ? 'text-gray-900' : 'text-gray-500 hover:text-gray-900'
                  }`}
              >
                Monthly
              </button>
              <button
                onClick={() => setBillingCycle('yearly')}
                className={`relative z-10 px-6 sm:px-8 py-3 rounded-full font-semibold text-sm transition-colors duration-300 flex items-center gap-2 ${billingCycle === 'yearly' ? 'text-gray-900' : 'text-gray-500 hover:text-gray-900'
                  }`}
              >
                Yearly <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-xs">Save 20%</span>
              </button>
              <motion.div
                className="absolute top-1 bottom-1 bg-white rounded-full shadow-sm"
                initial={false}
                animate={{
                  left: billingCycle === 'monthly' ? '4px' : 'calc(50% + 4px)',
                  width: 'calc(50% - 8px)'
                }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
              />
            </div>
          </div>
        </Reveal>

        <Reveal
          direction="up"
          stagger={0.12}
          start="top 90%"
          className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 max-w-6xl mx-auto sm:items-start"
        >
          {plans.map((plan, index) => (
            <div
              key={plan.code}
              className={`relative bg-white rounded-3xl p-8 transition-all duration-300 ${plan.isPopular
                  ? 'shadow-2xl border-2 border-purple-500 scale-105 z-10'
                  : 'shadow-lg border border-gray-100 hover:shadow-xl'
                }`}
            >
              {plan.isPopular && (
                <div className="absolute -top-4 left-0 right-0 flex justify-center">
                  <span className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-xs font-bold px-4 py-1.5 rounded-full uppercase tracking-wider shadow-md">
                    Most Popular
                  </span>
                </div>
              )}

              <div className="mb-6">
                <h3 className="text-2xl font-bold text-gray-900 mb-2">{plan.name}</h3>
                <p className="text-gray-500 text-sm h-10">{plan.description}</p>
              </div>

              <div className="mb-8">
                  <span className="text-5xl font-extrabold text-gray-900 tracking-tight">
                    {formatPrice(billingCycle === 'monthly' ? plan.pricing.monthly : plan.pricing.yearly, plan.pricing?.currency || 'INR')}
                  </span>
                <span className="text-gray-500 font-medium">/{billingCycle === 'monthly' ? 'mo' : 'yr'}</span>
              </div>

              <button
                onClick={() => navigate('/register/tenant')}
                className={`w-full py-4 rounded-xl font-bold text-sm transition-all mb-8 shadow-sm hover:shadow-md ${plan.isPopular
                    ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:opacity-90 hover:-translate-y-0.5'
                    : 'bg-purple-50 text-purple-700 hover:bg-purple-100 hover:-translate-y-0.5'
                  }`}
              >
                Get Started Free
              </button>

              <div className="space-y-4">
                {plan.features?.map((feature, idx) => (
                  <div key={idx} className="flex items-start gap-3 text-sm text-gray-600">
                    <CheckCircle className="w-5 h-5 text-purple-500 flex-shrink-0 mt-0.5" />
                    <span className="font-medium">{feature.name}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </Reveal>
      </div>
    </section>
  );
};

// // Testimonials Section
// const TestimonialsSection = () => {
//   const testimonials = [
//     {
//       name: "Dr. Sarah Johnson",
//       role: "Principal, Springfield School",
//       content: "AttendEase ERP has transformed how we manage our institution. Attendance tracking is now effortless, and parents love the portal!",
//       rating: 5
//     },
//     {
//       name: "Prof. Michael Chen",
//       role: "Dean of Academics",
//       content: "The analytics dashboard gives us incredible insights into student performance and attendance patterns.",
//       rating: 5
//     },
//     {
//       name: "Lisa Rodriguez",
//       role: "Parent",
//       content: "I can now track my child's attendance and academic progress in real-time. It's been a game-changer!",
//       rating: 5
//     }
//   ];

//   return (
//     <section className="py-20 px-4 bg-gray-50">
//       <div className="max-w-7xl mx-auto">
//         <div className="text-center mb-12">
//           <h2 className="text-4xl font-bold text-gray-900 mb-4">
//             Trusted by Educational Institutions
//           </h2>
//           <p className="text-xl text-gray-600">
//             See what our customers have to say
//           </p>
//         </div>
//         <div className="grid md:grid-cols-3 gap-8">
//           {testimonials.map((testimonial, index) => (
//             <motion.div
//               key={index}
//               initial={{ opacity: 0, y: 20 }}
//               whileInView={{ opacity: 1, y: 0 }}
//               transition={{ delay: index * 0.1 }}
//               viewport={{ once: true }}
//               className="bg-white rounded-xl p-6 shadow-lg"
//             >
//               <div className="flex items-center gap-1 mb-4">
//                 {[...Array(testimonial.rating)].map((_, i) => (
//                   <Star key={i} className="w-5 h-5 text-yellow-400 fill-current" />
//                 ))}
//               </div>
//               <p className="text-gray-600 mb-4 italic">"{testimonial.content}"</p>
//               <div>
//                 <p className="font-semibold text-gray-900">{testimonial.name}</p>
//                 <p className="text-sm text-gray-500">{testimonial.role}</p>
//               </div>
//             </motion.div>
//           ))}
//         </div>
//       </div>
//     </section>
//   );
// };

// Contact & Demo Section (Combined)
const ContactSection = ({
  contactForm, setContactForm, handleContactSubmit, contactSubmitting, contactSuccess,
  demoRequest, setDemoRequest, handleDemoRequest, demoSubmitting, demoSuccess
}) => {
  return (
    <section id="contact" className="py-20 px-4 bg-white">
      <div className="max-w-7xl mx-auto">
        <Reveal className="text-center mb-12">
          <div>
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Get in Touch
            </h2>
            <p className="text-lg sm:text-xl text-gray-600">
              Have questions? We'd love to hear from you
            </p>
          </div>
        </Reveal>

        <Reveal direction="up" stagger={0.15} className="grid lg:grid-cols-2 gap-12 lg:items-start">
          {/* Contact Form */}
          <div className="bg-gray-50 rounded-xl p-8">
            <h3 className="text-2xl font-semibold text-gray-900 mb-4">Contact Us</h3>
            <form onSubmit={handleContactSubmit} className="space-y-4">
              <div>
                <input
                  type="text"
                  placeholder="Your Name *"
                  value={contactForm.name}
                  onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  required
                />
              </div>
              <div>
                <input
                  type="email"
                  placeholder="Email Address *"
                  value={contactForm.email}
                  onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  required
                />
              </div>
              <div>
                <input
                  type="tel"
                  placeholder="Phone Number"
                  value={contactForm.phone}
                  onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
              <div>
                <input
                  type="text"
                  placeholder="Institution Name"
                  value={contactForm.institutionName}
                  onChange={(e) => setContactForm({ ...contactForm, institutionName: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
              <div>
                <textarea
                  placeholder="Your Message *"
                  rows="4"
                  value={contactForm.message}
                  onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  required
                ></textarea>
              </div>
              {contactSuccess === 'success' && (
                <div className="text-green-600 text-sm">Thank you! We'll get back to you soon.</div>
              )}
              {contactSuccess === 'error' && (
                <div className="text-red-600 text-sm">Something went wrong. Please try again.</div>
              )}
              <button
                type="submit"
                disabled={contactSubmitting}
                className="w-full px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:from-purple-700 hover:to-indigo-700 transition font-semibold disabled:opacity-50"
              >
                {contactSubmitting ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Send Message'}
              </button>
            </form>
          </div>

          {/* Demo Request Form */}
          <div className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-xl p-8 text-white">
            <h3 className="text-2xl font-semibold mb-4">Request a Demo</h3>
            <p className="text-purple-100 mb-6">See AttendEase ERP in action with a personalized demo</p>
            <form onSubmit={handleDemoRequest} className="space-y-4">
              <div>
                <input
                  type="text"
                  placeholder="Your Name *"
                  value={demoRequest.name}
                  onChange={(e) => setDemoRequest({ ...demoRequest, name: e.target.value })}
                  className="w-full px-4 py-3 border border-purple-300 bg-white/10 rounded-lg focus:ring-2 focus:ring-white focus:border-transparent text-white placeholder-purple-200"
                  required
                />
              </div>
              <div>
                <input
                  type="email"
                  placeholder="Email Address *"
                  value={demoRequest.email}
                  onChange={(e) => setDemoRequest({ ...demoRequest, email: e.target.value })}
                  className="w-full px-4 py-3 border border-purple-300 bg-white/10 rounded-lg focus:ring-2 focus:ring-white focus:border-transparent text-white placeholder-purple-200"
                  required
                />
              </div>
              <div>
                <input
                  type="tel"
                  placeholder="Phone Number"
                  value={demoRequest.phone}
                  onChange={(e) => setDemoRequest({ ...demoRequest, phone: e.target.value })}
                  className="w-full px-4 py-3 border border-purple-300 bg-white/10 rounded-lg focus:ring-2 focus:ring-white focus:border-transparent text-white placeholder-purple-200"
                />
              </div>
              <div>
                <input
                  type="text"
                  placeholder="Institution Name *"
                  value={demoRequest.institutionName}
                  onChange={(e) => setDemoRequest({ ...demoRequest, institutionName: e.target.value })}
                  className="w-full px-4 py-3 border border-purple-300 bg-white/10 rounded-lg focus:ring-2 focus:ring-white focus:border-transparent text-white placeholder-purple-200"
                  required
                />
              </div>
              <div>
                <input
                  type="text"
                  placeholder="Number of Students"
                  value={demoRequest.studentCount}
                  onChange={(e) => setDemoRequest({ ...demoRequest, studentCount: e.target.value })}
                  className="w-full px-4 py-3 border border-purple-300 bg-white/10 rounded-lg focus:ring-2 focus:ring-white focus:border-transparent text-white placeholder-purple-200"
                />
              </div>
              {demoSuccess === 'success' && (
                <div className="text-green-300 text-sm">Demo request sent! We'll contact you within 24 hours.</div>
              )}
              {demoSuccess === 'error' && (
                <div className="text-red-300 text-sm">Something went wrong. Please try again.</div>
              )}
              <button
                type="submit"
                disabled={demoSubmitting}
                className="w-full px-6 py-3 bg-white text-purple-600 rounded-lg hover:bg-gray-100 transition font-semibold disabled:opacity-50"
              >
                {demoSubmitting ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Request Demo'}
              </button>
            </form>
          </div>
        </Reveal>
      </div>
    </section>
  );
};

// FAQ Section
const FAQSection = () => {
  const [openIndex, setOpenIndex] = useState(null);

  const faqs = [
    {
      question: "How long does it take to set up?",
      answer: "Most institutions can set up and start using AttendEase ERP within 24-48 hours. Our team provides full onboarding support."
    },
    {
      question: "Is there a free trial available?",
      answer: "Yes! We offer a 14-day free trial with full access to all features. No credit card required."
    },
    {
      question: "Can I cancel my subscription anytime?",
      answer: "Absolutely. You can cancel your subscription at any time. No long-term contracts."
    },
    {
      question: "Is my data secure?",
      answer: "Yes, we use enterprise-grade encryption and security measures to protect your data. Regular backups ensure data safety."
    },
    {
      question: "Do you offer dedicated support?",
      answer: "Yes, all our plans include email support. Premium plans include priority support and dedicated account manager."
    }
  ];

  return (
    <section id="faq" className="py-24 px-4 bg-gray-50">
      <div className="max-w-3xl mx-auto">
        <Reveal className="text-center mb-16">
          <div>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 mb-4 tracking-tight">
              Frequently Asked Questions
            </h2>
            <p className="text-lg sm:text-xl text-gray-600">
              Got questions? We've got answers
            </p>
          </div>
        </Reveal>
        <Reveal direction="up" stagger={0.08} className="space-y-4">
          {faqs.map((faq, index) => (
            <div
              key={index}
              className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow"
            >
              <button
                className="w-full px-6 sm:px-8 py-6 text-left font-semibold text-gray-900 hover:bg-gray-50 flex justify-between items-center focus:outline-none focus:bg-gray-50 transition-colors"
                onClick={() => setOpenIndex(openIndex === index ? null : index)}
              >
                <span className="text-base sm:text-lg">{faq.question}</span>
                <ChevronRight className={`w-6 h-6 text-purple-600 transition-transform duration-300 flex-shrink-0 ml-4 ${openIndex === index ? 'rotate-90' : ''}`} />
              </button>
              <AnimatePresence>
                {openIndex === index && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="overflow-hidden"
                  >
                    <div className="px-6 sm:px-8 pb-6 pt-2 text-gray-600 leading-relaxed border-t border-gray-50">
                      {faq.answer}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </Reveal>
      </div>
    </section>
  );
};

// CTA Section
const CTASection = ({ navigate }) => {
  return (
    <section className="py-24 px-4 bg-gradient-to-r from-purple-600 to-indigo-600 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_bottom,_var(--tw-gradient-stops))] from-white/20 via-transparent to-transparent opacity-50"></div>
      <div className="max-w-4xl mx-auto text-center relative z-10">
        <Reveal direction="zoom" className="px-2 sm:px-0">
          <div>
            <h2 className="text-4xl sm:text-5xl font-extrabold text-white mb-6 tracking-tight">
              Ready to Transform Your Institution?
            </h2>
            <p className="text-lg sm:text-xl text-purple-100 mb-10 max-w-2xl mx-auto">
              Join thousands of institutions already using AttendEase ERP to streamline their daily operations.
            </p>
            <div className="flex flex-wrap gap-4 justify-center">
              <button
                onClick={() => navigate('/register/tenant')}
                className="px-10 py-4 bg-white text-purple-600 rounded-xl hover:bg-gray-50 transition-all font-bold shadow-[0_0_20px_rgba(255,255,255,0.3)] hover:shadow-[0_0_30px_rgba(255,255,255,0.5)] hover:-translate-y-1 text-lg w-full sm:w-auto"
              >
                Start Free Trial
              </button>
              <button
                onClick={() => document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' })}
                className="px-10 py-4 border-2 border-purple-200 text-white rounded-xl hover:bg-white/10 hover:border-white transition-all font-bold text-lg w-full sm:w-auto"
              >
                Contact Sales
              </button>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
};

// Footer Component
const Footer = () => {
  const navigate = useNavigate();

  const socials = [
    { name: 'Twitter', icon: <Twitter className="w-5 h-5" />, href: 'https://twitter.com' },
    { name: 'LinkedIn', icon: <Linkedin className="w-5 h-5" />, href: 'https://linkedin.com' },
    { name: 'Facebook', icon: <Facebook className="w-5 h-5" />, href: 'https://facebook.com' },
    { name: 'Instagram', icon: <Instagram className="w-5 h-5" />, href: 'https://instagram.com' },
  ];

  const scrollTo = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });

  return (
    <footer className="bg-gray-900 text-white py-12 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="grid md:grid-cols-4 gap-10 sm:gap-8">
          <div>
            <div className="flex items-center mb-4">
              <div className="w-10 h-10 bg-gradient-to-r from-purple-600 to-indigo-600 rounded-xl flex items-center justify-center">
                <GraduationCap className="w-6 h-6 text-white" />
              </div>
              <span className="ml-2 text-xl font-bold">AttendEase ERP</span>
            </div>
            <p className="text-gray-400 text-sm">
              Complete ERP solution for educational institutions.
            </p>
            <div className="flex gap-4 mt-4">
              {socials.map((social) => (
                <a
                  key={social.name}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={social.name}
                  className="text-gray-400 hover:text-white transition"
                >
                  {social.icon}
                </a>
              ))}
            </div>
          </div>
          <div>
            <h4 className="font-semibold mb-4">Product</h4>
            <ul className="space-y-2 text-gray-400">
              <li><button onClick={() => scrollTo('features')} className="hover:text-white transition">Features</button></li>
              <li><button onClick={() => scrollTo('pricing')} className="hover:text-white transition">Pricing</button></li>
              <li><button onClick={() => scrollTo('contact')} className="hover:text-white transition">Demo</button></li>
              <li><button onClick={() => scrollTo('how-it-works')} className="hover:text-white transition">How It Works</button></li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold mb-4">Company</h4>
            <ul className="space-y-2 text-gray-400">
              <li><button onClick={() => scrollTo('features')} className="hover:text-white transition">About Us</button></li>
              <li><button onClick={() => scrollTo('faq')} className="hover:text-white transition">FAQ</button></li>
              <li><button className="hover:text-white transition">Careers</button></li>
              <li><button onClick={() => scrollTo('contact')} className="hover:text-white transition">Contact</button></li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold mb-4">Contact</h4>
            <ul className="space-y-3 text-gray-400">
              <li className="flex items-start gap-3">
                <Mail className="w-5 h-5 text-purple-500 flex-shrink-0 mt-0.5" />
                <span className="text-sm leading-relaxed">Reach out to us via the contact form for any inquiries.</span>
              </li>
              <li className="flex items-start gap-3">
                <Shield className="w-5 h-5 text-indigo-500 flex-shrink-0 mt-0.5" />
                <span className="text-sm leading-relaxed">Enterprise-grade support for all our customers.</span>
              </li>
              <li className="flex items-start gap-3">
                <ArrowRight className="w-5 h-5 text-purple-500 flex-shrink-0 mt-0.5" />
                <button onClick={() => navigate('/login')} className="text-sm hover:text-white transition text-left">Already have an account? Log in</button>
              </li>
            </ul>
          </div>
        </div>
        <div className="border-t border-gray-800 mt-10 pt-8 text-center text-gray-400 text-sm">
          <p>&copy; {new Date().getFullYear()} AttendEase ERP. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
};

export default LandingPage;