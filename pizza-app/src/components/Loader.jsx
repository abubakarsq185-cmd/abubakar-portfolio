import { motion } from 'framer-motion'

export function Loader({ done }) {
  return (
    <motion.div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center"
      style={{ background: 'radial-gradient(circle at 50% 40%,#5a1216 0%,#3d0b0e 65%,#160406 100%)' }}
      initial={{ opacity: 1 }}
      animate={{ opacity: done ? 0 : 1, visibility: done ? 'hidden' : 'visible' }}
      transition={{ duration: 0.8 }}
    >
      <div className="relative flex h-[104px] w-[104px] items-center justify-center rounded-full border-[3px] border-gold/20 border-t-gold animate-spin" style={{ animationDuration: '1.1s' }}>
        <span className="text-[40px]" style={{ animation: 'spin 3s linear infinite reverse' }}>🍕</span>
      </div>
      <div className="mt-6 font-display text-[26px] font-black tracking-wide text-gold">
        TOWN <span className="text-red-bright">PIZZA HUT</span>
      </div>
      <div className="mt-2.5 font-oswald text-xs uppercase tracking-[4px] text-gold-light">Firing up the oven…</div>
      <div className="mt-5 h-[3px] w-[180px] overflow-hidden rounded bg-gold/15">
        <motion.i className="block h-full w-2/5 bg-gradient-to-r from-transparent via-gold to-transparent"
          animate={{ x: ['-120%', '320%'] }} transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }} />
      </div>
    </motion.div>
  )
}
