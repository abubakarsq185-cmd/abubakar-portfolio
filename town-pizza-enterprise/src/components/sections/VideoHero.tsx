"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import styles from "./VideoHero.module.css";
import { Button } from "@/components/ui/Button";
import { waLink } from "@/lib/utils";

/**
 * Full-bleed cinematic video hero.
 * Video lives at /public/videos/hero.mp4 (swap the file to change it).
 * Autoplays muted + looped; on prefers-reduced-motion we show a static poster
 * image instead of an autoplaying video. A dark scrim keeps the copy legible.
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
            src="/images/hero-product.webp"
            alt="Town Pizza Hut signature pizza"
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
            poster="/images/hero-product.webp"
          >
            <source src="/videos/hero.mp4" type="video/mp4" />
          </video>
        )}
        <div className={styles.scrim} />
      </div>

      <div className={styles.copy}>
        <p className={styles.eyebrow}>Family Restaurant · Swat, Pakistan</p>
        <h1 className={styles.title}>
          TOWN <span>PIZZA</span> HUT
          <span className={styles.gold}>The Name of Quality</span>
        </h1>
        <p className={styles.sub}>
          Fresh, hot and hand-made every single day — loaded pizzas, juicy burgers, crispy fried chicken and more, across 5 branches in Swat.
        </p>
        <div className={styles.cta}>
          <a href="#menu">
            <Button>View Menu</Button>
          </a>
          <a href={waLink()} target="_blank" rel="noopener noreferrer">
            <Button variant="ghost">Order on WhatsApp</Button>
          </a>
        </div>
      </div>

      <div className={styles.scroll}>Scroll to explore</div>
    </section>
  );
}
