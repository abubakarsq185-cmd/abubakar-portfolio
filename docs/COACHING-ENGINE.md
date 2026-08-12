# The coaching engine

`packages/domain/src/coaching/` · tested in `tests/unit/coaching-engine.test.ts`

The engine is deterministic and rule-based on purpose. An AI that invents
training load for a stranger with a bad back is a liability; a small set of
transparent rules that a coach can read, audit and override is a product.

The AI layer may *explain* these decisions. It never makes them.

## Invariants

Enforced in code and asserted in tests:

1. A member with a progression hold is **never** auto-progressed.
2. A restricted movement pattern is **never** auto-progressed.
3. Reported pain outranks every progression rule.
4. At most one recommendation per exercise, plus at most one plan-level
   recommendation — a member is never handed contradictory instructions.
5. Every recommendation records its rule id, version, evidence and before/after
   values.

## The rules

### R-PROG-001 — controlled load progression

**When** the last two sessions on an exercise met every prescribed rep at or
below the intended effort ceiling, with no discomfort ≥ 4/10.

**Then** increase load by the exercise's load step, capped at 7.5% of current
load and rounded to what the gym can actually put on a bar.

*Two sessions, not one — one good session is noise. The percentage cap stops a
2.5 kg step becoming trivial on a 40 kg lift and dangerous on a 200 kg one.*

### R-PROG-002 — rep progression

Same trigger, for bodyweight or unloaded movements. Adds two reps to the target
rather than weight.

### R-HOLD-003 / R-HOLD-004 — backing off

**When** the last two sessions fell short of the prescribed rep floor.

**Then** reduce load ~10% (loaded) or hold the target (unloaded), with member
copy that frames it as normal: *"this is normal and it works"*. Members quit
when they feel like they are failing; they do not quit when the plan adjusts.

### R-MISS-005 — missed workouts

**When** three or more sessions were missed in the last fourteen days.

**Then** offer a shorter week — a floor of two days, one less than current.

*The failure mode here is a plan that quietly becomes fiction. Offering less is
better than letting someone carry a four-day plan they have not touched in a
fortnight.*

### R-RECOV-006 — poor recovery

**When** two consecutive check-ins report soreness ≥ 4/5 together with sleep or
energy ≤ 2/5.

**Then** cut weekly volume by a third **and require staff approval**.

*This one always needs a human. Soreness plus bad sleep might be training load —
or a new baby, a night shift, or something medical. The engine can reduce the
training variable; only a person can ask the question.*

### R-PAIN-007 — reported discomfort

**When** discomfort ≥ 4/10 is logged on an exercise.

**Then** stop progression for that movement, require staff approval, and tell
the member plainly: *"Please do not push through pain."* Highest precedence, so
it wins against any progression rule the same evaluation produced.

## Suggested load in the player

`suggestedLoadForNextSession()` pre-fills the weight field from the member's own
history — never a population average:

- progression hold, restricted movement, or discomfort ≥ 4 → **hold** last load
- two clean sessions → next step up
- last session missed targets → ~10% back-off
- otherwise → repeat last load
- no history → the template's starting load

## Substitutions

`resolveSubstitutions()` filters the *approved* substitution graph. It never
invents a swap. A candidate must:

1. be approved for the requested reason,
2. train the same movement pattern — unless it is explicitly an injury-friendly
   or low-impact alternative,
3. not be a movement pattern restricted for this member,
4. need only equipment the branch actually has available,
5. be low-impact if the member requires low impact,
6. carry no contraindication matching a condition on file.

If nothing survives, the member is told to ask a coach rather than being offered
something plausible. The rejection reasons are returned too, so staff can see
*why* a member had no options — usually a machine out of service.

## Program matching

`matchProgram()` scores approved templates on goal fit, experience gap, days per
week, session length, branch equipment, low-impact requirement, Ramadan mode and
home training, then prefers branch and organization content over the platform
library.

Two conditions are near-disqualifying rather than merely penalised:

- **missing equipment** — a plan the branch cannot deliver is worse than making
  a coach choose
- **low impact required but not offered** — that is a safety constraint, not a
  preference

Any contraindication matching a member's condition drops the score by 200,
which is designed to be unrecoverable.

The matcher refuses to auto-assign — returning `needsHumanAssignment` — when the
member was flagged by health screening, when the best candidate carries a
contraindication, or when the best score is still below 60 with warnings.

## Adherence and streaks

`computeAdherence()` gives **half credit for partial sessions**. Someone who
turned up, did six sets of twelve and left is not the same as someone who did
not come, and scoring them identically teaches members that a short session is
worthless.

Streaks count consecutive *completed scheduled sessions*, so a planned rest day
does not break one.

## Personal records

`detectPersonalRecords()` tracks max weight, best estimated 1RM (Epley) and max
reps, and never regresses an existing record. A rep record on a lighter weight
does not overwrite one set on a heavier one.

## Adding a rule

1. Write a function in `progression.ts` returning a `CoachingRecommendation`
   with a new rule id, rationale, evidence and before/after values.
2. Add it to `evaluateCoachingRules` with a precedence — safety rules above
   progression rules, always.
3. Set `requiresStaffApproval: true` if the rule touches anything a qualified
   person should see first.
4. Add tests: the case where it fires, the case where it must not, and its
   interaction with an active progression hold.

Recommendations are written to `coaching_recommendations` with state
`auto_applied` or `proposed`. Staff approve, reject or override from the
coaching queue; an override requires a written reason and is audited.
