"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { SectionHead } from "@/components/ui/Reveal";
import { Button } from "@/components/ui/Button";
import { rs, waLink } from "@/lib/utils";

const sizes = [
  { id: "R", label: "Regular 7″", base: 700, topping: 150 },
  { id: "M", label: "Medium 11″", base: 1400, topping: 200 },
  { id: "L", label: "Large 13″", base: 1900, topping: 250 },
  { id: "XL", label: "X-Large 16″", base: 2400, topping: 350 },
] as const;

const crusts = ["Hand-Tossed", "Thin Crust", "Stuffed Crust (+Rs.300)", "Double Crust (+Rs.300)"] as const;
const allToppings = ["Extra Cheese", "Chicken Tikka", "Grilled Chicken", "Pepperoni", "Mushroom", "Black Olives", "Green Pepper", "Onion", "Sweet Corn", "Jalapeño", "Tomato", "Sausages"];

export function Customizer() {
  const [size, setSize] = useState<(typeof sizes)[number]>(sizes[2]);
  const [crust, setCrust] = useState<string>(crusts[0]);
  const [picked, setPicked] = useState<string[]>(["Extra Cheese", "Chicken Tikka", "Black Olives"]);

  const toggle = (t: string) =>
    setPicked((p) => (p.includes(t) ? p.filter((x) => x !== t) : [...p, t]));

  const total = useMemo(() => {
    const crustExtra = crust.includes("+Rs.300") ? 300 : 0;
    return size.base + picked.length * size.topping + crustExtra;
  }, [size, crust, picked]);

  const orderText = `Hi Town Pizza Hut! I'd like to build a pizza:\n• Size: ${size.label}\n• Crust: ${crust}\n• Toppings: ${picked.join(", ") || "None"}\n• Total: ${rs(total)}`;

  return (
    <section id="customizer" className="px-[6vw] py-24" style={{ background: "linear-gradient(180deg,#3d0b0e,#22120f)" }}>
      <SectionHead eyebrow="Make it yours" title="Build Your" em="Pizza" />
      <div className="mx-auto grid max-w-[1100px] gap-10 lg:grid-cols-[1fr_340px]">
        <div className="space-y-8">
          <div>
            <h4 className="mb-3 font-[family-name:var(--font-oswald)] text-sm uppercase tracking-wide text-gold-light">1 · Choose size</h4>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {sizes.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSize(s)}
                  className={`rounded-xl border px-3 py-4 text-center transition-all ${size.id === s.id ? "border-gold bg-gold/10" : "border-gold/25 hover:border-gold/60"}`}
                >
                  <div className="font-[family-name:var(--font-oswald)] text-cream">{s.label}</div>
                  <div className="mt-1 text-xs text-gold-light">{rs(s.base)}</div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <h4 className="mb-3 font-[family-name:var(--font-oswald)] text-sm uppercase tracking-wide text-gold-light">2 · Choose crust</h4>
            <div className="flex flex-wrap gap-3">
              {crusts.map((c) => (
                <button
                  key={c}
                  onClick={() => setCrust(c)}
                  className={`rounded-full border px-4 py-2 font-[family-name:var(--font-oswald)] text-[13px] transition-all ${crust === c ? "border-gold bg-gold/10 text-gold" : "border-gold/25 text-cream hover:border-gold/60"}`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          <div>
            <h4 className="mb-3 font-[family-name:var(--font-oswald)] text-sm uppercase tracking-wide text-gold-light">
              3 · Add toppings <span className="text-cream/50">(+{rs(size.topping)} each)</span>
            </h4>
            <div className="flex flex-wrap gap-2.5">
              {allToppings.map((t) => {
                const on = picked.includes(t);
                return (
                  <button
                    key={t}
                    onClick={() => toggle(t)}
                    aria-pressed={on}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 font-[family-name:var(--font-oswald)] text-[13px] transition-all ${on ? "border-gold bg-gold text-maroon-deep" : "border-gold/25 text-cream hover:border-gold/60"}`}
                  >
                    {on && <Check size={13} />} {t}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* live summary */}
        <div className="lg:sticky lg:top-28 lg:self-start">
          <div className="rounded-[22px] border border-gold/25 bg-white/[0.03] p-7">
            <div className="font-[family-name:var(--font-oswald)] text-xs uppercase tracking-[3px] text-red-bright">Your pizza</div>
            <div className="my-2 font-[family-name:var(--font-playfair)] text-2xl text-gold">{size.label}</div>
            <div className="text-[13px] text-[#c9b79c]">{crust}</div>
            <ul className="my-4 space-y-1 text-sm text-cream/90">
              {picked.length === 0 && <li className="text-cream/50">No extra toppings</li>}
              {picked.map((t) => (
                <li key={t} className="flex items-center gap-2"><Check size={13} className="text-gold" /> {t}</li>
              ))}
            </ul>
            <motion.div key={total} initial={{ scale: 0.9, opacity: 0.6 }} animate={{ scale: 1, opacity: 1 }} className="mb-5 border-t border-white/10 pt-4 font-[family-name:var(--font-oswald)] text-4xl font-bold text-cream">
              {rs(total)}
            </motion.div>
            <a href={waLink(orderText)} target="_blank" rel="noopener noreferrer" className="block">
              <Button className="w-full">Order this pizza</Button>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
