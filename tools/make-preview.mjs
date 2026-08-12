/**
 * Build a single-file, offline-openable preview of GymGuide.
 *
 * Captures every screen of the running app as each role, then writes one HTML
 * file with the images embedded, navigable by role. It is a preview of real
 * screens, not the running application — forms in it do not submit, and the
 * file says so plainly at the top.
 *
 * Run:  node make-preview.mjs      (needs the app on :3000)
 */
import { randomBytes, createHash } from 'node:crypto';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import pg from 'pg';
import { chromium } from '@playwright/test';

const BASE = 'http://localhost:3000';
const TMP = '/tmp/preview-shots';
const OUT = process.env.PREVIEW_OUT ??
  '/tmp/claude-0/-home-user-abubakar-portfolio/d11dd90d-b44b-5bfe-baff-844c0d86f8a1/scratchpad/gymguide-preview.html';
mkdirSync(TMP, { recursive: true });

const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();

async function tokenFor(email) {
  const token = randomBytes(32).toString('base64url');
  const { rows } = await db.query('select id, organization_id from users where email = $1', [email]);
  await db.query(
    `insert into auth_sessions (user_id, organization_id, token_hash, mfa_satisfied, expires_at)
     values ($1,$2,$3,true, now() + interval '3 hours')`,
    [rows[0].id, rows[0].organization_id, createHash('sha256').update(token).digest('hex')],
  );
  return token;
}

const { rows: ids } = await db.query(`
  select (select u.id from users u where u.email = 'ayesha.khan@example.com') as member,
         (select ws.id from workout_sessions ws join users u on u.id = ws.user_id
           where u.email = 'ayesha.khan@example.com' and ws.state = 'scheduled'
           order by ws.scheduled_for limit 1) as session,
         (select id from programs where code = 'muscle_foundations_3d') as program`);
const { member: MEMBER, session: SESSION, program: PROGRAM } = ids[0];

const DESKTOP = { width: 1280, height: 820 };
const PHONE = { width: 412, height: 880 };

const GROUPS = [
  {
    role: 'Anyone', account: null, viewport: DESKTOP,
    note: 'The public site and sign-in. No account needed.',
    screens: [
      ['Landing page', '/'],
      ['Sign in', '/sign-in'],
    ],
  },
  {
    role: 'Gym owner', account: 'owner@apexfitness.pk', viewport: DESKTOP,
    note: 'Sees both branches, all money, all health data. The person who buys the product.',
    screens: [
      ['Dashboard', '/dashboard'],
      ['Members', '/dashboard/members'],
      ['Member profile', `/dashboard/members/${MEMBER}`],
      ['Billing', '/dashboard/billing'],
      ['Reports — both branches', '/dashboard/reports'],
      ['Classes', '/dashboard/classes?day=2026-08-22'],
      ['Health escalations', '/dashboard/escalations'],
      ['Automations', '/dashboard/automations'],
      ['Programs', '/dashboard/programs'],
    ],
  },
  {
    role: 'Branch manager', account: 'manager.dha@apexfitness.pk', viewport: DESKTOP,
    note: 'One branch only. Compare the reports screen with the owner’s — same URL, same code.',
    screens: [
      ['Dashboard', '/dashboard'],
      ['Reports — one branch', '/dashboard/reports'],
      ['Health escalations', '/dashboard/escalations'],
    ],
  },
  {
    role: 'Coach', account: 'coach@apexfitness.pk', viewport: DESKTOP,
    note: 'Their own caseload and health data. Authors programs.',
    screens: [
      ['Dashboard', '/dashboard'],
      ['Program library', '/dashboard/programs'],
      ['A program, phase by phase', `/dashboard/programs/${PROGRAM}`],
      ['Health escalations', '/dashboard/escalations'],
    ],
  },
  {
    role: 'Front desk', account: 'frontdesk@apexfitness.pk', viewport: DESKTOP,
    note: 'Enrolment and money. No health screening, no restricted notes, no nutrition data.',
    screens: [
      ['Dashboard', '/dashboard'],
      ['Enrol a member', '/dashboard/enrol'],
      ['Members', '/dashboard/members'],
      ['Member profile — no health section', `/dashboard/members/${MEMBER}`],
      ['Classes', '/dashboard/classes?day=2026-08-22'],
      ['Billing', '/dashboard/billing'],
    ],
  },
  {
    role: 'Member', account: 'ayesha.khan@example.com', viewport: PHONE,
    note: 'Captured at phone size, because that is what a member is holding.',
    screens: [
      ['Today', '/app'],
      ['Train', '/app/train'],
      ['The guided player', SESSION ? `/app/train/${SESSION}` : '/app/train'],
      ['Plan', '/app/plan'],
      ['Progress', '/app/progress'],
      ['Nutrition', '/app/nutrition'],
      ['Support and the AI coach', '/app/support'],
      ['Profile and consent', '/app/profile'],
    ],
  },
  {
    role: 'New member', account: 'nida.aslam@example.com', viewport: PHONE,
    note: 'Part way through onboarding. Opening the app sends her back to the wizard.',
    screens: [
      ['Onboarding — the health step', '/app'],
    ],
  },
  {
    role: 'Platform admin', account: 'support@gymguide.app', viewport: DESKTOP,
    note: 'GymGuide’s own view across paying gyms. No route to member health data.',
    screens: [
      ['Platform console', '/platform'],
    ],
  },
];

const browser = await chromium.launch();
const captured = [];

for (const group of GROUPS) {
  const token = group.account ? await tokenFor(group.account) : null;
  const ctx = await browser.newContext({
    viewport: group.viewport, colorScheme: 'dark', reducedMotion: 'reduce',
  });
  if (token) {
    await ctx.addCookies([
      { name: 'gg_session', value: token, domain: 'localhost', path: '/', httpOnly: true, sameSite: 'Lax' },
    ]);
  }
  const page = await ctx.newPage();

  for (const [label, url] of group.screens) {
    await page.goto(BASE + url, { waitUntil: 'load', timeout: 45_000 });
    await page.waitForTimeout(650);
    const id = `${group.role}-${label}`.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const file = `${TMP}/${id}.jpg`;
    await page.screenshot({ path: file, type: 'jpeg', quality: 60, fullPage: true });
    captured.push({ group: group.role, note: group.note, label, url, file,
                    phone: group.viewport === PHONE, final: page.url().replace(BASE, '') });
    console.log(`  ${group.role.padEnd(16)} ${label}`);
  }
  await ctx.close();
}
await browser.close();
await db.end();

// -------------------------------------------------------------------------
const b64 = (f) => 'data:image/jpeg;base64,' + readFileSync(f).toString('base64');
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const groups = [...new Set(captured.map((c) => c.group))];
const tabs = groups.map((g, i) =>
  `<button class="tab${i === 0 ? ' on' : ''}" data-group="${esc(g)}" role="tab" aria-selected="${i === 0}">${esc(g)}</button>`
).join('\n      ');

const panels = groups.map((g, gi) => {
  const items = captured.filter((c) => c.group === g);
  const note = items[0].note;
  const thumbs = items.map((c, i) =>
    `<button class="thumb${i === 0 ? ' on' : ''}" data-shot="${esc(c.group + '|' + c.label)}">
            <span class="thumb-n">${String(i + 1).padStart(2, '0')}</span>
            <span class="thumb-l">${esc(c.label)}</span>
            <code>${esc(c.url)}</code>
          </button>`).join('\n          ');
  const shots = items.map((c, i) =>
    `<figure class="shot${c.phone ? ' phone' : ''}${i === 0 ? ' on' : ''}" data-shot="${esc(c.group + '|' + c.label)}">
            <img src="${b64(c.file)}" alt="${esc(c.label)}" loading="lazy" decoding="async" />
            <figcaption><strong>${esc(c.label)}</strong><code>${esc(c.final || c.url)}</code></figcaption>
          </figure>`).join('\n          ');
  return `
      <section class="panel${gi === 0 ? ' on' : ''}" data-group="${esc(g)}" role="tabpanel">
        <p class="role-note">${esc(note)}</p>
        <div class="split">
          <nav class="thumbs" aria-label="Screens">
          ${thumbs}
          </nav>
          <div class="stage">
          ${shots}
          </div>
        </div>
      </section>`;
}).join('\n');

const html = `<title>GymGuide Screen Preview</title>
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
  :root {
    --ink:#14161a; --ink-2:#3a3f47; --slate:#666d77; --paper:#f7f8f9; --paper-2:#edeff2;
    --paper-3:#e2e5e9; --rule:#d7dbe0; --rule-2:#bfc5cc; --accent:#0f5f59; --warn:#8a5a12;
    --warn-soft:rgba(138,90,18,.10);
    --mono:ui-monospace,"SF Mono",SFMono-Regular,"Cascadia Mono","Roboto Mono",Menlo,Consolas,monospace;
    --sans:"Avenir Next",Avenir,"Segoe UI","Helvetica Neue",Helvetica,Arial,sans-serif;
  }
  @media (prefers-color-scheme:dark){:root:not([data-theme="light"]){
    --ink:#eef1f4; --ink-2:#c9cfd6; --slate:#98a0aa; --paper:#0f1114; --paper-2:#171a1e;
    --paper-3:#1f2328; --rule:#2a2e34; --rule-2:#3b4149; --accent:#59bdb5; --warn:#d9a35c;
    --warn-soft:rgba(217,163,92,.12);
  }}
  :root[data-theme="dark"]{
    --ink:#eef1f4; --ink-2:#c9cfd6; --slate:#98a0aa; --paper:#0f1114; --paper-2:#171a1e;
    --paper-3:#1f2328; --rule:#2a2e34; --rule-2:#3b4149; --accent:#59bdb5; --warn:#d9a35c;
    --warn-soft:rgba(217,163,92,.12);
  }
  *{box-sizing:border-box}
  body{margin:0;background:var(--paper);color:var(--ink);font-family:var(--sans);font-size:16px;line-height:1.55;-webkit-font-smoothing:antialiased}
  .wrap{max-width:1400px;margin:0 auto;padding:0 clamp(.75rem,.5rem + 1vw,1.5rem) 4rem}
  header.top{padding:2rem 0 1.25rem}
  .kicker{font-family:var(--mono);font-size:.6875rem;letter-spacing:.16em;text-transform:uppercase;color:var(--accent);margin:0 0 .625rem}
  h1{font-size:clamp(1.5rem,1.1rem + 2vw,2.25rem);margin:0 0 .75rem;letter-spacing:-.02em;font-weight:600}
  .live{border:1px solid var(--rule);border-left:3px solid var(--warn);background:var(--warn-soft);padding:1rem 1.125rem;margin:0 0 1.5rem;max-width:74ch}
  .live p{margin:0 0 .5rem;font-size:.9375rem;color:var(--ink-2)}
  .live p:last-child{margin:0}
  .live code{font-family:var(--mono);font-size:.8125rem;background:var(--paper-3);padding:.1rem .35rem;border-radius:2px}
  .tabs{display:flex;flex-wrap:wrap;gap:.375rem;border-bottom:1px solid var(--rule);padding-bottom:.75rem;margin-bottom:1.25rem}
  .tab{font-family:var(--sans);font-size:.875rem;padding:.4rem .8rem;border:1px solid var(--rule-2);background:var(--paper-2);
       color:var(--ink-2);border-radius:999px;cursor:pointer}
  .tab:hover{color:var(--ink)}
  .tab.on{background:var(--accent);border-color:var(--accent);color:var(--paper);font-weight:600}
  .tab:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
  .panel{display:none}.panel.on{display:block}
  .role-note{margin:0 0 1.25rem;color:var(--slate);font-size:.9375rem;max-width:74ch}
  .split{display:grid;grid-template-columns:250px minmax(0,1fr);gap:1.5rem;align-items:start}
  @media(max-width:820px){.split{grid-template-columns:1fr}}
  .thumbs{display:flex;flex-direction:column;gap:2px;position:sticky;top:1rem;max-height:82vh;overflow-y:auto}
  @media(max-width:820px){.thumbs{position:static;flex-direction:row;overflow-x:auto;max-height:none}}
  .thumb{text-align:left;font-family:var(--sans);background:var(--paper-2);border:1px solid var(--rule);
         padding:.5rem .7rem;cursor:pointer;color:var(--ink-2);display:flex;flex-direction:column;gap:.1rem;min-width:180px}
  .thumb:hover{background:var(--paper-3);color:var(--ink)}
  .thumb.on{border-color:var(--accent);background:var(--paper-3);color:var(--ink)}
  .thumb:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
  .thumb-n{font-family:var(--mono);font-size:.5625rem;letter-spacing:.1em;color:var(--accent)}
  .thumb-l{font-size:.8125rem;font-weight:600;line-height:1.25}
  .thumb code{font-family:var(--mono);font-size:.5625rem;color:var(--slate);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .stage{min-width:0}
  .shot{display:none;margin:0}.shot.on{display:block}
  .shot img{display:block;width:100%;height:auto;border:1px solid var(--rule-2);background:var(--paper-2);padding:6px;
            box-shadow:0 1px 2px rgba(0,0,0,.08),0 14px 34px -18px rgba(0,0,0,.35)}
  .shot.phone img{max-width:390px}
  figcaption{padding-top:.75rem;display:flex;flex-wrap:wrap;gap:.5rem .875rem;align-items:baseline}
  figcaption strong{font-size:.9375rem}
  figcaption code{font-family:var(--mono);font-size:.6875rem;color:var(--slate)}
  footer{margin-top:3rem;padding-top:1.25rem;border-top:1px solid var(--rule);font-family:var(--mono);
         font-size:.6875rem;color:var(--slate);display:flex;flex-wrap:wrap;gap:.4rem 1.25rem}
</style>

<div class="wrap">
  <header class="top">
    <p class="kicker">GymGuide &middot; screen preview</p>
    <h1>Every screen, by who is signed in</h1>
    <div class="live">
      <p><strong>This file is a preview, not the running application.</strong> Every image is a real capture of
      the built app signed in as that role — but it is a picture, so nothing here submits.</p>
      <p>To use the real thing, with working forms and a real database, run <code>./start.sh</code> in the
      project and open <code>http://localhost:3000</code>. No PostgreSQL installed? <code>docker compose up</code>.</p>
    </div>
    <div class="tabs" role="tablist">
      ${tabs}
    </div>
  </header>
${panels}
  <footer>
    <span>${captured.length} screens</span>
    <span>Chromium 1280&times;820 and 412&times;880</span>
    <span>Seeded gym: Apex Fitness Lahore</span>
    <span>Password for every demo account: GymGuide!Demo2026</span>
  </footer>
</div>

<script>
  const wrap = document.querySelector('.wrap');
  wrap.addEventListener('click', (event) => {
    const tab = event.target.closest('.tab');
    if (tab) {
      for (const t of wrap.querySelectorAll('.tab')) {
        const on = t === tab;
        t.classList.toggle('on', on);
        t.setAttribute('aria-selected', String(on));
      }
      for (const p of wrap.querySelectorAll('.panel')) {
        p.classList.toggle('on', p.dataset.group === tab.dataset.group);
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    const thumb = event.target.closest('.thumb');
    if (thumb) {
      const panel = thumb.closest('.panel');
      for (const t of panel.querySelectorAll('.thumb')) t.classList.toggle('on', t === thumb);
      for (const s of panel.querySelectorAll('.shot')) {
        s.classList.toggle('on', s.dataset.shot === thumb.dataset.shot);
      }
    }
  });
</script>
`;

writeFileSync(OUT, html);
console.log(`\n${captured.length} screens → ${OUT} (${(Buffer.byteLength(html) / 1048576).toFixed(2)} MB)`);
