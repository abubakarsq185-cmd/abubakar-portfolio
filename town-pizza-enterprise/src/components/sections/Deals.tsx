import { Reveal, SectionHead } from "@/components/ui/Reveal";
import { deals } from "@/lib/data";
import { rs, waLink } from "@/lib/utils";

export function Deals() {
  return (
    <section id="deals" className="px-[6vw] py-24" style={{ background: "linear-gradient(180deg,#22120f,#3d0b0e)" }}>
      <SectionHead eyebrow="Best value · Best taste" title="Super" em="Deals" />
      <div className="mx-auto grid max-w-[1150px] gap-[22px] sm:grid-cols-2 lg:grid-cols-3">
        {deals.map((d, i) => (
          <Reveal key={d.b} delay={(i % 3) * 0.08}>
            <div className="group relative h-full overflow-hidden rounded-[20px] border border-gold/25 p-7 transition-all duration-300 hover:-translate-y-2 hover:border-gold hover:shadow-2xl" style={{ background: "linear-gradient(160deg,rgba(90,18,22,.6),rgba(29,7,9,.85))" }}>
              <div className="absolute -right-10 -top-10 h-[120px] w-[120px] rounded-full" style={{ background: "radial-gradient(circle,rgba(232,181,63,.25),transparent 70%)" }} />
              <span className="mb-3.5 inline-block rounded-full bg-red-bright px-3.5 py-1.5 font-[family-name:var(--font-oswald)] text-xs uppercase tracking-wide text-white">{d.b}</span>
              <div className="mb-1.5 font-[family-name:var(--font-playfair)] text-2xl text-gold">{d.t}</div>
              <div className="mb-4 font-[family-name:var(--font-oswald)] text-[34px] font-bold text-cream">{rs(d.p)}<small className="text-base text-gold-light">/-</small></div>
              <ul className="space-y-1">
                {d.items.map((it, j) => (
                  <li key={j} className="relative pl-[22px] text-sm leading-snug text-[#e3d0b7] before:absolute before:left-0 before:content-['🍕'] before:[font-size:12px]">{it}</li>
                ))}
              </ul>
              <a href={waLink(`Hi Town Pizza Hut! I want to order the ${d.b} (${rs(d.p)})`)} target="_blank" rel="noopener noreferrer" className="mt-4 inline-block border-b border-gold pb-0.5 font-[family-name:var(--font-oswald)] text-[13px] tracking-wide text-gold transition-colors hover:text-gold-light">
                Order this deal →
              </a>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
