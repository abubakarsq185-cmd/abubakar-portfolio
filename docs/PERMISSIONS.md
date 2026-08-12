# Roles and permissions

The matrix lives in three places that must agree:

- `db/migrations/0010_rbac_reference.sql` — the database, which RLS reads
- `packages/types/src/rbac.ts` — what the API and interface use to decide
- this document — why

`tests/integration/data-integrity.test.ts` fails the build if the first two ever
drift apart.

## Roles

| Role | Scope | Summary |
| --- | --- | --- |
| `platform_super_admin` | Platform | GymGuide staff. Tenants, plans, flags, support access. Health data only through a reasoned, time-limited support session. |
| `gym_owner` | Organization | Everything in their brand, including money and health. |
| `branch_manager` | Assigned branches | Operations, staff, members, money and health for their branch. Not organization settings, not role grants. |
| `coach` | Assigned caseload | Their members' training and health. **No financial access by default.** |
| `front_desk` | Branch | Enrolment, sales, payments, check-in, bookings. **No health, nutrition, photos or restricted notes.** |
| `nutrition_professional` | Assigned caseload | Nutrition plans and nutrition check-ins. No money. |
| `member` | Self | Their own plan, workouts, progress, bookings, invoices, support. |
| `guardian` | Linked dependents | Billing and membership for dependents. Health only with explicit consent. |

## The matrix

`●` granted · `–` not granted

| Permission | Owner | Manager | Coach | Front desk | Nutrition |
| --- | :-: | :-: | :-: | :-: | :-: |
| `organization.settings.write` | ● | – | – | – | – |
| `branches.write` | ● | – | – | – | – |
| `staff.read` / `staff.write` | ● | ● | – | – | – |
| `staff.roles.write` | ● | – | – | – | – |
| `audit.read` | ● | ● | – | – | – |
| `integrations.read` | ● | ● | – | – | – |
| `integrations.write` | ● | – | – | – | – |
| `platform_billing.read` | ● | – | – | – | – |
| `leads.read` / `leads.write` | ● | ● | – | ● | – |
| `members.read.all` | ● | ● | – | ● | – |
| `members.read.assigned` | – | – | ● | – | ● |
| `members.write` | ● | ● | – | ● | – |
| `members.export` | ● | ● | – | – | – |
| `consent.collect` | ● | ● | – | ● | – |
| `notes.write` | ● | ● | ● | ● | ● |
| `notes.coach.read` | ● | ● | ● | – | – |
| `notes.restricted.read` | ● | ● | – | – | – |
| `tasks.write` | ● | ● | ● | ● | ● |
| `health.read` | ● | ● | ● | – | ● |
| `health.write` | ● | ● | ● | – | – |
| `progress_photos.read` | ● | – | ● | – | – |
| `escalations.manage` | ● | ● | ● | – | – |
| `finance.read` | ● | ● | – | ● | – |
| `finance.write` | ● | ● | – | ● | – |
| `finance.refund` | ● | – | – | – | – |
| `plans.write` | ● | – | – | – | – |
| `memberships.write` | ● | ● | – | ● | – |
| `ledger.read` | ● | ● | – | – | – |
| `content.write` | ● | ● | ● | – | – |
| `programs.assign` | ● | ● | ● | – | – |
| `programs.override` | ● | – | ● | – | – |
| `checkins.review` | ● | ● | ● | – | ● |
| `nutrition.read` | ● | – | ● | – | ● |
| `nutrition.write` | ● | – | – | – | ● |
| `classes.write` | ● | ● | – | – | – |
| `bookings.write` | ● | ● | ● | ● | – |
| `attendance.write` | ● | ● | ● | ● | – |
| `equipment.write` | ● | ● | – | – | – |
| `automations.write` | ● | ● | – | – | – |
| `messaging.read` / `messaging.write` | ● | ● | ● | ● | ● |
| `support.read` | ● | ● | ● | ● | ● |
| `support.write` | ● | ● | ● | – | ● |
| `ai.logs.read` | ● | – | – | – | – |
| `reports.read` | ● | ● | ● | ● | – |
| `reports.financial` | ● | ● | – | – | – |
| `reports.export` | ● | ● | – | – | – |

Members hold `member.self`; guardians additionally hold `family.billing.manage`.
Platform super admins hold everything, materialised so the console can render a
complete matrix.

## The decisions worth defending

**Coaches have no financial permission.** A coach seeing a member's arrears
changes the coaching relationship, and most gyms do not want it. It is a grant
away when a gym does: `user_permission_grants` requires a written reason, is
audited, and can expire. The demo seeds exactly that — the head coach has
`finance.read` "runs the PT package P&L review with the owner each month".

**Front desk has no health access at all.** Not a redacted view — no access.
Front desk staff turn over quickly, work at a counter people lean over, and do
not need a member's back injury to sell a membership. They can still *collect*
consent and screening, because collecting is not reading.

**Only owners refund.** Refunds move money outward and are the most common
internal-fraud vector in a gym. `finance.write` lets a manager or front desk
take money in; only `finance.refund` sends it back.

**Only owners change roles.** Privilege escalation should require the person
who owns the business. Managers can invite and deactivate staff
(`staff.write`); they cannot make someone an owner.

**Managers get `health.read` but not `progress_photos.read`.** A manager works
escalations, so they need conditions and injuries. Photographs are a different
kind of intimacy and belong to the coach the member chose to share them with.

**Nutrition professionals see health but not money.** Allergies, conditions and
medication matter for their work. Arrears do not.

## Branch scope

Scope is a list of branch ids on the actor. **An empty list means
organization-wide** — that is how owners and org-level staff are expressed, and
it keeps every policy uniform:

```sql
app.can_touch_branch(target)
  = target is null
 or cardinality(app.current_branch_ids()) = 0
 or target = any (app.current_branch_ids())
```

## Caseload scope

`members.read.assigned` narrows further: `app.can_access_member()` returns true
only when the actor is the member's `assigned_coach_id` or
`assigned_nutritionist_id`. It is `SECURITY DEFINER` so the lookup itself is not
subject to RLS, which would recurse while evaluating the policy that called it.

## Individual grants

`user_permission_grants` adds a single permission to one user with a mandatory
reason, an optional expiry, and an audit entry. This is how a gym says "Hassan
can see the numbers" without inventing a new role or promoting him to manager.
