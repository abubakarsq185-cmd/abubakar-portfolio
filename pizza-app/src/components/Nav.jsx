import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Menu, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { waLink } from '@/lib/utils'

const links = [
  ['#home', 'Home'], ['#story', 'Story'], ['#menu', 'Menu'], ['#deals', 'Deals'], ['#branches', 'Branches'],
]

export function Nav() {
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <motion.header
      initial={{ y: -80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.7, ease: 'easeOut' }}
      className={`fixed inset-x-0 top-0 z-[900] flex items-center justify-between px-[6vw] transition-all duration-400 ${
        scrolled ? 'bg-[rgba(24,6,8,.82)] py-2.5 shadow-[0_6px_30px_rgba(0,0,0,.5)] backdrop-blur-md' : 'py-4'
      }`}
    >
      <a href="#home" className="leading-none">
        <div className="font-display text-[23px] font-black text-gold">TOWN <span className="text-red-bright">PIZZA HUT</span></div>
        <div className="font-oswald text-[9px] uppercase tracking-[3px] text-cream/70">The Name of Quality</div>
      </a>

      <nav className="hidden items-center gap-8 md:flex">
        {links.map(([href, label]) => (
          <a key={href} href={href} className="group relative font-oswald text-[13px] uppercase tracking-wider text-cream transition-colors hover:text-gold">
            {label}
            <span className="absolute -bottom-1 left-0 h-0.5 w-0 bg-gold transition-all duration-300 group-hover:w-full" />
          </a>
        ))}
        <a href={waLink('')} target="_blank" rel="noopener">
          <Button size="sm">Order Now</Button>
        </a>
      </nav>

      <button className="md:hidden z-[950] text-gold" aria-label="Menu" onClick={() => setOpen((v) => !v)}>
        {open ? <X size={28} /> : <Menu size={28} />}
      </button>

      <AnimatePresence>
        {open && (
          <motion.nav
            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ duration: 0.4, ease: 'easeInOut' }}
            className="fixed inset-y-0 right-0 z-[940] flex w-[76%] max-w-[320px] flex-col justify-center gap-7 bg-[rgba(18,4,5,.98)] p-10 backdrop-blur-lg md:hidden"
          >
            {links.map(([href, label]) => (
              <a key={href} href={href} onClick={() => setOpen(false)} className="font-oswald text-lg uppercase tracking-wider text-cream hover:text-gold">{label}</a>
            ))}
            <a href={waLink('')} target="_blank" rel="noopener" onClick={() => setOpen(false)}><Button>Order Now</Button></a>
          </motion.nav>
        )}
      </AnimatePresence>
    </motion.header>
  )
}
