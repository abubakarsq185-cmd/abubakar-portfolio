import { Star } from "lucide-react";
import { Reveal, SectionHead } from "@/components/ui/Reveal";
import { testimonials } from "@/lib/data";

export function Testimonials() {
  return (
    <section id="reviews" className="px-[6vw] py-24" style={{ background: "linear-gradient(180deg,#140809,#22120f)" }}>
      <SectionHead eyebrow="Loved across the valley" title="What Swat" em="Says" />
      <div className="mx-auto grid max-w-[1100px] gap-6 sm:grid-cols-2">
        {testimonials.map((t, i) => (
          <Reveal key={t.n} delay={(i % 2) * 0.1}>
            <figure className="h-full rounded-[20px] border border-gold/15 bg-white/[0.03] p-8 transition-all duration-400 hover:border-gold/40">
              <div className="mb-4 flex gap-1" aria-label={`${t.r} out of 5 stars`}>
                {Array.from({ length: t.r }).map((_, s) => (
                  <Star key={s} size={18} className="fill-gold text-gold" />
                ))}
              </div>
              <blockquote className="font-[family-name:var(--font-playfair)] text-lg italic leading-relaxed text-cream">“{t.q}”</blockquote>
              <figcaption className="mt-4 font-[family-name:var(--font-oswald)] text-sm uppercase tracking-wide text-gold-light">— {t.n}</figcaption>
            </figure>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
