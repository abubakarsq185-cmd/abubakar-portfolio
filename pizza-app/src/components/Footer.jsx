import { Bike, Clock, Cake, Facebook, MessageCircle } from 'lucide-react'
import { Reveal } from '@/components/Reveal'
import { Button } from '@/components/ui/button'
import { waLink } from '@/lib/utils'

export function InfoStrip() {
  const items = [
    { Icon: Bike, h: 'Free Home Delivery', p: 'Within 5 km on orders above Rs 1000' },
    { Icon: Clock, h: 'Open Daily', p: '10:00 AM – 11:45 PM' },
    { Icon: Cake, h: 'Birthday Party Hall', p: 'Book our party deal — hall charges free' },
  ]
  return (
    <div className="flex flex-wrap justify-center gap-12 bg-maroon-deep px-[6vw] py-11 text-center">
      {items.map(({ Icon, h, p }) => (
        <div key={h} className="max-w-[220px]">
          <Icon className="mx-auto mb-2 text-gold" size={30} strokeWidth={1.5} />
          <h4 className="mb-1.5 font-oswald text-[15px] uppercase tracking-wide text-gold">{h}</h4>
          <p className="text-[13.5px] leading-normal text-[#e3d0b7]">{p}</p>
        </div>
      ))}
    </div>
  )
}

export function CTA() {
  return (
    <section id="order" className="relative overflow-hidden px-[6vw] py-24 text-center"
      style={{ background: 'linear-gradient(rgba(22,6,8,.78),rgba(22,6,8,.86)),radial-gradient(circle at 30% 30%,#c0161c,#3d0b0e)' }}>
      <Reveal>
        <h2 className="mb-4 font-display text-[clamp(38px,7.5vw,74px)] font-black leading-none text-cream">Craving a <em className="italic text-gold">slice?</em></h2>
        <p className="mx-auto mb-8 max-w-[520px] text-[17px] leading-relaxed text-[#e7d5bd]">Order now on WhatsApp and we'll have it hot, fresh and ready — delivered free within 5 km on orders above Rs 1000.</p>
        <a href={waLink('')} target="_blank" rel="noopener"><Button>Order on WhatsApp</Button></a>
      </Reveal>
    </section>
  )
}

export function Footer() {
  return (
    <footer className="bg-[#0f0405] px-[6vw] pb-8 pt-14 text-center">
      <div className="mb-1.5 font-display text-3xl font-black text-gold">TOWN <span className="text-red-bright">PIZZA HUT</span></div>
      <div className="mb-6 font-oswald text-[11px] uppercase tracking-[3px] text-[#c9b79c]">The Name of Quality · Family Restaurant · Swat</div>
      <div className="mb-6 flex justify-center gap-4">
        {[
          { href: 'https://www.facebook.com/TownPizzaHutSwat/', Icon: Facebook, label: 'Facebook' },
          { href: waLink(''), Icon: MessageCircle, label: 'WhatsApp' },
        ].map(({ href, Icon, label }) => (
          <a key={label} href={href} target="_blank" rel="noopener" aria-label={label}
            className="flex h-[42px] w-[42px] items-center justify-center rounded-full border border-gold/30 text-cream transition-all hover:-translate-y-0.5 hover:bg-gold hover:text-maroon-deep">
            <Icon size={18} />
          </a>
        ))}
      </div>
      <div className="mb-6 flex flex-wrap justify-center gap-6">
        {[['#story', 'Story'], ['#menu', 'Menu'], ['#deals', 'Deals'], ['#branches', 'Branches']].map(([h, l]) => (
          <a key={h} href={h} className="font-oswald text-[13px] uppercase tracking-wide text-[#c9b79c] transition-colors hover:text-gold">{l}</a>
        ))}
      </div>
      <div className="border-t border-white/[0.08] pt-5 text-xs leading-relaxed text-[#a68d78]">
        Complaints &amp; Suggestions: Syed Abdul Hadi 0348-5922580 · Syed Ihsan Ul Hadi 0341-9097057<br />
        © 2026 Town Pizza Hut — All rights reserved. The Name of Quality.
      </div>
    </footer>
  )
}

export function FloatingWA() {
  return (
    <a href={waLink('')} target="_blank" rel="noopener" aria-label="Order on WhatsApp"
      className="fixed bottom-6 right-6 z-[800] flex h-[58px] w-[58px] animate-wa-pulse items-center justify-center rounded-full bg-[#25D366] shadow-[0_8px_26px_rgba(37,211,102,.5)] transition-transform hover:scale-110">
      <MessageCircle size={30} className="text-white" />
    </a>
  )
}
