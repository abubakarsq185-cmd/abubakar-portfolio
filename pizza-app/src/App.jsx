import { useEffect, useState } from 'react'
import { motion, useScroll } from 'framer-motion'
import { Loader } from '@/components/Loader'
import { Nav } from '@/components/Nav'
import { Hero } from '@/components/Hero'
import { Story, Flagship, Collage, Quality, Ingredients } from '@/components/Sections'
import { MenuSection } from '@/components/MenuSection'
import { Deals } from '@/components/Deals'
import { Branches } from '@/components/Branches'
import { InfoStrip, CTA, Footer, FloatingWA } from '@/components/Footer'

export default function App() {
  const [loaded, setLoaded] = useState(false)
  const { scrollYProgress } = useScroll()

  useEffect(() => {
    const t = setTimeout(() => setLoaded(true), 1100)
    return () => clearTimeout(t)
  }, [])

  return (
    <div className="grain">
      <Loader done={loaded} />
      <a href="#menu" className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-0 focus:z-[9999] focus:rounded-b-lg focus:bg-gold focus:px-4 focus:py-2.5 focus:font-oswald focus:text-[13px] focus:uppercase focus:tracking-wide focus:text-maroon-deep">Skip to menu</a>
      <motion.div className="fixed left-0 top-0 z-[960] h-[3px] origin-left bg-gradient-to-r from-red-bright to-gold" style={{ scaleX: scrollYProgress, width: '100%' }} />
      <Nav />
      <main>
        <Hero />
        <Story />
        <Flagship />
        <Collage />
        <Quality />
        <Ingredients />
        <MenuSection />
        <Deals />
        <Branches />
        <InfoStrip />
        <CTA />
      </main>
      <Footer />
      <FloatingWA />
    </div>
  )
}
