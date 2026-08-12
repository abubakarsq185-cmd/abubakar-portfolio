import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import Link from 'next/link';
import type { Metadata } from 'next';
import { Badge, EmptyState, Notice, Panel, ProgressBar, SafetyBanner, Stat } from '@gymguide/ui';
import { requireMember } from '@/server/auth/session';
import {
  MEAL_SLOTS,
  MEAL_SLOT_LABELS,
  deleteMealLog,
  loadNutrition,
  logMeal,
  type MealSlot,
} from '@/server/services/nutrition';

export const metadata: Metadata = { title: 'Nutrition' };

const KARACHI = 'Asia/Karachi';
const DATE_LONG = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });

function today(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: KARACHI }).format(new Date());
}

function shiftDay(day: string, days: number): string {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function backTo(day: string, message: string, ok: boolean): never {
  const params = new URLSearchParams({ day, [ok ? 'done' : 'error']: message });
  redirect(`/app/nutrition?${params.toString()}`);
}

async function logMealAction(formData: FormData): Promise<void> {
  'use server';
  const { actor } = await requireMember();
  const day = String(formData.get('day'));
  const foodItemId = String(formData.get('foodItemId') ?? '');
  const result = await logMeal(actor, {
    day,
    slot: String(formData.get('slot')) as MealSlot,
    foodItemId: foodItemId || undefined,
    freeText: String(formData.get('freeText') ?? ''),
    servings: Number(formData.get('servings') ?? 1),
  });
  revalidatePath('/app/nutrition');
  backTo(day, result.message, result.ok);
}

async function removeMealAction(formData: FormData): Promise<void> {
  'use server';
  const { actor } = await requireMember();
  const day = String(formData.get('day'));
  const result = await deleteMealLog(actor, String(formData.get('mealLogId')));
  revalidatePath('/app/nutrition');
  backTo(day, result.message, result.ok);
}

export default async function NutritionPage({
  searchParams,
}: {
  searchParams: Promise<{ day?: string; done?: string; error?: string }>;
}) {
  const [{ actor }, params] = await Promise.all([requireMember(), searchParams]);
  const day = /^\d{4}-\d{2}-\d{2}$/.test(params.day ?? '') ? params.day! : today();
  const data = await loadNutrition(actor, day);

  const counted = data.meals.filter((meal) => meal.caloriesKcal !== null).length;
  const described = data.meals.length - counted;
  const bandTone =
    data.band.band === 'on_track'
      ? 'success'
      : data.band.band === 'well_over' || data.band.band === 'well_under'
        ? 'warning'
        : 'info';

  return (
    <div className="stack stack-5">
      <header className="stack stack-2">
        <div className="row-between row-wrap">
          <h1 style={{ fontSize: '1.5rem' }}>Nutrition</h1>
          <div className="row">
            <Link className="btn btn-ghost btn-sm" href={`/app/nutrition?day=${shiftDay(day, -1)}`}>
              ←
            </Link>
            <Link className="btn btn-ghost btn-sm" href="/app/nutrition">
              Today
            </Link>
            <Link className="btn btn-ghost btn-sm" href={`/app/nutrition?day=${shiftDay(day, 1)}`}>
              →
            </Link>
          </div>
        </div>
        <p className="small muted">{DATE_LONG.format(new Date(`${day}T12:00:00Z`))}</p>
      </header>

      {params.done ? <Notice tone="success">{params.done}</Notice> : null}
      {params.error ? <Notice tone="danger">{params.error}</Notice> : null}

      <SafetyBanner tone="info" title="Everyday eating guidance, not medical advice">
        This helps you build steady habits. It is not medical nutrition therapy and it does not replace a doctor or a
        qualified dietitian. If you are pregnant, managing a condition such as diabetes, taking medication that
        interacts with food, or struggling with how you eat, please{' '}
        <Link href="/app/support">talk to gym staff</Link> so a person can help.
      </SafetyBanner>

      {data.targets ? (
        <>
          <section className="grid grid-4" aria-label="Today's totals">
            <Stat
              label="Calories"
              value={
                data.targets.caloriesKcal
                  ? `${Math.round(data.totals.caloriesKcal)} / ${data.targets.caloriesKcal}`
                  : String(Math.round(data.totals.caloriesKcal))
              }
            />
            <Stat
              label="Protein"
              value={
                data.targets.proteinG
                  ? `${Math.round(data.totals.proteinG)}g / ${data.targets.proteinG}g`
                  : `${Math.round(data.totals.proteinG)}g`
              }
            />
            <Stat label="Carbs" value={`${Math.round(data.totals.carbsG)}g`} />
            <Stat label="Fat" value={`${Math.round(data.totals.fatG)}g`} />
          </section>

          {data.targets.caloriesKcal ? (
            <div className="stack stack-2">
              <ProgressBar
                value={data.totals.caloriesKcal}
                max={data.targets.caloriesKcal}
                tone={data.band.band === 'well_over' ? 'warning' : 'primary'}
                label={`${Math.round(data.totals.caloriesKcal)} of ${data.targets.caloriesKcal} calories`}
              />
              <Notice tone={bandTone}>{data.band.message}</Notice>
            </div>
          ) : null}

          <p className="micro muted">
            Targets set by {data.targets.setByName ?? 'your gym'}
            {data.targets.setByRole ? ` (${data.targets.setByRole.replace(/_/g, ' ')})` : ''}. Only a qualified person
            can change them — ask on the Support tab if they no longer suit you.
            {data.targets.guardRailNotes ? ` ${data.targets.guardRailNotes}` : ''}
          </p>
        </>
      ) : (
        <Notice tone="info">
          Nobody has set calorie or macro targets for you, so this screen sticks to portion guidance — which works
          without anyone needing to know your medical history. If you want numbers, ask your coach or the gym&rsquo;s
          nutrition professional on the Support tab.
        </Notice>
      )}

      <Panel title="Your plate, without counting">
        <div className="stack stack-3">
          <div className="grid grid-4">
            <Stat label="Protein" value={`${data.targets?.proteinPalms ?? data.plate.proteinPalms} palms`} />
            <Stat label="Carbs" value={`${data.targets?.carbCuppedHands ?? data.plate.carbCuppedHands} hands`} />
            <Stat label="Vegetables" value={`${data.targets?.vegFists ?? data.plate.vegFists} fists`} />
            <Stat label="Fats" value={`${data.targets?.fatThumbs ?? data.plate.fatThumbs} thumbs`} />
          </div>
          <ul className="stack stack-2" style={{ paddingLeft: '1.1rem' }}>
            {data.plate.explanation.map((line) => (
              <li key={line} className="small secondary">
                {line}
              </li>
            ))}
          </ul>
          <p className="micro muted">
            Your own hand is the measure, so it scales with you and needs no scales or app. Water target today:{' '}
            {(data.water.targetMl / 1000).toFixed(1)} litres.
          </p>
        </div>
      </Panel>

      {data.ramadan ? (
        <Panel title="Ramadan schedule">
          <div className="stack stack-3">
            {data.ramadan.map((entry) => (
              <div key={entry.slot} className="stack stack-2">
                <div className="row">
                  <Badge tone="primary">{MEAL_SLOT_LABELS[entry.slot as MealSlot] ?? entry.slot}</Badge>
                  <span className="small">{entry.time}</span>
                </div>
                <p className="small secondary">{entry.guidance}</p>
              </div>
            ))}
            <p className="micro muted">
              The same daily totals, in two windows. Training moves to after iftar for most people. If you feel faint or
              unwell while fasting, stop and speak to staff.
            </p>
          </div>
        </Panel>
      ) : null}

      {data.planEntries.length > 0 ? (
        <Panel title={data.planName ?? 'Today’s suggested meals'}>
          <div className="stack stack-3">
            {data.planEntries.map((entry, index) => (
              <div key={`${entry.slot}-${index}`} className="stack stack-2">
                <div className="row">
                  <Badge>{MEAL_SLOT_LABELS[entry.slot] ?? entry.slot}</Badge>
                  <strong className="small">{entry.title}</strong>
                </div>
                {entry.guidance ? <p className="small secondary">{entry.guidance}</p> : null}
              </div>
            ))}
          </div>
        </Panel>
      ) : null}

      <Panel title="What you ate">
        {data.meals.length === 0 ? (
          <EmptyState
            title="Nothing logged yet"
            body="Log a meal below. Two or three entries a day is enough to spot a pattern — you do not have to weigh anything."
          />
        ) : (
          <div className="stack stack-3">
            {data.meals.map((meal) => (
              <div key={meal.id} className="row-between row-wrap">
                <div className="stack stack-2" style={{ minWidth: 0 }}>
                  <div className="row">
                    <Badge>{MEAL_SLOT_LABELS[meal.slot] ?? meal.slot}</Badge>
                    <span className="small">{meal.description}</span>
                  </div>
                  <span className="micro muted">
                    {meal.servings === 1 ? '1 serving' : `${meal.servings} servings`}
                    {meal.caloriesKcal !== null
                      ? ` · ${Math.round(meal.caloriesKcal)} kcal · ${Math.round(meal.proteinG ?? 0)}g protein`
                      : ' · described, not counted'}
                  </span>
                </div>
                <form action={removeMealAction}>
                  <input type="hidden" name="mealLogId" value={meal.id} />
                  <input type="hidden" name="day" value={day} />
                  <button className="btn btn-ghost btn-sm" type="submit">
                    Remove
                  </button>
                </form>
              </div>
            ))}
            {described > 0 ? (
              <p className="micro muted">
                {described} {described === 1 ? 'entry has' : 'entries have'} no numbers because you described{' '}
                {described === 1 ? 'it' : 'them'} in your own words. That still counts as logging — we just will not
                invent calories for it.
              </p>
            ) : null}
          </div>
        )}
      </Panel>

      <Panel title="Log a meal">
        <form action={logMealAction} className="stack stack-4">
          <input type="hidden" name="day" value={day} />

          <div className="grid grid-2">
            <label className="stack stack-2">
              <span className="label">Meal</span>
              <select className="select" name="slot" defaultValue="lunch" required>
                {MEAL_SLOTS.map((slot) => (
                  <option key={slot} value={slot}>
                    {MEAL_SLOT_LABELS[slot]}
                  </option>
                ))}
              </select>
            </label>

            <label className="stack stack-2">
              <span className="label">Servings</span>
              <input
                className="input"
                type="number"
                name="servings"
                defaultValue="1"
                min="0.25"
                max="20"
                step="0.25"
                required
              />
            </label>
          </div>

          <label className="stack stack-2">
            <span className="label">Pick a food</span>
            <select className="select" name="foodItemId" defaultValue="">
              <option value="">— or describe it below —</option>
              {data.commonFoods.map((food) => (
                <option key={food.id} value={food.id}>
                  {food.name}
                  {food.nameUr ? ` · ${food.nameUr}` : ''} — {food.servingLabel}, {Math.round(food.caloriesKcal)} kcal
                </option>
              ))}
            </select>
            <span className="hint">Local staples are listed first. Portions are the everyday ones, not grams.</span>
          </label>

          <label className="stack stack-2">
            <span className="label">Or describe what you ate</span>
            <input className="input" name="freeText" placeholder="Two roti, chicken salan and salad" />
            <span className="hint">
              Described meals are recorded without calorie figures. A description is not a measurement, and guessing
              numbers would put fiction into your history.
            </span>
          </label>

          <button className="btn btn-primary" type="submit" style={{ alignSelf: 'flex-start' }}>
            Log it
          </button>
        </form>
      </Panel>

      {data.weekTotals.length > 1 ? (
        <Panel title="Last seven days">
          <div className="stack stack-3">
            {data.weekTotals.map((entry) => (
              <div key={entry.day} className="stack stack-2">
                <div className="row-between">
                  <span className="small">{DATE_LONG.format(new Date(`${entry.day}T12:00:00Z`))}</span>
                  <span className="small muted">
                    {entry.caloriesKcal > 0 ? `${Math.round(entry.caloriesKcal)} kcal` : 'not logged'}
                  </span>
                </div>
                <ProgressBar
                  value={entry.caloriesKcal}
                  max={data.targets?.caloriesKcal ?? Math.max(...data.weekTotals.map((item) => item.caloriesKcal), 1)}
                  label={`${Math.round(entry.caloriesKcal)} calories on ${entry.day}`}
                />
              </div>
            ))}
            <p className="micro muted">
              Consistency across the week matters more than any single day. A high day is not a failure and does not
              need making up for.
            </p>
          </div>
        </Panel>
      ) : null}
    </div>
  );
}
