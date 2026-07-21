"use client";

import { useEffect, useRef, type ReactNode } from "react";
import Lenis from "lenis";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

/**
 * Lenis smooth scrolling wired into GSAP's ScrollTrigger + rAF loop.
 * Respects prefers-reduced-motion (skips Lenis entirely).
 */
export function SmoothScroll({ children }: { children: ReactNode }) {
  const scrollBar = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    gsap.registerPlugin(ScrollTrigger);

    let lenis: Lenis | undefined;
    let rafId = 0;

    const onScrollProgress = () => {
      const h = document.documentElement.scrollHeight - window.innerHeight;
      const p = h > 0 ? window.scrollY / h : 0;
      if (scrollBar.current) scrollBar.current.style.transform = `scaleX(${p})`;
    };

    if (!prefersReduced) {
      lenis = new Lenis({ duration: 1.1, smoothWheel: true });
      lenis.on("scroll", ScrollTrigger.update);
      const raf = (time: number) => {
        lenis?.raf(time);
        rafId = requestAnimationFrame(raf);
      };
      rafId = requestAnimationFrame(raf);
      gsap.ticker.lagSmoothing(0);
    }

    window.addEventListener("scroll", onScrollProgress, { passive: true });
    onScrollProgress();

    return () => {
      cancelAnimationFrame(rafId);
      lenis?.destroy();
      window.removeEventListener("scroll", onScrollProgress);
      ScrollTrigger.getAll().forEach((t) => t.kill());
    };
  }, []);

  return (
    <>
      <div className="fixed left-0 top-0 z-[960] h-[3px] w-full origin-left scale-x-0 bg-gradient-to-r from-red-bright to-gold" ref={scrollBar} />
      {children}
    </>
  );
}
