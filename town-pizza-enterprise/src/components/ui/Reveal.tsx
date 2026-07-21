"use client";

import { motion, type Variants } from "framer-motion";
import type { ReactNode } from "react";

const ease = [0.2, 0.7, 0.2, 1] as const;

export function Reveal({
  children,
  className,
  delay = 0,
  y = 44,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  y?: number;
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.8, delay, ease }}
    >
      {children}
    </motion.div>
  );
}

export const staggerParent: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};
export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 30 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease } },
};

export function SectionHead({ eyebrow, title, em }: { eyebrow: string; title: string; em: string }) {
  return (
    <Reveal className="mb-14 text-center">
      <div className="font-[family-name:var(--font-oswald)] text-xs uppercase tracking-[4px] text-red-bright">{eyebrow}</div>
      <h2 className="mt-2 font-[family-name:var(--font-playfair)] text-[clamp(34px,6vw,60px)] font-black leading-none text-cream">
        {title} <em className="italic text-gold">{em}</em>
      </h2>
      <div className="mx-auto mt-5 h-[3px] w-[70px] rounded bg-gold" />
    </Reveal>
  );
}
