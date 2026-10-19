// src/component/Legal/PrivacyPolicy.jsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ShieldCheck,
  Lock,
  Database,
  Cpu,
  FileCheck2,
  Users,
  ArrowLeft,
  CheckCircle,
  EyeOff,
  Server,
  KeyRound,
  Sparkles,
} from 'lucide-react';

const PrivacyPolicy = () => {
  const navigate = useNavigate();

  const sections = [
    {
      id: 'biometric-privacy',
      title: '1. Biometric AI Privacy Invariant (Vector-Only Architecture)',
      icon: Cpu,
      content: `AttendEase operates under a strict, mathematically verified zero-raw-biometric data storage policy. When face detection or attendance scanning occurs:
• Facial processing is executed client-side on the instructor’s or student’s terminal via high-efficiency neural networks.
• Raw facial imagery and camera snapshots are NEVER transmitted to or stored on AttendEase cloud servers.
• Mathematical descriptors (512-dimensional numerical floating-point vectors) are computed in transient memory and stored encrypted. It is computationally irreversible to reconstruct a human face from these mathematical vectors.
• All registered descriptors remain strictly scoped to the tenant’s cryptographic domain and are permanently wiped upon student graduation or enrollment deactivation.`,
    },
    {
      id: 'multi-tenant-isolation',
      title: '2. Multi-Tenant Cryptographic & Logical Isolation',
      icon: Database,
      content: `Every educational institution provisioned on AttendEase receives dedicated, isolated tenant tenancy:
• Multi-tenant database queries enforce mandatory tenantId scoping at both the middleware gateway and the data model query interceptor.
• Cross-tenant data leakage is prevented via strict query boundary verification and automated regression test suites.
• Custom tenant domains, logos, color themes, and academic configurations remain isolated within each institution's partition.`,
    },
    {
      id: 'data-collection',
      title: '3. Information We Collect and Process',
      icon: FileCheck2,
      content: `AttendEase collects only the minimum operational data required to conduct university administration:
• Institutional User Profiles: Full name, academic email address, university enrollment number, section, course, branch, and semester assignment.
• Attendance & Timetable Records: Timetable slot schedules, lecture check-ins, medical/duty leave applications, and supporting documents.
• Academic Evaluations: Examination seating allocations, numerical grade rosters, and cryptographic QR hall ticket verification tokens.
• Security & Operational Logs: User session timestamps, IP addresses, and tamper-resistant audit logs to maintain institutional compliance.`,
    },
    {
      id: 'compliance',
      title: '4. Regulatory Compliance & Student Data Rights',
      icon: ShieldCheck,
      content: `AttendEase adheres to international and domestic student data protection benchmarks:
• Family Educational Rights and Privacy Act (FERPA): Student educational records are accessible strictly by authorized institutional personnel and designated parents/guardians.
• Indian Digital Personal Data Protection Act (DPDP): Personal student identifiers are processed exclusively for lawful academic purposes with parental consent mechanisms for minors.
• Right to Audit & Erasure: Institutional registrars retain full rights to request complete data exports or cryptographic data purging upon contract termination.`,
    },
    {
      id: 'security-measures',
      title: '5. Encryption & Infrastructure Security Standards',
      icon: Lock,
      content: `Our cloud infrastructure implements enterprise-grade security protocols:
• Data in Transit: 100% encrypted using TLS 1.3 with automated HSTS header enforcement.
• Data at Rest: Sensitive attributes and database partitions encrypted using AES-256.
• Authentication Security: Dual-mode session handling leveraging httpOnly, SameSite=Strict cookies with cryptographic XSRF double-submit protection.
• Continuous Auditing: Regular automated vulnerability scans and continuous penetration testing.`,
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
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Security & Privacy Protocol v2.4</span>
            </div>
            <h1 className="font-headline text-3xl sm:text-4xl font-extrabold tracking-tight text-ink mb-3">
              AttendEase Privacy Policy
            </h1>
            <p className="text-sm sm:text-base text-ink-muted max-w-2xl mx-auto leading-relaxed">
              Transparent, verifiable privacy architecture engineered for modern universities, autonomous colleges, and research institutions.
            </p>
            <div className="mt-4 text-xs font-mono text-ink-muted">
              Effective Date: Academic Year 2026–2027 • Last Certified: October 2026
            </div>
          </motion.div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-12 flex-1">
        {/* Key Guarantees Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-12">
          <div className="p-4 rounded-xl bg-surface border border-line shadow-xs">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center mb-3">
              <EyeOff className="w-4 h-4" />
            </div>
            <h2 className="text-xs font-bold text-ink mb-1">Zero Raw Photos</h2>
            <p className="text-[11px] text-ink-muted leading-relaxed">
              Raw facial photographs are never saved or transmitted. Descriptors are strictly 512-d mathematical floats.
            </p>
          </div>
          <div className="p-4 rounded-xl bg-surface border border-line shadow-xs">
            <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-3">
              <Server className="w-4 h-4" />
            </div>
            <h2 className="text-xs font-bold text-ink mb-1">Tenant Data Isolation</h2>
            <p className="text-[11px] text-ink-muted leading-relaxed">
              Every campus has dedicated, encrypted logical boundaries preventing cross-institutional leakage.
            </p>
          </div>
          <div className="p-4 rounded-xl bg-surface border border-line shadow-xs">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-600 flex items-center justify-center mb-3">
              <KeyRound className="w-4 h-4" />
            </div>
            <h2 className="text-xs font-bold text-ink mb-1">FERPA & DPDP Ready</h2>
            <p className="text-[11px] text-ink-muted leading-relaxed">
              Comprehensive role-scoped access control ensuring student educational records remain confidential.
            </p>
          </div>
        </div>

        {/* Policy Sections */}
        <div className="space-y-8">
          {sections.map((section, idx) => {
            const Icon = section.icon;
            return (
              <motion.section
                key={section.id}
                id={section.id}
                initial={{ opacity: 0, y: 15 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-40px' }}
                transition={{ duration: 0.35, delay: idx * 0.05 }}
                className="p-6 rounded-2xl bg-surface border border-line shadow-xs scroll-mt-24"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <Icon className="w-4 h-4" />
                  </div>
                  <h2 className="text-base font-bold text-ink tracking-tight font-headline">
                    {section.title}
                  </h2>
                </div>
                <div className="text-xs text-ink-soft leading-relaxed whitespace-pre-line space-y-2">
                  {section.content}
                </div>
              </motion.section>
            );
          })}
        </div>

        {/* Contact DPO Card */}
        <div className="mt-12 p-6 rounded-2xl bg-surface-subtle border border-line text-center">
          <h2 className="text-sm font-bold text-ink mb-1">Institutional Privacy Inquiries</h2>
          <p className="text-xs text-ink-muted max-w-xl mx-auto mb-4">
            If your university registrar, audit committee, or legal department requires custom data processing agreements (DPA) or security compliance documentation, reach out to our team.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={() => navigate('/support')}
              className="h-8 px-4 bg-primary hover:bg-primary-hover text-on-primary rounded-lg text-xs font-medium transition-colors"
            >
              Contact Support
            </button>
            <a
              href="mailto:privacy@attendease.internal"
              className="h-8 px-4 bg-surface hover:bg-surface-subtle border border-line rounded-lg text-xs font-medium text-ink inline-flex items-center"
            >
              privacy@attendease.com
            </a>
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

export default PrivacyPolicy;
