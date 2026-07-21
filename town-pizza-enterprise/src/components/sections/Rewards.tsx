import { Gift, Star, Crown } from "lucide-react";
import { Reveal, SectionHead } from "@/components/ui/Reveal";
import { Button } from "@/components/ui/Button";
import { waLink } from "@/lib/utils";

const tiers = [
  { Icon: Star, name: "Slice Club", perk: "Earn 1 point per Rs.100 spent. 100 points = a free Regular pizza.", color: "text-gold-light" },
  { Icon: Gift, name: "Birthday Treat", perk: "Free party-hall booking + a surprise dessert on your birthday order.", color: "text-red-bright" },
  { Icon: Crown, name: "Town Elite", perk: "Priority delivery, monthly exclusive deals and early access to new flavours.", color: "text-gold" },
];

export function Rewards() {
  return (
    <section id="rewards" className="px-[6vw] py-24" style={{ background: "linear-gradient(180deg,#22120f,#3d0b0e)" }}>
      <SectionHead eyebrow="More reasons to love us" title="Town" em="Rewards" />
      <div className="mx-auto grid max-w-[1050px] gap-6 sm:grid-cols-3">
        {tiers.map((t, i) => (
          <Reveal key={t.name} delay={i * 0.1}>
            <div className="h-full rounded-[20px] border border-gold/15 bg-white/[0.03] p-8 text-center transition-all duration-400 hover:-translate-y-2 hover:border-gold">
              <t.Icon className={`mx-auto mb-4 ${t.color}`} size={40} strokeWidth={1.5} />
              <h4 className="font-[family-name:var(--font-oswald)] text-lg uppercase tracking-wide text-cream">{t.name}</h4>
              <p className="mt-2 text-[13.5px] leading-relaxed text-[#cbb79c]">{t.perk}</p>
            </div>
          </Reveal>
        ))}
      </div>
      <Reveal className="mt-10 text-center" delay={0.1}>
        <a href={waLink("Hi Town Pizza Hut! I'd like to join Town Rewards.")} target="_blank" rel="noopener noreferrer">
          <Button variant="ghost">Join on WhatsApp</Button>
        </a>
      </Reveal>
    </section>
  );
}
