import { Reveal, SectionHead } from "@/components/ui/Reveal";

const steps = [
  { n: "01", e: "🫓", h: "Hand-Made Dough", p: "Kneaded and rested daily for that light, crisp base." },
  { n: "02", e: "🍅", h: "Rich Tomato Sauce", p: "Our tasty house sauce spread edge to edge." },
  { n: "03", e: "🧀", h: "Real Melted Cheese", p: "Piled on generously and baked till golden." },
  { n: "04", e: "🍗", h: "Loaded Toppings", p: "Marinated chicken, olives, peppers & more." },
];

export function Ingredients() {
  return (
    <section id="ingredients" className="px-[6vw] py-24" style={{ background: "linear-gradient(180deg,#3d0b0e,#22120f)" }}>
      <SectionHead eyebrow="Built layer by layer" title="The" em="Perfect Slice" />
      <div className="mx-auto grid max-w-[1050px] gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((s, i) => (
          <Reveal key={s.n} delay={i * 0.1}>
            <div className="group h-full rounded-[20px] border border-gold/15 bg-white/[0.03] p-8 text-center transition-all duration-400 hover:-translate-y-2 hover:shadow-2xl">
              <span className="font-[family-name:var(--font-playfair)] text-[13px] italic text-gold/50">{s.n}</span>
              <div className="text-[60px] drop-shadow-[0_10px_16px_rgba(0,0,0,.4)] transition-transform duration-500 group-hover:-translate-y-1.5">{s.e}</div>
              <h4 className="my-2 font-[family-name:var(--font-oswald)] text-[15px] uppercase tracking-wide text-gold">{s.h}</h4>
              <p className="text-[13px] leading-relaxed text-[#cbb79c]">{s.p}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
