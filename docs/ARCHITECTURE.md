# Architecture

## Shape

```
                    ┌──────────────────────────────────────────┐
   Browser ────────▶│  apps/web (Next.js 15, App Router)        │
   Expo app ───────▶│  · marketing site   · staff dashboard     │
                    │  · member portal    · REST API (/api/v1)  │
                    │  · server actions   · webhooks            │
                    └───────────────┬──────────────────────────┘
                                    │
                    ┌───────────────▼──────────────────────────┐
                    │  apps/web/src/server                     │
                    │  auth · audit · rate limit · services    │
                    │  adapters: payments, notify, AI, storage │
                    └───────────────┬──────────────────────────┘
                                    │  withTenant(actor, fn)
                    ┌───────────────▼──────────────────────────┐
                    │  PostgreSQL                              │
                    │  101 tables · RLS on all of them         │
                    │  append-only audit, consent, ledger      │
                    └──────────────────────────────────────────┘

   packages/domain   pure decisions (coaching, safety, money, nutrition, AI)
   packages/types    zod schemas, enums, the RBAC matrix
   packages/config   env, i18n, formatting, country config
   packages/ui       tokens, CSS design system, React primitives
```

## The one rule that shapes everything

**Decisions are pure; effects are not.**

`packages/domain` contains no I/O. It takes plain data and returns plain data:
"given these two sessions, add 2.5 kg and here is why", "given this screening,
stop progression on hinge and squat, open a high-priority case". That makes the
hard parts of the product — progression, safety, money — testable without a
database, which is why there are 149 unit tests that run in 20 milliseconds.

The server layer does the effects: read from Postgres, call the domain, write
back, audit, notify. Services never re-implement a decision; if a rule lives in
two places it will diverge, and the one that diverges will be the one nobody
tested.

## Request lifecycle

A staff member opens a member's profile:

1. **Session** — `getSession()` reads the `gg_session` cookie, hashes it, looks
   up `auth_sessions`, and builds an `Actor`: user id, organization, primary
   role, resolved permissions (role grants plus individual grants), branch scope
   and platform-admin flag.
2. **Authorization** — `requirePermission('members.read.all')` in the page, then
   `can(actor, 'health.read')` inside the service to decide whether the health
   query runs at all.
3. **Tenant transaction** — `withTenant(session, fn)` checks out a connection
   from the *application* pool (a role without `BYPASSRLS`), opens a
   transaction, and sets six GUCs: user id, organization, role, branch ids,
   permissions, platform-admin.
4. **RLS** — every policy reads those GUCs. A coach querying `member_profiles`
   gets their caseload because `app.can_access_member()` says so, not because
   the SQL remembered to filter.
5. **Audit** — opening a health record writes a `read_sensitive` audit row
   through the owner connection, so it lands even if the read itself is denied.
6. **Render** — the page renders only the sections the actor's permissions
   allow. A front-desk user does not get an empty health tab; they get no health
   tab.

## Why two database pools

| Pool | Role | Used for |
| --- | --- | --- |
| `appPool` | `gymguide_app` — no `BYPASSRLS` | Every request. RLS applies. |
| `ownerPool` | migration owner | Session lookup before an actor exists, audit writes, cross-tenant platform administration, staff notification of an escalation raised by a member |

The escalation case is the interesting one. When a member reports knee pain, the
member has no permission to write into a coach's notification rows — correctly.
But the coach must be told. So the risk flag, the case and the member's own
notice are written in the member's tenant transaction, and only the staff
notification uses the owner connection, immediately afterwards, with a narrow
query. The alternative — giving members broader write permission — would be
worse.

`assertRlsEnforced` runs once per process and refuses to start in production if
the application role can bypass RLS.

## Multi-tenancy

```
Platform
└── Organization (tenant boundary — every tenant table carries organization_id)
    └── Branch (branch-owned tables also carry branch_id)
        ├── Staff (staff_assignments; NULL branch = organization-wide)
        └── Members
```

Branch scope is expressed as an array on the actor. An **empty array means
organization-wide**, which keeps every policy expression uniform:
`app.can_touch_branch(x)` is true when the array is empty, when the target is
null, or when the array contains the target.

## Content hierarchy

Programs, exercises, workouts and foods follow the same pattern:

```
platform library (organization_id IS NULL)  → readable by every tenant
  └── organization content                  → the gym's own, private to them
       └── branch content                   → equipment-specific variants
            └── member assignment           → what one person actually does
```

Members are matched to *approved templates* by `matchProgram()`, which scores
goal fit, experience, schedule, branch equipment and safety constraints, and
refuses to auto-assign when the best candidate still carries warnings. Missing
equipment and a required-but-absent low-impact program are near-disqualifying,
because handing someone a plan their gym cannot deliver is worse than making a
coach choose.

## Offline

The member app is the only part that must work with no network.

1. The player payload is cached under a `clientSessionId` when the workout opens.
2. Every logged set writes to that cache immediately.
3. Finishing queues the session.
4. The queue drains on foreground, on reconnect, and after finishing.
5. `POST /api/v1/workouts/sync` upserts on `(user_id, client_session_id)`.

Point 5 is a partial unique index, not application logic, so a queue replayed
five times still produces one session. Set logs upsert on
`(workout_session_id, workout_item_id, set_number)` for the same reason.

## Jobs and automations

`job_queue` is a Postgres-backed queue with dedupe keys and backoff. Automations
evaluate through one gate (`evaluateAutomationGate`) that checks dedupe, member
suspension, category opt-in, marketing consent, weekly caps, cooldown and quiet
hours — in that order. Only `safety` category messages bypass quiet hours and
frequency caps, and even those never reach a suspended account.

## Extension points

- **A new payment provider** implements `PaymentAdapter` (create intent, verify
  webhook) in `apps/web/src/server/adapters/payments.ts`. Nothing else changes.
- **A new country** is an entry in `packages/config/src/countries.ts`: currency,
  tax, units, week start, privacy regime and preferred adapters.
- **A new language** is a dictionary in `packages/config/src/i18n.ts`; missing
  keys fall back to English rather than rendering blank.
- **A new coaching rule** is a function in `progression.ts` returning a
  `CoachingRecommendation` with a rule id, added to `evaluateCoachingRules` with
  a precedence. Safety rules always outrank progression rules.
- **Smart-door hardware** verifies a rotating token against `access_credentials`
  through the integration API rather than reading member records.
