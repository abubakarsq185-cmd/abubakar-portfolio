import Link from 'next/link';
import { revalidatePath } from 'next/cache';
import type { Metadata } from 'next';
import { RISK_KIND_LABELS, type RiskKind } from '@gymguide/types';
import { Badge, EmptyState, Panel, SafetyBanner } from '@gymguide/ui';
import { requirePermission } from '@/server/auth/session';
import { loadEscalationQueue, resolveRiskFlag } from '@/server/services/safety';

export const metadata: Metadata = { title: 'Health escalations' };

async function resolveAction(formData: FormData): Promise<void> {
  'use server';
  const { actor } = await requirePermission('health.write');
  const riskFlagId = String(formData.get('riskFlagId'));
  const resolution = String(formData.get('resolution') ?? '').trim();
  const lift = formData.get('liftHold') === 'on';
  if (resolution.length < 10) return;
  await resolveRiskFlag(actor, riskFlagId, resolution, lift);
  revalidatePath('/dashboard/escalations');
}

export default async function EscalationsPage() {
  const { actor } = await requirePermission('health.read');
  const queue = await loadEscalationQueue(actor);

  return (
    <div className="stack stack-6">
      <header className="page-header">
        <div className="stack stack-2">
          <h1 style={{ fontSize: '1.75rem' }}>Health escalations</h1>
          <p className="small muted">
            {queue.length} open. Automatic plan changes are already paused for anyone listed here.
          </p>
        </div>
      </header>

      <SafetyBanner tone="warning" title="This is a triage queue, not a clinical record">
        GymGuide does not diagnose and neither should this screen. Contact the member, decide whether they need a
        doctor or physiotherapist, and record what you did. Every action here is audited.
      </SafetyBanner>

      {queue.length === 0 ? (
        <Panel title="Queue">
          <EmptyState
            title="Nothing open"
            body="No member currently has an unresolved health flag. New reports appear here immediately and notify the assigned role."
          />
        </Panel>
      ) : (
        <div className="stack stack-4">
          {queue.map((item) => (
            <article key={item.riskFlagId} className="card stack stack-4">
              <div className="row-between row-wrap">
                <div className="stack stack-2">
                  <div className="row">
                    <Badge tone={item.severity === 'critical' ? 'danger' : item.severity === 'high' ? 'warning' : 'neutral'}>
                      {item.severity}
                    </Badge>
                    <h2 style={{ fontSize: '1.125rem' }}>{RISK_KIND_LABELS[item.kind as RiskKind] ?? item.kind}</h2>
                  </div>
                  <p className="small muted">
                    <Link href={`/dashboard/members/${item.userId}`}>{item.memberName}</Link> · reported via{' '}
                    {item.source.replace(/_/g, ' ')} · open {Math.round(item.hoursOpen)}h
                    {item.caseReference ? ` · case ${item.caseReference}` : ''}
                  </p>
                </div>
                <div className="row">
                  {item.blocksProgression ? <Badge tone="warning">progression paused</Badge> : null}
                  <Link className="btn btn-secondary btn-sm" href={`/dashboard/members/${item.userId}`}>
                    Open member
                  </Link>
                </div>
              </div>

              {item.detail ? <p className="small secondary">{item.detail}</p> : null}

              {actor.permissions.includes('health.write') ? (
                <form action={resolveAction} className="stack stack-3">
                  <input type="hidden" name="riskFlagId" value={item.riskFlagId} />
                  <label className="label" htmlFor={`resolution-${item.riskFlagId}`}>
                    What did you do? (recorded in the audit trail)
                  </label>
                  <textarea
                    id={`resolution-${item.riskFlagId}`}
                    name="resolution"
                    className="textarea"
                    required
                    minLength={10}
                    placeholder="Called the member, referred to physiotherapy, swapped squats for leg press within a pain-free range…"
                  />
                  <label className="checkbox-row">
                    <input type="checkbox" name="liftHold" />
                    <span>
                      <strong className="small">Lift the progression hold</strong>
                      <span className="hint">
                        Only if this member is safe to progress again. The hold lifts only when no other blocking flag
                        remains open.
                      </span>
                    </span>
                  </label>
                  <button className="btn btn-primary btn-sm" type="submit" style={{ alignSelf: 'flex-start' }}>
                    Resolve escalation
                  </button>
                </form>
              ) : (
                <p className="micro muted">You can see this queue but not resolve items — that needs health.write.</p>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
