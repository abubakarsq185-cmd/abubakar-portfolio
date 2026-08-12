import Link from 'next/link';
import type { Metadata } from 'next';
import { ProgressRing, SafetyBanner, Badge } from '@gymguide/ui';
import { requireMember } from '@/server/auth/session';
import { loadToday } from '@/server/services/training';
import { requireOnboarded } from '@/server/services/onboarding';

export const metadata: Metadata = { title: 'Today' };

export default async function TodayPage() {
  const { actor } = await requireMember();
  // A member who has not finished onboarding has no plan to show, so send them
  // to the wizard rather than presenting an empty Today screen.
  await requireOnboarded(actor);
  const today = await loadToday(actor);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const primary = today.cards[0];
  const rest = today.cards.slice(1);

  return (
    <div className="stack stack-6 fade-up">
      <header className="stack stack-2">
        <p className="micro muted">
          {new Date().toLocaleDateString('en-PK', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
        <h1 style={{ fontSize: '1.5rem' }}>
          {greeting}, {today.greetingName}
        </h1>
      </header>

      {today.safetyBanner ? (
        <SafetyBanner tone="warning" title="A coach is reviewing your plan">
          {today.safetyBanner}
        </SafetyBanner>
      ) : null}

      {primary ? (
        <section className="card card-accent stack stack-4">
          <div className="row-between">
            <span className="eyebrow">What to do today</span>
            {primary.kind === 'workout' ? <Badge tone="primary">Session ready</Badge> : null}
          </div>
          <h2 style={{ fontSize: '1.375rem' }}>{primary.title}</h2>
          <p className="secondary">{primary.subtitle}</p>
          {primary.ctaHref ? (
            <Link className="btn btn-primary btn-lg btn-block" href={primary.ctaHref}>
              {primary.ctaLabel}
            </Link>
          ) : null}
        </section>
      ) : null}

      <section className="grid grid-2">
        <article className="card stack stack-3" style={{ alignItems: 'center' }}>
          <ProgressRing value={today.adherencePercent} caption="4 weeks" label="Adherence" />
          <p className="small secondary" style={{ textAlign: 'center' }}>
            {today.adherencePercent >= 80
              ? 'Outstanding consistency. This is exactly how progress happens.'
              : today.adherencePercent >= 55
                ? 'Solid. One more session a week would compound nicely.'
                : 'Every session counts. Start with one this week.'}
          </p>
        </article>

        <article className="card stack stack-3">
          <span className="stat-label">Sessions completed</span>
          <span className="stat-value">{today.streak}</span>
          <p className="small secondary">In the last four weeks.</p>
          <Link className="btn btn-secondary btn-sm" href="/app/progress">
            See your progress
          </Link>
        </article>
      </section>

      {rest.length > 0 ? (
        <section className="stack stack-3">
          <h2 style={{ fontSize: '1.0625rem' }}>Also today</h2>
          {rest.map((card) => (
            <article key={`${card.kind}-${card.title}`} className="card card-hover row-between">
              <div className="stack" style={{ gap: '0.125rem', minWidth: 0 }}>
                <strong className="small">{card.title}</strong>
                <span className="micro muted">{card.subtitle}</span>
              </div>
              {card.ctaHref ? (
                <Link className="btn btn-secondary btn-sm" href={card.ctaHref}>
                  {card.ctaLabel}
                </Link>
              ) : null}
            </article>
          ))}
        </section>
      ) : null}

      <article className="card card-hover row-between">
        <div className="stack" style={{ gap: '0.125rem', minWidth: 0 }}>
          <strong className="small">Eating</strong>
          <span className="micro muted">Portion guidance, your plan for today, and a place to log meals.</span>
        </div>
        <Link className="btn btn-secondary btn-sm" href="/app/nutrition">
          Open nutrition
        </Link>
      </article>

      <p className="micro muted" style={{ textAlign: 'center' }}>
        Something not right? <Link href="/app/support">Talk to gym staff</Link> — a real person, not the app.
      </p>
    </div>
  );
}
