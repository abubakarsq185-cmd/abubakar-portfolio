# Dewan-e-Hareem — Website Template

A professional, responsive, single-page website for **Dewan-e-Hareem** — a fine-dining
multi-cuisine restaurant, the **Dewan-e-Khas** wedding & event marquee, and **Hareem Bakers**,
located in Kanju, Mingora, Swat Valley, Khyber Pakhtunkhwa, Pakistan.

Built from the public-sources business profile. No build step, no dependencies — just open
`index.html` in a browser (fonts load from Google Fonts).

## Files
- `index.html` — page structure & content
- `styles.css` — royal Mughal-inspired theme (maroon / gold / cream), fully responsive
- `main.js` — mobile nav, sticky header, scroll-reveal animations, footer year

## Sections
Hero · About · Services · Menu & Pricing · Dewan-e-Khas marquee · Hareem Bakers ·
Gallery · Reviews · Visit / Locations · Contact · Footer, plus floating call/WhatsApp buttons.

## Content confirmed from the profile
- Buffet pricing: Dinner Rs. 2,300/head (Mon–Thu), Hi-Tea Rs. 1,595/head
- Special BBQ Platter (house speciality)
- Main branch address + Plus Code `R87R+HP5`
- Department phone numbers, email, official domain, social links

## ⚠️ Still needed from the client (placeholders in place)
- [ ] Full à la carte menu (photo/PDF) with per-item prices
- [ ] Owner/manager name + founding story for the About section
- [ ] High-resolution logo file
- [ ] 15–20 licensed food/venue photos (replace the placeholder `.frame` blocks)
- [ ] One confirmed **primary** reservation + WhatsApp number for the CTA buttons
- [ ] Actual current operating hours
- [ ] Branch 2 (Kabal) status — open, or still "coming soon"?
- [ ] Any Halal certification, awards, or press mentions to feature
- [ ] Verified Google Maps rating/reviews to embed

## Swapping in real photos
Each grey striped `.frame` block is an image placeholder. Replace with, e.g.:
```html
<img src="images/dining-hall.jpg" alt="Dining hall at Dewan-e-Hareem" class="frame">
```
Keep the `frame` class (or remove it) and set `object-fit: cover` for best results.
