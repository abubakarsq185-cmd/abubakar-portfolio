# GymGuide

Multi-tenant gym management software with a digital fitness coach built in.

A gym buys GymGuide. Staff enrol members. Every member — including the ones who
will never pay for a personal trainer — gets a plan that tells them exactly what
to do today, how to do it properly, and whether it is working. The gym gets
memberships, billing, classes, attendance, automations and branch reporting in
the same system.

> This repository also contains the original single-page portfolio site
> (`index.html`, `styles.css`, `main.js`) at the root. GymGuide lives in
> `apps/`, `packages/` and `db/`.

---

## Quick start

Requires Node 20+, pnpm 10+, and PostgreSQL 15+.

```bash
pnpm install

cp .env.example .env
# Set DATABASE_URL, DATABASE_APP_URL and SESSION_SECRET.
# SESSION_SECRET: openssl rand -base64 48

pnpm db:bootstrap          # reset → migrate → seed the demo gym
pnpm dev                   # http://localhost:3000
```

`db:bootstrap` also creates the `gymguide_app` role with the password from
`DATABASE_APP_URL`. That role is deliberately unprivileged — it cannot bypass
row-level security — and it is the role the application and the tests use.

```bash
pnpm test                  # 172 tests: unit + integration against real Postgres
pnpm test:unit             # pure domain logic, no database
pnpm test:integration      # tenant isolation, idempotency, ledger integrity
pnpm build                 # production build of the web app
```

### Demo accounts

Every seeded account uses the password in `SEED_DEMO_PASSWORD`
(default `GymGuide!Demo2026`). Sign in at `/sign-in` — the page lists them too.

| Role | Email | What you see |
| --- | --- | --- |
| Gym owner | `owner@apexfitness.pk` | Both branches, money, health, everything |
| Branch manager | `manager.gulberg@apexfitness.pk` | Gulberg branch only |
| Branch manager | `manager.dha@apexfitness.pk` | DHA branch only |
| Coach | `coach@apexfitness.pk` | Assigned members, health, **no financial data** |
| Front desk | `frontdesk@apexfitness.pk` | Enrolment and payments, **no health data** |
| Nutrition professional | `nutrition@apexfitness.pk` | Nutrition plans for assigned members only |
| Member | `ayesha.khan@example.com` | The member app, 128 days of history |
| Member (escalation) | `ahmed.nawaz@example.com` | Open knee-pain escalation, progression paused |
| Member (at risk) | `hamza.raza@example.com` | Five weeks inactive, in the retention queue |
| Member (Urdu) | `maryam.javed@example.com` | Urdu locale, Ramadan mode, hybrid plan |
| Guardian | `tariq.noor@example.com` | Pays for a dependent, cannot see her health data |
| Platform admin | `support@gymguide.app` | The platform console |

Sign in as the coach and then the front desk on the same member: the coach sees
the health screening and the escalation; the front desk sees the membership and
the invoice, and the health tab is not there at all. That difference is enforced
in the database, not just in the interface.

---

## What is in the box

```
apps/
  web/                  Next.js 15 — landing site, sign-in, staff dashboard,
                        member portal, API routes, all server logic
  mobile/               Expo member app with the offline workout queue
packages/
  types/                Zod schemas, enums, the RBAC matrix
  config/               Typed env, i18n (en / ur / ur_rm), formatting, countries
  domain/               Coaching engine, safety engine, billing, nutrition, AI contract
  ui/                   Design tokens, CSS design system, React primitives, charts
db/
  migrations/           12 SQL migrations — schema, RLS, RBAC reference, views
  seed/                 "Apex Fitness Lahore" demo tenant
  scripts/              Migration runner and CLI
tests/
  unit/                 149 tests — engines, money, safety, adherence
  integration/          23 tests — isolation, idempotency, parity, ledger
docs/                   Architecture, security, permissions, integrations
```

### The demo tenant

`pnpm db:seed` builds **Apex Fitness Lahore**: two branches, nine staff across
every role, sixteen members at different stages, 419 workout sessions with 4,129
logged sets, twelve weeks of weight and habit history, classes with bookings and
a waitlist, invoices and payments that reconcile against a balanced double-entry
ledger, twelve automations with a suppressed message and an opt-in refusal, an
open health escalation, and AI transcripts including one that was blocked.

It is deterministic — same ids, same numbers, every run.

---

## The parts worth reading

**The coaching engine** (`packages/domain/src/coaching/progression.ts`) is
deterministic and rule-based. Two clean sessions at the intended effort earn a
capped load increase; two missed ones earn a 10% back-off; three missed sessions
in a fortnight offer a shorter week; two poor recovery check-ins cut volume and
create a staff review. Every recommendation records its rule id, the evidence,
and the before/after values. Three invariants are enforced and tested: a member
with a progression hold is never auto-progressed, a restricted movement pattern
is never auto-progressed, and reported pain outranks every progression rule.

**The safety engine** (`packages/domain/src/safety/risk-engine.ts`) turns
screening answers, workout reports and free text — in English, Urdu and Roman
Urdu — into risk flags, progression holds and escalations. It never diagnoses,
never prescribes, and never tells a member they are medically fine. A reported
symptom stops automation for the affected movements, opens a health-restricted
case with an SLA, notifies the right role through quiet hours, and audits all of
it.

**The AI coach** (`packages/domain/src/ai/contract.ts`) can only act through six
tools. Requests are classified before the model is called and output is
validated after — a draft that claims medical safety, names a condition,
recommends a supplement or promises a result is replaced, not shipped. Every
turn is logged with model, prompt version, tool calls, sources and safety
verdict. The default driver is deterministic and offline.

**The ledger** (`packages/domain/src/billing/ledger.ts`) is double-entry and
append-only at the database level. Invoice state is derived from amounts, never
set by hand. `assertBalanced` runs before anything is written, and an integration
test asserts the seeded ledger balances to the paisa.

**Row-level security** (`db/migrations/0009_rls.sql`) is the last line of
defence behind the API's own checks. The isolation tests connect as the
unprivileged application role and try to read across tenants, read health data
without permission, and rewrite the audit log. They also caught a real bug: a
permissive `FOR ALL` write policy widened `SELECT`, letting front desk read
coach-only notes. `0012_policy_fixes.sql` is that fix.

---

## Status: what is built, and what is not

Being precise about this matters more than a longer feature list.

### Working end to end

- Landing site, sign-in with role-based routing, session auth with TOTP support
- Staff dashboard: live metrics, escalation / inactivity / coaching / payment /
  waiver / lead / task queues, branch performance, member search and directory
- Health escalation queue with resolution and audited progression-hold release
- Member app: Today, Train, the guided workout player with offline logging and
  idempotent sync, Support with the AI coach and staff hand-off
- API: workout sync, safety reporting, payment webhooks with signature
  verification and idempotency
- Server services for enrolment, payments, refunds, reconciliation, the coaching
  engine and the AI runtime — all with audit trails
- The full database, RLS, seed and 172 tests

### Service layer built, screen not yet wired

The logic, validation and audit trail exist and are tested; the staff-facing page
is the remaining work: enrolment wizard, billing console, class scheduling,
program builder, automation editor, reports and the platform console.
`apps/web/src/server/services/` holds these; `members.ts` (`enrolMember`) and
`billing.ts` (`recordPayment`, `issueRefund`, `reconcilePayments`) are the ones
to look at first.

### Deliberately not pretending to work

Cash and bank transfer are fully implemented, including reconciliation and
receipts. Card, wallet and QR are real adapters with signature verification and
idempotency, but they need live merchant credentials to move money and say so in
the interface. WhatsApp needs approved templates. Smart-door access has an API
seam and no vendor. App-store distribution is not configured. `docs/INTEGRATIONS.md`
lists exactly what each one needs.

---

## Documentation

| Document | What it covers |
| --- | --- |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | How the pieces fit, request lifecycle, data flow |
| [docs/SECURITY.md](docs/SECURITY.md) | Tenancy, RLS, auth, audit, health data, threat notes |
| [docs/PERMISSIONS.md](docs/PERMISSIONS.md) | The full role → permission matrix and why |
| [docs/INTEGRATIONS.md](docs/INTEGRATIONS.md) | Every adapter, its status and its credentials |
| [docs/COACHING-ENGINE.md](docs/COACHING-ENGINE.md) | Every rule, its evidence and its guard rails |
| [docs/TESTING.md](docs/TESTING.md) | What is tested, how to run it, what it proves |

---

## A note on scope

GymGuide is not a medical service. It does not diagnose, treat, or replace
doctors, physiotherapists, dietitians or qualified trainers. The safety engine,
the nutrition guard rails and the AI contract exist because a fitness app that
answers a chest-pain question with a workout tweak is worse than no app at all.
