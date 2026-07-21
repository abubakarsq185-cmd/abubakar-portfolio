import { useRef } from 'react'
import { motion, useMotionValue, useSpring, useTransform, useReducedMotion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { PizzaArt } from '@/components/PizzaArt'
import { waLink } from '@/lib/utils'

const floaties = [
  { e: '🍅', c: 'top-[12%] left-[14%] text-[34px]' },
  { e: '🧀', c: 'top-[20%] right-[12%] text-[40px]' },
  { e: '🌿', c: 'bottom-[24%] left-[9%] text-[30px]' },
  { e: '🫑', c: 'bottom-[16%] right-[14%] text-[36px]' },
  { e: '🍄', c: 'top-[46%] left-[3%] text-[26px]' },
  { e: '🌶️', c: 'top-[52%] right-[4%] text-[28px]' },
]

/* Set to a real photo path (e.g. '/images/hero-pizza.png') to replace the SVG art */
const HERO_PHOTO = null

export function Hero() {
  const reduce = useReducedMotion()
  const ref = useRef(null)
  const mx = useMotionValue(0)
  const my = useMotionValue(0)
  const rotateY = useSpring(useTransform(mx, [-0.5, 0.5], [-26, 26]), { stiffness: 120, damping: 18 })
  const rotateX = useSpring(useTransform(my, [-0.5, 0.5], [22, -22]), { stiffness: 120, damping: 18 })

  const onMove = (e) => {
    if (reduce) return
    const r = ref.current.getBoundingClientRect()
    mx.set((e.clientX - r.left) / r.width - 0.5)
    my.set((e.clientY - r.top) / r.height - 0.5)
  }
  const onLeave = () => { mx.set(0); my.set(0) }

  return (
    <section
      id="home" ref={ref} onMouseMove={onMove} onMouseLeave={onLeave}
      className="relative flex min-h-[100svh] flex-col items-center justify-center overflow-hidden px-[6vw] pb-20 pt-24 text-center"
      style={{ background: 'radial-gradient(circle at 50% 42%,rgba(120,24,28,.55),transparent 55%),radial-gradient(circle at 50% 90%,rgba(232,181,63,.10),transparent 60%),linear-gradient(165deg,#2b0a0c 0%,#5a1216 42%,#3d0b0e 100%)' }}
    >
      {/* rotating rays */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[150vmax] w-[150vmax] -translate-x-1/2 -translate-y-1/2 animate-ray-spin opacity-70"
        style={{ background: 'conic-gradient(from 0deg,transparent 0deg,rgba(232,181,63,.06) 12deg,transparent 24deg,transparent 36deg,rgba(232,181,63,.06) 48deg,transparent 60deg)' }} />
      {/* glow */}
      <motion.div className="pointer-events-none absolute left-1/2 top-[44%] aspect-square w-[min(720px,90vw)] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[30px]"
        style={{ background: 'radial-gradient(circle,rgba(232,181,63,.28),rgba(225,27,34,.10) 45%,transparent 70%)' }}
        animate={{ scale: [1, 1.08, 1], opacity: [0.75, 1, 0.75] }} transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }} />
      {/* marquee */}
      <div className="pointer-events-none absolute left-0 top-1/2 w-full -translate-y-1/2 overflow-hidden opacity-[0.045]">
        <motion.b className="inline-block whitespace-nowrap font-display text-[22vw] font-black text-cream"
          animate={{ x: ['0%', '-50%'] }} transition={{ duration: 24, repeat: Infinity, ease: 'linear' }}>
          TOWN&nbsp;PIZZA&nbsp;HUT&nbsp;·&nbsp;TOWN&nbsp;PIZZA&nbsp;HUT&nbsp;·&nbsp;
        </motion.b>
      </div>

      <div className="relative z-10 flex flex-col items-center">
        <motion.div className="mb-3.5 inline-flex items-center gap-3 font-oswald text-[12.5px] uppercase tracking-[5px] text-gold-light"
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.8 }}>
          <span className="h-px w-9 bg-gradient-to-r from-transparent to-gold" />
          Family Restaurant · Swat, Pakistan
          <span className="h-px w-9 bg-gradient-to-l from-transparent to-gold" />
        </motion.div>

        {/* 3D PIZZA STAGE */}
        <div className="relative mx-auto my-1 aspect-square w-[min(460px,78vw)]" style={{ perspective: 1400 }}>
          {/* floating ingredients */}
          <div className="pointer-events-none absolute inset-0 z-[4]">
            {floaties.map((f, i) => (
              <motion.span key={i} className={`absolute drop-shadow-[0_8px_12px_rgba(0,0,0,.45)] ${f.c}`}
                animate={{ y: [0, -26, 0], rotate: [-8, 10, -8] }}
                transition={{ duration: 8 + i, repeat: Infinity, ease: 'easeInOut', delay: i * 0.3 }}>{f.e}</motion.span>
            ))}
          </div>
          <motion.div
            className="relative h-full w-full"
            style={{ rotateX, rotateY, transformStyle: 'preserve-3d' }}
            initial={{ opacity: 0, scale: 0.4, y: 60 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ delay: 0.35, duration: 1.4, ease: [0.16, 0.84, 0.3, 1] }}
          >
            {/* steam */}
            <div className="pointer-events-none absolute left-1/2 top-[6%] z-[6] h-3/5 w-3/5 -translate-x-1/2">
              {[0, 0.8, 1.6].map((d, i) => (
                <motion.span key={i} className="absolute bottom-0 h-[60px] w-2.5 rounded-full blur-[6px]"
                  style={{ left: `${24 + i * 21}%`, background: 'linear-gradient(to top,rgba(255,255,255,.28),transparent)' }}
                  animate={{ y: [0, -120], opacity: [0, 0.6, 0], scaleX: [1, 2.4] }}
                  transition={{ duration: 4 + i * 0.3, repeat: Infinity, ease: 'easeIn', delay: d }} />
              ))}
            </div>
            <motion.div className="h-full w-full" animate={{ y: [0, -16, 0], rotate: [0, 6, 0] }} transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}>
              {HERO_PHOTO
                ? <img src={HERO_PHOTO} alt="Town Pizza Hut signature pizza" className="h-full w-full object-contain drop-shadow-[0_40px_45px_rgba(0,0,0,.6)]" />
                : <PizzaArt className="h-full w-full drop-shadow-[0_40px_45px_rgba(0,0,0,.6)]" />}
            </motion.div>
            {/* ground shadow */}
            <motion.div className="absolute -bottom-[2%] left-1/2 h-[9%] w-[62%] -translate-x-1/2 blur-[9px]"
              style={{ background: 'radial-gradient(ellipse,rgba(0,0,0,.55),transparent 70%)' }}
              animate={{ scaleX: [1, 0.82, 1], opacity: [0.55, 0.35, 0.55] }} transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }} />
          </motion.div>
        </div>

        <motion.h1 className="mb-1.5 font-display text-[clamp(42px,9.5vw,104px)] font-black leading-[0.88] text-cream drop-shadow-[0_8px_34px_rgba(0,0,0,.5)]"
          initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35, duration: 0.9 }}>
          TOWN <span className="text-red-bright">PIZZA</span> HUT
          <span className="mt-4 block font-oswald text-[0.30em] font-semibold tracking-[8px] text-gold">The Name of Quality</span>
        </motion.h1>

        <motion.p className="mx-auto mt-5 max-w-[540px] text-[clamp(15px,2.2vw,18px)] leading-relaxed text-[#f3e4c8]"
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5, duration: 0.9 }}>
          Fresh, hot and hand-made every single day. Loaded pizzas, juicy burgers, crispy fried chicken and more — served across 5 branches in Swat.
        </motion.p>

        <motion.div className="mt-9 flex flex-wrap justify-center gap-4"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7, duration: 1 }}>
          <a href="#menu"><Button>View Menu</Button></a>
          <a href={waLink('')} target="_blank" rel="noopener"><Button variant="ghost">Order on WhatsApp</Button></a>
        </motion.div>

        <motion.div className="mt-11 flex flex-wrap justify-center gap-4"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.95, duration: 1 }}>
          {[['5', 'Branches'], ['10–11:45', 'Open Daily'], ['Free', 'Delivery 5km*']].map(([b, s]) => (
            <div key={s} className="min-w-[120px] rounded-2xl border border-gold/20 bg-white/[0.04] px-6 py-3.5 backdrop-blur">
              <b className="block font-display text-2xl leading-tight text-gold">{b}</b>
              <small className="font-oswald text-[10px] uppercase tracking-[2px] text-cream/75">{s}</small>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}
