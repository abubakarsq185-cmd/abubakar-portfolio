import 'server-only';
/**
 * The audit trail.
 *
 * audit_logs is append-only at the database level (triggers block UPDATE and
 * DELETE, and the app role has those privileges revoked), so this module is the
 * only way anything gets recorded — and nothing can quietly rewrite history.
 *
 * Writes use the owner connection deliberately: an audit record must survive
 * even when the action it describes was denied.
 */
import type { AuditAction, RoleCode } from '@gymguide/types';
import { withOwner } from './db/pool';

export interface AuditInput {
  organizationId: string | null;
  branchId?: string | null;
  actorUserId?: string | null;
  actorRole?: RoleCode | null;
  impersonatedBy?: string | null;
  action: AuditAction;
  entityType: string;
  entityId?: string | null;
  subjectUserId?: string | null;
  summary: string;
  before?: unknown;
  after?: unknown;
  reason?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  requestId?: string | null;
}

export async function recordAudit(input: AuditInput): Promise<void> {
  try {
    await withOwner((db) =>
      db.query(
        `insert into audit_logs
           (organization_id, branch_id, actor_user_id, actor_role, impersonated_by, action,
            entity_type, entity_id, subject_user_id, summary, before_state, after_state,
            reason, ip_address, user_agent, request_id)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
        [
          input.organizationId,
          input.branchId ?? null,
          input.actorUserId ?? null,
          input.actorRole ?? null,
          input.impersonatedBy ?? null,
          input.action,
          input.entityType,
          input.entityId ?? null,
          input.subjectUserId ?? null,
          input.summary,
          input.before === undefined ? null : JSON.stringify(input.before),
          input.after === undefined ? null : JSON.stringify(input.after),
          input.reason ?? null,
          input.ipAddress ?? null,
          input.userAgent ?? null,
          input.requestId ?? null,
        ],
      ),
    );
  } catch (error) {
    // Never let an audit failure swallow the user's action, but make it loud.
    console.error('[gymguide] failed to write audit record', { action: input.action, error });
  }
}

/**
 * Reading sensitive data is itself an audited event. Call this whenever staff
 * open health screening, restricted notes or progress photos.
 */
export async function recordSensitiveRead(input: {
  organizationId: string | null;
  actorUserId: string;
  actorRole: RoleCode;
  entityType: string;
  entityId: string;
  subjectUserId: string;
  summary: string;
}): Promise<void> {
  await recordAudit({ ...input, action: 'read_sensitive' });
}

/** Diff helper so audit records store what actually changed, not whole rows. */
export function diff<T extends Record<string, unknown>>(
  before: T,
  after: Partial<T>,
): { before: Partial<T>; after: Partial<T> } {
  const changedBefore: Partial<T> = {};
  const changedAfter: Partial<T> = {};
  for (const key of Object.keys(after) as Array<keyof T>) {
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
      changedBefore[key] = before[key];
      changedAfter[key] = after[key];
    }
  }
  return { before: changedBefore, after: changedAfter };
}
