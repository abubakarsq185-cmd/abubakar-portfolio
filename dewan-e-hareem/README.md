# Dewan-e-Hareem — Website Template

A professional, responsive, single-page website for **Dewan-e-Hareem** — a fine-dining
multi-cuisine restaurant, the **Dewan-e-Khas** wedding & event marquee, and **Hareem Bakers**,
located in Kanju, Mingora, Swat Valley, Khyber Pakhtunkhwa, Pakistan.

Built from the public-sources business profile. No build step, no dependencies — just open
`index.html` in a browser (fonts load from Google Fonts).

## Files
- `index.html` — page structure & content
- `styles.css` — royal Mughal-inspired theme (maroon / gold / cream), fully responsive
- `main.js` — mobile nav, sticky header, scroll-reveal animations, gallery lightbox, footer year
- `media/` — cinematic hero video (`hero.mp4` + `hero.webm`) and `hero-poster.jpg`
- `images/` — venue photography + the gold medallion logo (`logo-medallion.png`, `logo-180.png`, `favicon-32.png`)

## Hero video
The hero is a colour-graded, upscaled (1080p) loop of the venue's illuminated exterior —
warm cinematic grade, subtle vignette, muted autoplay loop with `playsinline` and a poster
fallback. Served as WebM (VP9) with an MP4 fallback. Source clip was enhanced with ffmpeg.

## Logo
The client's gold medallion is cropped to a transparent circular emblem and used as the
header/footer brand mark (with a hover shimmer) and as a glowing, gently-floating crest in
the hero. It also drives the favicon and Apple touch icon.

## Sections
Hero · About · Services · Menu & Pricing · Dewan-e-Khas marquee · Hareem Bakers ·
Gallery · Reviews · Visit / Locations · Contact · Footer, plus floating call/WhatsApp buttons.

## Content confirmed from the profile
- Buffet pricing: Dinner Rs. 2,300/head (Mon–Thu), Hi-Tea Rs. 1,595/head
- Special BBQ Platter (house speciality)
- Main branch address + Plus Code `R87R+HP5`
- Department phone numbers, email, official domain, social links

## Real photos now in place
Five real photographs of the Dewan-e-Khas marquee live in `images/` and are used across the site:

| File | Used in |
|---|---|
| `grand-aisle.jpg` | Full-bleed hero background + gallery hero tile |
| `marquee-canopy.jpg` | About section + gallery |
| `stage-floral-arch.jpg` | About section + gallery |
| `stage-swing.jpg` | Dewan-e-Khas section + gallery |
| `hall-lounge.jpg` | Dewan-e-Khas section + gallery |

The gallery is a clickable mosaic with a full-screen lightbox (arrow-key / Escape support).

## ⚠️ Still needed from the client
- [ ] Full à la carte menu (photo/PDF) with per-item prices
- [ ] Owner/manager name + founding story for the About section
- [ ] High-resolution logo file
- [ ] **Food & bakery photos** (buffet spread, BBQ platter, cakes) — the bakery section still uses placeholders
- [ ] A few more venue/exterior + daytime Swat-view shots to widen the gallery
- [ ] One confirmed **primary** reservation + WhatsApp number for the CTA buttons
- [ ] Actual current operating hours
- [ ] Branch 2 (Kabal) status — open, or still "coming soon"?
- [ ] Any Halal certification, awards, or press mentions to feature
- [ ] Verified Google Maps rating/reviews to embed

## Swapping in more photos
The remaining grey striped `.frame` blocks (bakery section) are placeholders. Replace with, e.g.:
```html
<img src="images/signature-cake.jpg" alt="Signature cake from Hareem Bakers" class="frame frame-square">
```
Keep the `frame` class — `img.frame` is already styled with `object-fit: cover`.

## Owner mode (editable menu)
The menu is fully editable by the owner — no coding.

1. Scroll to the footer and click **"Owner login"**. Enter the passcode
   (default **`hareem2026`** — change it in `main.js`, `var PASS`).
2. An **Owner mode** bar appears. Every dish shows an **Edit** badge — tap a dish to:
   - **Upload / change / replace its photo**
   - **Edit its name**
   - **Edit its price**
   Then **Save**. Use **Reset item** to restore the original.
3. Edits are stored in that browser. To publish them to everyone:
   - Click **⬇ Export menu file** → downloads `menu-data.json`.
   - Put that file at `data/menu-data.json` on the live site.
   - All visitors now see the updated photos/names/prices.
   - **⬆ Import** loads a `menu-data.json` back into the editor.

> Note: this is a client-side editor (the site is static). The passcode is
> basic gating, not strong security. For multi-user live editing without the
> export/import step, a small backend/CMS would be needed — happy to add one.
