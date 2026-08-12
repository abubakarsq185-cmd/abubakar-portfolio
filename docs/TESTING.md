# Testing

```bash
pnpm test              # everything — 241 tests
pnpm test:unit         # 120 tests, no database, ~70ms
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
| `rls-isolation.test.ts` | 26 | Cross-tenant reads and writes, member self-scope, coach caseload, branch scope, permission-gated health and financial data, equipment visibility, unauthenticated access, append-only enforcement |
| `data-integrity.test.ts` | 23 | RBAC matrix parity between code and database, enum parity, ledger balance, invoice state consistency, seed shape, RLS coverage, `security_invoker` on every view |
| `enrolment-payment.test.ts` | 6 | Acceptance criterion 1 driven through the real services as a front-desk actor: enrolment artefacts, joining fee, balanced ledger, payment idempotency, audit trail |
| `onboarding.test.ts` | 15 | Acceptance criteria 2 and 4 from the member's side: step resumption, validation, clean screening, chest-pain escalation with a restricted high-priority case, movement restriction without a full hold, template matching, coach hand-off; plus nutrition logging and diary isolation |
| `scheduling.test.ts` | 9 | Class check-in and attendance, double check-in refusal, waitlist promotion only under capacity, longest-waiting member wins a released place, late-cancellation window, class cancellation releasing everyone, permission boundaries |
| `programs.test.ts` | 15 | Platform templates read-only to a gym, copy-and-adapt carrying phases and days, unique codes, summary and progression-rule validation, publishing with a named approver, refusing to publish an empty program, withdrawal leaving existing members alone, and front desk being unable to author |
| `automations.test.ts` | 12 | Marketing classified from the trigger rather than a clearable flag, consent forced back on, quiet hours never applied to urgent triggers but kept on routine nudges, the contact ceiling, channel and time validation, tasks needing an assignee, and a coach being unable to edit |
| `platform-support-access.test.ts` | 9 | Support access requiring a real reason, platform-only, time-limited and clamped, write access requiring the gym's approval, close recording, and the console's shape excluding health data |
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

**Front desk could not enrol anyone.** The `user_roles` insert policy demanded
`staff.roles.write`, which only an owner holds, so the very first step of
acceptance criterion 1 failed on RLS. Fixed in `0013_member_role_grant.sql`:
`members.write` may assign the member and guardian roles, staff roles still may
not.

**Four identifier allocators read through row-level security.** Member numbers,
invoice numbers, payment references, receipt numbers and — found later, by the
onboarding tests — support-case references were all derived with `max(...) + 1`.
A branch-scoped user sees fewer rows, computes a lower maximum, and collides with
a number already issued at another branch; and two people acting at once compute
the same one. Fixed in `0014_member_number_sequence.sql` and
`0015_document_sequences.sql` with atomic `SECURITY DEFINER` allocators, with
support cases switched over in `services/safety.ts` once the onboarding test
caught the one that had been missed.

**Deleting a user was impossible.** `audit_logs` referenced `users` with
`ON DELETE SET NULL` while the append-only trigger blocked UPDATE, so an erasure
request could never complete. `0016_audit_outlives_subject.sql` drops those
foreign keys: an audit record is supposed to outlive the row it describes.

**Erasure was impossible for a second reason.** Append-only DELETE triggers
refused cascades. Immutability and deletion rights had been conflated;
`0017_append_only_semantics.sql` separates them — the trigger keeps content
unrewritable for everyone, revoked privileges stop the application deleting, and
a privileged erasure job can still remove a person.

**The counters backfilled themselves at migration time.** On a database built
from scratch the migrations run before the seed, so the seed's hard-coded numbers
never moved the counters and the first real enrolment collided.
`0018_sequence_backfill_triggers.sql` makes a counter advance past any number
inserted explicitly — which is also what importing history from another system
needs.

**Members could not see their own gym's equipment.** `branch_equipment` was
staff-only. Two features run as the member and depend on it: the workout player's
substitutions, which concluded the gym owned nothing and offered no alternatives,
and onboarding's program matcher, which found every template unequippable and
declined on safety grounds — correctly reasoning from wrong input. Caught by
*"finishes onboarding by matching an approved template"*, fixed in
`0019_members_can_see_their_gym.sql`. Which machines a gym owns is not
confidential; the member is standing in the room looking at them.

**No template existed for a beginner wanting muscle gain.** The most common thing
a new member asks for matched nothing, so every such member was told to wait for
a coach — which defeats the point of the app. The matcher was behaving correctly;
the content was missing. `muscle_foundations_3d` and its three sessions were
added to the seed.

**A payment INSERT bound one parameter to two column types.** `$17` was used for
both `reconciled_by` (uuid) and `receipt_number` (text). PostgreSQL rejected it;
the statement is now written with 21 distinct, commented parameters.

**A coach was told nobody was on a program they were withdrawing.** The
"members on it" count was a subquery inside the caller's own query, so it ran
through row-level security: a coach saw only the members they personally coach,
and a program a hundred people were running looked empty. The count is a fact
about the program, not about who is asking, so it now reads with the owner
connection. Caught by *"withdrawing does not take the plan away from anyone
already on it"*.

**The "logged only" channel warning could never appear.** The set of
deliverable channels was built from every channel rather than only the ready
ones, so `unavailableChannels` was always empty and a manager configuring a
WhatsApp sequence would have been told nothing. Caught by *"lists every
automation with what it did and whether its channels can deliver"*.

**Enum arrays arrived as strings.** `notification_channel[]` has no
node-postgres parser, so `automations.channels` came back as the literal
`"{in_app,push}"` and every array operation on it threw. Cast to `text[]` in the
query.

**`pnpm typecheck` pointed at a tsconfig that was never created.** Nothing
outside the tests had ever been type-checked. All six projects now typecheck, and
that immediately surfaced two copies of `@types/react` in one program — see
`docs/decisions/react-types-resolution.md`.

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
