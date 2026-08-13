# Security and privacy

Members hand a gym their injuries, conditions, weight and photographs. This
document describes what GymGuide does about that, and — as importantly — what it
does not claim.

## Tenant isolation

Isolation is enforced in three places, and the database is the one that counts.

1. **Interface** — pages render only what the actor's permissions allow.
2. **API / service layer** — `can(actor, permission)` before the query runs.
3. **PostgreSQL row-level security** — the last line of defence.

Every request runs inside a transaction on a connection authenticated as
`gymguide_app`, a role created with `NOBYPASSRLS`. The transaction sets six
session GUCs and every policy reads them:

| GUC | Meaning |
| --- | --- |
| `app.user_id` | The acting user |
| `app.organization_id` | Their tenant |
| `app.role` | Primary role code |
| `app.branch_ids` | Comma-separated branch scope; **empty means org-wide** |
| `app.permissions` | Resolved permission list |
| `app.is_platform_admin` | Platform staff flag |

If the GUCs are unset — an unauthenticated connection, a leaked credential, a
psql session — every tenant policy evaluates false and the connection sees
nothing. There is a test for exactly that.

`assertRlsEnforced()` runs on first use and **throws in production** if the
application role turns out to be a superuser or to have `BYPASSRLS`.

### Proven, not asserted

`tests/integration/rls-isolation.test.ts` creates a second organization and,
connected as the unprivileged role, tries to:

- read another gym's members, branches, invoices, payments and health records
- insert a row into another organization
- update another organization's branch
- read another member's invoices and health screening as a member
- read health data as front desk
- read coach-only and restricted notes as front desk
- read the ledger as a coach
- see members outside the caseload as a coach
- see other branches as a branch manager
- see an unshared progress photo as a coach
- update or delete the audit log, the ledger and consent history

All twenty-three assertions must fail to read, or the suite fails.

This is not theoretical. The suite caught a real bug: `notes` had a permissive
`FOR ALL` write policy, and because PostgreSQL OR-s permissive policies, that
policy also granted `SELECT` — front desk could read coach-only notes.
`db/migrations/0012_policy_fixes.sql` splits write policies into
INSERT/UPDATE/DELETE so the read policy is the sole authority on visibility.

## Authentication

- **Passwords**: scrypt (N=16384, r=8, p=1, 64-byte key) with a per-password
  salt. Parameters are stored in the hash, so they can be raised later without
  invalidating anyone. A failed login for a non-existent account still performs
  a derivation, so account existence is not detectable by timing.
- **Sessions**: 32 random bytes, stored as a SHA-256 hash, in an `httpOnly`,
  `SameSite=Lax`, `Secure` (outside development) cookie. Not a JWT — revoking a
  session is a database write, which matters when a phone is lost.
- **MFA**: TOTP (RFC 6238) with a ±1 window for clock drift. Enabled per user,
  or forced for all staff with `REQUIRE_STAFF_MFA`. Sessions record whether MFA
  was satisfied.
- **Lockout**: ten consecutive failures locks an account for fifteen minutes.
  Login is rate limited per email address.
- **Rehashing**: a password hashed with weaker parameters is upgraded silently
  on next successful login.

## Health data

Health data is the strictest tier in the product.

| Data | Permission | Notes |
| --- | --- | --- |
| Health screening | `health.read` | Front desk never has it |
| Risk flags / escalations | `health.read` | Same policy as screening |
| Progress photos | `progress_photos.read` **and** the member set `shared_with_coach` | Private by default |
| Nutrition targets and plans | `nutrition.read` | Front desk and unassigned coaches excluded |
| Coach-only notes | `notes.coach.read` | |
| Restricted notes | `notes.restricted.read` | Incidents, disputes |
| Support case detail marked `contains_health_data` | `health.read` | The case exists in the queue; the detail does not render |

Opening a health record writes a `read_sensitive` audit entry naming the actor,
the subject and the time. A guardian sees a dependent's billing but **not** their
health data unless `family_links.can_view_health` was explicitly granted.

Platform administrators do not get silent access — to anything. Every tenant
policy resolves through `app.has_support_access(org)`, which requires an
**active, unexpired support access session** held by that platform user for that
organization. Creating one requires a written reason of at least twelve
characters plus an expiry, and it is listed for the gym owner to see.

This was not always true, and the gap is worth recording. `health_row_visible()`
enforced it from the start, but `in_tenant_scope()` — which every generated
tenant policy is built on — returned true on the platform flag alone. Against
the demo gym with no support session open, `support@gymguide.app` could read 20
member profiles, 68 invoices and 10 notes including coach-only and restricted
ones, and `/dashboard/members` rendered the gym's members by name. Health data
was the exception that proved the rule was missing everywhere else.
`0020_support_access_gates_tenant_data.sql` closes it, `requireStaff()` sends
platform staff to `/platform` without a session so the interface agrees with the
database, and `tests/integration/rls-isolation.test.ts` asserts both directions:
nothing readable without a session, the gym readable with one, and shut again
the moment it ends or expires.

What platform staff can still see without a session is the platform's own
business: which gyms exist, what they pay, the plan catalogue, feature flags and
the support ledger itself. Not a single row of member data.

## Consent

`consents` is append-only. Granting, refusing and withdrawing each write a new
row carrying the version, channel, collecting staff member, IP and timestamp.
Nothing is ever edited, so "what did this member agree to on the day they
joined?" has an answer.

Marketing consent is separate per channel, defaults to false, and the automation
gate refuses to send marketing without it. WhatsApp additionally requires opt-in
before any message, which is why the seed contains a suppressed WhatsApp
notification with the reason recorded.

## Audit

`audit_logs` is append-only at three levels: triggers block `UPDATE` and
`DELETE`, the application role has those privileges revoked, and writes go
through one module. Audited events include payments, refunds, consent capture,
program assignment, engine overrides, escalations, role and permission changes,
sensitive reads, exports, erasure requests, impersonation and every AI output.

The same trigger protection covers `ledger_entries` and `consents`. Financial
corrections are new balancing entries, never edits.

## Money

- Integer minor units and an explicit currency; mixing currencies throws.
- Every money event produces a balanced double-entry group, checked by
  `assertBalanced` before anything is written.
- Invoice state is derived from amounts, never assigned.
- Payments carry an idempotency key with a unique index, so a double-submitted
  form or a retried request cannot post twice.
- Webhooks verify signatures with a constant-time comparison and a timestamp
  skew window, then deduplicate on `(provider, external_event_id)`.
- Refunds cannot exceed the payment they belong to.

## Files

Progress photos and health documents are private. Access is a short-lived signed
URL (HMAC over key plus expiry, default five minutes), verified in constant
time. Uploads are validated by MIME allow-list, size cap, and an
extension-matches-content check, and filenames containing path separators are
rejected.

## AI

- Member data is **never** used for external model training.
- The model reaches member data only through six typed tools, each scoped by RLS.
- Requests are classified before the model is called; medical, supplement,
  extreme-diet, mental-health and cross-member requests never reach it.
- Output is validated after: claims of medical safety, diagnoses, supplement
  recommendations, calorie prescriptions, "push through the pain" and outcome
  promises are replaced with a safe message and an escalation.
- Every turn is stored with driver, model, prompt version, tool calls, sources,
  output and safety verdict.
- The default driver is deterministic and makes no network calls.

## Transport and headers

HSTS, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, a strict
referrer policy and a narrow permissions policy are set for every response.
TLS termination and at-rest encryption are deployment responsibilities;
`DATABASE_SSL=true` enables verified TLS to PostgreSQL.

## Data rights

`data_requests` tracks export, erasure and rectification requests with a 30-day
clock and a handler. Erasure respects the append-only tables: audit, consent and
ledger history are retained as legal and financial records while personal
identifiers elsewhere are removed. That trade-off is deliberate and should be
stated in the gym's privacy notice.

## What this is not

- Not a penetration test. No third-party assessment has been performed.
- Not certified against any standard. No SOC 2, ISO 27001 or HIPAA claim is made,
  and HIPAA does not apply to a gym in Pakistan.
- Not a medical device, and not a substitute for clinical judgement.

## Reporting a vulnerability

Email `security@gymguide.app` with reproduction steps. Please do not open a
public issue.
