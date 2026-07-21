import type { Metadata, Viewport } from "next";
import { Playfair_Display, Oswald, Inter } from "next/font/google";
import { RESTAURANT, branches } from "@/lib/data";
import { SmoothScroll } from "@/components/SmoothScroll";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { FloatingWA } from "@/components/FloatingWA";
import "./globals.css";

const playfair = Playfair_Display({ subsets: ["latin"], weight: ["700", "900"], variable: "--font-playfair", display: "swap" });
const oswald = Oswald({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-oswald", display: "swap" });
const inter = Inter({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(RESTAURANT.url),
  title: {
    default: `${RESTAURANT.name} — ${RESTAURANT.tagline} | Swat`,
    template: `%s | ${RESTAURANT.name}`,
  },
  description:
    "Town Pizza Hut — Family Restaurant in Swat. Fresh, hand-made pizza, juicy burgers & crispy fried chicken across 5 branches. Cinematic ordering experience. The Name of Quality.",
  keywords: ["pizza Swat", "Town Pizza Hut", "best pizza Swat", "burgers Swat", "fried chicken", "family restaurant Swat", "pizza delivery"],
  applicationName: RESTAURANT.name,
  authors: [{ name: RESTAURANT.name }],
  openGraph: {
    type: "website",
    title: `${RESTAURANT.name} — ${RESTAURANT.tagline}`,
    description: "Fresh, hand-made pizza, juicy burgers & crispy fried chicken across 5 branches in Swat.",
    siteName: RESTAURANT.name,
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: `${RESTAURANT.name} — ${RESTAURANT.tagline}`,
    description: "Fresh, hand-made pizza & more across 5 branches in Swat.",
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#3d0b0e",
  width: "device-width",
  initialScale: 1,
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "Restaurant",
  name: RESTAURANT.name,
  description: "Family restaurant serving fresh hand-made pizza, burgers and fried chicken across 5 branches in Swat.",
  servesCuisine: ["Pizza", "Fast Food", "Burgers", "Fried Chicken"],
  priceRange: "₨₨",
  url: RESTAURANT.url,
  telephone: "+92" + RESTAURANT.wa.slice(2),
  openingHours: "Mo-Su 10:00-23:45",
  address: branches.map((b) => ({
    "@type": "PostalAddress",
    streetAddress: b.addr,
    addressLocality: "Swat",
    addressCountry: "PK",
  })),
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${playfair.variable} ${oswald.variable} ${inter.variable} antialiased`}>
      <body>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
        <a
          href="#menu"
          className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-0 focus:z-[9999] focus:rounded-b-lg focus:bg-gold focus:px-4 focus:py-2.5 focus:text-[13px] focus:uppercase focus:tracking-wide focus:text-maroon-deep"
        >
          Skip to menu
        </a>
        <SmoothScroll>
          <Nav />
          <main>{children}</main>
          <Footer />
        </SmoothScroll>
        <FloatingWA />
      </body>
    </html>
  );
}
