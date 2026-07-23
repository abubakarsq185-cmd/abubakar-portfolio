/**
 * motion.js — scroll + interaction choreography.
 *
 * - Lenis for buttered smooth scrolling (disabled under reduced-motion).
 * - GSAP + ScrollTrigger for cinematic reveals synced to the Lenis scroll.
 * - Nav: mobile drawer, scroll state, active-section highlighting.
 * - Menu category filtering with an animated reshuffle.
 * - A top scroll-progress bar.
 */

import Lenis from 'lenis'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

export function initMotion() {
  const lenis = setupLenis()
  setupReveals()
  setupNav(lenis)
  setupFilters()
  setupScrollProgress()
  refreshOnLoad()
}

/* ---------- smooth scroll ---------- */
function setupLenis() {
  if (reduceMotion) return null

  const lenis = new Lenis({
    duration: 1.1,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    smoothWheel: true,
  })

  lenis.on('scroll', ScrollTrigger.update)
  gsap.ticker.add((time) => lenis.raf(time * 1000))
  gsap.ticker.lagSmoothing(0)
  return lenis
}

/* ---------- scroll reveals ---------- */
function setupReveals() {
  if (reduceMotion) {
    document
      .querySelectorAll('.reveal-up, .pull, .pull-right, .pull-stagger, .reveal-card')
      .forEach((el) => el.classList.add('is-in'))
    return
  }

  // Hero copy — quick staggered entrance on load.
  gsap.to('.reveal-up', {
    y: 0,
    opacity: 1,
    duration: 0.9,
    stagger: 0.12,
    ease: 'power3.out',
    delay: 0.25,
  })

  // Section headers / panels pull up as they enter.
  gsap.utils.toArray('.pull').forEach((el) => {
    gsap.fromTo(
      el,
      { y: 42, opacity: 0 },
      {
        y: 0,
        opacity: 1,
        duration: 0.8,
        ease: 'power3.out',
        scrollTrigger: { trigger: el, start: 'top 88%' },
      },
    )
  })

  gsap.utils.toArray('.pull-right').forEach((el) => {
    gsap.fromTo(
      el,
      { x: 60, opacity: 0 },
      {
        x: 0,
        opacity: 1,
        duration: 0.9,
        ease: 'power3.out',
        scrollTrigger: { trigger: el, start: 'top 85%' },
      },
    )
  })

  // Cards animate in batches for a wave effect.
  ScrollTrigger.batch('.reveal-card', {
    start: 'top 90%',
    onEnter: (batch) =>
      gsap.to(batch, {
        y: 0,
        opacity: 1,
        duration: 0.7,
        stagger: 0.08,
        ease: 'power3.out',
        overwrite: true,
      }),
  })
}

/* ---------- navigation ---------- */
function setupNav(lenis) {
  const nav = document.getElementById('nav')
  const toggle = document.getElementById('navToggle')
  const links = document.getElementById('navLinks')

  // Condense the header once scrolled.
  const onScroll = () => nav?.classList.toggle('is-scrolled', window.scrollY > 40)
  onScroll()
  window.addEventListener('scroll', onScroll, { passive: true })

  // Mobile drawer.
  toggle?.addEventListener('click', () => {
    const open = nav.classList.toggle('is-open')
    toggle.setAttribute('aria-expanded', String(open))
    toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu')
  })

  // Smooth-scroll anchor links + close drawer.
  links?.querySelectorAll('a[href^="#"]').forEach((a) => {
    a.addEventListener('click', (e) => {
      const id = a.getAttribute('href')
      const target = document.querySelector(id)
      if (!target) return
      e.preventDefault()
      nav.classList.remove('is-open')
      toggle?.setAttribute('aria-expanded', 'false')
      if (lenis) lenis.scrollTo(target, { offset: -70 })
      else target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' })
    })
  })

  // Active-section highlighting.
  const anchors = [...(links?.querySelectorAll('a[href^="#"]') || [])]
  const sections = anchors
    .map((a) => document.querySelector(a.getAttribute('href')))
    .filter(Boolean)
  const spy = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return
        anchors.forEach((a) =>
          a.classList.toggle('is-active', a.getAttribute('href') === `#${entry.target.id}`),
        )
      })
    },
    { rootMargin: '-45% 0px -50% 0px' },
  )
  sections.forEach((s) => spy.observe(s))
}

/* ---------- menu filtering ---------- */
function setupFilters() {
  const chips = document.querySelectorAll('.menu__toolbar .chip')
  const rows = document.querySelectorAll('.pizza-row')

  chips.forEach((chip) => {
    chip.addEventListener('click', () => {
      chips.forEach((c) => c.classList.remove('is-active'))
      chip.classList.add('is-active')
      const filter = chip.dataset.filter

      rows.forEach((row) => {
        const show = filter === 'all' || row.dataset.category === filter
        if (reduceMotion) {
          row.style.display = show ? '' : 'none'
          return
        }
        if (show) {
          row.style.display = ''
          gsap.fromTo(
            row,
            { opacity: 0, y: 16 },
            { opacity: 1, y: 0, duration: 0.45, ease: 'power2.out' },
          )
        } else {
          gsap.to(row, {
            opacity: 0,
            y: 10,
            duration: 0.25,
            ease: 'power1.in',
            onComplete: () => (row.style.display = 'none'),
          })
        }
      })
    })
  })
}

/* ---------- scroll progress bar ---------- */
function setupScrollProgress() {
  const bar = document.getElementById('scrollProgress')
  if (!bar) return
  const update = () => {
    const max = document.documentElement.scrollHeight - window.innerHeight
    const p = max > 0 ? window.scrollY / max : 0
    bar.style.transform = `scaleX(${p})`
  }
  update()
  window.addEventListener('scroll', update, { passive: true })
  window.addEventListener('resize', update)
}

/* ---------- make sure triggers measure after fonts/images ---------- */
function refreshOnLoad() {
  window.addEventListener('load', () => ScrollTrigger.refresh())
  setTimeout(() => ScrollTrigger.refresh(), 600)
}
