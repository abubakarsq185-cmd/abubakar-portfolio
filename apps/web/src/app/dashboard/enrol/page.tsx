import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { enrolMemberInput, EXPERIENCE_LABELS, GOAL_LABELS, TRAINING_GOALS, EXPERIENCE_LEVELS } from '@gymguide/types';
import { formatMoney } from '@gymguide/config';
import { Badge, Field, Notice, SafetyBanner } from '@gymguide/ui';
import { requirePermission, tenantSessionFor } from '@/server/auth/session';
import { withTenant } from '@/server/db/pool';
import { enrolMember } from '@/server/services/members';

export const metadata: Metadata = { title: 'Enrol a member' };

/**
 * The front desk's most important screen. One form, one transaction: user,
 * profile, consent evidence, signed waiver, emergency contact, membership,
 * first invoice, ledger postings, app invite and a matched program.
 */
async function enrolAction(formData: FormData): Promise<void> {
  'use server';
  const { actor } = await requirePermission('members.write');

  const parsed = enrolMemberInput.safeParse({
    branchId: formData.get('branchId'),
    fullName: formData.get('fullName'),
    email: formData.get('email') || undefined,
    phone: formData.get('phone'),
    dateOfBirth: formData.get('dateOfBirth') || undefined,
    gender: formData.get('gender') || 'undisclosed',
    locale: formData.get('locale') || 'en',
    primaryGoal: formData.get('primaryGoal'),
    experienceLevel: formData.get('experienceLevel'),
    assignedCoachId: formData.get('assignedCoachId') || undefined,
    membershipPlanId: formData.get('membershipPlanId'),
    membershipStartsOn: formData.get('membershipStartsOn'),
    chargeJoiningFee: formData.get('chargeJoiningFee') === 'on',
    emergencyContact: {
      fullName: formData.get('emergencyName'),
      relationship: formData.get('emergencyRelationship'),
      phone: formData.get('emergencyPhone'),
    },
    consents: {
      terms: formData.get('consentTerms') === 'on',
      privacy: formData.get('consentPrivacy') === 'on',
      healthData: formData.get('consentHealth') === 'on',
      progressPhotos: formData.get('consentPhotos') === 'on',
      aiCoaching: formData.get('consentAi') === 'on',
      marketingEmail: formData.get('consentMarketingEmail') === 'on',
      marketingSms: formData.get('consentMarketingSms') === 'on',
      marketingWhatsapp: formData.get('consentMarketingWhatsapp') === 'on',
    },
    waiverSigned: formData.get('waiverSigned') === 'on',
    waiverSignatureName: formData.get('waiverSignatureName'),
    sendAppInvite: formData.get('sendAppInvite') === 'on',
    notes: formData.get('notes') || undefined,
  });

  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    redirect(`/dashboard/enrol?error=${encodeURIComponent(`${issue?.path.join('.') ?? 'form'}: ${issue?.message ?? 'Check the form'}`)}`);
  }

  const result = await enrolMember(actor, parsed.data);
  if (!result.ok) {
    redirect(`/dashboard/enrol?error=${encodeURIComponent(result.error ?? 'Enrolment failed.')}`);
  }
  redirect(`/dashboard/members/${result.userId}?enrolled=1`);
}

export default async function EnrolPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const [{ actor }, params] = await Promise.all([requirePermission('members.write'), searchParams]);

  const { branches, plans, coaches } = await withTenant(tenantSessionFor(actor), async (db) => {
    const [branchRows, planRows, coachRows] = await Promise.all([
      db.query<{ id: string; name: string }>(
        'select id, name from branches where is_active and deleted_at is null order by name',
      ),
      db.query<{ id: string; name: string; price_minor: string; joining_fee_minor: string; currency: string; billing_interval: string }>(
        `select id, name, price_minor, joining_fee_minor, currency, billing_interval
           from membership_plans where is_active and deleted_at is null and kind in ('membership','day_pass')
          order by sort_order`,
      ),
      db.query<{ id: string; full_name: string }>(
        `select distinct u.id, u.full_name
           from users u
           join user_roles ur on ur.user_id = u.id and ur.revoked_at is null
           join roles r on r.id = ur.role_id
          where r.code in ('coach','nutrition_professional') and u.status = 'active'
          order by u.full_name`,
      ),
    ]);
    return { branches: branchRows.rows, plans: planRows.rows, coaches: coachRows.rows };
  });

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="stack stack-6">
      <header className="page-header">
        <div className="stack stack-2">
          <h1 style={{ fontSize: '1.75rem' }}>Enrol a member</h1>
          <p className="small muted">
            Everything below happens in one transaction. If any part fails, none of it is saved — there is no such thing
            as a half-enrolled member.
          </p>
        </div>
        <Link className="btn btn-ghost btn-sm" href="/dashboard/members">
          Cancel
        </Link>
      </header>

      {params.error ? <Notice tone="danger">{params.error}</Notice> : null}

      <form action={enrolAction} className="stack stack-6">
        <section className="card stack stack-4">
          <h2 style={{ fontSize: '1.125rem' }}>1 · Who they are</h2>
          <div className="grid grid-2">
            <Field label="Full name" htmlFor="fullName" required>
              <input id="fullName" name="fullName" className="input" required placeholder="Ayesha Khan" />
            </Field>
            <Field label="Mobile number" htmlFor="phone" required hint="03xx-xxxxxxx or +923xxxxxxxxx">
              <input id="phone" name="phone" className="input" required inputMode="tel" placeholder="0321 4567001" />
            </Field>
            <Field label="Email" htmlFor="email" hint="Optional, but needed for the app invite by email.">
              <input id="email" name="email" type="email" className="input" placeholder="ayesha@example.com" />
            </Field>
            <Field label="Date of birth" htmlFor="dateOfBirth" hint="Used for age-appropriate programming and birthdays.">
              <input id="dateOfBirth" name="dateOfBirth" type="date" className="input" max={today} />
            </Field>
            <Field label="Gender" htmlFor="gender">
              <select id="gender" name="gender" className="select" defaultValue="undisclosed">
                <option value="female">Female</option>
                <option value="male">Male</option>
                <option value="other">Other</option>
                <option value="undisclosed">Prefer not to say</option>
              </select>
            </Field>
            <Field label="App language" htmlFor="locale">
              <select id="locale" name="locale" className="select" defaultValue="en">
                <option value="en">English</option>
                <option value="ur">اردو (Urdu)</option>
                <option value="ur_rm">Roman Urdu</option>
              </select>
            </Field>
          </div>
        </section>

        <section className="card stack stack-4">
          <h2 style={{ fontSize: '1.125rem' }}>2 · What they want</h2>
          <div className="grid grid-2">
            <Field label="Home branch" htmlFor="branchId" required>
              <select id="branchId" name="branchId" className="select" required>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Primary goal" htmlFor="primaryGoal" required>
              <select id="primaryGoal" name="primaryGoal" className="select" required defaultValue="fat_loss">
                {TRAINING_GOALS.map((goal) => (
                  <option key={goal} value={goal}>
                    {GOAL_LABELS[goal]}
                  </option>
                ))}
              </select>
            </Field>
            <Field
              label="Training experience"
              htmlFor="experienceLevel"
              required
              hint="First-timers are matched to the gym induction program."
            >
              <select id="experienceLevel" name="experienceLevel" className="select" required defaultValue="beginner">
                {EXPERIENCE_LEVELS.map((level) => (
                  <option key={level} value={level}>
                    {EXPERIENCE_LABELS[level]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Assign a coach" htmlFor="assignedCoachId" hint="Optional now; a manager can assign later.">
              <select id="assignedCoachId" name="assignedCoachId" className="select" defaultValue="">
                <option value="">No coach yet</option>
                {coaches.map((coach) => (
                  <option key={coach.id} value={coach.id}>
                    {coach.full_name}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </section>

        <section className="card stack stack-4">
          <h2 style={{ fontSize: '1.125rem' }}>3 · Membership</h2>
          <div className="grid grid-2">
            <Field label="Plan" htmlFor="membershipPlanId" required>
              <select id="membershipPlanId" name="membershipPlanId" className="select" required>
                {plans.map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.name} — {formatMoney(Number(plan.price_minor), plan.currency)} / {plan.billing_interval}
                    {Number(plan.joining_fee_minor) > 0
                      ? ` (+ ${formatMoney(Number(plan.joining_fee_minor), plan.currency)} joining)`
                      : ''}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Starts on" htmlFor="membershipStartsOn" required>
              <input id="membershipStartsOn" name="membershipStartsOn" type="date" className="input" required defaultValue={today} />
            </Field>
          </div>
          <label className="checkbox-row">
            <input type="checkbox" name="chargeJoiningFee" defaultChecked />
            <span>
              <strong className="small">Charge the joining fee</strong>
              <span className="hint">Uncheck if you are waiving it as part of a promotion.</span>
            </span>
          </label>
          <p className="micro muted">
            An invoice is raised now and posted to the ledger. Take payment from the member’s profile once they are
            enrolled — cash and bank transfer are recorded immediately.
          </p>
        </section>

        <section className="card stack stack-4">
          <h2 style={{ fontSize: '1.125rem' }}>4 · Emergency contact</h2>
          <div className="grid grid-3">
            <Field label="Name" htmlFor="emergencyName" required>
              <input id="emergencyName" name="emergencyName" className="input" required />
            </Field>
            <Field label="Relationship" htmlFor="emergencyRelationship" required>
              <input id="emergencyRelationship" name="emergencyRelationship" className="input" required placeholder="Spouse" />
            </Field>
            <Field label="Phone" htmlFor="emergencyPhone" required>
              <input id="emergencyPhone" name="emergencyPhone" className="input" required inputMode="tel" />
            </Field>
          </div>
        </section>

        <section className="card stack stack-4">
          <h2 style={{ fontSize: '1.125rem' }}>5 · Consent and waiver</h2>
          <SafetyBanner tone="info" title="Read these to the member, do not tick them on their behalf">
            Each box below is stored as an immutable record with the version, the channel, your name and the time. It is
            the gym’s evidence of what the member actually agreed to.
          </SafetyBanner>

          <div className="stack stack-3">
            <label className="checkbox-row">
              <input type="checkbox" name="consentTerms" required />
              <span>
                <strong className="small">Terms of membership <Badge tone="danger">required</Badge></strong>
                <span className="hint">The member accepts the gym’s terms.</span>
              </span>
            </label>
            <label className="checkbox-row">
              <input type="checkbox" name="consentPrivacy" required />
              <span>
                <strong className="small">Privacy notice <Badge tone="danger">required</Badge></strong>
                <span className="hint">How their data is used and who can see it.</span>
              </span>
            </label>
            <label className="checkbox-row">
              <input type="checkbox" name="consentHealth" />
              <span>
                <strong className="small">Health information</strong>
                <span className="hint">
                  Needed before coaching staff can see screening answers. Without it, the member can still train — the
                  plan simply stays conservative.
                </span>
              </span>
            </label>
            <label className="checkbox-row">
              <input type="checkbox" name="consentAi" defaultChecked />
              <span>
                <strong className="small">AI coaching assistant</strong>
                <span className="hint">GymGuide Coach explains their plan. Their data is never used to train models.</span>
              </span>
            </label>
            <label className="checkbox-row">
              <input type="checkbox" name="consentPhotos" />
              <span>
                <strong className="small">Progress photos</strong>
                <span className="hint">Private by default; sharing with a coach is a separate choice in the app.</span>
              </span>
            </label>
            <div className="grid grid-3">
              <label className="checkbox-row">
                <input type="checkbox" name="consentMarketingEmail" />
                <span className="small">Marketing by email</span>
              </label>
              <label className="checkbox-row">
                <input type="checkbox" name="consentMarketingSms" />
                <span className="small">Marketing by SMS</span>
              </label>
              <label className="checkbox-row">
                <input type="checkbox" name="consentMarketingWhatsapp" />
                <span className="small">WhatsApp messages</span>
              </label>
            </div>
          </div>

          <div className="grid grid-2">
            <Field label="Waiver signed by" htmlFor="waiverSignatureName" required hint="Type the member’s name as they signed it.">
              <input id="waiverSignatureName" name="waiverSignatureName" className="input" required />
            </Field>
            <label className="checkbox-row" style={{ alignSelf: 'flex-end' }}>
              <input type="checkbox" name="waiverSigned" required />
              <span>
                <strong className="small">Liability waiver signed <Badge tone="danger">required</Badge></strong>
                <span className="hint">The member cannot train until this is signed.</span>
              </span>
            </label>
          </div>
        </section>

        <section className="card stack stack-4">
          <h2 style={{ fontSize: '1.125rem' }}>6 · Finish</h2>
          <label className="checkbox-row">
            <input type="checkbox" name="sendAppInvite" defaultChecked />
            <span>
              <strong className="small">Send the app invite</strong>
              <span className="hint">
                They get a link to set a password. Their plan is waiting when they open it.
              </span>
            </span>
          </label>
          <Field label="Notes for staff" htmlFor="notes" hint="Visible to staff. Not shown to the member.">
            <textarea id="notes" name="notes" className="textarea" placeholder="Nervous about the weights area — pair with an induction session." />
          </Field>
          <button className="btn btn-primary btn-lg" type="submit">
            Enrol member and raise invoice
          </button>
        </section>
      </form>
    </div>
  );
}
