# Town Pizza Hut — Website

Premium, animation-rich restaurant site built with **Vite + React + Tailwind CSS + Framer Motion**, with a **shadcn/ui**-style Button. CRAV-style scroll storytelling, rebranded fully around Town Pizza Hut (Swat).

## Run locally

```bash
cd pizza-app
npm install
npm run dev        # http://localhost:5173
```

## Build & deploy (static)

```bash
npm run build      # outputs to dist/
npm run preview    # preview the production build
```

`dist/` is plain static files — deploy free to **Netlify, Vercel, GitHub Pages, Cloudflare Pages**, or any static host.

## Add your real photos (recommended for photo-realism)

1. Put transparent-background / 4K photos in `public/images/`.
2. **Hero pizza:** in `src/components/Hero.jsx`, set `const HERO_PHOTO = '/images/hero-pizza.png'` — it replaces the crafted SVG.
3. **Gallery:** edit the `collage` array in `src/components/Sections.jsx` to point at your photos.

## Stack / skills used
- **ui-ux-pro-max** — design system (warm red + gold, Playfair Display, 200–300ms motion) + accessibility checklist (focus states, skip link, SVG icons).
- **motion-framer** — Framer Motion animation patterns (scroll reveals, hero spring tilt, stagger, marquee, AnimatePresence tab transitions).
- **shadcn** registry — Button component pattern.

## Structure
- `src/components/` — Hero, Nav, Sections (Story/Flagship/Collage/Quality/Ingredients), MenuSection, Deals, Branches, Footer, Loader, PizzaArt
- `src/lib/data.js` — all menu items, deals, branches (edit prices here)
- `src/lib/utils.js` — WhatsApp number + helpers
