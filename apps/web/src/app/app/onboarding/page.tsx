import Link from 'next/link';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import type { Metadata } from 'next';
import { EXPERIENCE_LABELS, EXPERIENCE_LEVELS, GOAL_LABELS, TRAINING_GOALS } from '@gymguide/types';
import { Badge, Notice, Panel, ProgressBar, SafetyBanner } from '@gymguide/ui';
import { requireMember } from '@/server/auth/session';
import {
  ONBOARDING_STEPS,
  STEP_TITLES,
  completeOnboarding,
  goToStep,
  loadOnboarding,
  saveGoals,
  saveHealthScreening,
  saveSchedule,
  type OnboardingStep,
} from '@/server/services/onboarding';

export const metadata: Metadata = { title: 'Getting started' };

/** Everyday words. A screening question nobody understands is worthless. */
const RED_FLAG_QUESTIONS: Array<{ name: string; question: string }> = [
  { name: 'chestPain', question: 'Do you ever get pain or tightness in your chest?' },
  { name: 'fainting', question: 'Have you fainted or blacked out in the last year?' },
  { name: 'severeDizziness', question: 'Do you get severe dizziness or lose your balance?' },
  { name: 'breathingDifficulty', question: 'Do you get short of breath doing everyday things?' },
  { name: 'currentSharpPain', question: 'Do you have sharp pain anywhere right now?' },
  { name: 'recentSurgery', question: 'Have you had surgery in the last 12 months?' },
  { name: 'pregnancyOrPostpartum', question: 'Are you pregnant, or within a year of giving birth?' },
  { name: 'doctorAdvisedAgainstExercise', question: 'Has a doctor ever told you not to exercise?' },
  { name: 'disorderedEatingConcern', question: 'Do you have concerns about your eating you would like support with?' },
];

const CONDITIONS: Array<{ value: string; label: string }> = [
  { value: 'heart_condition', label: 'Heart condition' },
  { value: 'high_blood_pressure', label: 'High blood pressure' },
  { value: 'diabetes', label: 'Diabetes' },
  { value: 'asthma', label: 'Asthma' },
  { value: 'thyroid', label: 'Thyroid condition' },
  { value: 'pcos', label: 'PCOS' },
  { value: 'joint_problem', label: 'Joint problem' },
  { value: 'back_problem', label: 'Back problem' },
  { value: 'other', label: 'Something else' },
];

const PAIN_AREAS = ['neck', 'shoulder', 'elbow', 'wrist', 'lower_back', 'hip', 'knee', 'ankle'] as const;

const DAYS = [
  { value: 'mon', label: 'Mon' },
  { value: 'tue', label: 'Tue' },
  { value: 'wed', label: 'Wed' },
  { value: 'thu', label: 'Thu' },
  { value: 'fri', label: 'Fri' },
  { value: 'sat', label: 'Sat' },
  { value: 'sun', label: 'Sun' },
];

const TIMES = [
  { value: 'early_morning', label: 'Early morning' },
  { value: 'morning', label: 'Morning' },
  { value: 'afternoon', label: 'Afternoon' },
  { value: 'evening', label: 'Evening' },
  { value: 'late_night', label: 'Late night' },
  { value: 'flexible', label: 'Whenever I can' },
];

function back(message: string): never {
  redirect(`/app/onboarding?error=${encodeURIComponent(message)}`);
}

function optionalNumber(value: FormDataEntryValue | null): number | null {
  const text = String(value ?? '').trim();
  if (!text) return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

async function startAction(): Promise<void> {
  'use server';
  const { actor } = await requireMember();
  await goToStep(actor, 'goals');
  revalidatePath('/app/onboarding');
  redirect('/app/onboarding');
}

async function backToAction(formData: FormData): Promise<void> {
  'use server';
  const { actor } = await requireMember();
  await goToStep(actor, String(formData.get('step')) as OnboardingStep);
  revalidatePath('/app/onboarding');
  redirect('/app/onboarding');
}

async function goalsAction(formData: FormData): Promise<void> {
  'use server';
  const { actor } = await requireMember();
  const result = await saveGoals(actor, {
    primaryGoal: String(formData.get('primaryGoal') ?? ''),
    experienceLevel: String(formData.get('experienceLevel') ?? ''),
    heightCm: optionalNumber(formData.get('heightCm')),
    startingWeightKg: optionalNumber(formData.get('startingWeightKg')),
    targetWeightKg: optionalNumber(formData.get('targetWeightKg')),
  });
  if (!result.ok) back(result.message ?? 'Please check that step.');
  revalidatePath('/app/onboarding');
  redirect('/app/onboarding');
}

async function scheduleAction(formData: FormData): Promise<void> {
  'use server';
  const { actor } = await requireMember();
  const result = await saveSchedule(actor, {
    trainingDaysPerWeek: Number(formData.get('trainingDaysPerWeek') ?? 3),
    preferredSessionMinutes: Number(formData.get('preferredSessionMinutes') ?? 45),
    preferredTrainingTime: String(formData.get('preferredTrainingTime') ?? 'flexible'),
    preferredDays: formData.getAll('preferredDays').map(String),
  });
  if (!result.ok) back(result.message ?? 'Please check that step.');
  revalidatePath('/app/onboarding');
  redirect('/app/onboarding');
}

async function healthAction(formData: FormData): Promise<void> {
  'use server';
  const { actor } = await requireMember();
  const flag = (name: string) => formData.get(name) === 'yes';
  const result = await saveHealthScreening(actor, {
    redFlags: {
      chestPain: flag('chestPain'),
      fainting: flag('fainting'),
      severeDizziness: flag('severeDizziness'),
      breathingDifficulty: flag('breathingDifficulty'),
      currentSharpPain: flag('currentSharpPain'),
      recentSurgery: flag('recentSurgery'),
      pregnancyOrPostpartum: flag('pregnancyOrPostpartum'),
      doctorAdvisedAgainstExercise: flag('doctorAdvisedAgainstExercise'),
      disorderedEatingConcern: flag('disorderedEatingConcern'),
    },
    conditions: formData.getAll('conditions').map(String),
    painAreas: formData.getAll('painAreas').map(String),
    medications: formData.get('medications') === 'yes',
    detail: String(formData.get('detail') ?? '').trim() || undefined,
  });
  if (!result.ok) back(result.message ?? 'Please check that step.');
  revalidatePath('/app/onboarding');
  redirect(
    result.escalation
      ? `/app/onboarding?escalated=${encodeURIComponent(result.escalation.caseReference ?? 'raised')}`
      : '/app/onboarding',
  );
}

async function preferencesAction(formData: FormData): Promise<void> {
  'use server';
  const { actor } = await requireMember();
  const result = await completeOnboarding(actor, {
    ramadanMode: formData.get('ramadanMode') === 'on',
    trainsAtHome: formData.get('trainsAtHome') === 'on',
    needsLowImpact: formData.get('needsLowImpact') === 'on',
  });
  if (!result.ok) back(result.message ?? 'Please check that step.');
  revalidatePath('/app/onboarding');
  revalidatePath('/app');
  redirect('/app/onboarding');
}

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; escalated?: string }>;
}) {
  const [{ actor }, params] = await Promise.all([requireMember(), searchParams]);
  const state = await loadOnboarding(actor);

  const stepIndex = ONBOARDING_STEPS.indexOf(state.step);
  const previous = stepIndex > 0 ? ONBOARDING_STEPS[stepIndex - 1] : null;

  return (
    <div className="stack stack-5">
      <header className="stack stack-3">
        <div className="row-between row-wrap">
          <h1 style={{ fontSize: '1.5rem' }}>{STEP_TITLES[state.step]}</h1>
          <Badge>
            Step {stepIndex + 1} of {ONBOARDING_STEPS.length}
          </Badge>
        </div>
        <ProgressBar
          value={stepIndex}
          max={ONBOARDING_STEPS.length - 1}
          label={`Step ${stepIndex + 1} of ${ONBOARDING_STEPS.length}`}
        />
        <p className="micro muted">
          Everything is saved as you go, so you can stop and come back. Nothing here is shared with other members.
        </p>
      </header>

      {params.error ? <Notice tone="danger">{params.error}</Notice> : null}

      {state.step === 'welcome' ? (
        <>
          <Panel title={`Hello ${state.memberName.split(' ')[0]}`}>
            <div className="stack stack-3">
              <p className="small secondary">
                Five short steps and you will have a plan for your first session — what to do, how much, and what good
                form looks like. It takes about three minutes.
              </p>
              <ul className="stack stack-2" style={{ paddingLeft: '1.1rem' }}>
                <li className="small secondary">What you want to get out of training.</li>
                <li className="small secondary">When you can realistically come in.</li>
                <li className="small secondary">A few health questions, so we keep you safe.</li>
                <li className="small secondary">How you prefer to train.</li>
              </ul>
              <p className="micro muted">
                {state.equipmentAtBranch.length > 0
                  ? `Your plan will only use equipment your gym actually has — ${state.equipmentAtBranch
                      .slice(0, 4)
                      .join(', ')}${state.equipmentAtBranch.length > 4 ? ' and more' : ''}.`
                  : 'Your plan will only use equipment your gym actually has.'}
              </p>
            </div>
          </Panel>
          <form action={startAction}>
            <button className="btn btn-primary btn-block" type="submit">
              Let’s start
            </button>
          </form>
        </>
      ) : null}

      {state.step === 'goals' ? (
        <Panel title="What do you want from training?">
          <form action={goalsAction} className="stack stack-4">
            <label className="stack stack-2">
              <span className="label">Main goal</span>
              <select className="select" name="primaryGoal" defaultValue={state.primaryGoal ?? 'general_fitness'} required>
                {TRAINING_GOALS.map((goal) => (
                  <option key={goal} value={goal}>
                    {GOAL_LABELS[goal]}
                  </option>
                ))}
              </select>
            </label>

            <label className="stack stack-2">
              <span className="label">How much training have you done before?</span>
              <select className="select" name="experienceLevel" defaultValue={state.experienceLevel ?? 'beginner'} required>
                {EXPERIENCE_LEVELS.map((level) => (
                  <option key={level} value={level}>
                    {EXPERIENCE_LABELS[level]}
                  </option>
                ))}
              </select>
              <span className="hint">
                Be honest rather than optimistic — it decides how much you start with, and starting too heavy is the
                fastest way to stop.
              </span>
            </label>

            <div className="grid grid-3">
              <label className="stack stack-2">
                <span className="label">Height (cm)</span>
                <input
                  className="input"
                  type="number"
                  name="heightCm"
                  min="80"
                  max="260"
                  step="0.5"
                  defaultValue={state.heightCm ?? ''}
                />
              </label>
              <label className="stack stack-2">
                <span className="label">Weight now (kg)</span>
                <input
                  className="input"
                  type="number"
                  name="startingWeightKg"
                  min="25"
                  max="400"
                  step="0.1"
                  defaultValue={state.startingWeightKg ?? ''}
                />
              </label>
              <label className="stack stack-2">
                <span className="label">Target weight (kg)</span>
                <input
                  className="input"
                  type="number"
                  name="targetWeightKg"
                  min="25"
                  max="400"
                  step="0.1"
                  defaultValue={state.targetWeightKg ?? ''}
                />
                <span className="hint">Optional.</span>
              </label>
            </div>

            <button className="btn btn-primary btn-block" type="submit">
              Continue
            </button>
          </form>
        </Panel>
      ) : null}

      {state.step === 'schedule' ? (
        <Panel title="When can you actually train?">
          <form action={scheduleAction} className="stack stack-4">
            <label className="stack stack-2">
              <span className="label">Days a week</span>
              <select className="select" name="trainingDaysPerWeek" defaultValue={String(state.trainingDaysPerWeek ?? 3)}>
                {[1, 2, 3, 4, 5, 6, 7].map((days) => (
                  <option key={days} value={days}>
                    {days} {days === 1 ? 'day' : 'days'}
                  </option>
                ))}
              </select>
              <span className="hint">
                Pick the number you can keep up on a bad week, not a good one. Three steady weeks beat one perfect one.
              </span>
            </label>

            <label className="stack stack-2">
              <span className="label">How long per session</span>
              <select
                className="select"
                name="preferredSessionMinutes"
                defaultValue={String(state.preferredSessionMinutes ?? 45)}
              >
                {[20, 30, 45, 60, 75, 90].map((minutes) => (
                  <option key={minutes} value={minutes}>
                    {minutes} minutes
                  </option>
                ))}
              </select>
            </label>

            <label className="stack stack-2">
              <span className="label">Usual time of day</span>
              <select
                className="select"
                name="preferredTrainingTime"
                defaultValue={state.preferredTrainingTime ?? 'flexible'}
              >
                {TIMES.map((time) => (
                  <option key={time.value} value={time.value}>
                    {time.label}
                  </option>
                ))}
              </select>
            </label>

            <fieldset className="stack stack-2" style={{ border: 0, padding: 0, margin: 0 }}>
              <legend className="label">Which days suit you?</legend>
              <div className="row row-wrap">
                {DAYS.map((day) => (
                  <label key={day.value} className="checkbox-row" style={{ minWidth: '5.5rem' }}>
                    <input
                      type="checkbox"
                      name="preferredDays"
                      value={day.value}
                      defaultChecked={state.preferredDays.includes(day.value)}
                    />
                    <span className="small">{day.label}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            {/* Back posts the same form to a different action: a nested
                form is invalid HTML, and formNoValidate lets someone go back
                without first satisfying the fields in front of them. */}
            <div className="row">
              {previous ? (
                <>
                  <input type="hidden" name="step" value={previous} />
                  <button className="btn btn-ghost" type="submit" formAction={backToAction} formNoValidate>
                    Back
                  </button>
                </>
              ) : null}
              <button className="btn btn-primary" type="submit" style={{ flex: 1 }}>
                Continue
              </button>
            </div>
          </form>
        </Panel>
      ) : null}

      {state.step === 'health' ? (
        <>
          <SafetyBanner tone="warning" title="Answer honestly — this is the part that keeps you safe">
            Nobody is judging these answers and no other member can see them. If you say yes to something serious, we
            will pause the automatic plan and a qualified person at your gym will speak to you first. GymGuide does not
            diagnose anything and is not a substitute for a doctor.
          </SafetyBanner>

          <Panel title="A few health questions">
            <form action={healthAction} className="stack stack-4">
              <div className="stack stack-3">
                {RED_FLAG_QUESTIONS.map((item) => (
                  <fieldset key={item.name} className="stack stack-2" style={{ border: 0, padding: 0, margin: 0 }}>
                    <legend className="small">{item.question}</legend>
                    <div className="row">
                      <label className="checkbox-row">
                        <input type="radio" name={item.name} value="no" defaultChecked />
                        <span className="small">No</span>
                      </label>
                      <label className="checkbox-row">
                        <input type="radio" name={item.name} value="yes" />
                        <span className="small">Yes</span>
                      </label>
                    </div>
                  </fieldset>
                ))}
              </div>

              <fieldset className="stack stack-2" style={{ border: 0, padding: 0, margin: 0 }}>
                <legend className="label">Any of these conditions?</legend>
                <div className="stack stack-2">
                  {CONDITIONS.map((condition) => (
                    <label key={condition.value} className="checkbox-row">
                      <input type="checkbox" name="conditions" value={condition.value} />
                      <span className="small">{condition.label}</span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <fieldset className="stack stack-2" style={{ border: 0, padding: 0, margin: 0 }}>
                <legend className="label">Anywhere that regularly hurts?</legend>
                <div className="row row-wrap">
                  {PAIN_AREAS.map((area) => (
                    <label key={area} className="checkbox-row" style={{ minWidth: '8rem' }}>
                      <input type="checkbox" name="painAreas" value={area} />
                      <span className="small">{area.replace(/_/g, ' ')}</span>
                    </label>
                  ))}
                </div>
                <span className="hint">
                  We will keep exercises that load these areas out of your plan until a coach says otherwise.
                </span>
              </fieldset>

              <fieldset className="stack stack-2" style={{ border: 0, padding: 0, margin: 0 }}>
                <legend className="small">Do you take medication regularly?</legend>
                <div className="row">
                  <label className="checkbox-row">
                    <input type="radio" name="medications" value="no" defaultChecked />
                    <span className="small">No</span>
                  </label>
                  <label className="checkbox-row">
                    <input type="radio" name="medications" value="yes" />
                    <span className="small">Yes</span>
                  </label>
                </div>
                <span className="hint">
                  Noted for staff awareness only. We will never give you advice about medication.
                </span>
              </fieldset>

              <label className="stack stack-2">
                <span className="label">Anything else we should know?</span>
                <textarea
                  className="textarea"
                  name="detail"
                  rows={3}
                  placeholder="Old knee injury from cricket, still stiff in the mornings…"
                />
              </label>

              <div className="row">
                {previous ? (
                  <>
                    <input type="hidden" name="step" value={previous} />
                    <button className="btn btn-ghost" type="submit" formAction={backToAction} formNoValidate>
                      Back
                    </button>
                  </>
                ) : null}
                <button className="btn btn-primary" type="submit" style={{ flex: 1 }}>
                  Continue
                </button>
              </div>
            </form>
          </Panel>
        </>
      ) : null}

      {state.step === 'preferences' ? (
        <>
          {params.escalated ? (
            <SafetyBanner tone="warning" title="Someone at your gym will speak to you first">
              Thank you for telling us. Based on what you said, we have paused automatic changes to your plan and raised
              this with staff
              {params.escalated !== 'raised' ? ` (reference ${params.escalated})` : ''}. You can carry on setting up your
              account. If anything feels wrong before someone contacts you, please{' '}
              <Link href="/app/support">talk to gym staff</Link>.
            </SafetyBanner>
          ) : null}

          <Panel title="How do you like to train?">
            <form action={preferencesAction} className="stack stack-4">
              <label className="checkbox-row">
                <input type="checkbox" name="needsLowImpact" />
                <span>
                  <strong className="small">Keep it low impact</strong>
                  <span className="hint">No jumping or running. Choose this if your joints complain.</span>
                </span>
              </label>

              <label className="checkbox-row">
                <input type="checkbox" name="trainsAtHome" />
                <span>
                  <strong className="small">I train at home sometimes</strong>
                  <span className="hint">We will favour a plan that works without gym machines.</span>
                </span>
              </label>

              <label className="checkbox-row">
                <input type="checkbox" name="ramadanMode" defaultChecked={state.ramadanMode} />
                <span>
                  <strong className="small">Use a Ramadan schedule when fasting</strong>
                  <span className="hint">
                    Sessions move to after iftar and volume drops a little. You can turn this on or off any time in your
                    profile.
                  </span>
                </span>
              </label>

              <div className="row">
                {previous ? (
                  <>
                    <input type="hidden" name="step" value={previous} />
                    <button className="btn btn-ghost" type="submit" formAction={backToAction} formNoValidate>
                      Back
                    </button>
                  </>
                ) : null}
                <button className="btn btn-primary" type="submit" style={{ flex: 1 }}>
                  Build my plan
                </button>
              </div>
            </form>
          </Panel>
        </>
      ) : null}

      {state.step === 'plan' ? (
        <>
          {state.assignedProgramName ? (
            <Panel title="You’re ready">
              <div className="stack stack-3">
                <p className="small secondary">
                  You have been matched to <strong>{state.assignedProgramName}</strong>, chosen from your gym&rsquo;s
                  approved programs using your goal, your experience, how often you can train, and the equipment your
                  branch actually has.
                </p>
                {state.progressionHoldReason ? (
                  <Notice tone="warning">
                    Weights will stay where they are until a coach has reviewed what you told us in the health step.
                    Your plan still works — it just will not get harder on its own.
                  </Notice>
                ) : null}
                <p className="micro muted">
                  Nothing here is fixed. A coach can change any part of it, and the app adjusts as you log sessions.
                </p>
              </div>
            </Panel>
          ) : (
            <Panel title="A coach is choosing your plan">
              <div className="stack stack-3">
                <p className="small secondary">
                  We did not find a template we were confident matching you to on your own, so a coach at your gym will
                  set your plan instead. That is deliberate: a plan nobody is confident in is worse than waiting a day
                  for the right one.
                </p>
                <p className="micro muted">
                  You will get a notification as soon as it is ready. In the meantime you can book a class or come in
                  and use the gym.
                </p>
              </div>
            </Panel>
          )}

          <div className="stack stack-3">
            <Link className="btn btn-primary btn-block" href="/app">
              Go to today
            </Link>
            <Link className="btn btn-secondary btn-block" href="/app/plan">
              See the whole plan
            </Link>
            <p className="micro muted" style={{ textAlign: 'center' }}>
              Questions about any of this? <Link href="/app/support">Talk to gym staff</Link> — a real person.
            </p>
          </div>
        </>
      ) : null}
    </div>
  );
}
