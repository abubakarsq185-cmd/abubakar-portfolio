"use client";

import { motion } from "framer-motion";
import { Hero3D } from "@/components/three/Hero3D";
import { Button } from "@/components/ui/Button";
import { waLink } from "@/lib/utils";

export function Hero() {
  return (
    <section id="home" className="relative flex min-h-[100svh] flex-col items-center justify-center overflow-hidden px-[6vw] pb-24 pt-24 text-center">
      {/* WebGL centerpiece */}
      <Hero3D />

      {/* rotating warm rays */}
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 h-[150vmax] w-[150vmax] -translate-x-1/2 -translate-y-1/2 animate-[ray-spin_60s_linear_infinite] opacity-50"
        style={{ background: "conic-gradient(from 0deg,transparent 0deg,rgba(232,181,63,.06) 12deg,transparent 24deg,transparent 36deg,rgba(232,181,63,.06) 48deg,transparent 60deg)" }}
      />

      {/* copy is pushed to the lower third so the 3D pizza owns the centre */}
      <div className="pointer-events-none relative z-10 mt-[46vh] flex flex-col items-center">
        <motion.div
          className="mb-3.5 inline-flex items-center gap-3 font-[family-name:var(--font-oswald)] text-[12.5px] uppercase tracking-[5px] text-gold-light"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.8 }}
        >
          <span className="h-px w-9 bg-gradient-to-r from-transparent to-gold" />
          Family Restaurant · Swat, Pakistan
          <span className="h-px w-9 bg-gradient-to-l from-transparent to-gold" />
        </motion.div>

        <motion.h1
          className="mb-1.5 font-[family-name:var(--font-playfair)] text-[clamp(42px,9vw,104px)] font-black leading-[0.88] text-cream drop-shadow-[0_8px_34px_rgba(0,0,0,.7)]"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45, duration: 0.9 }}
        >
          TOWN <span className="text-red-bright">PIZZA</span> HUT
          <span className="mt-4 block font-[family-name:var(--font-oswald)] text-[0.30em] font-semibold tracking-[8px] text-gold">The Name of Quality</span>
        </motion.h1>

        <motion.p
          className="mx-auto mt-5 max-w-[540px] text-[clamp(15px,2.2vw,18px)] leading-relaxed text-[#f3e4c8] drop-shadow-[0_2px_10px_rgba(0,0,0,.8)]"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.9 }}
        >
          Freshly hand-made every single day. Loaded pizzas, juicy burgers, crispy fried chicken and more — served across 5 branches in Swat.
        </motion.p>

        <motion.div
          className="pointer-events-auto mt-9 flex flex-wrap justify-center gap-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.75, duration: 1 }}
        >
          <a href="#menu">
            <Button>View Menu</Button>
          </a>
          <a href={waLink()} target="_blank" rel="noopener noreferrer">
            <Button variant="ghost">Order on WhatsApp</Button>
          </a>
        </motion.div>

        <motion.div
          className="mt-11 flex flex-wrap justify-center gap-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.95, duration: 1 }}
        >
          {[["5", "Branches"], ["10–11:45", "Open Daily"], ["Free", "Delivery 5km*"]].map(([b, s]) => (
            <div key={s} className="min-w-[120px] rounded-2xl border border-gold/20 bg-white/[0.04] px-6 py-3.5 backdrop-blur">
              <b className="block font-[family-name:var(--font-playfair)] text-2xl leading-tight text-gold">{b}</b>
              <small className="font-[family-name:var(--font-oswald)] text-[10px] uppercase tracking-[2px] text-cream/75">{s}</small>
            </div>
          ))}
        </motion.div>
      </div>

      <div className="pointer-events-none absolute bottom-6 left-1/2 z-10 -translate-x-1/2 font-[family-name:var(--font-oswald)] text-[10px] uppercase tracking-[3px] text-gold-light/60">
        Scroll to explore
      </div>
    </section>
  );
}
