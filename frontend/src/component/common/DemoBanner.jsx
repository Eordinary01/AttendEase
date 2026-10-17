import React from 'react';
import { Clock, LogOut, Sparkles, AlertTriangle, ShieldCheck } from 'lucide-react';
import { useDemo } from '../../contexts/DemoContext';

export const DemoBanner = () => {
  const { isDemo, demoRole, remainingSeconds, endDemo } = useDemo();

  if (!isDemo) return null;

  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  const formattedTime = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  const isExpiringSoon = remainingSeconds <= 180; // 3 minutes

  const roleNames = {
    student: 'Student Sandbox',
    teacher: 'Faculty Sandbox',
    admin: 'Institution Admin Sandbox',
    parent: 'Parent Portal Sandbox',
  };

  const roleTitle = roleNames[demoRole] || 'Demo Sandbox';

  return (
    <div className="w-full bg-surface text-ink border-b border-line px-4 py-2 shadow-xs sticky top-0 z-50">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Left side: Role Badge & Info */}
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 font-medium tracking-wide uppercase text-[10px]">
            <ShieldCheck className="w-3.5 h-3.5 text-primary" />
            <span>{roleTitle}</span>
          </div>
          <span className="hidden md:inline text-ink-muted">
            Institutional ledger operations are simulated in this browser session.
          </span>
        </div>

        {/* Right side: Countdown Timer & End Button */}
        <div className="flex items-center gap-3">
          <div
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded font-mono text-xs font-semibold tracking-wider transition-colors ${
              isExpiringSoon
                ? 'bg-status-error-bg text-status-error-text border border-status-error-border'
                : 'bg-surface-subtle text-ink border border-line'
            }`}
          >
            {isExpiringSoon ? (
              <AlertTriangle className="w-3.5 h-3.5 text-status-error-text" />
            ) : (
              <Clock className="w-3.5 h-3.5 text-ink-muted" />
            )}
            <span className="tnum">{formattedTime}</span>
          </div>

          <button
            onClick={() => endDemo(false)}
            className="flex items-center gap-1.5 px-3 py-1 rounded bg-rose-700 hover:bg-rose-800 text-white font-medium transition-colors text-xs focus:outline-none focus:ring-2 focus:ring-rose-500 focus:ring-offset-1"
            title="End demo session and return to landing page"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>End Demo</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default DemoBanner;
