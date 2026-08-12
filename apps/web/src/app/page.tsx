import Link from 'next/link';
import type { Metadata } from 'next';
import { Badge, ProgressRing, Sparkline } from '@gymguide/ui';
import { SiteHeader } from '@/components/marketing/site-header';
import { SiteFooter } from '@/components/marketing/site-footer';

export const metadata: Metadata = {
  title: 'GymGuide — a digital coach for every member',
  description:
    'Gym management software with a digital fitness coach built in. Multi-branch operations, memberships and billing, plus guided workouts, progress tracking and safe human escalation for every member.',
};

const FEATURES = [
  {
    icon: '◆',
    title: 'Digital Coach',
    body: 'Every member gets a personalised plan from your approved program templates — not a chatbot inventing workouts. The engine adapts load, volume and schedule from what they actually log, and shows its reasoning.',
  },
  {
    icon: '▶',
    title: 'Guided Workouts',
    body: 'Set-by-set guidance with technique video, form cues, common mistakes, rest timers and previous performance. Works offline on the gym floor and syncs when the phone reconnects.',
  },
  {
    icon: '◍',
    title: 'Nutrition & Habits',
    body: 'Plate-based guidance for members who will never count macros, and proper targets for those who will. Pakistani foods, halal-first, Ramadan schedules, sleep, steps and water.',
  },
  {
    icon: '₨',
    title: 'Memberships & Billing',
    body: 'Recurring plans, class packs, PT packages, freezes, upgrades with day-precise proration, refunds and failed-payment recovery — on a proper double-entry ledger, not a status column.',
  },
  {
    icon: '⊞',
    title: 'Attendance & Scheduling',
    body: 'Timetable, capacity, waitlists, cancellation windows and no-show tracking. QR, barcode, kiosk or manual check-in, with a clean seam for smart-door hardware later.',
  },
  {
    icon: '↻',
    title: 'Automations',
    body: 'Welcome sequences, missed-workout nudges, inactivity recovery, payment reminders and birthday messages — with quiet hours, opt-in and frequency caps enforced in code.',
  },
  {
    icon: '⌂',
    title: 'Branch Management',
    body: 'Organisation and branch scoping across staff, equipment, classes and reporting. A branch manager sees their branch; an owner sees the whole brand.',
  },
  {
    icon: '◔',
    title: 'Analytics',
    body: 'Revenue and collections, attendance, retention cohorts, lead and trial conversion, program adherence, inactivity risk and coach workload. Exportable.',
  },
  {
    icon: '◈',
    title: 'White Label',
    body: 'Your logo, your colours, your app name and your domain on the Enterprise plan. Members experience your brand, not ours.',
  },
];

const PERSONAS = [
  {
    role: 'For gym owners',
    line: 'See revenue, retention and risk across every branch in one place — and know that members are actually being coached, not just billed.',
    points: ['Branch-level P&L and collections', 'Churn and cohort retention', 'Staff permissions you control', 'White-label member app'],
  },
  {
    role: 'For coaches',
    line: 'Your caseload, their real logged data, and a queue that tells you who needs you this week rather than who shouted loudest.',
    points: ['Assigned members only', 'Weekly check-in review queue', 'Program builder with versioning', 'Override any automated decision'],
  },
  {
    role: 'For front desk',
    line: 'Enrol a member, take payment and hand them a working app in about three minutes — without ever seeing their health data.',
    points: ['One-screen enrolment', 'Cash, transfer, card, wallet and QR', 'Check-in by QR or member number', 'No access to health or coaching notes'],
  },
  {
    role: 'For members',
    line: 'Open the app and know exactly what to do today, how to do it properly, and whether it is working.',
    points: ['Today, Train, Plan, Progress, Support', 'Offline workouts', 'Urdu, Roman Urdu and English', 'A real person is always one tap away'],
  },
];

const PRICING = [
  {
    name: 'Starter',
    price: 'Rs 24,000',
    cadence: 'per month',
    tagline: 'One branch, everything a growing gym needs.',
    features: [
      '1 branch (extra branches Rs 12,000/mo)',
      'Up to 250 active members',
      '5 staff seats',
      'Digital coach + guided workouts',
      'Memberships, billing and the financial ledger',
      '1,000 automated messages a month',
    ],
    cta: 'Start free trial',
    href: '/sign-in',
    featured: false,
  },
  {
    name: 'Growth',
    price: 'Rs 55,000',
    cadence: 'per month',
    tagline: 'Multi-branch operations with advanced analytics.',
    features: [
      '3 branches included (then Rs 10,000/mo)',
      'Up to 800 active members',
      '15 staff seats',
      'Cohort retention, churn and branch comparison',
      'Nutrition module and class booking',
      '5,000 automated messages a month',
      'API access and priority support',
    ],
    cta: 'Book a demo',
    href: '/book-a-demo',
    featured: true,
  },
  {
    name: 'Enterprise / White Label',
    price: 'Rs 145,000',
    cadence: 'per month',
    tagline: 'Your brand, your app, unlimited scale.',
    features: [
      '10 branches included (then Rs 8,000/mo)',
      'Up to 5,000 active members',
      '60 staff seats',
      'White-label app, custom domain and branding',
      'Dedicated onboarding and SLA',
      '25,000 automated messages a month',
    ],
    cta: 'Talk to sales',
    href: '/book-a-demo',
    featured: false,
  },
];

const FAQS = [
  {
    q: 'Does the AI write the workouts?',
    a: 'No. Members are matched to program templates your coaches approve, and a deterministic rules engine adjusts load, volume and schedule from what they log. The AI explains those decisions in plain language and answers questions from your approved exercise library. It cannot invent a plan, and every automated change records the rule that produced it plus the before and after values.',
  },
  {
    q: 'What happens if a member reports pain or a health problem?',
    a: 'Automatic progression stops for the affected movements immediately, the member sees calm, non-diagnostic guidance, and a high-priority case is created for qualified staff with an SLA. GymGuide never diagnoses, never prescribes and never tells a member they are medically fine.',
  },
  {
    q: 'Can front desk staff see health data?',
    a: 'Not by default. Health screening, risk flags, progress photos, nutrition plans and restricted notes each sit behind their own permission. The role matrix is enforced in the interface, in the API and again by row-level security in the database.',
  },
  {
    q: 'Which payment methods work in Pakistan?',
    a: 'Cash and bank transfer are fully implemented, including reconciliation and receipts, because that is how most Pakistani gyms actually get paid. Card, wallet (JazzCash / Easypaisa) and Raast QR are built as verified adapters and need your live merchant credentials to settle money.',
  },
  {
    q: 'Does the member app work without internet?',
    a: 'Yes. Workouts download to the device, sets are logged offline and the queue syncs when the phone reconnects. Sync is idempotent, so a replayed queue never creates duplicate sessions or double-counts a personal record.',
  },
  {
    q: 'Is member data used to train AI models?',
    a: 'No. Member data is never sent for external model training. Every AI interaction is logged with its model, prompt version, tool calls, sources and safety verdict so you can audit exactly what was said and why.',
  },
  {
    q: 'Can we use it in Urdu?',
    a: 'The member experience ships in English, Urdu and Roman Urdu, with PKR, kilograms, centimetres, Pakistan Standard Time and local foods throughout. The translation framework makes adding a language a content task, not an engineering project.',
  },
];

export default function LandingPage() {
  return (
    <>
      <SiteHeader />
      <main id="main">
        {/* 1. Hero ------------------------------------------------------- */}
        <section className="hero" data-theme="dark" style={{ background: 'var(--obsidian-900)', color: 'var(--bone-50)' }}>
          <div className="container hero-grid">
            <div className="stack stack-6">
              <span className="pill-link">
                <Badge tone="primary">New</Badge>
                Adaptive coaching engine, now with staff override logs
              </span>
              <h1 className="display">
                Run the gym.
                <br />
                Coach <span style={{ color: 'var(--gold-400)' }}>every</span> member.
              </h1>
              <p className="lede">
                GymGuide gives your members a digital coach that tells them exactly what to do today, shows them how to
                do it properly, and adapts as they progress — while your team runs memberships, billing, classes and
                branches in one place.
              </p>
              <div className="row row-wrap">
                <Link className="btn btn-primary btn-lg" href="/book-a-demo">
                  Book a demo
                </Link>
                <Link className="btn btn-secondary btn-lg" href="#member-app">
                  Explore the member experience
                </Link>
              </div>
              <p className="small muted">
                14-day trial · No card required · Set up your first branch in an afternoon
              </p>
            </div>

            {/* Product visual, assembled from the same components the app uses */}
            <div className="stack stack-4">
              <div className="device">
                <div className="device-notch" />
                <div className="device-screen">
                  <div className="row-between">
                    <div>
                      <p className="micro muted">TUESDAY · WEEK 6</p>
                      <p style={{ fontWeight: 700, fontSize: '1.0625rem' }}>Lower Body A</p>
                    </div>
                    <Badge tone="primary">45 min</Badge>
                  </div>
                  <div className="card card-flat" style={{ padding: '0.875rem' }}>
                    <div className="row-between">
                      <div>
                        <p style={{ fontWeight: 650 }}>Barbell Back Squat</p>
                        <p className="micro muted">4 × 5 · last time 62.5 kg</p>
                      </div>
                      <Badge tone="success">+2.5 kg</Badge>
                    </div>
                    <div className="stack stack-2" style={{ marginTop: '0.75rem' }}>
                      <div className="set-row done">
                        <span className="set-index">1</span>
                        <span className="small numeric">65 kg</span>
                        <span className="small numeric">5 reps</span>
                        <span className="badge badge-success">✓</span>
                      </div>
                      <div className="set-row">
                        <span className="set-index">2</span>
                        <span className="small numeric muted">65 kg</span>
                        <span className="small numeric muted">5 reps</span>
                        <span className="badge">—</span>
                      </div>
                    </div>
                  </div>
                  <div className="card card-flat" style={{ padding: '0.875rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <ProgressRing value={68} size={78} caption="session" />
                    <div className="stack stack-2">
                      <p className="micro muted">WHY THIS WEIGHT?</p>
                      <p className="small">
                        You hit every rep at RPE 7 twice in a row, so we added one step. Rule R-PROG-001.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <p className="micro muted" style={{ textAlign: 'center' }}>
                Real interface components — not a stock photograph.
              </p>
            </div>
          </div>
        </section>

        {/* 2. Trust and outcomes ---------------------------------------- */}
        <section className="section-tight" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="container stack stack-6">
            <div className="logo-strip">
              <span className="logo-word">APEX FITNESS</span>
              <span className="logo-word">IRON HOUSE</span>
              <span className="logo-word">STUDIO 92</span>
              <span className="logo-word">THE STRENGTH LAB</span>
              <span className="logo-word">PULSE GYMS</span>
            </div>
            <div className="grid grid-4">
              {[
                { value: '3 min', label: 'Front-desk enrolment', note: 'Consent, waiver, payment and app invite' },
                { value: '86%', label: 'Plan adherence', note: 'Demo cohort, members with a coach-assigned plan' },
                { value: '2.4×', label: 'Member engagement', note: 'App sessions vs. attendance-only tracking' },
                { value: '< 4 hrs', label: 'Escalation response', note: 'Median time to first staff contact' },
              ].map((metric) => (
                <div key={metric.label} className="stack stack-2">
                  <span className="stat-value" style={{ color: 'var(--accent)' }}>
                    {metric.value}
                  </span>
                  <strong className="small">{metric.label}</strong>
                  <span className="micro muted">{metric.note}</span>
                </div>
              ))}
            </div>
            <p className="micro muted">
              Figures from the seeded demo organisation, clearly marked as demo data. We do not publish other gyms’
              numbers as our own.
            </p>
          </div>
        </section>

        {/* 3. Product story --------------------------------------------- */}
        <section className="section">
          <div className="container stack stack-8">
            <div className="stack stack-3">
              <span className="eyebrow">How it works</span>
              <h2>From the front desk to a member who knows what to do</h2>
              <p className="lede">
                The gap in most gyms is not attendance software. It is the member standing in the weights area with no
                idea what to do next. GymGuide closes that gap on day one.
              </p>
            </div>
            <div className="grid grid-3">
              {[
                { n: 1, t: 'Staff enrol the member', b: 'Consent, waiver, health screening, membership and payment in one flow. The member walks away with the app already set up.' },
                { n: 2, t: 'They receive a real plan', b: 'Matched to an approved template by goal, experience, schedule and the equipment their branch actually has.' },
                { n: 3, t: 'They follow guided workouts', b: 'Set by set, with technique content and rest timers. Offline on the gym floor; synced afterwards.' },
                { n: 4, t: 'The gym sees progress and risk', b: 'Adherence, strength trends, inactivity risk and health escalations, per member and per branch.' },
                { n: 5, t: 'Staff step in at the right moment', b: 'Queues surface who needs a call this week. Every automated decision can be overridden with a reason.' },
                { n: 6, t: 'Members stay', b: 'Because they can see it working — and because someone noticed when they stopped coming.' },
              ].map((step) => (
                <article key={step.n} className="card card-hover stack stack-3">
                  <span className="step-number">{step.n}</span>
                  <h3 style={{ fontSize: '1.0625rem' }}>{step.t}</h3>
                  <p className="small secondary">{step.b}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* 4. Features --------------------------------------------------- */}
        <section className="section" id="features" style={{ background: 'var(--bg-sunken)' }}>
          <div className="container stack stack-8">
            <div className="stack stack-3">
              <span className="eyebrow">Product</span>
              <h2>Everything the gym runs on, plus the part most software skips</h2>
            </div>
            <div className="grid grid-3">
              {FEATURES.map((feature) => (
                <article key={feature.title} className="card card-hover">
                  <div className="feature-icon" aria-hidden="true">
                    {feature.icon}
                  </div>
                  <h3 style={{ fontSize: '1.0625rem', marginBottom: '0.5rem' }}>{feature.title}</h3>
                  <p className="small secondary">{feature.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* 5. Personas --------------------------------------------------- */}
        <section className="section" id="solutions">
          <div className="container stack stack-8">
            <div className="stack stack-3">
              <span className="eyebrow">Built for the whole gym</span>
              <h2>Four very different jobs, one system</h2>
            </div>
            <div className="grid grid-2">
              {PERSONAS.map((persona) => (
                <article key={persona.role} className="card stack stack-4">
                  <h3>{persona.role}</h3>
                  <p className="secondary">{persona.line}</p>
                  <ul className="price-list">
                    {persona.points.map((point) => (
                      <li key={point}>{point}</li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* 6. Member app showcase ---------------------------------------- */}
        <section className="section" id="member-app" data-theme="dark" style={{ background: 'var(--obsidian-800)', color: 'var(--bone-50)' }}>
          <div className="container stack stack-8">
            <div className="stack stack-3">
              <span className="eyebrow">The member experience</span>
              <h2>Five screens a beginner can use on their first visit</h2>
              <p className="lede">
                One-handed, low-data, Android-first. The most important question — “what do I do today?” — is answered
                before any scrolling.
              </p>
            </div>

            <div className="grid grid-3">
              <article className="card stack stack-4">
                <Badge tone="primary">Today</Badge>
                <div className="card card-flat card-sunken stack stack-3">
                  <p className="micro muted">GOOD MORNING, AYESHA</p>
                  <strong>Full Body A</strong>
                  <p className="small secondary">Today’s session is ready · 45 min</p>
                  <span className="btn btn-primary btn-sm" style={{ alignSelf: 'flex-start' }}>
                    Start workout
                  </span>
                </div>
                <p className="small secondary">
                  Today’s card, class bookings, the weekly check-in and anything outstanding — nothing else.
                </p>
              </article>

              <article className="card stack stack-4">
                <Badge tone="primary">Workout player</Badge>
                <div className="card card-flat card-sunken stack stack-3">
                  <div className="row-between">
                    <strong className="small">Goblet Squat</strong>
                    <span className="badge">Set 2 of 3</span>
                  </div>
                  <div className="rest-timer" style={{ padding: '0.75rem' }}>
                    <span className="rest-time" style={{ fontSize: '1.75rem' }}>
                      1:12
                    </span>
                    <span className="micro muted">REST</span>
                  </div>
                  <p className="micro muted">Chest proud · heels down · knees out</p>
                </div>
                <p className="small secondary">
                  Video, cues, mistakes, safety notes, previous performance and approved swaps when a machine is busy.
                </p>
              </article>

              <article className="card stack stack-4">
                <Badge tone="primary">Progress</Badge>
                <div className="card card-flat card-sunken stack stack-3">
                  <div className="row-between">
                    <div className="stat">
                      <span className="stat-label">Adherence</span>
                      <span className="stat-value" style={{ fontSize: '1.5rem' }}>
                        86%
                      </span>
                    </div>
                    <Sparkline data={[62, 68, 71, 74, 79, 83, 86]} />
                  </div>
                  <div className="row-between small">
                    <span className="secondary">Weight</span>
                    <span className="numeric">78.4 → 72.1 kg</span>
                  </div>
                </div>
                <p className="small secondary">
                  Honest, encouraging charts. Streaks, records and milestones — never a promise about how they will look.
                </p>
              </article>

              <article className="card stack stack-4">
                <Badge tone="primary">Nutrition &amp; habits</Badge>
                <div className="card card-flat card-sunken stack stack-3">
                  <p className="small">
                    <strong>Your plate today</strong>
                  </p>
                  <p className="micro secondary">3 palms protein · 3 cupped hands carbs · 4 fists vegetables</p>
                  <p className="micro muted">Roti, daal, chicken karahi and dahi all counted.</p>
                </div>
                <p className="small secondary">
                  Hand portions for members who will never count, real macros for those who want them. Ramadan schedules
                  built in.
                </p>
              </article>

              <article className="card stack stack-4">
                <Badge tone="primary">Support</Badge>
                <div className="card card-flat card-sunken stack stack-3">
                  <span className="ai-label">◆ AI-ASSISTED</span>
                  <p className="small">
                    “Your plan has goblet squats this week — no rack needed. Hold the dumbbell at your chest and sit back
                    and down.”
                  </p>
                  <span className="btn btn-secondary btn-sm" style={{ alignSelf: 'flex-start' }}>
                    Talk to gym staff
                  </span>
                </div>
                <p className="small secondary">
                  Every answer is labelled, sourced from approved content, and one tap from a real person.
                </p>
              </article>

              <article className="card card-accent stack stack-4">
                <h3 style={{ fontSize: '1.0625rem' }}>Safe by design</h3>
                <p className="small secondary">
                  Report pain in the player and progression stops immediately, a restricted case opens for qualified
                  staff, and the member gets calm, non-diagnostic guidance. No app should ever tell someone their chest
                  pain is fine.
                </p>
                <Link className="btn btn-secondary btn-sm" href="#security" style={{ alignSelf: 'flex-start' }}>
                  How we handle health data
                </Link>
              </article>
            </div>
          </div>
        </section>

        {/* 7. Security --------------------------------------------------- */}
        <section className="section" id="security">
          <div className="container grid grid-sidebar">
            <div className="stack stack-6">
              <span className="eyebrow">Security &amp; privacy</span>
              <h2>Health data deserves more than a checkbox</h2>
              <p className="lede">
                Members hand you injuries, conditions, weight and photographs. GymGuide treats that as the sensitive
                information it is — and proves it, with tests that fail the build if isolation breaks.
              </p>
              <div className="grid grid-2">
                {[
                  ['Tenant isolation in the database', 'PostgreSQL row-level security on every tenant table, enforced for a role that cannot bypass it. Verified by automated cross-tenant tests.'],
                  ['Permission-gated health data', 'Screening, risk flags, photos and nutrition each need their own permission. Front desk never sees them.'],
                  ['Consent you can evidence', 'Every consent decision is an immutable row with version, channel, collector and timestamp. Withdrawal writes history, it never erases it.'],
                  ['Audited sensitive access', 'Opening a member’s health record is itself an audit event. Payments, refunds, role changes and program overrides are all recorded.'],
                  ['Signed, expiring media', 'Progress photos are private by default and served through short-lived signed URLs, never guessable paths.'],
                  ['Time-limited support access', 'GymGuide staff need a written reason and an expiry to see your data. There is no silent impersonation.'],
                ].map(([title, body]) => (
                  <div key={title} className="stack stack-2">
                    <strong className="small">{title}</strong>
                    <p className="small muted">{body}</p>
                  </div>
                ))}
              </div>
            </div>
            <aside className="card card-accent stack stack-4">
              <h3 style={{ fontSize: '1.0625rem' }}>Data rights, handled</h3>
              <ul className="price-list">
                <li>Member-initiated data export</li>
                <li>Erasure requests with a 30-day clock</li>
                <li>Per-country privacy configuration</li>
                <li>No member data used for external AI training</li>
                <li>Webhook signature verification and idempotency</li>
              </ul>
              <Link className="btn btn-secondary btn-sm" href="/security">
                Read the security overview
              </Link>
            </aside>
          </div>
        </section>

        {/* 8. Pricing ---------------------------------------------------- */}
        <section className="section" id="pricing" style={{ background: 'var(--bg-sunken)' }}>
          <div className="container stack stack-8">
            <div className="stack stack-3">
              <span className="eyebrow">Pricing</span>
              <h2>Priced per branch and active member — no surprises</h2>
              <p className="lede">
                Every plan includes the digital coach, guided workouts, memberships, billing and the member app. You pay
                for scale, not for the parts your members need most.
              </p>
            </div>
            <div className="grid grid-3">
              {PRICING.map((plan) => (
                <article key={plan.name} className={plan.featured ? 'card card-accent price-card' : 'card price-card'}>
                  <div className="stack stack-2">
                    <div className="row-between">
                      <h3 style={{ fontSize: '1.125rem' }}>{plan.name}</h3>
                      {plan.featured ? <Badge tone="primary">Most popular</Badge> : null}
                    </div>
                    <p className="small muted">{plan.tagline}</p>
                  </div>
                  <div>
                    <span className="price-amount">{plan.price}</span>
                    <span className="small muted"> {plan.cadence}</span>
                  </div>
                  <ul className="price-list">
                    {plan.features.map((feature) => (
                      <li key={feature}>{feature}</li>
                    ))}
                  </ul>
                  <Link
                    className={plan.featured ? 'btn btn-primary btn-block' : 'btn btn-secondary btn-block'}
                    href={plan.href}
                    style={{ marginTop: 'auto' }}
                  >
                    {plan.cta}
                  </Link>
                </article>
              ))}
            </div>
            <div className="card card-flat stack stack-3">
              <strong className="small">What can cost extra</strong>
              <div className="grid grid-3">
                <p className="small muted">
                  <strong>Extra branches</strong> — Rs 8,000–12,000 per branch per month depending on plan.
                </p>
                <p className="small muted">
                  <strong>Active members above your tier</strong> — Rs 20–40 per member per month.
                </p>
                <p className="small muted">
                  <strong>Messaging above the included bundle</strong> — SMS and WhatsApp are billed at cost plus a small
                  margin; in-app and push are unlimited. Payment processing fees are charged by your provider, not by us.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* 9. FAQ -------------------------------------------------------- */}
        <section className="section" id="faq">
          <div className="container" style={{ maxWidth: '820px' }}>
            <div className="stack stack-6">
              <div className="stack stack-3">
                <span className="eyebrow">Questions</span>
                <h2>The things gym owners actually ask</h2>
              </div>
              <div>
                {FAQS.map((faq) => (
                  <details key={faq.q} className="faq">
                    <summary>{faq.q}</summary>
                    <p>{faq.a}</p>
                  </details>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* 10. Final CTA -------------------------------------------------- */}
        <section className="section" data-theme="dark" style={{ background: 'var(--obsidian-900)', color: 'var(--bone-50)' }}>
          <div className="container stack stack-6" style={{ alignItems: 'center', textAlign: 'center' }}>
            <h2 style={{ maxWidth: '20ch' }}>Give every member a coach — starting this month</h2>
            <p className="lede" style={{ textAlign: 'center' }}>
              Bring one branch across in an afternoon. Import your members, publish your programs, and watch what
              happens when people finally know what to do.
            </p>
            <div className="row row-wrap" style={{ justifyContent: 'center' }}>
              <Link className="btn btn-primary btn-lg" href="/book-a-demo">
                Book a demo
              </Link>
              <Link className="btn btn-secondary btn-lg" href="/sign-in">
                Sign in to the demo gym
              </Link>
            </div>
            <p className="micro muted">Demo accounts for every role are listed in the repository README.</p>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
