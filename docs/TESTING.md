# Testing

```bash
pnpm test              # everything — 172 tests
pnpm test:unit         # 149 tests, no database, ~20ms
pnpm test:integration  # 23 tests against real PostgreSQL
```

Integration tests need a migrated and seeded database:

```bash
pnpm db:bootstrap
```

## What each suite proves

### Unit — `tests/unit/`

Pure domain logic. No database, no network, no mocks worth speaking of, because
the domain layer has no I/O to mock.

| File | Tests | Covers |
| --- | --- | --- |
| `coaching-engine.test.ts` | 36 | Target evaluation, load maths, all six rules, the three safety invariants, substitution filtering, adherence, streaks, personal records |
| `safety-engine.test.ts` | 24 | Screening assessment, red-flag escalation, movement restriction, multilingual triage, AI request classification, AI output validation |
| `billing.test.ts` | 29 | Money arithmetic, per-line tax, derived invoice state, promotions, double-entry balance, month-end rollover, proration, freezes, dunning, retry backoff |
| `nutrition-and-engagement.test.ts` | 31 | Calorie guard rails, plate scaling, program matching, inactivity risk, the automation gate, milestones |

The tests worth reading are the negative ones. `safety-engine.test.ts` asserts
that the product **never** tells a member they are medically fine, that a
diagnosis request is refused and escalated, that supplement questions are
blocked, and that "push through the pain" is rejected as model output.

### Integration — `tests/integration/`

Real PostgreSQL, real migrations, real seed. Crucially, these connect as
`gymguide_app` — the unprivileged application role — and the helper **refuses to
run** if that role turns out to have `BYPASSRLS`, because then the tests would
prove nothing.

| File | Tests | Covers |
| --- | --- | --- |
| `rls-isolation.test.ts` | 23 | Cross-tenant reads and writes, member self-scope, coach caseload, branch scope, permission-gated health and financial data, unauthenticated access, append-only enforcement |
| `data-integrity.test.ts` | 23 | RBAC matrix parity between code and database, enum parity, ledger balance, invoice state consistency, seed shape, RLS coverage, `security_invoker` on every view |
| `webhook-idempotency.test.ts` | 6 | Webhook deduplication under replay and race, rejected-signature recording, signature verification, offline sync idempotency |

## Bugs these tests actually caught

**A permissive `FOR ALL` policy widened SELECT.** `notes` had separate read and
write policies. Because PostgreSQL OR-s permissive policies, the write policy —
which only checked `notes.write` — also granted `SELECT`, so front desk could
read coach-only notes. Caught by *"front desk cannot read restricted or
coach-only notes"*, fixed in `db/migrations/0012_policy_fixes.sql`, which splits
write policies into INSERT/UPDATE/DELETE across `notes`, `conversations` and
`family_links`.

**Program matching under-weighted safety.** A member needing low-impact
programming could still be matched to a hypertrophy template, and a branch
missing four machines could still be assigned a program requiring them, because
both were soft penalties. Caught by the program-matching tests; both are now
near-disqualifying.

**A duplicate automation dedupe key.** The seed tried to record the same
automation firing on two channels with one dedupe key, and the unique index
rejected it — correctly. The key now includes the channel.

**Urdu triage never matched.** `\b` is ASCII-only in JavaScript, so
`/\b(سینے میں درد)\b/` could never match. Caught by the multilingual triage
test; Urdu-script patterns are now matched without word boundaries.

## Conventions

- Tests name the behaviour, not the function: *"never auto-progresses a member
  with a progression hold"*, not *"evaluateCoachingRules works"*.
- Every safety rule has a test for the case where it must **not** fire.
- Integration tests roll back their transactions and clean up fixtures.
- Deterministic time: the seed pins a date and the PRNG is seeded, so
  "flaky test" is not a category here.

## Not yet covered

- **End-to-end.** Playwright is configured and Chromium is available, but no
  specs are written. The first three should be: front-desk enrolment through to
  a working member login; a member completing a workout offline and syncing; a
  member reporting pain and a coach seeing the escalation.
- **Accessibility.** Semantics, focus management, contrast and reduced-motion
  are handled in the design system, but no automated axe run exists.
- **Load.** No performance testing has been done. The indexes are considered but
  unproven at scale.
