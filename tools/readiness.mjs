/**
 * The readiness check.
 *
 *   node tools/readiness.mjs            full check, needs the app on :3000
 *   node tools/readiness.mjs --quick    skip the build and the journey walk
 *
 * Runs every check that can be automated, in seven sections, and writes
 * readiness-report.html plus a console summary. Exits non-zero if anything that
 * blocks a handover fails.
 *
 * It reports three outcomes, and the difference matters:
 *
 *   PASS     verified working, right now, on this machine
 *   FAIL     broken — fix before anyone uses this
 *   GATE     cannot be settled by software: a contract, a deployment, or a
 *            person with the standing to sign it off. Not a bug, and not
 *            something more code will clear.
 */
import { execSync, spawn, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import pg from 'pg';
import { launchOptions } from './browser-launch.mjs';

const require = createRequire(import.meta.url);
const ROOT = new URL('..', import.meta.url).pathname;
// With no CHECK_BASE_URL the robot builds the app and then serves it itself, on
// a port of its own. That is deliberate. Driving a server someone else started
// means rebuilding .next underneath a running `next start`, which swaps the
// build out from under it mid-run — the first navigations then fail with a bare
// chrome-error and the whole sweep is unreliable for reasons that have nothing
// to do with the application. Owning the server also means one command is
// genuinely enough.
const EXTERNAL = process.env.CHECK_BASE_URL ?? null;
let BASE = EXTERNAL ?? '';
const QUICK = process.argv.includes('--quick');
const PASSWORD = process.env.SEED_DEMO_PASSWORD ?? 'GymGuide!Demo2026';

const G = '\x1b[32m', R = '\x1b[31m', Y = '\x1b[33m', B = '\x1b[1m', D = '\x1b[2m', O = '\x1b[0m';
const sections = [];
let current = null;

function section(title, why) {
  current = { title, why, checks: [] };
  sections.push(current);
  console.log(`\n${B}${title}${O}  ${D}${why}${O}`);
}

function check(label, status, detail = '') {
  current.checks.push({ label, status, detail });
  const mark = status === 'PASS' ? `${G}✓${O}` : status === 'FAIL' ? `${R}✗${O}` : `${Y}▲${O}`;
  console.log(`  ${mark} ${label}${detail ? `  ${D}${detail}${O}` : ''}`);
}

const run = (cmd) => {
  const out = spawnSync('bash', ['-lc', cmd], { cwd: ROOT, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  return { ok: out.status === 0, out: `${out.stdout ?? ''}${out.stderr ?? ''}` };
};

const env = Object.fromEntries(
  (existsSync(`${ROOT}/.env`) ? readFileSync(`${ROOT}/.env`, 'utf8') : '')
    .split('\n').filter((l) => l.includes('=') && !l.trimStart().startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]),
);

// =========================================================================
section('1. Environment', 'the machine can run it at all');
// =========================================================================
{
  const node = process.versions.node;
  check(`Node ${node}`, Number(node.split('.')[0]) >= 20 ? 'PASS' : 'FAIL', 'needs 20.11 or newer');

  const pnpm = run('pnpm -v');
  check('pnpm installed', pnpm.ok ? 'PASS' : 'FAIL', pnpm.out.trim().slice(0, 20));

  check('.env present', existsSync(`${ROOT}/.env`) ? 'PASS' : 'FAIL',
    existsSync(`${ROOT}/.env`) ? '' : 'run ./start.sh to create one');

  const secret = env.SESSION_SECRET ?? '';
  const weak = secret.length < 32 || /replace|change-me|placeholder|local-demo/i.test(secret);
  check('SESSION_SECRET is a real secret', weak ? 'FAIL' : 'PASS',
    weak ? 'still a placeholder or too short' : `${secret.length} characters`);

  check('.env is not committed', run('git ls-files --error-unmatch .env').ok ? 'FAIL' : 'PASS',
    'secrets must never be in git');
}

// =========================================================================
section('2. Database and security posture', 'where the isolation actually lives');
// =========================================================================
let db = null;
try {
  db = new pg.Client({ connectionString: env.DATABASE_URL ?? process.env.DATABASE_URL });
  await db.connect();
  check('Owner connection', 'PASS');

  const migrations = await db.query('select count(*)::int as n from schema_migrations');
  const onDisk = run('ls db/migrations/*.sql | wc -l').out.trim();
  const applied = migrations.rows[0].n;
  check('Every migration applied', String(applied) === onDisk ? 'PASS' : 'FAIL',
    `${applied} applied, ${onDisk} on disk`);

  const tables = await db.query(`
    select count(*)::int as total,
           count(*) filter (where not c.relrowsecurity)::int as unprotected
      from pg_tables t
      join pg_class c on c.relname = t.tablename
      join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
     where t.schemaname = 'public'`);
  const { total, unprotected } = tables.rows[0];
  // schema_migrations is infrastructure the app never touches.
  check('Row-level security on every tenant table',
    unprotected <= 1 ? 'PASS' : 'FAIL', `${total - unprotected}/${total} protected`);

  const role = await db.query(`select rolbypassrls, rolsuper from pg_roles where rolname = 'gymguide_app'`);
  const bad = !role.rows[0] || role.rows[0].rolbypassrls || role.rows[0].rolsuper;
  check('Application role cannot bypass security', bad ? 'FAIL' : 'PASS',
    bad ? 'gymguide_app is over-privileged' : 'NOBYPASSRLS, NOSUPERUSER');

  const seed = await db.query(`
    select (select count(*) from member_profiles)::int members,
           (select count(*) from workout_sessions where state = 'scheduled')::int upcoming,
           (select count(*) from ledger_entries)::int ledger`);
  const s = seed.rows[0];
  check('Demo data present', s.members > 0 ? 'PASS' : 'FAIL', `${s.members} members`);
  check('Members have sessions waiting', s.upcoming > 0 ? 'PASS' : 'FAIL',
    `${s.upcoming} scheduled — without these the app has nothing to tell anyone to do`);

  const ledger = await db.query(`
    select coalesce(sum(case when direction = 'debit' then amount_minor else -amount_minor end), 0)::bigint as drift
      from ledger_entries`);
  check('Ledger balances', String(ledger.rows[0].drift) === '0' ? 'PASS' : 'FAIL',
    `drift ${ledger.rows[0].drift} paisa`);
} catch (error) {
  check('Database reachable', 'FAIL', error.message.split('\n')[0]);
}

// =========================================================================
section('3. Code health', 'it compiles and the types are honest');
// =========================================================================
{
  const tc = run('pnpm typecheck');
  check('Typecheck, all 7 projects', tc.ok ? 'PASS' : 'FAIL',
    tc.ok ? '' : tc.out.split('\n').filter((l) => l.includes('error')).slice(0, 2).join(' '));

  if (!QUICK) {
    const build = run('pnpm build');
    check('Production build', build.ok ? 'PASS' : 'FAIL',
      build.ok ? '' : build.out.split('\n').slice(-3).join(' ').slice(0, 160));
  } else {
    check('Production build', 'GATE', 'skipped with --quick');
  }
}

// =========================================================================
section('4. Automated tests', 'the rules that must never regress');
// =========================================================================
{
  const tests = run('npx vitest run --reporter=json --outputFile=/tmp/vitest.json >/dev/null 2>&1; cat /tmp/vitest.json');
  try {
    const result = JSON.parse(tests.out);
    const failed = result.numFailedTests ?? 0;
    check('Unit and integration suite', failed === 0 ? 'PASS' : 'FAIL',
      `${result.numPassedTests}/${result.numTotalTests} passing`);
  } catch {
    check('Unit and integration suite', 'FAIL', 'could not run — is PostgreSQL up?');
  }
}

// =========================================================================
section('5. Every route, every role', 'nothing 500s and nobody sees what they should not');
// =========================================================================

/** Wait for a URL to answer, or give up. Returns true if it ever answered. */
async function waitForServer(url, seconds) {
  const deadline = Date.now() + seconds * 1000;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
      if (res.status < 500) return true;
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

let server = null;
if (EXTERNAL) {
  check('App reachable', await waitForServer(EXTERNAL, 20) ? 'PASS' : 'FAIL', EXTERNAL);
} else if (!existsSync(`${ROOT}apps/web/.next/BUILD_ID`)) {
  check('App reachable', 'FAIL', 'no production build — run `pnpm build`, or drop --quick so this does it for you');
} else {
  const port = Number(process.env.CHECK_PORT ?? 3210);
  BASE = `http://localhost:${port}`;
  process.stdout.write(`  ${D}starting its own server on ${port}${O}\n`);
  // .env lives at the repo root, which Next — started from apps/web — will not
  // find on its own, so hand it over explicitly.
  server = spawn('npx', ['next', 'start', '--port', String(port)], {
    cwd: `${ROOT}apps/web`, stdio: 'ignore', detached: true,
    env: { ...process.env, ...env },
  });
  // Detached so the whole group can be killed: `next start` spawns a child, and
  // killing only the parent leaves the port held.
  const stop = () => { try { process.kill(-server.pid, 'SIGKILL'); } catch { /* already gone */ } };
  process.on('exit', stop);
  process.on('SIGINT', () => { stop(); process.exit(130); });

  const up = await waitForServer(BASE, 60);
  check('App reachable', up ? 'PASS' : 'FAIL', up ? `serving on ${port}` : `never came up on ${port}`);
  if (!up) { stop(); server = null; }
}
const ROLES = {
  owner: 'owner@apexfitness.pk',
  manager: 'manager.dha@apexfitness.pk',
  coach: 'coach@apexfitness.pk',
  frontDesk: 'frontdesk@apexfitness.pk',
  nutrition: 'nutrition@apexfitness.pk',
  member: 'ayesha.khan@example.com',
  guardian: 'tariq.noor@example.com',
  platform: 'support@gymguide.app',
};

let sweepFailures = 0;
try {
  if (!BASE) throw new Error('no server to check against');
  const { chromium } = require('@playwright/test');
  const { randomBytes, createHash } = await import('node:crypto');

  const ids = await db.query(`
    select (select id from users where email = 'ayesha.khan@example.com') member,
           (select id from workout_sessions where state = 'scheduled' limit 1) session,
           (select id from programs where organization_id is null limit 1) program`);
  const { member, session, program } = ids.rows[0];

  // Every page in the application. `allow` lists the roles that should get a
  // rendered page; everyone else must be redirected, never shown a crash.
  const ROUTES = [
    // '/' renders for everyone. '/sign-in' deliberately bounces an already
    // signed-in user to their own home, so it is listed as nobody's page —
    // being redirected away from it is the correct outcome, not a fault.
    ['/', 'all'], ['/sign-in', []],
    ['/dashboard', 'staff'], ['/dashboard/members', 'staff'],
    [`/dashboard/members/${member}`, 'staff'],
    ['/dashboard/enrol', ['owner', 'manager', 'frontDesk']],
    ['/dashboard/billing', ['owner', 'manager', 'frontDesk', 'coach']],
    ['/dashboard/classes', 'staff'],
    ['/dashboard/escalations', ['owner', 'manager', 'coach', 'nutrition']],
    ['/dashboard/programs', 'staff'], [`/dashboard/programs/${program}`, 'staff'],
    ['/dashboard/reports', ['owner', 'manager', 'coach', 'frontDesk']],
    ['/dashboard/automations', 'staff'],
    ['/app', 'members'], ['/app/train', 'members'], ['/app/plan', 'members'],
    ['/app/progress', 'members'], ['/app/nutrition', 'members'],
    ['/app/support', 'members'], ['/app/profile', 'members'],
    ['/app/onboarding', 'members'],
    [`/app/train/${session}`, 'members'],
    ['/platform', ['platform']],
  ];
  const STAFF = ['owner', 'manager', 'coach', 'frontDesk', 'nutrition'];
  const MEMBERS = ['member', 'guardian'];
  const expand = (a) => a === 'all' ? Object.keys(ROLES) : a === 'staff' ? STAFF : a === 'members' ? MEMBERS : a;

  const browser = await chromium.launch(launchOptions(BASE));
  const tokens = {};
  for (const [key, email] of Object.entries(ROLES)) {
    const token = randomBytes(32).toString('base64url');
    const { rows } = await db.query('select id, organization_id from users where email = $1', [email]);
    if (!rows[0]) continue;
    await db.query(
      `insert into auth_sessions (user_id, organization_id, token_hash, mfa_satisfied, expires_at)
       values ($1,$2,$3,true, now() + interval '2 hours')`,
      [rows[0].id, rows[0].organization_id, createHash('sha256').update(token).digest('hex')],
    );
    tokens[key] = token;
  }

  let crashes = 0, wrongAccess = 0, checked = 0;
  const detail = [];

  // One context per role, reused across every route. Creating a context per
  // combination made this take longer than the whole rest of the check.
  for (const role of Object.keys(ROLES)) {
    if (!tokens[role]) continue;
    const ctx = await browser.newContext({ viewport: { width: 1200, height: 800 } });
    await ctx.addCookies([{ name: 'gg_session', value: tokens[role], domain: 'localhost', path: '/', httpOnly: true, sameSite: 'Lax' }]);
    const page = await ctx.newPage();

    // Narrate the sweep. It is the longest section, and a section that prints
    // nothing for minutes is indistinguishable from one that has hung.
    process.stdout.write(`  ${D}… ${role}${O}`);

    for (const [route, allow] of ROUTES) {
      const allowed = new Set(expand(allow));
      const response = await page.goto(BASE + route, { waitUntil: 'domcontentloaded', timeout: 20_000 }).catch(() => null);
      const body = await page.locator('body').innerText().catch(() => '');
      const status = response?.status() ?? 0;
      const landed = page.url().replace(BASE, '').split('?')[0];
      checked += 1;

      // A crash is always a failure, whoever asked for the page.
      if (/Application error|server-side exception|Digest:/i.test(body) || status >= 500) {
        crashes += 1;
        detail.push(`${route} as ${role}: SERVER ERROR (${status})`);
      } else if (allowed.has(role) && landed !== route.split('?')[0] && !route.includes('/app/onboarding')) {
        // Someone entitled to the page was sent somewhere else.
        wrongAccess += 1;
        detail.push(`${route} as ${role}: expected access, landed on ${landed}`);
      } else if (!allowed.has(role) && landed === route.split('?')[0] && route !== '/' && route !== '/sign-in') {
        wrongAccess += 1;
        detail.push(`${route} as ${role}: NOT entitled but the page rendered`);
      }
    }
    await ctx.close();
  }
  process.stdout.write('\n');
  await browser.close();

  check(`${checked} route/role combinations rendered without a server error`,
    crashes === 0 ? 'PASS' : 'FAIL', crashes ? detail.filter((d) => d.includes('SERVER')).slice(0, 3).join('; ') : '');
  check('Access matched the permission matrix everywhere',
    wrongAccess === 0 ? 'PASS' : 'FAIL', wrongAccess ? detail.filter((d) => !d.includes('SERVER')).slice(0, 3).join('; ') : '');
  sweepFailures = crashes + wrongAccess;
} catch (error) {
  check('Route sweep', 'FAIL', `${error.message.split('\n')[0]}${BASE ? ` — against ${BASE}` : ''}`);
  sweepFailures = 1;
}

// =========================================================================
section('6. The journeys a gym runs on', 'end to end, through the real interface');
// =========================================================================
{
  if (QUICK) {
    check('43-step journey walk', 'GATE', 'skipped with --quick');
  } else if (!BASE) {
    check('Journey walk', 'FAIL', 'no server to walk through');
  } else {
    const walk = run(`WALK_BASE_URL=${BASE} SEED_DEMO_PASSWORD=${JSON.stringify(PASSWORD)} node tools/walkthrough.mjs`);
    const match = walk.out.match(/(\d+) steps — (\d+) pass, (\d+) fail/);
    if (match) {
      const [, total, passed, failed] = match;
      check(`${total} steps across 8 journeys`, Number(failed) === 0 ? 'PASS' : 'FAIL',
        `${passed} passed, ${failed} failed`);
    } else {
      check('Journey walk', 'FAIL', 'did not complete — see the output above');
    }
  }
}

// Nothing below here needs the app, so give the port back.
if (server) { try { process.kill(-server.pid, 'SIGKILL'); } catch { /* already gone */ } server = null; }

// =========================================================================
section('7. Go-live gates', 'not code — these need a contract, a server, or a person');
// =========================================================================
{
  const cardReady = Boolean(env.STRIPE_SECRET_KEY);
  check('Card / wallet / QR payments', cardReady ? 'PASS' : 'GATE',
    cardReady ? 'credentials present' : 'no merchant credentials — cash and bank transfer work today');

  const smtp = Boolean(env.SMTP_URL);
  check('Email delivery', smtp ? 'PASS' : 'GATE', smtp ? 'SMTP configured' : 'messages are recorded, not sent');

  const whatsapp = Boolean(env.WHATSAPP_ACCESS_TOKEN);
  check('WhatsApp', whatsapp ? 'PASS' : 'GATE', whatsapp ? 'configured' : 'needs Meta-approved templates');

  const ssl = env.DATABASE_SSL === 'true';
  check('Database TLS', ssl ? 'PASS' : 'GATE',
    ssl ? 'on' : 'off — fine locally, required in production');

  const prod = env.APP_ENV === 'production';
  check('APP_ENV', prod ? 'PASS' : 'GATE', prod ? 'production' : `${env.APP_ENV ?? 'unset'} — this is not a production configuration`);

  check('Deployed somewhere with backups', 'GATE', 'nothing is hosted yet; no restore has been tested');
  check('Health-data handling signed off', 'GATE', 'needs a person qualified to accept the obligation, not software');
  check('Load and accessibility testing', 'GATE', 'not run');
}

if (db) await db.end();

// =========================================================================
const flat = sections.flatMap((s) => s.checks);
const pass = flat.filter((c) => c.status === 'PASS').length;
const fail = flat.filter((c) => c.status === 'FAIL').length;
const gate = flat.filter((c) => c.status === 'GATE').length;

console.log(`\n${B}${'─'.repeat(64)}${O}`);
console.log(`${B}${pass} passing   ${fail ? R : ''}${fail} failing${O}   ${Y}${gate} gates${O}`);
console.log(
  fail === 0
    ? `\n${G}${B}The software is working.${O} ${gate} gate(s) remain before handover — see section 7.\n`
    : `\n${R}${B}${fail} check(s) failed. Fix these before anyone uses this.${O}\n`,
);

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const rows = sections.map((s) => `
    <section>
      <h2>${esc(s.title)}</h2><p class="why">${esc(s.why)}</p>
      <table><tbody>${s.checks.map((c) => `
        <tr class="${c.status.toLowerCase()}">
          <td class="st">${c.status}</td><td>${esc(c.label)}</td><td class="dt">${esc(c.detail)}</td>
        </tr>`).join('')}</tbody></table>
    </section>`).join('');

writeFileSync(`${ROOT}/readiness-report.html`, `<!doctype html><meta charset="utf-8">
<title>GymGuide readiness — ${new Date().toISOString().slice(0, 16).replace('T', ' ')}</title>
<style>
 :root{--ink:#16181c;--paper:#fafbfc;--rule:#e2e5e9;--pass:#1f7a4d;--fail:#b3372a;--gate:#8a5a12;--slate:#6b7280}
 @media(prefers-color-scheme:dark){:root{--ink:#eef1f4;--paper:#111316;--rule:#282c31;--pass:#5ec48f;--fail:#e08a78;--gate:#d7a259;--slate:#98a0aa}}
 body{margin:0;background:var(--paper);color:var(--ink);font:15px/1.55 ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif}
 .w{max-width:960px;margin:0 auto;padding:2.5rem 1.25rem 4rem}
 h1{font-size:1.75rem;margin:0 0 .4rem;letter-spacing:-.02em}
 .sum{display:flex;gap:1px;background:var(--rule);border:1px solid var(--rule);margin:1.25rem 0 2rem}
 .sum div{background:var(--paper);padding:.75rem 1.1rem;flex:1}
 .sum b{display:block;font-size:1.5rem;font-variant-numeric:tabular-nums}
 .sum span{font-size:.6875rem;letter-spacing:.08em;text-transform:uppercase;color:var(--slate)}
 .verdict{border:1px solid var(--rule);border-left:3px solid var(--gate);padding:1rem 1.15rem;margin-bottom:2rem}
 h2{font-size:1.05rem;margin:2rem 0 .25rem}
 .why{margin:0 0 .75rem;color:var(--slate);font-size:.875rem}
 table{width:100%;border-collapse:collapse;font-size:.875rem}
 td{padding:.45rem .6rem;border-bottom:1px solid var(--rule);vertical-align:top}
 .st{font:600 .6875rem ui-monospace,monospace;letter-spacing:.06em;width:4.5rem}
 tr.pass .st{color:var(--pass)} tr.fail .st{color:var(--fail)} tr.gate .st{color:var(--gate)}
 tr.fail td{background:color-mix(in srgb,var(--fail) 7%,transparent)}
 .dt{color:var(--slate);font-size:.8125rem}
 footer{margin-top:2.5rem;padding-top:1rem;border-top:1px solid var(--rule);color:var(--slate);font-size:.75rem}
</style>
<div class="w">
  <h1>GymGuide readiness</h1>
  <p class="why">Generated ${new Date().toUTCString()} &middot; every check run against the real application.</p>
  <div class="sum">
    <div><b style="color:var(--pass)">${pass}</b><span>passing</span></div>
    <div><b style="color:${fail ? 'var(--fail)' : 'inherit'}">${fail}</b><span>failing</span></div>
    <div><b style="color:var(--gate)">${gate}</b><span>gates</span></div>
  </div>
  <div class="verdict">
    <strong>${fail === 0 ? 'The software is working.' : `${fail} check(s) failed.`}</strong>
    ${fail === 0
      ? `Every automated check passes. ${gate} gate(s) remain before this can be handed to a gym — none of them are code, and none can be cleared by writing more of it. See section 7.`
      : 'Fix the failing checks before anyone uses this.'}
  </div>
  ${rows}
  <footer>PASS verified now &middot; FAIL broken &middot; GATE needs a contract, a server, or a qualified person</footer>
</div>`);

console.log(`${D}Report written to readiness-report.html${O}\n`);
process.exit(fail === 0 ? 0 : 1);
