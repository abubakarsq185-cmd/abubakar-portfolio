import Link from 'next/link';

export function SiteHeader() {
  return (
    <header className="topbar" data-theme="dark" style={{ background: 'rgba(8, 9, 11, 0.82)', color: 'var(--bone-50)' }}>
      <div className="container topbar-inner">
        <Link href="/" className="brand" aria-label="GymGuide home">
          <span className="brand-mark" aria-hidden="true">
            GG
          </span>
          GymGuide
        </Link>

        <nav className="nav" aria-label="Primary">
          <Link className="nav-link" href="/#features">
            Product
          </Link>
          <Link className="nav-link" href="/#solutions">
            Solutions
          </Link>
          <Link className="nav-link" href="/#member-app">
            Member app
          </Link>
          <Link className="nav-link" href="/#pricing">
            Pricing
          </Link>
          <Link className="nav-link" href="/#faq">
            Resources
          </Link>
        </nav>

        <div className="row">
          <Link className="btn btn-ghost btn-sm hide-sm" href="/sign-in">
            Sign in
          </Link>
          <Link className="btn btn-secondary btn-sm hide-sm" href="/book-a-demo">
            Book a demo
          </Link>
          <Link className="btn btn-primary btn-sm" href="/sign-in">
            Start free trial
          </Link>
        </div>
      </div>
    </header>
  );
}
