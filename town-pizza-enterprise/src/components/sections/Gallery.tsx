import { ImageIcon } from "lucide-react";
import { Reveal, SectionHead } from "@/components/ui/Reveal";

const items = [
  { e: "🍕", cap: "Signature loaded pizza", cls: "sm:row-span-2" },
  { e: "🔥", cap: "Fresh from the oven" },
  { e: "🍔", cap: "Juicy tower burgers" },
  { e: "🍗", cap: "Crispy fried chicken", cls: "sm:col-span-2" },
  { e: "🧀", cap: "Real melted cheese" },
];

export function Gallery() {
  return (
    <section id="gallery" className="px-[6vw] py-24" style={{ background: "#140809" }}>
      <SectionHead eyebrow="Straight from our kitchen" title="Made" em="Fresh, Daily" />
      <Reveal className="mx-auto grid max-w-[1150px] grid-cols-2 gap-4 sm:auto-rows-[220px] sm:grid-cols-3">
        {items.map((c, i) => (
          <div key={i} className={`group relative flex items-center justify-center overflow-hidden rounded-2xl border border-gold/15 transition-all duration-500 hover:-translate-y-1.5 hover:shadow-2xl ${c.cls || ""}`} style={{ background: "linear-gradient(135deg,#2b1416,#3d0b0e)" }}>
            <div className="flex flex-col items-center gap-2.5 p-4 text-center text-gold-light/70">
              <span className="text-[52px]">{c.e}</span>
              <ImageIcon size={16} className="opacity-50" />
              <small className="font-[family-name:var(--font-oswald)] text-[10px] uppercase tracking-[2px]">{c.cap}</small>
            </div>
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent p-4 font-[family-name:var(--font-oswald)] text-[13px] uppercase tracking-wide text-cream">{c.cap}</div>
          </div>
        ))}
      </Reveal>
      <p className="mt-6 text-center font-[family-name:var(--font-oswald)] text-[13px] tracking-wide text-gold-light">Tip: drop your own 4K food photos into <b>public/images</b> to replace these panels.</p>
    </section>
  );
}
