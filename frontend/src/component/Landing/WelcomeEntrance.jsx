import React, { useEffect, useRef, useState } from 'react';
import { GraduationCap, ShieldCheck } from 'lucide-react';
import gsap from 'gsap';

export const WelcomeEntrance = ({ onFinish }) => {
  const containerRef = useRef(null);
  const emblemRef = useRef(null);
  const textRef = useRef(null);
  const statusRef = useRef(null);
  const lineRef = useRef(null);
  const [dismissed, setDismissed] = useState(false);

  const handleDismiss = () => {
    if (dismissed) return;
    setDismissed(true);
    try {
      sessionStorage.setItem('attendease_welcome_seen', 'true');
    } catch (e) {
      // Ignore storage errors in restricted contexts
    }
    if (containerRef.current) {
      gsap.to(containerRef.current, {
        opacity: 0,
        scale: 0.98,
        duration: 0.35,
        ease: 'power2.inOut',
        onComplete: onFinish,
      });
    } else {
      onFinish();
    }
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        handleDismiss();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        onComplete: () => {
          // Auto-resolve after 1.5s sequence
          gsap.delayedCall(0.3, handleDismiss);
        },
      });

      tl.fromTo(
        emblemRef.current,
        { scale: 0.75, opacity: 0, y: 15 },
        { scale: 1, opacity: 1, y: 0, duration: 0.5, ease: 'back.out(1.4)' }
      )
        .fromTo(
          lineRef.current,
          { width: 0 },
          { width: '100%', duration: 0.4, ease: 'power2.out' },
          '-=0.2'
        )
        .fromTo(
          textRef.current?.children || [],
          { opacity: 0, y: 10 },
          { opacity: 1, y: 0, stagger: 0.08, duration: 0.35, ease: 'power2.out' },
          '-=0.2'
        )
        .fromTo(
          statusRef.current,
          { opacity: 0, y: 8 },
          { opacity: 1, y: 0, duration: 0.3, ease: 'power2.out' },
          '-=0.1'
        );
    }, containerRef);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      ctx.revert();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#071311] text-white px-4 select-none"
      style={{ willChange: 'opacity, transform' }}
    >
      {/* Subtle Hairline Grid Texture */}
      <div
        className="absolute inset-0 opacity-[0.04] pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(to right, rgb(var(--color-primary) / 0.4) 1px, transparent 1px), linear-gradient(to bottom, rgb(var(--color-primary) / 0.4) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }}
      />

      {/* Skip Button Top-Right */}
      <button
        onClick={handleDismiss}
        className="absolute top-5 right-6 flex items-center gap-1.5 px-3 py-1.5 rounded border border-white/10 bg-white/5 hover:bg-white/10 text-white/70 hover:text-white text-xs font-mono transition cursor-pointer"
        aria-label="Skip intro sequence"
      >
        <span>Skip</span>
        <span className="text-[10px] px-1 py-0.2 bg-white/10 rounded">Esc</span>
      </button>

      {/* Central Institutional Monogram Card */}
      <div className="relative max-w-md w-full text-center flex flex-col items-center">
        {/* Institutional Seal Emblem */}
        <div
          ref={emblemRef}
          className="w-16 h-16 rounded-lg bg-primary/20 border border-primary/50 flex items-center justify-center mb-5 relative shadow-[0_0_24px_rgba(var(--color-primary)/0.3)]"
        >
          <GraduationCap className="w-8 h-8 text-primary-light" />
          <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-primary border-2 border-[#071311] flex items-center justify-center">
            <ShieldCheck className="w-3.5 h-3.5 text-white" />
          </div>
        </div>

        {/* Brand & Subtitle */}
        <div ref={textRef} className="space-y-1.5">
          <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-primary-light font-semibold">
            Institutional Registry Engine
          </div>
          <h1 className="text-3xl sm:text-4xl font-headline font-bold tracking-tight text-white">
            Attend<span className="text-primary-light">Ease</span>
          </h1>
          <p className="text-xs text-white/60 font-body max-w-sm mx-auto">
            Multi-Tenant Academic ERP &amp; Deterministic Attendance Registry
          </p>
        </div>

        {/* Hairline Divider */}
        <div className="w-48 h-px bg-white/10 my-5 overflow-hidden">
          <div ref={lineRef} className="h-full bg-primary" />
        </div>

        {/* Live Ledger Verification Token */}
        <div
          ref={statusRef}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded bg-white/5 border border-white/10 text-[11px] font-mono text-white/80"
        >
          <span className="w-2 h-2 rounded-full bg-[#10b981] animate-pulse" />
          <span>SESSION 2026-27 &bull; SECURE MULTI-TENANT BOOT</span>
        </div>
      </div>
    </div>
  );
};

export default WelcomeEntrance;
