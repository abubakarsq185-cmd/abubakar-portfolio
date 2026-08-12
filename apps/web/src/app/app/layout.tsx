import Link from 'next/link';
import { requireMember } from '@/server/auth/session';

const TABS = [
  { href: '/app', label: 'Today', icon: '◉' },
  { href: '/app/train', label: 'Train', icon: '▶' },
  { href: '/app/plan', label: 'Plan', icon: '☰' },
  { href: '/app/progress', label: 'Progress', icon: '◔' },
  { href: '/app/support', label: 'Support', icon: '◆' },
];

export default async function MemberAppLayout({ children }: { children: React.ReactNode }) {
  const { organizationName } = await requireMember();

  return (
    <div data-theme="dark" style={{ minHeight: '100dvh', background: 'var(--bg)', color: 'var(--text)' }}>
      <header className="topbar">
        <div className="app-main topbar-inner" style={{ paddingBottom: 0, height: 60 }}>
          <Link href="/app" className="brand" style={{ fontSize: '0.9375rem' }}>
            <span className="brand-mark" aria-hidden="true">
              GG
            </span>
            {organizationName ?? 'GymGuide'}
          </Link>
          <Link href="/app/profile" className="btn btn-ghost btn-sm" aria-label="Profile and settings">
            Profile
          </Link>
        </div>
      </header>

      <main id="main" className="app-main">
        {children}
      </main>

      <nav className="tabbar" aria-label="Member app">
        {TABS.map((tab) => (
          <Link key={tab.href} href={tab.href} className="tab">
            <span className="tab-icon" aria-hidden="true">
              {tab.icon}
            </span>
            {tab.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
