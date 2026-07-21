import { Reveal } from "@/components/ui/Reveal";

export function ChefStory() {
  return (
    <section id="story" className="overflow-hidden px-[6vw] py-24" style={{ background: "linear-gradient(180deg,#22120f,#140809)" }}>
      <div className="mx-auto grid max-w-[1150px] items-center gap-14 lg:grid-cols-2">
        <Reveal className="relative order-1 aspect-square lg:order-none">
          <div className="absolute inset-[8%] animate-[ray-spin_30s_linear_infinite] rounded-full opacity-40 blur-[3px]" style={{ background: "conic-gradient(from 45deg,#5a1216,#c0161c,#b8842a,#5a1216)" }} />
          <div className="relative flex h-full w-full items-center justify-center rounded-[28px] border border-gold/20 bg-white/[0.03] text-[120px]">👨‍🍳</div>
        </Reveal>
        <Reveal delay={0.15}>
          <div className="font-[family-name:var(--font-oswald)] text-xs uppercase tracking-[4px] text-gold">Since day one</div>
          <h3 className="my-3 font-[family-name:var(--font-playfair)] text-[clamp(28px,4.4vw,48px)] font-black leading-[1.1] text-cream">
            Honest food, made fresh, <em className="italic text-gold">served with pride.</em>
          </h3>
          <p className="mb-4 max-w-[520px] text-base leading-8 text-[#e0cdb2]">
            Town Pizza Hut is a proud family restaurant born and raised in Swat. From our first branch on Kabal Road to five branches across the valley, one promise has never changed — real ingredients, generous toppings, and pizza that comes out hot every time.
          </p>
          <p className="max-w-[520px] text-base leading-8 text-[#c9b79c]">
            Whether it&apos;s a family dinner, a birthday in our free party hall, or a late-night craving delivered to your door, we cook every single order fresh. That&apos;s why we&apos;re known as <em className="text-gold-light">The Name of Quality.</em>
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            {["🔥 Freshly Baked", "🧀 Real Cheese", "🛵 Free Delivery*", "🎉 Free Birthday Hall"].map((f) => (
              <span key={f} className="rounded-full border border-gold/30 bg-gold/10 px-4 py-2 font-[family-name:var(--font-oswald)] text-[13px] tracking-wide text-gold-light">{f}</span>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
