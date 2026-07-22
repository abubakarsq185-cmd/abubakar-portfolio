import Image from "next/image";
import styles from "./HeroProduct.module.css";
import { Button } from "@/components/ui/Button";
import { waLink } from "@/lib/utils";

/**
 * Cinematic product hero.
 * Swap /public/images/hero-product.png with a real 4K photo — the markup and
 * animation stay the same. next/image auto-serves responsive AVIF/WebP srcsets
 * (see next.config images.formats) so the 4K original never bloats mobile loads.
 * A .webp is also kept alongside the .png for non-next fallbacks.
 */
export function HeroProduct() {
  return (
    <section id="home" className={styles.hero}>
      <div className={styles.rays} aria-hidden="true" />

      <div className={styles.stage}>
        <div className={styles.entry}>
          <div className={styles.spin}>
            <Image
              className={styles.img}
              src="/images/hero-product.png"
              alt="Town Pizza Hut signature loaded pizza"
              width={1280}
              height={853}
              sizes="(max-width: 700px) 74vw, (max-width: 1100px) 45vw, 560px"
              priority
            />
          </div>
        </div>
        <div className={styles.shadow} aria-hidden="true" />
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
    </section>
  );
}
