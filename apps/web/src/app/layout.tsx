import type { Metadata, Viewport } from 'next';
import '@gymguide/ui/styles.css';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL ?? 'http://localhost:3000'),
  title: {
    default: 'GymGuide — a digital coach for every member',
    template: '%s · GymGuide',
  },
  description:
    'GymGuide is gym management software with a digital fitness coach built in. Run your branches, memberships and billing — and give every member guided workouts, progress tracking and support, whether or not they have a personal trainer.',
  keywords: [
    'gym management software',
    'gym software Pakistan',
    'member app',
    'digital fitness coach',
    'gym CRM',
    'membership billing',
    'class booking software',
  ],
  openGraph: {
    type: 'website',
    siteName: 'GymGuide',
    title: 'GymGuide — a digital coach for every member',
    description:
      'Run the gym. Coach every member. Multi-branch management, memberships and billing, plus a guided training experience members actually use.',
    locale: 'en_PK',
  },
  twitter: { card: 'summary_large_image', title: 'GymGuide', description: 'A digital coach for every gym member.' },
  robots: { index: true, follow: true },
  alternates: { canonical: '/' },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F6F4F0' },
    { media: '(prefers-color-scheme: dark)', color: '#08090B' },
  ],
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
