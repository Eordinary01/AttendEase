// src/component/Legal/TermsOfService.jsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  FileText,
  ShieldCheck,
  Scale,
  Clock,
  Sparkles,
  ArrowLeft,
  Building,
  CreditCard,
  AlertCircle,
  CheckCircle,
} from 'lucide-react';

const TermsOfService = () => {
  const navigate = useNavigate();

  const sections = [
    {
      id: 'agreement',
      title: '1. Institutional Master Subscription Agreement',
      content: `By registering a campus subdomain, provisioning institutional administrator accounts, or accessing the AttendEase SaaS ERP platform ("Service"), the subscribing university, college, educational polytechnic, or school ("Institution") agrees to be bound by these Terms of Service.
If you are enrolling an institution on behalf of an academic board, dean, or directorate, you certify that you possess the requisite authority to bind the entity to these terms.`,
    },
    {
      id: 'subscriptions-and-trial',
      title: '2. Subscriptions, Trials, Grace Periods & Auto-Downgrade Policy',
      content: `• Evaluation Trial: New educational institutions are granted a 14-day full-access trial of the Enterprise tier to evaluate automated timetable generation, facial biometric attendance, and custom role delegation.
• 3-Day Grace Period: In the event of subscription expiration or billing review, AttendEase enforces an automated 72-hour grace period during which full institutional access is maintained without lockout.
• Data Preservation Guarantee: Following grace period expiration without renewal, institutional databases are never abruptly deleted. The tenant is automatically transitioned to the persistent Free Tier, ensuring attendance registries, student enrollments, and academic calendars remain intact.
• Cancellation & Portability: Institutions may cancel subscriptions at any time and download full CSV and JSON data archives of all academic records.`,
    },
    {
      id: 'sla',
      title: '3. Service Level Agreement (SLA) & Reliability',
      content: `• Uptime Guarantee: AttendEase targets 99.9% platform availability across all core services (attendance marking, student logins, timetable viewer) excluding scheduled maintenance windows announced at least 48 hours in advance.
• Disaster Recovery & Backups: Institutional databases are automatically snapshotted on a 24-hour cycle with point-in-time recovery capabilities across distributed multi-zone cloud nodes.
• Support Response Times: Technical support tickets logged via the Administrator Support Portal receive initial response within 4 business hours for Critical/High severity incidents and within 24 business hours for standard inquiries.`,
    },
    {
      id: 'conduct',
      title: '4. Institutional Governance & Acceptable Use',
      content: `• Academic Authority: Institutions are solely responsible for ensuring the accuracy and legitimacy of student enrollment files, instructor assignments, and attendance percentage thresholds.
• Biometric Consent: Institutions deploying facial verification modules warrant that they have communicated the 100% vector-only privacy design to enrolled students and acquired necessary institutional consents.
• Prohibited Activities: Users may not reverse-engineer, probe for vulnerabilities outside authorized security programs, or utilize platform endpoints to distribute unauthorized communications.`,
    },
    {
      id: 'intellectual-property',
      title: '5. Institutional Ownership of Academic Data',
      content: `• Zero Vendor Lock-in: All student records, attendance histories, examination papers, grade records, and custom institution branding remain the exclusive intellectual and proprietary property of the Institution.
• AttendEase Platform IP: All neural network weight optimizations, user interface architectures, software codebases, and platform designs remain the exclusive property of AttendEase Technologies Inc.`,
    },
  ];

  return (
    <div className="min-h-screen bg-background text-ink flex flex-col">
      {/* Top Bar */}
      <header className="sticky top-0 z-30 bg-surface/90 backdrop-blur-md border-b border-line">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-ink-muted hover:text-ink bg-surface-subtle hover:bg-surface border border-line rounded-lg transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back</span>
            </button>
            <span className="h-4 w-px bg-line" />
            <span className="font-headline font-bold text-base tracking-tight text-ink">
              Attend<span className="text-primary">Ease</span> Legal
            </span>
          </div>
          <button
            onClick={() => navigate('/login')}
            className="text-xs font-semibold text-primary hover:text-primary-hover px-3 py-1.5 rounded-lg border border-primary/20 hover:border-primary/40 transition-colors"
          >
            Institutional Sign In
          </button>
        </div>
      </header>

      {/* Hero Header */}
      <div className="border-b border-line bg-surface/50 py-12 md:py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-mono font-medium mb-4">
              <Scale className="w-3.5 h-3.5" />
              <span>Institutional Master Agreement</span>
            </div>
            <h1 className="font-headline text-3xl sm:text-4xl font-extrabold tracking-tight text-ink mb-3">
              AttendEase Terms of Service
            </h1>
            <p className="text-sm sm:text-base text-ink-muted max-w-2xl mx-auto leading-relaxed">
              Standard commercial, operational, and service level terms governing the AttendEase Academic ERP SaaS platform.
            </p>
            <div className="mt-4 text-xs font-mono text-ink-muted">
              Effective Date: Academic Year 2026–2027 • Standard Institutional Version
            </div>
          </motion.div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-12 flex-1">
        {/* Core Principles Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-12">
          <div className="p-4 rounded-xl bg-surface border border-line shadow-xs">
            <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-3">
              <Clock className="w-4 h-4" />
            </div>
            <h2 className="text-xs font-bold text-ink mb-1">3-Day Grace Period</h2>
            <p className="text-[11px] text-ink-muted leading-relaxed">
              Subscription renewals include automatic 72-hour grace and seamless fallback to persistent Free Tier without data lockout.
            </p>
          </div>
          <div className="p-4 rounded-xl bg-surface border border-line shadow-xs">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center mb-3">
              <Building className="w-4 h-4" />
            </div>
            <h2 className="text-xs font-bold text-ink mb-1">100% Institution Data Ownership</h2>
            <p className="text-[11px] text-ink-muted leading-relaxed">
              All student profiles, attendance matrices, grades, and enrollments remain solely institutional property with full export portability.
            </p>
          </div>
          <div className="p-4 rounded-xl bg-surface border border-line shadow-xs">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-600 flex items-center justify-center mb-3">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <h2 className="text-xs font-bold text-ink mb-1">99.9% Uptime Commitment</h2>
            <p className="text-[11px] text-ink-muted leading-relaxed">
              High-availability multi-zone deployment engineered to support critical university examination schedules and daily attendance.
            </p>
          </div>
        </div>

        {/* Terms Sections */}
        <div className="space-y-8">
          {sections.map((section, idx) => (
            <motion.section
              key={section.id}
              id={section.id}
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.35, delay: idx * 0.05 }}
              className="p-6 rounded-2xl bg-surface border border-line shadow-xs scroll-mt-24"
            >
              <h2 className="text-base font-bold text-ink tracking-tight font-headline mb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-primary" />
                {section.title}
              </h2>
              <div className="text-xs text-ink-soft leading-relaxed whitespace-pre-line space-y-2">
                {section.content}
              </div>
            </motion.section>
          ))}
        </div>

        {/* Questions or Custom SLA */}
        <div className="mt-12 p-6 rounded-2xl bg-surface-subtle border border-line text-center">
          <h2 className="text-sm font-bold text-ink mb-1">Custom Master Service Agreements</h2>
          <p className="text-xs text-ink-muted max-w-xl mx-auto mb-4">
            State universities, multi-campus university systems, or government education boards with specialized procurement or on-premise compliance needs can request tailored MSAs.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={() => navigate('/support')}
              className="h-8 px-4 bg-primary hover:bg-primary-hover text-on-primary rounded-lg text-xs font-medium transition-colors cursor-pointer"
            >
              Open Support Inquiry
            </button>
            <button
              onClick={() => navigate('/register/tenant')}
              className="h-8 px-4 bg-surface hover:bg-surface-subtle border border-line rounded-lg text-xs font-medium text-ink transition-colors cursor-pointer"
            >
              Deploy Institution
            </button>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-line bg-surface py-6 text-center text-xs text-ink-muted">
        <p>&copy; {new Date().getFullYear()} AttendEase Technologies Inc. All rights reserved.</p>
      </footer>
    </div>
  );
};

export default TermsOfService;
