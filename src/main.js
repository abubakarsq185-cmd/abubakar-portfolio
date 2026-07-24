/**
 * main.js — application entry point.
 *
 * Order matters:
 *  1. Render all menu DOM from data (so motion can find the cards).
 *  2. Prepare the cinematic hero video (autoplay + reduced-motion aware).
 *  3. Wire scroll + interaction choreography.
 *  4. Dismiss the loader once the first paint is ready.
 *
 * The interactive 3D pizza lives in ./pizza-scene.js and is no longer mounted
 * here (the hero now uses the promo video). It remains available for reuse —
 * import initPizzaScene(canvasEl) into any section to bring it back.
 */

import './styles.css'
import { mountAll } from './render.js'
import { initMotion } from './motion.js'

mountAll()
initMotion()
setupHeroVideo()

// Cinematic hero video: honour autoplay policies and reduced-motion.
function setupHeroVideo() {
  const video = document.getElementById('heroVideo')
  if (!video) return

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (reduceMotion) {
    // Show the first frame as a still and never loop-animate.
    video.removeAttribute('autoplay')
    video.pause()
    return
  }

  // Some browsers block autoplay until a gesture — retry on first interaction.
  const tryPlay = () => {
    const p = video.play()
    if (p && typeof p.catch === 'function') p.catch(() => {})
  }
  tryPlay()
  const kick = () => {
    tryPlay()
    window.removeEventListener('pointerdown', kick)
    window.removeEventListener('touchstart', kick)
  }
  window.addEventListener('pointerdown', kick, { once: true })
  window.addEventListener('touchstart', kick, { once: true })

  // Pause when scrolled off-screen to save battery/CPU.
  const io = new IntersectionObserver(
    (entries) => entries.forEach((e) => (e.isIntersecting ? tryPlay() : video.pause())),
    { threshold: 0.1 },
  )
  io.observe(video)
}

// Dismiss the loader after paint.
function hideLoader() {
  const loader = document.getElementById('loader')
  if (!loader) return
  loader.classList.add('is-done')
  window.setTimeout(() => loader.remove(), 700)
}

if (document.readyState === 'complete') {
  requestAnimationFrame(hideLoader)
} else {
  window.addEventListener('load', () => requestAnimationFrame(hideLoader))
  // Safety net: never trap the user behind the loader.
  window.setTimeout(hideLoader, 3500)
}
