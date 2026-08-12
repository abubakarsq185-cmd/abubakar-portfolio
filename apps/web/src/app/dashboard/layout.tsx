import Link from 'next/link';
import { can, ROLE_LABELS } from '@gymguide/types';
import { Avatar } from '@gymguide/ui';
import { requireStaff, signOut } from '@/server/auth/session';

async function signOutAction(): Promise<void> {
  'use server';
  await signOut();
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { actor, organizationName } = await requireStaff();

  const nav: Array<{ heading: string; links: Array<{ href: string; label: string; show: boolean }> }> = [
    {
      heading: 'Overview',
      links: [
        { href: '/dashboard', label: 'Dashboard', show: true },
        { href: '/dashboard/reports', label: 'Reports', show: can(actor, 'reports.read') },
      ],
    },
    {
      heading: 'People',
      links: [
        { href: '/dashboard/members', label: 'Members', show: can(actor, 'members.read.all') || can(actor, 'members.read.assigned') },
        { href: '/dashboard/enrol', label: 'Enrol a member', show: can(actor, 'members.write') },
        { href: '/dashboard/leads', label: 'Leads & trials', show: can(actor, 'leads.read') },
        { href: '/dashboard/staff', label: 'Staff', show: can(actor, 'staff.read') },
      ],
    },
    {
      heading: 'Coaching',
      links: [
        { href: '/dashboard/coaching', label: 'Coaching queue', show: can(actor, 'checkins.review') },
        { href: '/dashboard/programs', label: 'Programs & exercises', show: can(actor, 'content.write') },
        { href: '/dashboard/escalations', label: 'Health escalations', show: can(actor, 'health.read') },
      ],
    },
    {
      heading: 'Operations',
      links: [
        { href: '/dashboard/classes', label: 'Classes', show: can(actor, 'classes.write') || can(actor, 'bookings.write') },
        { href: '/dashboard/attendance', label: 'Check-in', show: can(actor, 'attendance.write') },
        { href: '/dashboard/billing', label: 'Billing & payments', show: can(actor, 'finance.read') },
        { href: '/dashboard/automations', label: 'Automations', show: can(actor, 'automations.write') },
        { href: '/dashboard/support', label: 'Support', show: can(actor, 'support.read') },
      ],
    },
  ];

  return (
    <div className="shell">
      <aside className="sidebar">
        <Link href="/dashboard" className="brand" style={{ padding: '0 0.75rem' }}>
          <span className="brand-mark" aria-hidden="true">
            GG
          </span>
          <span className="stack" style={{ gap: 0 }}>
            <span style={{ fontSize: '0.9375rem' }}>{organizationName ?? 'GymGuide'}</span>
            <span className="micro muted" style={{ fontWeight: 500 }}>
              {ROLE_LABELS[actor.role]}
            </span>
          </span>
        </Link>

        <nav aria-label="Dashboard" className="stack stack-4">
          {nav.map((group) => {
            const links = group.links.filter((link) => link.show);
            if (links.length === 0) return null;
            return (
              <div key={group.heading} className="side-group">
                <span className="side-heading">{group.heading}</span>
                {links.map((link) => (
                  <Link key={link.href} className="side-link" href={link.href}>
                    {link.label}
                  </Link>
                ))}
              </div>
            );
          })}
        </nav>

        <div className="stack stack-3" style={{ marginTop: 'auto', padding: '0 0.25rem' }}>
          <div className="row">
            <Avatar name={actor.fullName} />
            <div className="stack" style={{ gap: 0, minWidth: 0 }}>
              <strong className="small" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {actor.fullName}
              </strong>
              <span className="micro muted">{actor.email}</span>
            </div>
          </div>
          <form action={signOutAction}>
            <button className="btn btn-ghost btn-sm btn-block" type="submit">
              Sign out
            </button>
          </form>
        </div>
      </aside>

      <main className="main" id="main">
        {children}
      </main>
    </div>
  );
}
