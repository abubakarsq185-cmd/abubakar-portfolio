/**
 * main.js — application entry point.
 *
 * Order matters:
 *  1. Render all menu DOM from data (so motion can find the cards).
 *  2. Boot the 3D pizza hero (heavy — kept in its own chunk by Vite).
 *  3. Wire scroll + interaction choreography.
 *  4. Dismiss the loader once the first paint is ready.
 */

import './styles.css'
import { mountAll } from './render.js'
import { initMotion } from './motion.js'

mountAll()
initMotion()

// Lazily import the 3D scene so the heavy three.js chunk never blocks
// first paint or the loader dismissal on slow connections.
const canvas = document.getElementById('pizzaCanvas')
if (canvas) {
  import('./pizza-scene.js')
    .then(({ initPizzaScene }) => initPizzaScene(canvas))
    .catch((err) => {
      // A WebGL failure must never break the rest of the site.
      console.warn('3D hero unavailable:', err)
      canvas.closest('.hero__stage')?.classList.add('hero__stage--fallback')
    })
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
