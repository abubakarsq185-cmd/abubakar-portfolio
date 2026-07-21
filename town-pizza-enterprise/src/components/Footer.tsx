import { MessageCircle, Bike, Clock, Cake } from "lucide-react";
import { waLink } from "@/lib/utils";

function Facebook({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M22 12c0-5.5-4.5-10-10-10S2 6.5 2 12c0 5 3.7 9.1 8.4 9.9v-7H7.9V12h2.5V9.8c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.2.2 2.2.2v2.5h-1.3c-1.2 0-1.6.8-1.6 1.6V12h2.8l-.4 2.9h-2.3v7C18.3 21.1 22 17 22 12z" />
    </svg>
  );
}

const footLinks: [string, string][] = [
  ["#menu", "Menu"],
  ["#deals", "Deals"],
  ["#locations", "Branches"],
  ["#reserve", "Reserve"],
  ["#faq", "FAQ"],
];

export function Footer() {
  return (
    <>
      <div className="flex flex-wrap justify-center gap-12 bg-maroon-deep px-[6vw] py-11 text-center">
        {[
          { Icon: Bike, h: "Free Home Delivery", p: "Within 5 km on orders above Rs 1000" },
          { Icon: Clock, h: "Open Daily", p: "10:00 AM – 11:45 PM" },
          { Icon: Cake, h: "Birthday Party Hall", p: "Book our party deal — hall charges free" },
        ].map(({ Icon, h, p }) => (
          <div key={h} className="max-w-[220px]">
            <Icon className="mx-auto mb-2 text-gold" size={30} strokeWidth={1.5} />
            <h4 className="mb-1.5 font-[family-name:var(--font-oswald)] text-[15px] uppercase tracking-wide text-gold">{h}</h4>
            <p className="text-[13.5px] leading-normal text-[#e3d0b7]">{p}</p>
          </div>
        ))}
      </div>

      <footer className="bg-[#0f0405] px-[6vw] pb-8 pt-14 text-center">
        <div className="mb-1.5 font-[family-name:var(--font-playfair)] text-3xl font-black text-gold">
          TOWN <span className="text-red-bright">PIZZA HUT</span>
        </div>
        <div className="mb-6 font-[family-name:var(--font-oswald)] text-[11px] uppercase tracking-[3px] text-[#c9b79c]">
          The Name of Quality · Family Restaurant · Swat
        </div>
        <div className="mb-6 flex justify-center gap-4">
          {[
            { href: "https://www.facebook.com/TownPizzaHutSwat/", Icon: Facebook, label: "Facebook" },
            { href: waLink(), Icon: MessageCircle, label: "WhatsApp" },
          ].map(({ href, Icon, label }) => (
            <a
              key={label}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={label}
              className="flex h-[42px] w-[42px] items-center justify-center rounded-full border border-gold/30 text-cream transition-all hover:-translate-y-0.5 hover:bg-gold hover:text-maroon-deep"
            >
              <Icon size={18} />
            </a>
          ))}
        </div>
        <div className="mb-6 flex flex-wrap justify-center gap-6">
          {footLinks.map(([h, l]) => (
            <a key={h} href={h} className="font-[family-name:var(--font-oswald)] text-[13px] uppercase tracking-wide text-[#c9b79c] transition-colors hover:text-gold">
              {l}
            </a>
          ))}
        </div>
        <div className="border-t border-white/[0.08] pt-5 text-xs leading-relaxed text-[#a68d78]">
          Complaints &amp; Suggestions: Syed Abdul Hadi 0348-5922580 · Syed Ihsan Ul Hadi 0341-9097057
          <br />© 2026 Town Pizza Hut — All rights reserved. The Name of Quality.
        </div>
      </footer>
    </>
  );
}
