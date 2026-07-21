import { Reveal, SectionHead } from "@/components/ui/Reveal";
import { Button } from "@/components/ui/Button";
import { pizzas } from "@/lib/data";
import { rs, waLink } from "@/lib/utils";

const picks = ["Town Pizza Special", "Chicken Tikka B.B.Q", "Chicken Fajita", "Pepperoni Hut", "Hot-N-Spicy", "Chicken Supreme"];

export function Featured() {
  const featured = picks
    .map((n) => pizzas.find((p) => p.name === n))
    .filter((p): p is NonNullable<typeof p> => Boolean(p));

  return (
    <section id="featured" className="px-[6vw] py-24" style={{ background: "linear-gradient(180deg,#140809,#22120f)" }}>
      <SectionHead eyebrow="Signature favourites" title="Featured" em="Pizzas" />
      <div className="mx-auto grid max-w-[1150px] gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {featured.map((p, i) => (
          <Reveal key={p.name} delay={(i % 3) * 0.08}>
            <article className="group relative h-full overflow-hidden rounded-[22px] border border-gold/15 bg-white/[0.03] p-7 transition-all duration-400 hover:-translate-y-2 hover:border-gold hover:shadow-2xl">
              {p.special && (
                <span className="absolute right-5 top-5 rounded-full bg-red-bright px-3 py-1 font-[family-name:var(--font-oswald)] text-[10px] uppercase tracking-wide text-white">Signature</span>
              )}
              <div className="mb-4 flex h-28 w-28 items-center justify-center rounded-full text-[64px] transition-transform duration-500 group-hover:rotate-12"
                style={{ background: "radial-gradient(circle at 40% 35%,#e6a94e,#8a4f18)" }}>
                🍕
              </div>
              <h3 className="font-[family-name:var(--font-oswald)] text-xl uppercase tracking-wide text-cream">{p.name}</h3>
              <p className="mt-2 min-h-[3.5rem] text-[13.5px] leading-relaxed text-[#c9b79c]">{p.desc}</p>
              <div className="mt-4 flex items-center justify-between">
                <span className="font-[family-name:var(--font-oswald)] text-gold-light">
                  from <b className="text-xl text-gold">{rs(p.r ?? p.m ?? 0)}</b>
                </span>
                <a href={waLink(`Hi Town Pizza Hut! I want to order the ${p.name}`)} target="_blank" rel="noopener noreferrer">
                  <Button size="sm">Order</Button>
                </a>
              </div>
            </article>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
