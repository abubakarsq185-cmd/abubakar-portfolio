import { Phone, MessageCircle } from 'lucide-react'
import { SectionHead } from '@/components/Sections'
import { Reveal } from '@/components/Reveal'
import { branches } from '@/lib/data'

export function Branches() {
  return (
    <section id="branches" className="px-[6vw] py-24" style={{ background: 'linear-gradient(180deg,#3d0b0e,#160809)' }}>
      <SectionHead eyebrow="5 locations across Swat" title="Find Your" em="Branch" />
      <div className="mx-auto grid max-w-[1150px] gap-[22px] sm:grid-cols-2 lg:grid-cols-3">
        {branches.map((b, i) => (
          <Reveal key={b.n} delay={(i % 3) * 0.08}>
            <div className="group relative h-full overflow-hidden rounded-[20px] border border-gold/20 bg-white/[0.03] p-7 transition-all duration-300 hover:-translate-y-1.5 hover:border-gold hover:shadow-2xl">
              <div className="absolute right-5 top-2.5 font-display text-[52px] font-black leading-none text-gold/[0.18]">{b.isNew ? '★' : i + 1}</div>
              <div className="mb-2.5 font-oswald text-xl uppercase tracking-wide text-gold">{b.n}{b.isNew && ' · New'}</div>
              <div className="mb-4 max-w-[88%] text-sm leading-relaxed text-[#ddc9ae]">{b.addr}</div>
              <div className="mb-4 flex flex-col gap-1.5">
                {b.phones.map((p) => (
                  <a key={p} href={`tel:+92${p.replace(/^0/, '')}`} className="flex items-center gap-2 font-oswald text-sm text-cream transition-colors hover:text-gold">
                    <Phone size={14} /> {p}
                  </a>
                ))}
              </div>
              <a href={`https://wa.me/${b.wa}?text=${encodeURIComponent(`Hi Town Pizza Hut (${b.n})! I would like to place an order.`)}`} target="_blank" rel="noopener"
                className="inline-flex items-center gap-2 rounded-full bg-[#25D366] px-4.5 py-2.5 font-oswald text-[13px] tracking-wide text-white transition-all hover:-translate-y-0.5 hover:shadow-[0_8px_20px_rgba(37,211,102,.4)]"
                style={{ paddingLeft: 18, paddingRight: 18 }}>
                <MessageCircle size={16} /> Order on WhatsApp
              </a>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  )
}
