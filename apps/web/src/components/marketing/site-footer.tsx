import Link from 'next/link';

const COLUMNS: Array<{ heading: string; links: Array<[string, string]> }> = [
  {
    heading: 'Product',
    links: [
      ['Digital coach', '/#features'],
      ['Guided workouts', '/#member-app'],
      ['Memberships & billing', '/#features'],
      ['Analytics', '/#features'],
      ['Pricing', '/#pricing'],
    ],
  },
  {
    heading: 'Solutions',
    links: [
      ['Gym owners', '/#solutions'],
      ['Coaches', '/#solutions'],
      ['Front desk', '/#solutions'],
      ['Members', '/#member-app'],
    ],
  },
  {
    heading: 'Company',
    links: [
      ['Book a demo', '/book-a-demo'],
      ['Security', '/security'],
      ['Support', '/support'],
      ['Status', '/status'],
    ],
  },
  {
    heading: 'Legal',
    links: [
      ['Privacy notice', '/legal/privacy'],
      ['Terms of service', '/legal/terms'],
      ['Data processing', '/legal/dpa'],
      ['Acceptable use', '/legal/acceptable-use'],
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="footer">
      <div className="container stack stack-8">
        <div className="footer-grid">
          <div className="stack stack-3">
            <Link href="/" className="brand">
              <span className="brand-mark" aria-hidden="true">
                GG
              </span>
              GymGuide
            </Link>
            <p className="small muted" style={{ maxWidth: '32ch' }}>
              Gym management software with a digital coach built in. Made for Pakistani gyms first, designed to travel.
            </p>
            <div className="row">
              {['LinkedIn', 'Instagram', 'YouTube'].map((network) => (
                <a key={network} className="small muted" href={`https://example.com/${network.toLowerCase()}`} rel="noreferrer noopener">
                  {network}
                </a>
              ))}
            </div>
          </div>

          {COLUMNS.map((column) => (
            <div key={column.heading} className="stack stack-3">
              <strong className="micro" style={{ letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                {column.heading}
              </strong>
              <div className="footer-links">
                {column.links.map(([label, href]) => (
                  <Link key={label} href={href}>
                    {label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="row-between row-wrap" style={{ borderTop: '1px solid var(--border)', paddingTop: '1.5rem' }}>
          <p className="micro muted">© {new Date().getFullYear()} GymGuide. All rights reserved.</p>
          <p className="micro muted">
            GymGuide is not a medical service. It does not diagnose, treat or replace doctors, physiotherapists,
            dietitians or qualified trainers.
          </p>
        </div>
      </div>
    </footer>
  );
}
