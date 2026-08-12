import Link from 'next/link';
import { revalidatePath } from 'next/cache';
import type { Metadata } from 'next';
import { AiLabel, Badge, EmptyState, SafetyBanner } from '@gymguide/ui';
import { requireMember, tenantSessionFor } from '@/server/auth/session';
import { withTenant } from '@/server/db/pool';
import { askCoach, loadCoachThread } from '@/server/services/coach-ai';

export const metadata: Metadata = { title: 'Support' };

async function askAction(formData: FormData): Promise<void> {
  'use server';
  const { actor } = await requireMember();
  const message = String(formData.get('message') ?? '').trim();
  if (message.length < 2) return;
  await askCoach(actor, message);
  revalidatePath('/app/support');
}

async function contactStaffAction(formData: FormData): Promise<void> {
  'use server';
  const { actor } = await requireMember();
  const subject = String(formData.get('subject') ?? '').trim();
  const detail = String(formData.get('detail') ?? '').trim();
  if (subject.length < 3 || detail.length < 3) return;

  await withTenant(tenantSessionFor(actor), async (db) => {
    const { rows } = await db.query<{ reference: string | null }>(
      `select max(reference) as reference from support_cases where reference like 'APX-C-%'`,
    );
    const reference = `APX-C-${rows[0]?.reference ? Number(rows[0].reference.split('-').pop()) + 1 : 1001}`;
    await db.query(
      `insert into support_cases
         (organization_id, branch_id, reference, member_user_id, raised_by_user_id, category, priority,
          state, subject, detail, contains_health_data, assigned_role, sla_due_at)
       select $1, mp.branch_id, $2, $3, $3, 'general', 'normal', 'open', $4, $5, false, 'front_desk',
              now() + interval '24 hours'
         from member_profiles mp where mp.user_id = $3`,
      [actor.organizationId, reference, actor.userId, subject, detail],
    );
  });
  revalidatePath('/app/support');
}

export default async function SupportPage() {
  const { actor } = await requireMember();
  const [thread, cases] = await Promise.all([
    loadCoachThread(actor),
    withTenant(tenantSessionFor(actor), async (db) => {
      const { rows } = await db.query<{ reference: string; subject: string; state: string; created_at: string; category: string }>(
        `select reference, subject, state, created_at, category from support_cases
          where member_user_id = $1 order by created_at desc limit 10`,
        [actor.userId],
      );
      return rows;
    }),
  ]);

  return (
    <div className="stack stack-6 fade-up">
      <header className="stack stack-2">
        <h1 style={{ fontSize: '1.5rem' }}>Support</h1>
        <p className="small secondary">
          GymGuide Coach explains your plan and exercise technique. It is not a doctor, physiotherapist or dietitian —
          and a real person is always one tap away.
        </p>
      </header>

      <SafetyBanner tone="info" title="If something feels seriously wrong, stop">
        Chest pain, feeling faint or trouble breathing means stop exercising and get medical help immediately. Do not
        wait for a reply here.
      </SafetyBanner>

      <section className="stack stack-3">
        <h2 style={{ fontSize: '1.0625rem' }}>GymGuide Coach</h2>

        <div className="stack stack-3">
          {thread.length === 0 ? (
            <EmptyState
              title="Ask anything about your training"
              body="“How do I do a goblet squat?” · “Why did my plan change?” · “The rack is busy, what can I do instead?”"
            />
          ) : (
            thread.map((message) => (
              <div key={message.id} className={message.role === 'member' ? 'ai-message member' : 'ai-message'}>
                {message.isAiAssisted ? <AiLabel /> : null}
                <p className="small" style={{ whiteSpace: 'pre-wrap' }}>
                  {message.body}
                </p>
                {message.sources && message.sources.length > 0 ? (
                  <p className="micro muted" style={{ marginTop: '0.5rem' }}>
                    Based on: {message.sources.map((source) => source.label).join(' · ')}
                  </p>
                ) : null}
                {message.escalatedCaseReference ? (
                  <p className="micro" style={{ marginTop: '0.5rem', color: 'var(--warning)' }}>
                    A member of staff has been notified — case {message.escalatedCaseReference}.
                  </p>
                ) : null}
              </div>
            ))
          )}
        </div>

        <form action={askAction} className="stack stack-3">
          <label className="sr-only" htmlFor="message">
            Ask GymGuide Coach
          </label>
          <textarea
            id="message"
            name="message"
            className="textarea"
            required
            minLength={2}
            placeholder="Ask about your plan, an exercise, or why something changed…"
          />
          <button className="btn btn-primary" type="submit">
            Ask GymGuide Coach
          </button>
        </form>
      </section>

      <section className="stack stack-3">
        <h2 style={{ fontSize: '1.0625rem' }}>Talk to gym staff</h2>
        <form action={contactStaffAction} className="card stack stack-3">
          <input className="input" name="subject" required placeholder="What is it about?" aria-label="Subject" />
          <textarea className="textarea" name="detail" required placeholder="Tell us what you need." aria-label="Details" />
          <button className="btn btn-secondary" type="submit">
            Send to the gym team
          </button>
          <p className="micro muted">A person will reply. Health questions go to a qualified member of staff.</p>
        </form>
      </section>

      {cases.length > 0 ? (
        <section className="stack stack-3">
          <h2 style={{ fontSize: '1.0625rem' }}>Your requests</h2>
          {cases.map((supportCase) => (
            <article key={supportCase.reference} className="card row-between">
              <div className="stack" style={{ gap: '0.125rem', minWidth: 0 }}>
                <strong className="small">{supportCase.subject}</strong>
                <span className="micro muted">
                  {supportCase.reference} · {new Date(supportCase.created_at).toLocaleDateString('en-PK')}
                </span>
              </div>
              <Badge tone={supportCase.state === 'resolved' || supportCase.state === 'closed' ? 'success' : 'warning'}>
                {supportCase.state.replace('_', ' ')}
              </Badge>
            </article>
          ))}
        </section>
      ) : null}

      <p className="micro muted" style={{ textAlign: 'center' }}>
        <Link href="/app/profile">Notification and privacy settings</Link>
      </p>
    </div>
  );
}
