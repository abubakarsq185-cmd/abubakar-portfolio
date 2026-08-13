# Go-live: how to check this before you hand it to a gym

Read this in order. It is written so you can work through it once and know
exactly what is true, what is broken, and what is still owed.

Three kinds of item appear:

| | Meaning |
| --- | --- |
| **PASS** | Verified working, right now, on your machine |
| **FAIL** | Broken. Do not hand over until it is fixed |
| **GATE** | Cannot be settled by software — a contract, a server, or a person with the standing to sign it off |

Gates are not bugs. Writing more code will not clear a single one of them.

---

## Stage 0 — Run the robot first

```bash
./start.sh                       # in one terminal, leave it running
node tools/readiness.mjs         # in another
```

It writes `readiness-report.html`. Open it. Seven sections, every check labelled
PASS, FAIL or GATE, and an exit code you can put in CI.

A full run takes about ten minutes because it typechecks, builds, runs 241
tests, opens all 23 pages as all 8 roles, and walks 43 steps through eight
journeys. `--quick` skips the build and the journey walk if you just want the
security and route checks.

**If anything says FAIL, stop and fix it.** Everything below assumes the robot
is clean.

---

## Stage 1 — Prove the security boundary yourself

This is the part you should not take anyone's word for, mine included. It takes
five minutes and it is the difference between "the screen hides it" and "the
data never leaves the database".

1. Sign in as `frontdesk@apexfitness.pk`. Open a member. **There is no health
   section.** Copy that member's URL.
2. Sign out. Sign in as `coach@apexfitness.pk`. Paste the same URL. **The health
   screening is there.**
3. As front desk again, type `/dashboard/escalations` into the address bar
   directly. **You are redirected**, with `?denied=health.read` on the URL.
4. Sign in as `owner@apexfitness.pk`, open `/dashboard/reports`. **Two branches.**
5. Sign in as `manager.dha@apexfitness.pk`, open the *same URL*. **One branch.**

Step 4 versus 5 is the whole design in one comparison: same URL, same code, no
filtering in the query. PostgreSQL returns different rows to different people.

**Pass criterion:** all five behave as described.

---

## Stage 2 — Walk the money

Money is where a bug costs a gym its trust.

1. As front desk, `/dashboard/enrol`. Enrol a member with a membership and the
   joining fee. **You land on their profile with a confirmation.**
2. On that profile, take a cash payment. **A receipt number is issued.**
3. Go to `/dashboard/billing`. **The payment appears in collections and the
   ledger balances are updated.**
4. Try to record the *same* payment twice (submit the form, then go back and
   submit again). **The second one must not create a second payment.**

**Pass criterion:** one member, one invoice, one payment, one receipt, and a
ledger that still balances.

Then, in `psql`:

```sql
select sum(case when direction='debit' then amount_minor else -amount_minor end)
  from ledger_entries;   -- must be exactly 0
```

If that is not zero, stop. Money is wrong somewhere.

---

## Stage 3 — Walk the safety path

The part that carries real risk.

1. Sign in as `nida.aslam@example.com`. **You land in the onboarding wizard**, at
   the health step.
2. Answer **yes** to chest pain. Continue.
3. **You get a calm warning that names no condition and offers no diagnosis**,
   and a case reference.
4. Sign in as `manager.gulberg@apexfitness.pk`, open `/dashboard/escalations`.
   **Nida is in the queue, marked critical.**
5. Check that member's plan: **progression is paused**.

**Pass criterion:** the member is warned without being diagnosed, a named role
owns the case, and automation stopped touching that member's plan.

**Fail immediately if:** the app names a condition, tells them they are fine,
tells them to push through, or lets the plan keep progressing.

---

## Stage 4 — Walk the member experience

Someone who has never had a trainer must be able to open this and know what to
do. Sign in as `ayesha.khan@example.com` **on a phone, or a narrow window**.

1. **Today** tells you one thing to do, not a dashboard.
2. **Train** → open the session. The player shows the target, the previous
   performance, a rest timer, "How to do it", "Swap exercise" and
   "Something hurts".
3. Log a set. Put the phone in aeroplane mode, log another, bring it back.
   **Nothing is lost.**
4. **Nutrition** leads with portions, and says plainly that it is not medical
   advice.
5. **Support** shows the AI coach. Every AI reply is labelled **AI-assisted**,
   and "talk to gym staff" is on screen.
6. **Profile** lets you turn off a channel, set quiet hours, and request your
   data or its deletion.

**Pass criterion:** you could hand the phone to someone who has never trained
and they would know what to do next.

---

## Stage 5 — Walk the gym's own tools

- **Classes** — check a member in; cancel a place and watch the waitlist take
  it; confirm front desk is *not* offered "cancel this class".
- **Programs** — copy a template, edit a phase, publish it. **Your name appears
  as the approver.** Confirm you cannot edit a GymGuide template directly.
- **Automations** — try to raise a contact ceiling past the cap (refused), try
  to turn off consent on a birthday message (forced back on), and read the skip
  reasons.
- **Reports** — tenure buckets, adherence, revenue from the ledger.

---

## Stage 6 — The gates

None of these are code. All of them are real.

### Payments
Cash and bank transfer work today, with reconciliation and receipts. **Card,
wallet and QR do not move money** — the adapters are real, with signature
verification and idempotency, but they need a contracted merchant account. Until
then the interface says so rather than pretending.

**Owed:** a payment provider agreement, then the keys in `.env`.

### Deployment
Nothing is hosted. Before handover you need a host, managed PostgreSQL, TLS, a
domain, secrets in a real secret store — and a **restore you have actually
tested**, not just a backup you have configured.

**Owed:** a deployment, and one practice restore from backup.

### Health data
Consent per purpose, audit trails, role restrictions and erasure are all built
and tested. Whether that discharges the obligations a gym takes on by storing
screening answers and progress photos is a judgement for someone qualified to
make it.

**Owed:** a review by a person with the standing to accept that risk.

### Messaging
WhatsApp needs templates approved by Meta. Email needs SMTP. Until configured,
messages are recorded but not delivered — the automations screen labels those
channels "logged only".

**Owed:** SMTP credentials, and Meta template approval.

### Mobile
The Expo project exists and shares types with the web app. Nothing is signed,
built or submitted. **Members use the web app on their phone today**, which
works — but it is not a store listing.

**Owed:** signing certificates and store submissions, if you want one.

### Not yet done
No load testing, no accessibility audit, no browser-matrix testing. Charts carry
screen-reader captions and focus states are styled, but nothing has been
audited, and nothing has been tested above a handful of users.

---

## Stage 7 — Before you hand over the keys

- [ ] Change `SEED_DEMO_PASSWORD`, and delete every demo account from the
      production database. **The demo password is in this repository.**
- [ ] Create the gym's real owner account and remove `support@gymguide.app` if
      the gym is not on your platform plan.
- [ ] Set `APP_ENV=production` and `DATABASE_SSL=true`.
- [ ] Confirm `.env` is not in git: `git ls-files .env` must print nothing.
- [ ] Run `node tools/readiness.mjs` against the deployed URL
      (`CHECK_BASE_URL=https://…`) and keep the report.
- [ ] Build the archive you are actually handing over:
      `node tools/package-release.mjs`. It writes `dist/gymguide-<sha>.tar.gz`,
      a `.zip`, and `SHA256SUMS`. It builds from `git archive HEAD`, so it
      cannot contain your `.env` — and it refuses to run on a dirty tree.
- [ ] Agree who the gym calls when something breaks, and when.

---

## What "done" honestly looks like

The software is finished and verified: 241 automated tests, 43 journey steps
through the real interface, and every page opened as every role without a
server error.

It is not ready to hand to a gym until the gates in Stage 6 are cleared. That is
not a criticism of the build — it is what the last mile of shipping software
that takes money and holds health data actually consists of.
