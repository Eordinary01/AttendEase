import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  LifeBuoy,
  HelpCircle,
  Search,
  Send,
  CheckCircle2,
  AlertCircle,
  GraduationCap,
  ShieldCheck,
  Clock,
  ArrowRight,
  ExternalLink,
  Building2,
  ChevronDown,
  Mail,
  MessageSquare
} from 'lucide-react';
import api from '../../utils/api';

const FAQS = [
  {
    q: "How do I find my institution's custom subdomain or login portal?",
    a: "Your institution has a dedicated URL formatted as https://yourcampus.attendease.com (or localhost:3000 if running on on-premise development). You can also click 'Campus Portals' in our navigation bar or on the landing page to search for your college and jump straight to your campus login."
  },
  {
    q: "I forgot my password or can't log in. How do I reset it?",
    a: "Head to your campus login portal and click 'Forgot password?'. If your campus uses single sign-on (SSO) or institutional directory integration, contact your campus IT administrator or registrar helpdesk to reset your institutional credentials."
  },
  {
    q: "How does the 14-day Free Trial work for new colleges?",
    a: "Every new institution gets full Enterprise tier access with 500 student slots for 14 days. No credit card is required. When the trial ends, you have a 3-day grace period. If you do not upgrade, your account automatically downgrades to our Free Tier with 100 students preserved—no student records or data are ever deleted."
  },
  {
    q: "Is student biometric facial recognition data kept private?",
    a: "Yes, 100%. AttendEase stores only anonymized mathematical face embedding vectors. Raw photos are never retained, sold, or shared with third parties. All vectors are encrypted with AES-256 at rest and strict tenant schema isolation ensures zero cross-institution data bleed."
  },
  {
    q: "Can parents monitor their ward's attendance and fee status?",
    a: "Yes. Parents can log in with their ward's assigned registration credentials or parent portal to access real-time attendance percentages, upcoming exam schedules, fee receipts, and dues breakdowns."
  },
  {
    q: "How does attendance geofencing work during lectures?",
    a: "Faculty can define an allowed radius (e.g. 50 meters) around a lecture hall or campus coordinate. Student self-check-ins are validated via high-accuracy GPS with anti-spoofing heuristics before attendance is logged."
  }
];

const PublicSupport = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [openFaq, setOpenFaq] = useState(null);

  // Support ticket / lead contact state
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    institution: '',
    category: 'general_support',
    message: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState(null); // 'success' | 'error'

  const filteredFaqs = FAQS.filter(f =>
    f.q.toLowerCase().includes(searchQuery.toLowerCase()) ||
    f.a.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.email || !formData.message) return;

    setSubmitting(true);
    setSubmitStatus(null);
    try {
      await api.post('/landing/contact', {
        name: formData.name,
        email: formData.email,
        college: formData.institution || 'Public Inquirer',
        phone: 'Support Desk Request',
        role: formData.category,
        message: formData.message,
        source: 'help_support_center'
      });
      setSubmitStatus('success');
      setFormData({ name: '', email: '', institution: '', category: 'general_support', message: '' });
    } catch (err) {
      console.error('Support ticket submission error:', err);
      setSubmitStatus('error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500/30 selection:text-indigo-200">
      {/* Header */}
      <header className="border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5 text-white hover:opacity-90 transition">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-emerald-400 p-[1.5px] shadow-lg shadow-indigo-500/20">
              <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                <GraduationCap className="w-5 h-5 text-indigo-400" />
              </div>
            </div>
            <span className="font-bold text-lg tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-100 to-slate-400">
              AttendEase
            </span>
          </Link>

          <div className="flex items-center gap-4 text-xs font-medium">
            <Link to="/privacy" className="text-slate-400 hover:text-slate-200 transition hidden sm:inline">
              Privacy
            </Link>
            <Link to="/terms" className="text-slate-400 hover:text-slate-200 transition hidden sm:inline">
              Terms
            </Link>
            <Link
              to="/#campus-select"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700/80 bg-slate-800/50 hover:bg-slate-800 text-slate-200 transition"
            >
              <Building2 className="w-3.5 h-3.5 text-indigo-400" />
              <span>Campus Portals</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Banner */}
      <div className="relative overflow-hidden py-16 sm:py-20 border-b border-slate-800/60 bg-gradient-to-b from-indigo-950/30 via-slate-900/20 to-transparent">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 mb-4">
            <LifeBuoy className="w-3.5 h-3.5" />
            <span>24/7 Academic Support & Documentation</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white mb-4">
            How can our Registrar Helpdesk assist you?
          </h1>
          <p className="text-slate-400 text-base sm:text-lg max-w-2xl mx-auto mb-8">
            Access immediate answers, campus portal resolution guidelines, technical SLAs, and direct support dispatch for students, faculty, and administrators.
          </p>

          {/* Search Bar */}
          <div className="relative max-w-xl mx-auto">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search knowledge base (e.g. login, reset password, free trial, biometrics)..."
              className="w-full pl-12 pr-4 py-3.5 rounded-xl bg-slate-900/90 border border-slate-700/80 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition text-sm shadow-xl"
            />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 flex-1 w-full">
        {/* Quick Help Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
          <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/40 hover:border-slate-700 transition">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 mb-4">
              <Building2 className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white mb-2">Can't Find Your Campus?</h3>
            <p className="text-xs text-slate-400 leading-relaxed mb-4">
              Search all onboarded campuses and jump directly into your institutional tenant login portal.
            </p>
            <Link
              to="/#campus-select"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-400 hover:text-indigo-300"
            >
              <span>Explore Campuses</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/40 hover:border-slate-700 transition">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-4">
              <Clock className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white mb-2">System Status & SLA</h3>
            <p className="text-xs text-slate-400 leading-relaxed mb-4">
              99.9% Core Uptime SLA across multi-region tenant clusters, automated Redis rate-limiting, and zero data leakage.
            </p>
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>All Systems Operational</span>
            </div>
          </div>

          <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/40 hover:border-slate-700 transition">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-4">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white mb-2">Privacy & Compliance</h3>
            <p className="text-xs text-slate-400 leading-relaxed mb-4">
              Strict multi-tenant cryptographic isolation, FERPA & DPDP compliant raw-photo protection, and vector embeddings.
            </p>
            <Link
              to="/privacy"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-400 hover:text-amber-300"
            >
              <span>Read Compliance Spec</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* 2-Column: FAQs and Direct Ticket Form */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          {/* FAQs (7 cols) */}
          <div className="lg:col-span-7 space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <HelpCircle className="w-5 h-5 text-indigo-400" />
              <h2 className="text-xl font-bold text-white">Frequently Asked Questions</h2>
            </div>

            {filteredFaqs.length === 0 ? (
              <div className="p-8 text-center border border-slate-800 rounded-xl bg-slate-900/30 text-slate-400">
                <p>No matching questions found for "{searchQuery}". Please send us a message below.</p>
              </div>
            ) : (
              filteredFaqs.map((faq, idx) => {
                const isOpen = openFaq === idx;
                return (
                  <div
                    key={idx}
                    className="border border-slate-800/80 rounded-xl bg-slate-900/40 overflow-hidden transition-all duration-200 hover:border-slate-700"
                  >
                    <button
                      type="button"
                      onClick={() => setOpenFaq(isOpen ? null : idx)}
                      className="w-full px-5 py-4 text-left flex items-center justify-between gap-4 text-sm font-semibold text-slate-100 hover:text-white"
                    >
                      <span>{faq.q}</span>
                      <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 shrink-0 ${isOpen ? 'rotate-180 text-indigo-400' : ''}`} />
                    </button>
                    {isOpen && (
                      <div className="px-5 pb-4 text-xs text-slate-400 leading-relaxed border-t border-slate-800/40 pt-3">
                        {faq.a}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Contact Dispatch Form (5 cols) */}
          <div className="lg:col-span-5">
            <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/50 backdrop-blur-sm sticky top-24">
              <div className="flex items-center gap-2 mb-2">
                <MessageSquare className="w-5 h-5 text-indigo-400" />
                <h3 className="text-lg font-bold text-white">Contact Registrar Support</h3>
              </div>
              <p className="text-xs text-slate-400 mb-6">
                Submit an inquiry or institutional help request. Our academic technical team responds within 2-4 business hours.
              </p>

              {submitStatus === 'success' && (
                <div className="mb-4 p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 text-xs flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>Ticket received! Our engineering desk has logged your request and will follow up shortly.</span>
                </div>
              )}

              {submitStatus === 'error' && (
                <div className="mb-4 p-4 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-300 text-xs flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>Failed to submit. Please ensure your email is valid or try again later.</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4 text-xs">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Your Name</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Dr. Jane Smith"
                    className="w-full px-3 py-2.5 rounded-lg bg-slate-950/70 border border-slate-700/80 text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">Official Email</label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="name@university.edu"
                    className="w-full px-3 py-2.5 rounded-lg bg-slate-950/70 border border-slate-700/80 text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">Institution / Campus Name</label>
                  <input
                    type="text"
                    value={formData.institution}
                    onChange={(e) => setFormData({ ...formData, institution: e.target.value })}
                    placeholder="e.g. Oxford Institute of Technology"
                    className="w-full px-3 py-2.5 rounded-lg bg-slate-950/70 border border-slate-700/80 text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">Category</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-lg bg-slate-950/70 border border-slate-700/80 text-white focus:outline-none focus:border-indigo-500 transition"
                  >
                    <option value="general_support">General Inquiries / Support</option>
                    <option value="login_issue">Tenant Login / Access Issue</option>
                    <option value="billing_upgrade">Billing / 14-Day Enterprise Trial</option>
                    <option value="biometric_setup">AI Biometric & Geofencing Setup</option>
                    <option value="security_compliance">Data Privacy & Security Inquiry</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">Message</label>
                  <textarea
                    required
                    rows={4}
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    placeholder="Describe your issue, error message, or campus inquiry..."
                    className="w-full px-3 py-2.5 rounded-lg bg-slate-950/70 border border-slate-700/80 text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition resize-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-2.5 px-4 rounded-lg bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-semibold transition flex items-center justify-center gap-2 disabled:opacity-50 shadow-md shadow-indigo-600/20"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{submitting ? 'Transmitting...' : 'Submit Support Request'}</span>
                </button>
              </form>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 py-8 text-center text-xs text-slate-500">
        <p>© {new Date().getFullYear()} AttendEase Inc. All rights reserved. SOC2 Type II Certified, FERPA & DPDP Compliant.</p>
        <div className="flex items-center justify-center gap-4 mt-2">
          <Link to="/privacy" className="hover:text-slate-300 transition">Privacy Policy</Link>
          <span>•</span>
          <Link to="/terms" className="hover:text-slate-300 transition">Terms of Service</Link>
          <span>•</span>
          <Link to="/support" className="text-slate-300 hover:text-white transition">Support & FAQ</Link>
        </div>
      </footer>
    </div>
  );
};

export default PublicSupport;
