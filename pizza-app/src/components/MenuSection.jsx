import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Pizza, Beef, Drumstick, Sandwich, Soup, CupSoda } from 'lucide-react'
import { SectionHead } from '@/components/Sections'
import { Reveal } from '@/components/Reveal'
import { pizzas, specials, burgers, chicken, shawarma, sides, drinks } from '@/lib/data'
import { rs } from '@/lib/utils'

const tabs = [
  { id: 'pizzas', label: 'Pizzas', Icon: Pizza },
  { id: 'burgers', label: 'Burgers', Icon: Beef },
  { id: 'chicken', label: 'Fried Chicken', Icon: Drumstick },
  { id: 'shawarma', label: 'Shawarmas', Icon: Sandwich },
  { id: 'sides', label: 'Rice · Soups · Sides', Icon: Soup },
  { id: 'drinks', label: 'Drinks · Ice Cream', Icon: CupSoda },
]

const cellVal = (v) => (v ? v.toLocaleString() : '—')

function PizzaTable({ rows }) {
  return (
    <div className="mx-auto max-w-[1050px] overflow-hidden rounded-2xl border border-gold/15 bg-white/[0.03]">
      <div className="grid grid-cols-[2.4fr_.8fr_.8fr_.8fr_.8fr] bg-maroon-deep px-5 py-3.5 font-oswald text-xs uppercase tracking-wide text-gold">
        <div>Pizza</div><div className="text-center">R 7″</div><div className="text-center">M 11″</div><div className="text-center">L 13″</div><div className="text-center">XL 16″</div>
      </div>
      {rows.map((p, i) => (
        <div key={i} className={`grid grid-cols-[2.4fr_.8fr_.8fr_.8fr_.8fr] items-center border-t border-white/[0.06] px-5 py-3.5 transition-colors hover:bg-gold/[0.07] ${p[6] ? 'text-red-bright' : ''}`}>
          <div>
            <div className={`font-oswald text-[15px] font-medium ${p[6] ? 'text-red-bright' : 'text-cream'}`}>{p[0]}</div>
            <div className="mt-0.5 hidden max-w-[95%] text-[11.5px] leading-snug text-[#c9b79c] sm:block">{p[1]}</div>
          </div>
          {[p[2], p[3], p[4], p[5]].map((v, j) => (
            <div key={j} className={`text-center font-oswald text-[15px] ${p[6] ? 'text-red-bright' : 'text-gold-light'}`}>{cellVal(v)}</div>
          ))}
        </div>
      ))}
    </div>
  )
}

function SimpleList({ arr }) {
  return (
    <div className="mx-auto grid max-w-[1050px] gap-3.5 sm:grid-cols-2">
      {arr.map((x, i) =>
        x.cat ? (
          <div key={i} className="col-span-full mb-1 mt-4 font-display text-[26px] italic text-gold">{x.cat}</div>
        ) : (
          <div key={i} className="flex items-center justify-between gap-3.5 rounded-xl border border-gold/10 bg-white/[0.03] px-5 py-3.5 transition-all hover:translate-x-1 hover:bg-gold/[0.08]">
            <span className="font-oswald text-[15px] text-cream">{x[0]}</span>
            <span className="whitespace-nowrap font-oswald text-[15px] text-gold">{rs(x[1])}</span>
          </div>
        )
      )}
    </div>
  )
}

export function MenuSection() {
  const [active, setActive] = useState('pizzas')
  return (
    <section id="menu" className="px-[6vw] py-24" style={{ background: 'linear-gradient(180deg,#22120f,#3d0b0e)' }}>
      <SectionHead eyebrow="Freshly made to order" title="Our" em="Menu" />
      <Reveal className="mb-11 flex flex-wrap justify-center gap-2.5">
        {tabs.map(({ id, label, Icon }) => (
          <button key={id} onClick={() => setActive(id)}
            className={`relative flex items-center gap-2 rounded-full border px-5 py-2.5 font-oswald text-sm uppercase tracking-wide transition-all ${
              active === id ? 'border-gold bg-gold font-semibold text-maroon-deep shadow-[0_8px_22px_rgba(232,181,63,.3)]' : 'border-gold/35 text-cream hover:-translate-y-0.5 hover:border-gold'
            }`}>
            <Icon size={16} /> {label}
          </button>
        ))}
      </Reveal>

      <AnimatePresence mode="wait">
        <motion.div key={active}
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.4 }}>
          {active === 'pizzas' && (
            <div>
              <p className="mb-6 text-center font-oswald text-[13px] tracking-wide text-gold-light">Prices in Rs. — Regular 7″ · Medium 11″ · Large 13″ · Extra Large 16″</p>
              <PizzaTable rows={pizzas} />
              <div className="mx-auto mt-4 max-w-[1050px] rounded-xl bg-gold/[0.08] p-3 text-center font-oswald text-[13px] tracking-wide text-gold-light">Extra Topping — R Rs.150 · M Rs.200 · L Rs.250 · XL Rs.350</div>
              <p className="mb-6 mt-8 text-center font-oswald text-[13px] tracking-wide text-gold-light">New Special Flavours</p>
              <PizzaTable rows={specials} />
            </div>
          )}
          {active === 'burgers' && <SimpleList arr={burgers} />}
          {active === 'chicken' && <SimpleList arr={chicken} />}
          {active === 'shawarma' && <SimpleList arr={shawarma} />}
          {active === 'sides' && <SimpleList arr={sides} />}
          {active === 'drinks' && <SimpleList arr={drinks} />}
        </motion.div>
      </AnimatePresence>
    </section>
  )
}
