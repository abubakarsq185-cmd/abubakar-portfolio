import { motion } from 'framer-motion'
import { Flame, Sparkles, Bike, Cake, ImageIcon } from 'lucide-react'
import { Reveal } from '@/components/Reveal'
import { PizzaArt } from '@/components/PizzaArt'
import { Button } from '@/components/ui/button'
import { waLink } from '@/lib/utils'

export function SectionHead({ eyebrow, title, em }) {
  return (
    <Reveal className="mb-14 text-center">
      <div className="font-oswald text-xs uppercase tracking-[4px] text-red-bright">{eyebrow}</div>
      <h2 className="mt-2 font-display text-[clamp(34px,6vw,60px)] font-black leading-none text-cream">
        {title} <em className="italic text-gold">{em}</em>
      </h2>
      <div className="mx-auto mt-5 h-[3px] w-[70px] rounded bg-gold" />
    </Reveal>
  )
}

export function Story() {
  return (
    <section id="story" className="px-[6vw] py-24 text-center" style={{ background: 'linear-gradient(180deg,#160809,#22120f)' }}>
      <Reveal><div className="mb-5 font-oswald text-xs uppercase tracking-[4px] text-red-bright">Since day one</div></Reveal>
      <Reveal delay={0.1}>
        <p className="mx-auto max-w-[820px] font-display text-[clamp(24px,3.6vw,40px)] font-bold italic leading-[1.35] text-cream">
          Honest food, made fresh, served with pride — real ingredients, generous toppings, and pizza that comes out <em className="text-gold">hot every time.</em>
        </p>
      </Reveal>
      <Reveal delay={0.2}>
        <p className="mx-auto mt-6 max-w-[600px] text-base leading-8 text-[#d8c3a8]">
          Town Pizza Hut is a proud family restaurant born and raised in Swat. From our first branch on Kabal Road to five branches across the valley, one promise has never changed. That's why we're known as The Name of Quality.
        </p>
      </Reveal>
      <Reveal delay={0.3}><p className="mt-6 font-oswald text-xs uppercase tracking-[3px] text-gold-light">Est. Swat, Pakistan · Family Restaurant</p></Reveal>
    </section>
  )
}

export function Flagship() {
  return (
    <section className="overflow-hidden px-[6vw] py-24" style={{ background: 'linear-gradient(180deg,#22120f,#2b1416)' }}>
      <div className="mx-auto grid max-w-[1150px] items-center gap-14 md:grid-cols-2">
        <Reveal className="relative order-1 aspect-square md:order-none">
          <div className="absolute inset-[6%] animate-ray-spin rounded-full opacity-50 blur-[2px]"
            style={{ background: 'conic-gradient(from 45deg,#5a1216,#c0161c,#b8842a,#5a1216)' }} />
          <motion.div className="relative mx-auto w-[82%]" animate={{ y: [0, -14, 0] }} transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}>
            <PizzaArt className="w-full" />
          </motion.div>
        </Reveal>
        <Reveal delay={0.15}>
          <div className="font-oswald text-xs uppercase tracking-[4px] text-gold">Top classic</div>
          <h3 className="my-3 font-display text-[clamp(30px,4.4vw,50px)] font-black leading-[1.05] text-cream">The <em className="italic text-gold">Town Pizza Special</em></h3>
          <p className="mb-4 max-w-[480px] text-base leading-8 text-[#e0cdb2]">
            Our signature pie — a generous bed of real melted cheese layered with tender special chicken, black olives, mushrooms, ripe tomato, onion, capsicum and our house Italian sauce. Baked hot, cut fresh, and loaded edge to edge. This is the one Swat keeps coming back for.
          </p>
          <p className="mb-6 font-oswald text-[15px] tracking-wide text-gold-light">Starting <b className="text-2xl text-gold">Rs.750</b> · available R · M · L · XL</p>
          <a href={waLink('Hi Town Pizza Hut! I want to order the Town Pizza Special')} target="_blank" rel="noopener"><Button>Order Now</Button></a>
        </Reveal>
      </div>
    </section>
  )
}

const collage = [
  { e: '🍕', cap: 'Signature loaded pizza', cls: 'md:row-span-2' },
  { e: '🔥', cap: 'Fresh from the oven' },
  { e: '🍔', cap: 'Juicy tower burgers' },
  { e: '🍗', cap: 'Crispy fried chicken', cls: 'md:col-span-2' },
  { e: '🧀', cap: 'Real melted cheese' },
]
export function Collage() {
  return (
    <section id="gallery" className="px-[6vw] py-24" style={{ background: '#160809' }}>
      <SectionHead eyebrow="Straight from our kitchen" title="Made" em="Fresh, Daily" />
      <Reveal delay={0.1} className="mx-auto grid max-w-[1150px] grid-cols-2 gap-4 md:auto-rows-[220px] md:grid-cols-3">
        {collage.map((c, i) => (
          <div key={i} className={`group relative flex items-center justify-center overflow-hidden rounded-2xl border border-gold/15 transition-all duration-500 hover:-translate-y-1.5 hover:shadow-2xl ${c.cls || ''}`}
            style={{ background: 'linear-gradient(135deg,#2b1416,#3d0b0e)' }}>
            <div className="flex flex-col items-center gap-2.5 p-4 text-center text-gold-light/70">
              <span className="text-[52px]">{c.e}</span>
              <ImageIcon size={16} className="opacity-50" />
              <small className="font-oswald text-[10px] uppercase tracking-[2px]">{c.cap}</small>
            </div>
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent p-4 font-oswald text-[13px] uppercase tracking-wide text-cream">{c.cap}</div>
          </div>
        ))}
      </Reveal>
      <p className="mt-6 text-center font-oswald text-[13px] tracking-wide text-gold-light">Tip: drop your own 4K food photos into <b>public/images</b> to replace these panels.</p>
    </section>
  )
}

const quality = [
  { icon: Flame, b: '100%', h: 'Freshly Baked', p: 'Every order cooked to order — never pre-made, never reheated.' },
  { icon: Sparkles, b: 'Real', h: 'Cheese Only', p: 'Generous, stretchy real cheese on every single pizza.' },
  { icon: Bike, b: '5 km', h: 'Free Delivery', p: 'Hot and free within 5 km on orders above Rs.1000.' },
  { icon: Cake, b: 'Free', h: 'Birthday Hall', p: 'Book our party deal — hall charges completely free.' },
]
export function Quality() {
  return (
    <section className="px-[6vw] py-24" style={{ background: 'linear-gradient(180deg,#160809,#2b1416)' }}>
      <SectionHead eyebrow="Food that feels good" title="Why We're" em="Different" />
      <div className="mx-auto grid max-w-[1100px] gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {quality.map((q, i) => (
          <Reveal key={q.h} delay={i * 0.1}>
            <div className="group h-full rounded-[20px] border border-gold/15 bg-white/[0.03] p-8 text-center transition-all duration-400 hover:-translate-y-2 hover:border-gold hover:bg-gold/[0.06]">
              <q.icon className="mx-auto mb-3.5 text-gold" size={40} strokeWidth={1.5} />
              <b className="block font-display text-[34px] leading-none text-gold">{q.b}</b>
              <h4 className="my-2 font-oswald text-sm uppercase tracking-wide text-cream">{q.h}</h4>
              <p className="text-[13.5px] leading-relaxed text-[#cbb79c]">{q.p}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  )
}

const steps = [
  { n: '01', e: '🫓', h: 'Hand-Made Dough', p: 'Kneaded and rested daily for that light, crisp base.' },
  { n: '02', e: '🍅', h: 'Rich Tomato Sauce', p: 'Our tasty house sauce spread edge to edge.' },
  { n: '03', e: '🧀', h: 'Real Melted Cheese', p: 'Piled on generously and baked till golden.' },
  { n: '04', e: '🍗', h: 'Loaded Toppings', p: 'Marinated chicken, olives, peppers & more.' },
]
export function Ingredients() {
  return (
    <section className="px-[6vw] py-24" style={{ background: 'linear-gradient(180deg,#2b1416,#22120f)' }}>
      <SectionHead eyebrow="Built layer by layer" title="The" em="Perfect Slice" />
      <div className="mx-auto grid max-w-[1050px] gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((s, i) => (
          <Reveal key={s.n} delay={i * 0.1}>
            <div className="group rounded-[20px] border border-gold/15 bg-white/[0.03] p-8 text-center transition-all duration-400 hover:-translate-y-2 hover:shadow-2xl">
              <span className="font-display text-[13px] italic text-gold/50">{s.n}</span>
              <motion.div className="text-[60px] drop-shadow-[0_10px_16px_rgba(0,0,0,.4)]" animate={{ y: [0, -12, 0] }} transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut', delay: i * 0.4 }}>{s.e}</motion.div>
              <h4 className="my-2 font-oswald text-[15px] uppercase tracking-wide text-gold">{s.h}</h4>
              <p className="text-[13px] leading-relaxed text-[#cbb79c]">{s.p}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  )
}
