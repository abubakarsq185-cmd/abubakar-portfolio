import { motion } from 'framer-motion'

/* Scroll-reveal wrapper — motion-framer skill pattern (stagger + spring-ish ease) */
export function Reveal({ children, className, delay = 0, y = 44, as = 'div' }) {
  const MotionTag = motion[as] || motion.div
  return (
    <MotionTag
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.8, delay, ease: [0.2, 0.7, 0.2, 1] }}
    >
      {children}
    </MotionTag>
  )
}

export const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
}
export const item = {
  hidden: { opacity: 0, y: 30 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.2, 0.7, 0.2, 1] } },
}
