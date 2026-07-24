"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import styles from "./VideoHero.module.css";
import { Button } from "@/components/ui/Button";
import { waLink } from "@/lib/utils";

/**
 * Full-bleed cinematic video hero — the video is the star.
 * Video lives at /public/videos/hero.mp4 (swap the file to change it).
 * Autoplays muted + looped behind a light scrim; overlay copy is intentionally
 * minimal + bottom-anchored so it never collides with branding baked into the
 * video. prefers-reduced-motion shows a static poster instead of autoplay.
 */
export function VideoHero() {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);

  return (
    <section id="home" className={styles.hero}>
      <div className={styles.media}>
        {reduced ? (
          <Image
            className={styles.bg}
            src="/videos/hero-poster.webp"
            alt="Town Pizza Hut"
            fill
            sizes="100vw"
            priority
          />
        ) : (
          <video
            className={styles.bg}
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            poster="/videos/hero-poster.webp"
          >
            <source src="/videos/hero.mp4" type="video/mp4" />
          </video>
        )}
        <div className={styles.scrim} />
      </div>

      <div className={styles.copy}>
        <p className={styles.tagline}>
          Fresh, hot &amp; hand-made — <em>The Name of Quality</em>
        </p>
        <p className={styles.sub}>Pizza · Burgers · Fried Chicken · 5 Branches in Swat</p>
        <div className={styles.cta}>
          <a href="#menu">
            <Button>View Menu</Button>
          </a>
          <a href={waLink()} target="_blank" rel="noopener noreferrer">
            <Button variant="ghost">Order on WhatsApp</Button>
          </a>
        </div>
        <div className={styles.scroll}>Scroll to explore</div>
      </div>
    </section>
  );
}
