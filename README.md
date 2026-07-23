# Town Pizza Hut — Cinematic Restaurant Website

A premium, single-page restaurant experience built around a fully procedural
**3D pizza hero**. Dark, warm, editorial visual language with scroll-driven
storytelling, smooth scrolling, and a fast, code-split build.

**The Name of Quality** · Family Restaurant · Free delivery within 5 km on
orders above Rs 1000.

## Stack

| Concern              | Tool                                              |
| -------------------- | ------------------------------------------------- |
| Build / dev server   | [Vite](https://vitejs.dev)                        |
| 3D hero              | [Three.js](https://threejs.org) (procedural pizza, PBR env, steam, bloom) |
| Animation            | [GSAP](https://gsap.com) + ScrollTrigger          |
| Smooth scroll        | [Lenis](https://lenis.darkroom.engineering)       |
| Fonts                | Bebas Neue · Cormorant Garamond · Outfit (Google) |

No framework runtime — the UI is rendered from plain data for maximum speed.

## Getting started

```bash
npm install
npm run dev      # local dev at http://localhost:5173
npm run build    # production build to /dist
npm run preview  # preview the production build
```

## Project structure

```
index.html            # page shell, SEO, Open Graph, JSON-LD Restaurant schema
public/
  favicon.svg         # brand favicon
  images/             # placeholder art — replace with real photography
  robots.txt, sitemap.xml
src/
  main.js             # entry: mounts DOM, boots motion + 3D, hides loader
  data.js             # ← single source of truth for ALL menu content & prices
  render.js           # turns data.js into DOM cards
  pizza-scene.js      # the Three.js 3D pizza hero
  motion.js           # Lenis + GSAP scroll reveals, nav, filters
  styles.css          # complete design system
vite.config.js        # build config (three/gsap split into their own chunks)
```

## Editing content

Everything visible on the site is driven by **`src/data.js`** — deals, family
deals, specials, pizzas + sizes/prices, premium pizzas, burgers, sides,
branches. Change a price or add a pizza there and it appears automatically.

Branch phone numbers, the birthday offer, hours, and management contacts live
in `index.html`.

## Replacing placeholder assets

- **Burger showcase image:** replace `public/images/burger-menu.svg` (or drop
  in a `.jpg`/`.png` and update the `<img src>` in `index.html`).
- **Social share image:** replace `public/images/og-cover.svg`.
- **Real pizza model:** `src/pizza-scene.js` is self-contained and procedural.
  To use a Blender export instead, load a `.glb` with `GLTFLoader` and swap it
  for the `pizza` group — the lighting, steam, and interaction stay as-is.

## Performance & quality notes

- Three.js and GSAP are split into separate chunks; the 3D scene is
  **dynamically imported** so it never blocks first paint.
- The render loop **pauses when the hero scrolls off-screen** and caps the
  device pixel ratio at 2 for stable 60fps.
- Bloom post-processing is disabled on very small screens.
- Full **`prefers-reduced-motion`** support: no auto-spin, no steam, instant
  reveals, native scrolling.
- Accessible: skip link, semantic landmarks, ARIA labels, keyboard-focusable
  cards, visible focus states, WCAG-minded contrast.
- SEO: descriptive metadata, canonical, Open Graph, Twitter cards, JSON-LD
  `Restaurant` structured data, `robots.txt`, `sitemap.xml`.

## Deployment

Any static host works. For Vercel/Netlify: build command `npm run build`,
output directory `dist`.
