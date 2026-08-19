import React, { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const DIRECTION_MAP = {
  up: { y: 48 },
  down: { y: -48 },
  left: { x: 64 },
  right: { x: -64 },
  zoom: { scale: 0.92 },
  fade: {},
};

const Reveal = ({
  children,
  as: Tag = 'div',
  direction = 'up',
  stagger = 0.12,
  delay = 0,
  duration = 0.8,
  start = 'top 95%',
  className = '',
  ...props
}) => {
  const ref = useRef(null);
  const revealed = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const fromProps = DIRECTION_MAP[direction] || DIRECTION_MAP.up;
    const targets = el.children.length ? gsap.utils.toArray(el.children) : [el];

    const reveal = () => {
      if (revealed.current) return;
      revealed.current = true;
      gsap.to(targets, {
        ...fromProps,
        x: 0,
        y: 0,
        scale: 1,
        autoAlpha: 1,
        stagger,
        delay,
        duration,
        ease: 'power3.out',
        clearProps: 'opacity,visibility,transform',
        overwrite: 'auto',
      });
    };

    // Pre-hide so the entrance is a reveal (not a flash).
    gsap.set(targets, { ...fromProps, autoAlpha: 0 });

    // Primary driver: GSAP ScrollTrigger.
    const st = ScrollTrigger.create({
      trigger: el,
      start,
      once: true,
      onEnter: reveal,
    });

    // Immediate reveal if already in view (e.g. anchor jump / short page).
    const checkInView = () => {
      if (revealed.current) return;
      const rect = el.getBoundingClientRect();
      if (rect.top < window.innerHeight - 40 && rect.bottom > 0) {
        reveal();
        ScrollTrigger.removeEventListener('scroll', checkInView);
      }
    };
    ScrollTrigger.addEventListener('scroll', checkInView);

    // Safety net: never leave content hidden.
    const fallback = window.setTimeout(() => {
      if (!revealed.current && el.getBoundingClientRect().top < window.innerHeight) {
        reveal();
      }
    }, 1500);

    // Re-measure once layout settles.
    const raf = requestAnimationFrame(() => ScrollTrigger.refresh());

    return () => {
      ScrollTrigger.removeEventListener('scroll', checkInView);
      window.clearTimeout(fallback);
      cancelAnimationFrame(raf);
      st.kill();
    };
  }, [direction, stagger, delay, duration, start]);

  return (
    <Tag ref={ref} className={className} {...props}>
      {children}
    </Tag>
  );
};

export default Reveal;