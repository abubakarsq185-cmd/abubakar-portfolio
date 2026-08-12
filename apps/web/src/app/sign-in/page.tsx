import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { loginInput } from '@gymguide/types';
import { serverEnv } from '@gymguide/config/env';
import { Field } from '@gymguide/ui';
import { getSession, requestMeta, signIn } from '@/server/auth/session';

export const metadata: Metadata = { title: 'Sign in' };

const DEMO_ACCOUNTS = [
  ['Gym owner', 'owner@apexfitness.pk', 'Everything across both branches'],
  ['Branch manager', 'manager.gulberg@apexfitness.pk', 'Gulberg only'],
  ['Coach', 'coach@apexfitness.pk', 'Assigned members, no financial data'],
  ['Front desk', 'frontdesk@apexfitness.pk', 'Enrolment and payments, no health data'],
  ['Nutrition professional', 'nutrition@apexfitness.pk', 'Nutrition plans only'],
  ['Member', 'ayesha.khan@example.com', 'The member app'],
  ['Member (escalation)', 'ahmed.nawaz@example.com', 'Has an open health escalation'],
  ['Platform admin', 'support@gymguide.app', 'The platform console'],
];

async function signInAction(formData: FormData): Promise<void> {
  'use server';

  const parsed = loginInput.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
    totp: formData.get('totp') || undefined,
    rememberDevice: formData.get('rememberDevice') === 'on',
  });
  if (!parsed.success) {
    redirect(`/sign-in?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? 'Check the form and try again.')}`);
  }

  const meta = await requestMeta();
  const result = await signIn({
    email: parsed.data.email,
    password: parsed.data.password,
    totp: parsed.data.totp,
    ip: meta.ip ?? undefined,
    userAgent: meta.userAgent ?? undefined,
  });

  if (!result.ok) {
    // Redirecting keeps the error on a server-rendered page: no client state,
    // and the form still works without JavaScript.
    redirect(`/sign-in?error=${encodeURIComponent(result.message)}&email=${encodeURIComponent(parsed.data.email)}`);
  }

  if (result.actor.isPlatformAdmin) redirect('/platform');
  if (result.actor.role === 'member' || result.actor.role === 'guardian') redirect('/app');
  redirect('/dashboard');
}

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; email?: string }>;
}) {
  const params = await searchParams;
  const session = await getSession();
  if (session) {
    if (session.actor.isPlatformAdmin) redirect('/platform');
    redirect(session.actor.role === 'member' || session.actor.role === 'guardian' ? '/app' : '/dashboard');
  }

  const env = serverEnv();
  const showHints = env.ALLOW_DEMO_LOGIN_HINTS && env.APP_ENV !== 'production';

  return (
    <main id="main" data-theme="dark" style={{ minHeight: '100dvh', background: 'var(--obsidian-900)', color: 'var(--bone-50)' }}>
      <div className="container section" style={{ display: 'grid', gap: '3rem', alignItems: 'center' }}>
        <div className="grid grid-split" style={{ alignItems: 'center' }}>
          <div className="stack stack-6">
            <Link href="/" className="brand">
              <span className="brand-mark" aria-hidden="true">
                GG
              </span>
              GymGuide
            </Link>
            <h1 style={{ fontSize: 'clamp(1.75rem, 1.4rem + 1.6vw, 2.5rem)' }}>Welcome back</h1>
            <p className="lede">
              One sign-in for the whole gym. What you see next depends on your role — owners get the brand, coaches get
              their members, members get their plan.
            </p>

            {showHints ? (
              <div className="card card-flat stack stack-3" style={{ background: 'var(--obsidian-700)' }}>
                <strong className="small">Demo accounts</strong>
                <p className="micro muted">
                  Password for every account: <code className="mono">{env.SEED_DEMO_PASSWORD}</code>
                </p>
                <div className="stack stack-2">
                  {DEMO_ACCOUNTS.map(([role, email, note]) => (
                    <div key={email} className="row-between small">
                      <span>
                        <strong>{role}</strong> <span className="mono muted">{email}</span>
                      </span>
                      <span className="micro muted hide-sm">{note}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <div className="card" style={{ background: 'var(--obsidian-700)' }}>
            <SignInForm error={params.error ?? null} email={params.email ?? ''} />
          </div>
        </div>
      </div>
    </main>
  );
}

function SignInForm({ error, email }: { error: string | null; email: string }) {
  return (
    <form action={signInAction} className="stack stack-4">
      <h2 style={{ fontSize: '1.25rem' }}>Sign in</h2>

      {error ? (
        <p className="error-text" role="alert" style={{ padding: '0.75rem 1rem', background: 'var(--danger-soft)', borderRadius: 'var(--radius-md)' }}>
          {error}
        </p>
      ) : null}

      <Field label="Email" htmlFor="email" required>
        <input
          id="email"
          name="email"
          type="email"
          className="input"
          autoComplete="email"
          required
          defaultValue={email}
          placeholder="you@yourgym.pk"
        />
      </Field>

      <Field label="Password" htmlFor="password" required>
        <input
          id="password"
          name="password"
          type="password"
          className="input"
          autoComplete="current-password"
          required
        />
      </Field>

      <Field
        label="Authenticator code"
        htmlFor="totp"
        hint="Only needed if your account has two-factor authentication enabled."
      >
        <input id="totp" name="totp" inputMode="numeric" pattern="\d{6}" className="input" autoComplete="one-time-code" placeholder="123456" />
      </Field>

      <label className="checkbox-row">
        <input type="checkbox" name="rememberDevice" />
        <span>
          <strong className="small">Remember this device</strong>
          <span className="hint">Do not use on a shared front-desk computer.</span>
        </span>
      </label>

      <button type="submit" className="btn btn-primary btn-block btn-lg">
        Sign in
      </button>

      <p className="micro muted">
        By signing in you agree to the <Link href="/legal/terms">terms</Link> and{' '}
        <Link href="/legal/privacy">privacy notice</Link>.
      </p>
    </form>
  );
}
