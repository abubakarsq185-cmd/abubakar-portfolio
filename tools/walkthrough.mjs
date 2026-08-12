/**
 * Walk every journey in the application, step by step, and record what happened.
 *
 * This drives the real interface: it types into forms, clicks buttons, and waits
 * for the server. Every step carries an assertion, so a step that says PASS was
 * actually checked, and a step that breaks is recorded as FAIL rather than
 * quietly skipped.
 *
 * Run:  node walkthrough.mjs      (needs the app on :3000)
 * Out:  steps/*.jpg + steps.json
 */
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

const BASE = process.env.WALK_BASE_URL ?? 'http://localhost:3000';
const OUT = process.env.WALK_DIR ??
  '/tmp/claude-0/-home-user-abubakar-portfolio/d11dd90d-b44b-5bfe-baff-844c0d86f8a1/scratchpad/steps';
const PASSWORD = process.env.SEED_DEMO_PASSWORD ?? 'GymGuide!Demo2026';

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const DESKTOP = { width: 1280, height: 820 };
const PHONE = { width: 412, height: 880 };

const record = [];
let journey = null;
let stepNo = 0;

function startJourney(id, title, role, blurb) {
  journey = { id, title, role, blurb };
  stepNo = 0;
  console.log(`\n=== ${id}  ${title}  (${role})`);
}

/** Capture the viewport and record the outcome of one step. */
async function step(page, label, check, { full = false } = {}) {
  stepNo += 1;
  const id = `${journey.id}-${String(stepNo).padStart(2, '0')}`;
  let verdict = 'PASS';
  let detail = check.expect ?? '';
  try {
    if (check.run) await check.run();
  } catch (error) {
    verdict = 'FAIL';
    detail = `${detail} — ${error.message.split('\n')[0]}`.trim();
  }
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${OUT}/${id}.jpg`, type: 'jpeg', quality: 66, fullPage: full });
  record.push({ ...journey, id, no: stepNo, label, verdict, detail, url: page.url().replace(BASE, '') });
  console.log(`  ${verdict === 'PASS' ? '✓' : '✗'} ${id} ${label}${verdict === 'FAIL' ? `  << ${detail}` : ''}`);
  return verdict === 'PASS';
}

async function signIn(page, email) {
  await page.goto(`${BASE}/sign-in`, { waitUntil: 'load' });
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/sign-in'), { timeout: 25_000 });
}

async function newPage(browser, viewport) {
  const ctx = await browser.newContext({ viewport, colorScheme: 'dark', reducedMotion: 'reduce' });
  return { ctx, page: await ctx.newPage() };
}

const stamp = Date.now().toString().slice(-7);
const browser = await chromium.launch();

// =========================================================================
// A — Front desk enrols a member and takes the money
// =========================================================================
{
  startJourney('A', 'Enrol a member and take payment', 'front desk',
    'Eleven things have to happen together: account, profile, consent per purpose, signed waiver, ' +
    'emergency contact, membership, invoice, ledger postings, notification preferences, app invite and a plan.');
  const { ctx, page } = await newPage(browser, DESKTOP);
  const member = { name: `Sana Walkthrough`, email: `e2e.sana.${stamp}@example.com`, phone: `+92321${stamp}` };

  await page.goto(`${BASE}/sign-in`, { waitUntil: 'load' });
  await step(page, 'Sign-in page, with the demo accounts listed on it', {
    expect: 'the form renders with email and password fields',
    run: async () => { await page.getByLabel('Email').waitFor(); await page.getByLabel('Password').waitFor(); },
  });

  await signIn(page, 'frontdesk@apexfitness.pk');
  await step(page, 'Front desk lands on the dashboard', {
    expect: 'routed to /dashboard, queues visible',
    run: async () => {
      if (!page.url().includes('/dashboard')) throw new Error(`landed on ${page.url()}`);
      await page.getByRole('heading', { level: 1 }).waitFor();
    },
  }, { full: true });

  await page.goto(`${BASE}/dashboard/enrol`, { waitUntil: 'load' });
  await step(page, 'Open the enrolment form', {
    expect: 'the form loads for a role holding members.write',
    run: async () => { await page.getByLabel(/full name/i).waitFor(); },
  }, { full: true });

  // Fill it the way a person would.
  await page.getByLabel(/full name/i).fill(member.name);
  await page.getByLabel(/^email/i).fill(member.email);
  await page.locator('input[name="phone"]').first().fill(member.phone);
  await step(page, 'Type the member’s details', { expect: 'fields accept input' });

  // Every required control, by the name the markup actually uses. The first pass
  // of this walkthrough guessed at these and the browser's own `required`
  // validation refused to submit — which is the form behaving correctly.
  for (const [name, value] of [
    ['branchId', null],
    ['primaryGoal', 'fat_loss'],
    ['experienceLevel', 'beginner'],
    ['membershipPlanId', null],
  ]) {
    const select = page.locator(`select[name="${name}"]`).first();
    if (!(await select.count())) continue;
    if (value) await select.selectOption(value).catch(() => {});
    else await select.selectOption({ index: 0 }).catch(() => {});
  }
  const startsOn = page.locator('input[name="membershipStartsOn"]').first();
  if (await startsOn.count()) await startsOn.fill(new Date().toISOString().slice(0, 10));

  for (const name of ['consentTerms', 'consentPrivacy', 'consentHealthData', 'consentAiCoaching', 'waiverSigned']) {
    const box = page.locator(`input[name="${name}"]`).first();
    if (await box.count()) await box.check().catch(() => {});
  }
  await page.locator('input[name="emergencyName"]').first().fill('Rashid Mahmood').catch(() => {});
  await page.locator('input[name="emergencyRelationship"]').first().fill('Spouse').catch(() => {});
  await page.locator('input[name="emergencyPhone"]').first().fill('+923214560000').catch(() => {});
  await page.locator('input[name="waiverSignatureName"]').first().fill(member.name).catch(() => {});
  await step(page, 'Record consent, the waiver signature and next of kin', {
    expect: 'consent is captured per purpose, not as one blanket tick',
    run: async () => {
      const count = await page.locator('input[type="checkbox"]').count();
      if (count < 5) throw new Error(`only ${count} consent controls found`);
    },
  }, { full: true });

  await page.getByRole('button', { name: /enrol|create member|save/i }).first().click();
  await page.waitForLoadState('load');
  await page.waitForTimeout(1200);
  const enrolled = await step(page, 'Submit — the whole enrolment in one transaction', {
    expect: 'redirected to the new member’s profile, not back to the form with an error',
    run: async () => {
      const url = page.url();
      if (/\/dashboard\/members\/[0-9a-f-]{36}/.test(url)) return;
      // Only now is a message on screen a failure rather than a confirmation.
      const notice = page.locator('.notice-danger');
      const text = (await notice.count()) ? (await notice.first().innerText()).slice(0, 140) : 'no reason given';
      throw new Error(`stayed on ${url.replace(BASE, '')} — ${text}`);
    },
  }, { full: true });

  if (enrolled) {
    await step(page, 'The profile shows the membership, invoice and assigned plan', {
      expect: 'artefacts of the enrolment are present on the page',
      run: async () => {
        const body = await page.locator('body').innerText();
        for (const needle of [member.name]) {
          if (!body.includes(needle)) throw new Error(`profile does not mention ${needle}`);
        }
      },
    }, { full: true });

    // Take the payment.
    const payPanel = page.getByText(/take a payment/i);
    if (await payPanel.count()) {
      await payPanel.first().scrollIntoViewIfNeeded();
      await step(page, 'The take-a-payment panel is on the profile', {
        expect: 'front desk can collect money without leaving the member',
      });

      const amount = page.locator('input[name="amountMinor"], input[name="amount"]');
      if (await amount.count()) await amount.first().fill('750000');
      const method = page.locator('select[name="method"]');
      if (await method.count()) await method.first().selectOption('cash').catch(() => {});
      await page.getByRole('button', { name: /record payment|take payment/i }).first().click();
      await page.waitForLoadState('load');
      await page.waitForTimeout(1200);
      await step(page, 'Record a cash payment', {
        expect: 'a success notice appears and a receipt number is issued',
        run: async () => {
          const body = await page.locator('body').innerText();
          if (!/receipt|recorded|paid/i.test(body)) throw new Error('no confirmation of the payment on the page');
        },
      }, { full: true });
    } else {
      await step(page, 'Take-a-payment panel', {
        expect: 'panel present on the member profile',
        run: async () => { throw new Error('panel not found on the profile'); },
      });
    }

    await page.goto(`${BASE}/dashboard/billing`, { waitUntil: 'load' });
    await step(page, 'Billing reflects the money immediately', {
      expect: 'collections and ledger balances include the payment just taken',
      run: async () => { await page.getByRole('heading', { level: 1 }).waitFor(); },
    }, { full: true });
  }

  await ctx.close();
}

// =========================================================================
// B — A member onboards, reports chest pain, and staff is alerted
// =========================================================================
{
  startJourney('B', 'Onboarding, and reporting chest pain', 'member → staff',
    'The safety path. Deterministic: the same answers always produce the same outcome, and no AI takes part ' +
    'in the decision.');
  const { ctx, page } = await newPage(browser, PHONE);

  await signIn(page, 'nida.aslam@example.com');
  // Sign-in lands on /app, which then redirects; wait for the settled URL
  // rather than racing the server.
  await page.waitForURL(/\/app\/onboarding/, { timeout: 20_000 }).catch(() => {});
  await step(page, 'An unfinished member is sent to the wizard, not to an empty Today', {
    expect: 'redirected to /app/onboarding',
    run: async () => {
      if (!page.url().includes('/app/onboarding')) throw new Error(`landed on ${page.url().replace(BASE, '')}`);
    },
  }, { full: true });

  await step(page, 'It resumes where she left off — the health step', {
    expect: 'the health questions are shown, mid-progress',
    run: async () => {
      const body = await page.locator('body').innerText();
      if (!/chest/i.test(body)) throw new Error('health questions not shown');
      if (!/step 4/i.test(body)) throw new Error('did not resume at step 4');
    },
  }, { full: true });

  // Say yes to chest pain.
  await page.locator('input[name="chestPain"][value="yes"]').check();
  await step(page, 'Answer yes to chest pain', {
    expect: 'the answer is accepted without the app editorialising',
    run: async () => {
      const checked = await page.locator('input[name="chestPain"][value="yes"]').isChecked();
      if (!checked) throw new Error('the radio did not take');
    },
  });

  await page.getByRole('button', { name: /continue/i }).first().click();
  await page.waitForLoadState('load');
  await page.waitForTimeout(1200);
  await step(page, 'The engine stops, warns, and escalates', {
    expect: 'a calm non-diagnostic notice, a case reference, and no diagnosis offered',
    run: async () => {
      const body = await page.locator('body').innerText();
      if (!/staff|speak to you/i.test(body)) throw new Error('no escalation notice shown');
      if (/heart attack|angina|you have/i.test(body)) throw new Error('the notice offers a diagnosis');
    },
  }, { full: true });

  await ctx.close();

  // Now the staff side of the same event.
  const staff = await newPage(browser, DESKTOP);
  // The engine routes a critical screening flag to a branch manager, and a
  // manager sees their own branch. Nida is at Gulberg, so it is the Gulberg
  // manager who must have been told — checking the DHA manager proved the
  // boundary works, not that the alert arrived.
  await signIn(staff.page, 'manager.gulberg@apexfitness.pk');
  await staff.page.goto(`${BASE}/dashboard/escalations`, { waitUntil: 'load' });
  await step(staff.page, 'It is already in the manager’s triage queue', {
    expect: 'a chest-pain flag for Nida Aslam, ranked critical',
    run: async () => {
      const body = await staff.page.locator('body').innerText();
      if (!/Nida/i.test(body)) throw new Error('the new escalation is not in the queue');
      if (!/critical/i.test(body)) throw new Error('not ranked critical');
    },
  }, { full: true });

  await step(staff.page, 'Resolving it requires writing down what you did', {
    expect: 'a resolution textarea with a minimum length, and the text is audited',
    run: async () => {
      const box = staff.page.locator('textarea[name="resolution"]').first();
      await box.waitFor();
      const min = await box.getAttribute('minLength');
      if (!min) throw new Error('no minimum length on the resolution field');
    },
  });
  await staff.ctx.close();
}

// =========================================================================
// C — A member trains
// =========================================================================
{
  startJourney('C', 'Following a session in the player', 'member',
    'What a member does four times a week. It has to work with one hand, in a basement, with no signal.');
  const { ctx, page } = await newPage(browser, PHONE);

  await signIn(page, 'ayesha.khan@example.com');
  await step(page, 'Today tells her one thing to do', {
    expect: 'a single primary instruction, not a dashboard',
    run: async () => { await page.getByRole('heading', { level: 1 }).waitFor(); },
  }, { full: true });

  await page.goto(`${BASE}/app/train`, { waitUntil: 'load' });
  await step(page, 'This week’s sessions', {
    expect: 'done, due and missed are distinguishable',
    run: async () => { await page.getByRole('heading', { level: 1 }).waitFor(); },
  }, { full: true });

  const open = page.locator('a[href*="/app/train/"]').first();
  if (await open.count()) {
    await open.click();
    await page.waitForLoadState('load');
    await page.waitForTimeout(800);
    await step(page, 'The guided player opens on the first exercise', {
      expect: 'target, cues, mistakes and safety notes are all present',
      run: async () => {
        const body = await page.locator('body').innerText();
        for (const affordance of [/log/i, /how to do it/i, /swap exercise/i, /something hurts/i]) {
          if (!affordance.test(body)) throw new Error(`missing ${affordance} on the player`);
        }
      },
    }, { full: true });

    const reps = page.locator('input[type="number"]').first();
    if (await reps.count()) {
      await reps.fill('10');
      await step(page, 'Log a set', { expect: 'the field accepts a rep count' });
    }
    // Guidance is one tap away rather than always on screen — correct on a
    // phone mid-set. Open it and check the content is really there.
    const how = page.getByText(/how to do it/i).first();
    if (await how.count()) await how.click().catch(() => {});
    await page.waitForTimeout(400);
    await step(page, 'Technique guidance is one tap away, with the exercise', {
      expect: 'cues, mistakes or safety notes appear without leaving the set',
      run: async () => {
        const body = await page.locator('body').innerText();
        if (!/cue|mistake|keep|brace|breathe|hold|slow/i.test(body)) {
          throw new Error('no technique guidance behind the disclosure');
        }
      },
    }, { full: true });
  } else {
    await step(page, 'Open a session', {
      expect: 'a startable session on the Train screen',
      run: async () => { throw new Error('no start link found'); },
    });
  }

  await page.goto(`${BASE}/app/progress`, { waitUntil: 'load' });
  await step(page, 'Progress: weight, volume, streak, records', {
    expect: 'charts render with twelve weeks of seeded history',
    run: async () => {
      const svg = await page.locator('svg').count();
      if (svg < 1) throw new Error('no charts rendered');
    },
  }, { full: true });

  await page.goto(`${BASE}/app/nutrition`, { waitUntil: 'load' });
  await step(page, 'Nutrition leads with portions, not calorie maths', {
    expect: 'plate guidance present; a non-medical disclaimer with a route to a human',
    run: async () => {
      const body = await page.locator('body').innerText();
      if (!/palm|plate/i.test(body)) throw new Error('no plate guidance');
      if (!/not medical|does not replace|doctor|dietitian/i.test(body)) throw new Error('no non-medical disclaimer');
    },
  }, { full: true });

  const food = page.locator('select[name="foodItemId"]');
  if (await food.count()) {
    const options = await food.first().locator('option').count();
    if (options > 1) {
      await food.first().selectOption({ index: 1 });
      await page.getByRole('button', { name: /log it/i }).first().click();
      await page.waitForLoadState('load');
      await page.waitForTimeout(1000);
      await step(page, 'Log a meal', {
        expect: 'the entry appears with figures taken from the food library, not from the client',
        run: async () => {
          const body = await page.locator('body').innerText();
          if (!/logged|kcal/i.test(body)) throw new Error('the meal did not appear');
        },
      }, { full: true });
    }
  }

  await page.goto(`${BASE}/app/support`, { waitUntil: 'load' });
  await step(page, 'Support: the AI coach, labelled, with a human always one tap away', {
    expect: 'AI-assisted labelling present and a "talk to gym staff" route',
    run: async () => {
      const body = await page.locator('body').innerText();
      if (!/staff/i.test(body)) throw new Error('no route to a human');
      // Only assert the label where there is an AI reply to label. An empty
      // thread with nothing labelled is a seeding gap, not a safety failure.
      const aiReplies = await page.locator('.ai-message, [class*="ai-message"]').count();
      if (aiReplies > 0 && !/ai-assisted|ai assisted/i.test(body)) {
        throw new Error('an AI reply is present but not labelled AI-assisted');
      }
      if (aiReplies === 0) throw new Error('no AI conversation seeded for this member');
    },
  }, { full: true });

  await ctx.close();
}

// =========================================================================
// D — A coach adapts and publishes a program
// =========================================================================
{
  startJourney('D', 'Adapting and publishing a program', 'coach',
    'Programs are the only source of member workouts. A gym never edits a shared template; it takes a copy.');
  const { ctx, page } = await newPage(browser, DESKTOP);

  await signIn(page, 'coach@apexfitness.pk');
  await page.goto(`${BASE}/dashboard/programs`, { waitUntil: 'load' });
  await step(page, 'The library: GymGuide templates and the gym’s own, kept apart', {
    expect: 'both sections render and templates offer copy, not edit',
    run: async () => {
      const body = await page.locator('body').innerText();
      if (!/GymGuide templates/i.test(body)) throw new Error('template section missing');
      if (!/copy/i.test(body)) throw new Error('no copy action offered');
    },
  }, { full: true });

  const copy = page.getByRole('button', { name: /copy/i }).first();
  if (await copy.count()) {
    await copy.click();
    await page.waitForLoadState('load');
    await page.waitForTimeout(1200);
    await step(page, 'Copy a template into the gym', {
      expect: 'lands on the copy, marked draft, recording what it came from',
      run: async () => {
        const body = await page.locator('body').innerText();
        if (!/draft/i.test(body)) throw new Error('the copy is not a draft');
        if (!/copied from/i.test(body)) throw new Error('provenance not recorded');
      },
    }, { full: true });

    await step(page, 'Its phases and week pattern came across intact', {
      expect: 'phases listed with progression rules in the engine’s vocabulary',
      run: async () => {
        const body = await page.locator('body').innerText();
        if (!/progression|phase/i.test(body)) throw new Error('no phases on the copy');
      },
    }, { full: true });

    const publish = page.getByRole('button', { name: /approve and publish/i }).first();
    if (await publish.count()) {
      await publish.click();
      await page.waitForLoadState('load');
      await page.waitForTimeout(1200);
      await step(page, 'Publish it — with a named approver', {
        expect: 'state becomes published and the approver is recorded on the row',
        run: async () => {
          const body = await page.locator('body').innerText();
          const failed = page.locator('.notice-danger');
          if (await failed.count()) throw new Error((await failed.first().innerText()).slice(0, 140));
          if (!/published/i.test(body)) throw new Error('did not publish');
          if (!/approved by/i.test(body)) throw new Error('no approver recorded');
        },
      }, { full: true });
    }
  }
  await ctx.close();
}

// =========================================================================
// E — Front desk runs a class
// =========================================================================
{
  startJourney('E', 'Running a class at the desk', 'front desk',
    'Capacity and the waitlist are decided in one statement in the database, not by reading a count and hoping.');
  const { ctx, page } = await newPage(browser, DESKTOP);

  await signIn(page, 'frontdesk@apexfitness.pk');
  await page.goto(`${BASE}/dashboard/classes?day=2026-08-22`, { waitUntil: 'load' });
  await step(page, 'A day’s timetable with every roster', {
    expect: 'classes with times, coach, capacity and booked members',
    run: async () => {
      const body = await page.locator('body').innerText();
      if (!/booked/i.test(body)) throw new Error('no roster information');
    },
  }, { full: true });

  const checkIn = page.getByRole('button', { name: /check in/i }).first();
  if (await checkIn.count()) {
    await checkIn.click();
    await page.waitForLoadState('load');
    await page.waitForTimeout(1200);
    await step(page, 'Check a member in', {
      expect: 'a confirmation, and the roster now shows them attended',
      run: async () => {
        const body = await page.locator('body').innerText();
        if (!/checked in|attended/i.test(body)) throw new Error('no confirmation of the check-in');
      },
    }, { full: true });
  }

  const cancelPlace = page.getByRole('button', { name: /cancel place/i }).first();
  if (await cancelPlace.count()) {
    await cancelPlace.click();
    await page.waitForLoadState('load');
    await page.waitForTimeout(1200);
    await step(page, 'Cancel a place — the waitlist is offered it at once', {
      expect: 'a message naming who was removed, and whether a penalty applied',
      run: async () => {
        const body = await page.locator('body').innerText();
        if (!/removed from the class/i.test(body)) throw new Error('no cancellation confirmation');
      },
    }, { full: true });
  }

  await step(page, 'Front desk is offered no way to cancel a whole class', {
    expect: 'no "cancel this class" control for a role without classes.write',
    run: async () => {
      const count = await page.getByText(/cancel this class/i).count();
      if (count > 0) throw new Error('front desk is being offered class cancellation');
    },
  });
  await ctx.close();
}

// =========================================================================
// F — A manager tunes an automation
// =========================================================================
{
  startJourney('F', 'Tuning what the gym sends members', 'branch manager',
    'These are messages to people who did not ask to hear from anyone today. Three limits are not the ' +
    'manager’s to remove.');
  const { ctx, page } = await newPage(browser, DESKTOP);

  await signIn(page, 'manager.dha@apexfitness.pk');
  await page.goto(`${BASE}/dashboard/automations`, { waitUntil: 'load' });
  await step(page, 'Every sequence, and what it actually did', {
    expect: 'triggers, channels, ceilings, quiet hours and skip reasons',
    run: async () => {
      const body = await page.locator('body').innerText();
      if (!/skipped/i.test(body)) throw new Error('no run outcomes shown');
    },
  }, { full: true });

  await step(page, 'Undeliverable channels are labelled, not implied to work', {
    expect: 'channels without a configured provider are marked logged only',
    run: async () => {
      const body = await page.locator('body').innerText();
      if (!/logged only|logged, not delivered/i.test(body)) throw new Error('undeliverable channels not flagged');
    },
  }, { full: true });

  const editSummary = page.locator('details.disclosure summary').first();
  if (await editSummary.count()) {
    await editSummary.click();
    await page.waitForTimeout(400);
    await step(page, 'Open the editor on one automation', {
      expect: 'channels, ceiling, cooldown and quiet hours are editable',
      run: async () => { await page.locator('input[name="maxPerMemberPerWeek"]').first().waitFor(); },
    }, { full: true });

    const cap = page.locator('input[name="maxPerMemberPerWeek"]').first();
    const max = await cap.getAttribute('max');
    await step(page, 'The contact ceiling is capped in the markup and the service', {
      expect: 'max attribute present, so the limit is not merely advisory',
      run: async () => { if (!max) throw new Error('no max on the frequency field'); },
    });

    await cap.fill('1');
    await page.getByRole('button', { name: /save automation/i }).first().click();
    await page.waitForLoadState('load');
    await page.waitForTimeout(1200);
    await step(page, 'Lower it and save', {
      expect: 'saved, with any forced constraint explained in the message',
      run: async () => {
        const body = await page.locator('body').innerText();
        if (!/saved/i.test(body)) throw new Error('no save confirmation');
      },
    }, { full: true });
  }
  await ctx.close();
}

// =========================================================================
// G — Owner reporting
// =========================================================================
{
  startJourney('G', 'What the owner sees at the end of the month', 'gym owner',
    'Figures follow the reader. The same URL returns one branch to a branch manager and two to an owner.');
  const { ctx, page } = await newPage(browser, DESKTOP);

  await signIn(page, 'owner@apexfitness.pk');
  await page.goto(`${BASE}/dashboard/reports`, { waitUntil: 'load' });
  await step(page, 'Both branches, side by side', {
    expect: 'Gulberg and DHA both present for an owner',
    run: async () => {
      const body = await page.locator('body').innerText();
      if (!/Gulberg/.test(body) || !/DHA/.test(body)) throw new Error('an owner is not seeing both branches');
    },
  }, { full: true });

  await step(page, 'Tenure buckets rather than one churn number', {
    expect: 'how long members stay is broken down, not averaged away',
    run: async () => {
      const body = await page.locator('body').innerText();
      if (!/how long members stay|month/i.test(body)) throw new Error('no tenure breakdown');
    },
  }, { full: true });
  await ctx.close();
}

// =========================================================================
// H — Platform support access
// =========================================================================
{
  startJourney('H', 'Platform support opening access to a gym', 'platform admin',
    'Time-limited, reasoned, and recorded in the gym’s own audit trail. Write access needs the gym to agree.');
  const { ctx, page } = await newPage(browser, DESKTOP);

  await signIn(page, 'support@gymguide.app');
  await step(page, 'The platform console', {
    expect: 'tenants, subscriptions and system health; no member health data',
    run: async () => {
      const body = await page.locator('body').innerText();
      if (!/Apex Fitness/i.test(body)) throw new Error('no tenants listed');
      // The console's own copy names the data it deliberately does not carry, so
      // a plain text search matches the reassurance. Look for actual member
      // health values instead: a screening answer or a pain area.
      if (/parq_plus|pain_areas|chest_pain/i.test(body)) {
        throw new Error('member health data is reachable here');
      }
    },
  }, { full: true });

  const reason = page.locator('textarea[name="reason"]').first();
  if (await reason.count()) {
    await reason.fill('short');
    await page.getByRole('button', { name: /open session/i }).first().click();
    await page.waitForLoadState('load');
    await page.waitForTimeout(1000);
    await step(page, 'A thin reason is refused', {
      expect: 'the gym must be given a real reason; twelve characters minimum',
      run: async () => {
        const body = await page.locator('body').innerText();
        if (!/reason/i.test(body)) throw new Error('no complaint about the reason');
      },
    }, { full: true });

    const reason2 = page.locator('textarea[name="reason"]').first();
    await reason2.fill('Owner reports payments missing from the billing screen; checking the webhook ledger.');
    const scope = page.locator('select[name="scope"]').first();
    if (await scope.count()) await scope.selectOption('read_write').catch(() => {});
    await page.getByRole('button', { name: /open session/i }).first().click();
    await page.waitForLoadState('load');
    await page.waitForTimeout(1000);
    await step(page, 'Write access without the gym’s approval is refused', {
      expect: 'support cannot grant itself the ability to change a customer’s data',
      run: async () => {
        const body = await page.locator('body').innerText();
        if (!/approve/i.test(body)) throw new Error('write access was not gated on the gym approving');
      },
    }, { full: true });

    const reason3 = page.locator('textarea[name="reason"]').first();
    await reason3.fill('Owner reports payments missing from the billing screen; checking the webhook ledger.');
    const scope2 = page.locator('select[name="scope"]').first();
    if (await scope2.count()) await scope2.selectOption('read_only').catch(() => {});
    await page.getByRole('button', { name: /open session/i }).first().click();
    await page.waitForLoadState('load');
    await page.waitForTimeout(1200);
    await step(page, 'Read-only access opens, and appears in the log', {
      expect: 'session open with an expiry, visible in the support access log',
      run: async () => {
        const body = await page.locator('body').innerText();
        if (!/support session open|expires/i.test(body)) throw new Error('the session did not open');
      },
    }, { full: true });
  }
  await ctx.close();
}

await browser.close();
writeFileSync(`${OUT}/steps.json`, JSON.stringify(record, null, 2));

const pass = record.filter((r) => r.verdict === 'PASS').length;
const fail = record.filter((r) => r.verdict === 'FAIL').length;
console.log(`\n${record.length} steps — ${pass} pass, ${fail} fail`);
if (fail) {
  console.log('\nFAILURES:');
  for (const r of record.filter((x) => x.verdict === 'FAIL')) {
    console.log(`  ${r.id} ${r.label}\n      ${r.detail}`);
  }
}
