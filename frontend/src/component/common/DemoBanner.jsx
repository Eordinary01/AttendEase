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
    <div className="w-full bg-slate-900/95 text-white backdrop-blur-md border-b border-purple-500/30 px-4 py-2.5 shadow-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3 text-xs sm:text-sm">
        {/* Left side: Role Badge & Info */}
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-600/30 text-purple-300 border border-purple-500/40 font-semibold tracking-wide uppercase text-[11px]">
            <Sparkles className="w-3.5 h-3.5 text-purple-400" />
            <span>{roleTitle}</span>
          </div>
          <span className="hidden md:inline text-slate-300">
            Database writes are simulated in this browser session.
          </span>
        </div>

        {/* Right side: Countdown Timer & End Button */}
        <div className="flex items-center gap-3">
          <div
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg font-mono font-bold tracking-wider transition-colors ${
              isExpiringSoon
                ? 'bg-red-500/20 text-red-300 border border-red-500/40 animate-pulse'
                : 'bg-slate-800 text-purple-200 border border-slate-700'
            }`}
          >
            {isExpiringSoon ? (
              <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
            ) : (
              <Clock className="w-3.5 h-3.5 text-purple-400" />
            )}
            <span>{formattedTime}</span>
          </div>

          <button
            onClick={() => endDemo(false)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-semibold transition-all shadow-sm active:scale-95 text-xs"
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
