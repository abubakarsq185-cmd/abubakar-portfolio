# Town Pizza Hut — Enterprise Web Experience

A production-grade, cinematic restaurant website built as a single-page scroll story with a real-time **WebGL 3D pizza hero**. Rebranded end-to-end around Town Pizza Hut (Swat) using the real menu, deals and branch data.

## Tech stack

| Area | Choice |
|------|--------|
| Framework | **Next.js 16** (App Router, Turbopack) |
| Language | **TypeScript** (strict) |
| UI | **React 19**, **Tailwind CSS v4** |
| 3D | **three.js**, **@react-three/fiber**, **@react-three/drei**, **@react-three/postprocessing** |
| Motion | **GSAP** (+ ScrollTrigger), **Framer Motion**, **Lenis** smooth scroll |
| Forms | **react-hook-form** + **zod** |
| Components | shadcn/ui Button pattern, **lucide-react** icons |

## Run it

```bash
cd town-pizza-enterprise
npm install
npm run dev        # http://localhost:3000
npm run build      # production build (typechecked)
npm start          # serve the production build
```

## The 3D hero

`src/components/three/PizzaScene.tsx` renders a **procedural PBR pizza** (crust, cheese, sauce, pepperoni, olives, basil) with cinematic lighting, **bloom**, **depth-of-field** (focused on the pizza), **vignette**, rising **steam particles**, orbiting **floating ingredients**, **mouse parallax**, and **scroll-driven separation** (ingredients lift and the pie spins as you scroll). It is mount-guarded (`Hero3D.tsx`) so the Canvas never server-renders, and it respects `prefers-reduced-motion`.

### Upgrade to a photoreal asset
The scene is architected for a drop-in upgrade: export a `.glb` of a real pizza (Blender / photo-scan) plus an `.hdr` environment, place them in `public/`, and swap the procedural meshes for `useGLTF('/pizza.glb')` + drei `<Environment files="/env.hdr" />`. No other code changes required — this is the path to a fully photoreal centrepiece.

## Sections
Hero · Featured Pizzas · Interactive Menu · **Live Pizza Customizer** · Super Deals · Ingredients · Chef Story · Gallery · Testimonials · Rewards · Locations · **Reservation form (RHF + Zod)** · FAQ · Footer. Ordering flows to WhatsApp click-to-chat.

## Quality
- **Strict TypeScript**, `tsc --noEmit` clean; `next build` passes with no errors.
- **SEO**: dynamic metadata, Open Graph, Twitter cards, **Restaurant JSON-LD**, `sitemap.ts`, `robots.ts`.
- **Accessibility**: semantic landmarks, ARIA, visible focus rings, skip link, reduced-motion.
- **Performance**: WebGL lazy/mount-guarded, static prerender, code-split client islands.

## Add your real photos
Gallery panels and section imagery are placeholders — drop 4K `.webp`/`.png` files into `public/images/` and reference them via `next/image`.

## Deploy
Optimised for **Vercel** (`vercel deploy`). Any Node host works via `npm run build && npm start`.
