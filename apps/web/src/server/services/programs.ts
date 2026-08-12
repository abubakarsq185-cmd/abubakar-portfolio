import 'server-only';
/**
 * Program authoring.
 *
 * Two rules shape this module.
 *
 * A gym never edits a platform template. It takes a copy, and the copy records
 * what it came from. Otherwise one gym's edit would change what every other gym
 * is running, and the platform library would stop meaning anything.
 *
 * Nothing reaches a member until someone has published it, and publishing is a
 * named person putting their name to it — the approver is recorded on the row.
 * "Only approved templates" is worth nothing if approval is implicit.
 */
import type { Actor } from '@gymguide/types';
import { can } from '@gymguide/types';
import { tenantSessionFor } from '../auth/session';
import { withOwner, withTenant, type Queryable } from '../db/pool';
import { recordAudit } from '../audit';

export const PROGRESSION_RULES = [
  'double_progression',
  'linear_load',
  'rep_progression',
  'rpe_autoregulated',
  'none',
] as const;
export type ProgressionRule = (typeof PROGRESSION_RULES)[number];

export const PROGRESSION_RULE_LABELS: Record<ProgressionRule, string> = {
  double_progression: 'Double progression — add reps to the top of the range, then add weight',
  linear_load: 'Linear load — add a fixed amount each session',
  rep_progression: 'Rep progression — add reps only, weight stays',
  rpe_autoregulated: 'Autoregulated — load follows reported effort',
  none: 'Hold — no automatic progression (deload or consolidation)',
};

/**
 * How many members are on each program.
 *
 * Read with the owner connection deliberately. Through a coach's row-level
 * scope this counts only the members they personally coach, so a program a
 * hundred people are running looks empty — and the coach withdraws it believing
 * nobody is affected. How many people are on a program is a fact about the
 * program, not about who is asking.
 */
async function activeAssignmentCounts(programIds: string[]): Promise<Map<string, number>> {
  if (programIds.length === 0) return new Map();
  return withOwner(async (db) => {
    const { rows } = await db.query<{ program_id: string; count: string }>(
      `select program_id, count(*) as count from program_assignments
        where program_id = any($1::uuid[]) and state = 'active'
        group by program_id`,
      [programIds],
    );
    return new Map(rows.map((row) => [row.program_id, Number(row.count)]));
  });
}

export interface ProgramListRow {
  programId: string;
  code: string;
  name: string;
  summary: string;
  scope: string;
  goal: string;
  experienceLevel: string;
  daysPerWeek: number;
  sessionMinutes: number;
  totalWeeks: number;
  lowImpact: boolean;
  ramadanFriendly: boolean;
  requiresEquipmentCodes: string[];
  publishState: string;
  isPlatform: boolean;
  /** True when this gym already has its own copy of a platform template. */
  alreadyCopied: boolean;
  membersOnIt: number;
  approvedByName: string | null;
  approvedAt: string | null;
}

export async function listPrograms(actor: Actor): Promise<ProgramListRow[]> {
  const session = tenantSessionFor(actor);

  return withTenant(session, async (db) => {
    const { rows } = await db.query<{
      id: string;
      code: string;
      name: string;
      summary: string;
      scope: string;
      goal: string;
      experience_level: string;
      days_per_week: number;
      session_minutes: number;
      total_weeks: number;
      low_impact: boolean;
      ramadan_friendly: boolean;
      requires_equipment_codes: string[];
      publish_state: string;
      is_platform: boolean;
      already_copied: boolean;
      approved_by_name: string | null;
      approved_at: string | null;
    }>(
      `select p.id, p.code, p.name, p.summary, p.scope::text as scope, p.goal::text as goal,
              p.experience_level::text as experience_level, p.days_per_week, p.session_minutes,
              p.total_weeks, p.low_impact, p.ramadan_friendly, p.requires_equipment_codes,
              p.publish_state::text as publish_state,
              p.organization_id is null as is_platform,
              exists (select 1 from programs copy
                       where copy.derived_from_program_id = p.id
                         and copy.organization_id is not null
                         and copy.deleted_at is null) as already_copied,
              u.full_name as approved_by_name, p.approved_at::text as approved_at
         from programs p
         left join users u on u.id = p.approved_by
        where p.deleted_at is null
        order by p.organization_id is null, p.goal, p.experience_level, p.name`,
    );

    const counts = await activeAssignmentCounts(rows.map((row) => row.id));

    return rows.map((row) => ({
      programId: row.id,
      code: row.code,
      name: row.name,
      summary: row.summary,
      scope: row.scope,
      goal: row.goal,
      experienceLevel: row.experience_level,
      daysPerWeek: row.days_per_week,
      sessionMinutes: row.session_minutes,
      totalWeeks: row.total_weeks,
      lowImpact: row.low_impact,
      ramadanFriendly: row.ramadan_friendly,
      requiresEquipmentCodes: row.requires_equipment_codes ?? [],
      publishState: row.publish_state,
      isPlatform: row.is_platform,
      alreadyCopied: row.already_copied,
      membersOnIt: counts.get(row.id) ?? 0,
      approvedByName: row.approved_by_name,
      approvedAt: row.approved_at,
    }));
  });
}

export interface ProgramPhaseDetail {
  phaseId: string;
  position: number;
  name: string;
  focus: string;
  weeks: number;
  progressionRule: string;
  deloadAtEnd: boolean;
  memberSummary: string | null;
  days: Array<{ weekNumber: number; dayNumber: number; workoutName: string | null; isRestDay: boolean }>;
}

export interface ProgramDetail extends ProgramListRow {
  intent: string;
  contraindications: string[];
  versionId: string | null;
  version: number | null;
  versionPublishState: string | null;
  changelog: string | null;
  derivedFromName: string | null;
  editable: boolean;
  phases: ProgramPhaseDetail[];
  /** Equipment the program needs that no branch in this gym has available. */
  missingEquipment: string[];
}

export async function loadProgram(actor: Actor, programId: string): Promise<ProgramDetail | null> {
  const session = tenantSessionFor(actor);

  return withTenant(session, async (db) => {
    const { rows } = await db.query<Record<string, unknown>>(
      `select p.id, p.code, p.name, p.summary, p.scope::text as scope, p.goal::text as goal,
              p.intent::text as intent, p.experience_level::text as experience_level,
              p.days_per_week, p.session_minutes, p.total_weeks, p.low_impact, p.ramadan_friendly,
              p.requires_equipment_codes, p.contraindications, p.publish_state::text as publish_state,
              p.organization_id is null as is_platform,
              -- ::text so the declared type is true. node-postgres hands back a
              -- Date for timestamptz, and the page formats this by slicing the
              -- ISO date off the front — which crashed the whole screen the
              -- moment a program was approved.
              p.approved_at::text as approved_at,
              u.full_name as approved_by_name,
              parent.name as derived_from_name,
              pv.id as version_id, pv.version, pv.publish_state::text as version_publish_state, pv.changelog,
              exists (select 1 from programs copy
                       where copy.derived_from_program_id = p.id
                         and copy.organization_id is not null
                         and copy.deleted_at is null) as already_copied
         from programs p
         left join users u on u.id = p.approved_by
         left join programs parent on parent.id = p.derived_from_program_id
         left join lateral (
           select pv.* from program_versions pv
            where pv.program_id = p.id order by pv.version desc limit 1
         ) pv on true
        where p.id = $1 and p.deleted_at is null`,
      [programId],
    );
    const row = rows[0];
    if (!row) return null;

    const versionId = (row.version_id as string | null) ?? null;

    const phases = versionId
      ? await db.query<{
          id: string;
          position: number;
          name: string;
          focus: string;
          weeks: number;
          progression_rule: string;
          deload_at_end: boolean;
          member_summary: string | null;
        }>(
          `select id, position, name, focus, weeks, progression_rule, deload_at_end, member_summary
             from program_phases where program_version_id = $1 order by position`,
          [versionId],
        )
      : { rows: [] };

    const days = phases.rows.length
      ? await db.query<{
          program_phase_id: string;
          week_number: number;
          day_number: number;
          is_rest_day: boolean;
          workout_name: string | null;
        }>(
          `select pd.program_phase_id, pd.week_number, pd.day_number, pd.is_rest_day, w.name as workout_name
             from program_days pd left join workouts w on w.id = pd.workout_id
            where pd.program_phase_id = any($1::uuid[])
            order by pd.week_number, pd.day_number`,
          [phases.rows.map((phase) => phase.id)],
        )
      : { rows: [] };

    // What the gym cannot actually equip. A coach editing a program should see
    // this before publishing, not discover it when the matcher declines.
    const { rows: equipment } = await db.query<{ code: string }>(
      `select distinct e.code from branch_equipment be
         join equipment e on e.id = be.equipment_id where be.is_available`,
    );
    const owned = new Set(equipment.map((item) => item.code));
    const required = (row.requires_equipment_codes as string[]) ?? [];

    const isPlatform = Boolean(row.is_platform);
    const memberCount = (await activeAssignmentCounts([programId])).get(programId) ?? 0;

    return {
      programId: row.id as string,
      code: row.code as string,
      name: row.name as string,
      summary: row.summary as string,
      scope: row.scope as string,
      goal: row.goal as string,
      intent: row.intent as string,
      experienceLevel: row.experience_level as string,
      daysPerWeek: Number(row.days_per_week),
      sessionMinutes: Number(row.session_minutes),
      totalWeeks: Number(row.total_weeks),
      lowImpact: Boolean(row.low_impact),
      ramadanFriendly: Boolean(row.ramadan_friendly),
      requiresEquipmentCodes: required,
      contraindications: (row.contraindications as string[]) ?? [],
      publishState: row.publish_state as string,
      isPlatform,
      alreadyCopied: Boolean(row.already_copied),
      membersOnIt: memberCount,
      approvedByName: (row.approved_by_name as string | null) ?? null,
      approvedAt: (row.approved_at as string | null) ?? null,
      versionId,
      version: row.version === null ? null : Number(row.version),
      versionPublishState: (row.version_publish_state as string | null) ?? null,
      changelog: (row.changelog as string | null) ?? null,
      derivedFromName: (row.derived_from_name as string | null) ?? null,
      // A platform template is read-only here however senior you are.
      editable: !isPlatform,
      phases: phases.rows.map((phase) => ({
        phaseId: phase.id,
        position: phase.position,
        name: phase.name,
        focus: phase.focus,
        weeks: phase.weeks,
        progressionRule: phase.progression_rule,
        deloadAtEnd: phase.deload_at_end,
        memberSummary: phase.member_summary,
        days: days.rows
          .filter((day) => day.program_phase_id === phase.id)
          .map((day) => ({
            weekNumber: day.week_number,
            dayNumber: day.day_number,
            workoutName: day.workout_name,
            isRestDay: day.is_rest_day,
          })),
      })),
      missingEquipment: required.filter((code) => !owned.has(code)),
    };
  });
}

/**
 * Copy a platform template into this gym so a coach can adapt it.
 *
 * The copy is a draft: taking a copy is not the same as approving it, and the
 * gym's version has to be published by a named person before anyone is put on
 * it. Phases, days and the version row come across; the workouts themselves are
 * shared rather than duplicated, because a gym editing "Full Body A" for one
 * program should not silently fork it for another.
 */
export async function copyProgramToGym(
  actor: Actor,
  programId: string,
): Promise<{ ok: boolean; message: string; programId?: string }> {
  if (!can(actor, 'content.write')) {
    return { ok: false, message: 'You do not have permission to author programs.' };
  }
  const organizationId = actor.organizationId;
  if (!organizationId) {
    return { ok: false, message: 'This account is not attached to a gym.' };
  }

  const session = tenantSessionFor(actor);
  try {
    const created = await withTenant(session, async (db) => {
      const { rows: source } = await db.query<{ code: string; name: string; organization_id: string | null }>(
        `select code, name, organization_id from programs where id = $1 and deleted_at is null`,
        [programId],
      );
      const original = source[0];
      if (!original) throw new Error('That program is not visible to you.');
      if (original.organization_id !== null) {
        throw new Error('That program already belongs to a gym — edit it directly instead of copying it.');
      }

      const code = await uniqueCode(db, organizationId, original.code);

      const { rows: inserted } = await db.query<{ id: string }>(
        `insert into programs
           (organization_id, scope, code, name, summary, intent, goal, experience_level,
            days_per_week, session_minutes, total_weeks, requires_equipment_codes, low_impact,
            ramadan_friendly, contraindications, publish_state, derived_from_program_id, created_by)
         select $1, 'organization', $2, $3, summary, intent, goal, experience_level,
                days_per_week, session_minutes, total_weeks, requires_equipment_codes, low_impact,
                ramadan_friendly, contraindications, 'draft', id, $4
           from programs where id = $5
         returning id`,
        [organizationId, code, `${original.name} (${actor.fullName.split(' ')[0]}’s copy)`, actor.userId, programId],
      );
      const newProgramId = inserted[0]!.id;

      const { rows: version } = await db.query<{ id: string }>(
        `insert into program_versions (organization_id, program_id, version, changelog, publish_state)
         values ($1, $2, 1, $3, 'draft')
         returning id`,
        [organizationId, newProgramId, `Copied from the platform template "${original.name}".`],
      );
      const newVersionId = version[0]!.id;

      // Phases and days come from the source program's newest version.
      const { rows: sourceVersion } = await db.query<{ id: string }>(
        `select id from program_versions where program_id = $1 order by version desc limit 1`,
        [programId],
      );
      if (sourceVersion[0]) {
        const { rows: phases } = await db.query<{ old_id: string; new_id: string }>(
          `with copied as (
             insert into program_phases
               (organization_id, program_version_id, position, name, focus, weeks,
                progression_rule, deload_at_end, member_summary)
             select $1, $2, position, name, focus, weeks, progression_rule, deload_at_end, member_summary
               from program_phases where program_version_id = $3
             returning id, position
           )
           select old.id as old_id, copied.id as new_id
             from copied join program_phases old
               on old.program_version_id = $3 and old.position = copied.position`,
          [organizationId, newVersionId, sourceVersion[0].id],
        );

        for (const phase of phases) {
          await db.query(
            `insert into program_days
               (organization_id, program_phase_id, week_number, day_number, workout_id, is_rest_day, label)
             select $1, $2, week_number, day_number, workout_id, is_rest_day, label
               from program_days where program_phase_id = $3`,
            [organizationId, phase.new_id, phase.old_id],
          );
        }
      }

      return { id: newProgramId, name: original.name };
    });

    await recordAudit({
      organizationId,
      actorUserId: actor.userId,
      actorRole: actor.role,
      action: 'create',
      entityType: 'program',
      entityId: created.id,
      summary: `${actor.fullName} copied the platform template "${created.name}" into this gym as a draft`,
    });

    return {
      ok: true,
      programId: created.id,
      message: 'Copied as a draft. Adapt it, then publish it before anyone is put on it.',
    };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'Could not copy that program.' };
  }
}

export interface ProgramEdits {
  name: string;
  summary: string;
  daysPerWeek: number;
  sessionMinutes: number;
  requiresEquipmentCodes: string[];
  lowImpact: boolean;
  ramadanFriendly: boolean;
  contraindications: string[];
}

export async function updateProgram(
  actor: Actor,
  programId: string,
  edits: ProgramEdits,
): Promise<{ ok: boolean; message: string }> {
  if (!can(actor, 'content.write')) {
    return { ok: false, message: 'You do not have permission to author programs.' };
  }
  if (edits.name.trim().length < 3) return { ok: false, message: 'Give the program a name.' };
  if (edits.summary.trim().length < 20) {
    return { ok: false, message: 'Write a summary a member would understand — at least a sentence.' };
  }
  if (edits.daysPerWeek < 1 || edits.daysPerWeek > 7) {
    return { ok: false, message: 'Days per week must be between one and seven.' };
  }

  const session = tenantSessionFor(actor);
  try {
    const before = await withTenant(session, async (db) => {
      const { rows } = await db.query<{ organization_id: string | null; name: string; publish_state: string }>(
        'select organization_id, name, publish_state from programs where id = $1 and deleted_at is null',
        [programId],
      );
      const program = rows[0];
      if (!program) throw new Error('That program is not visible to you.');
      if (program.organization_id === null) {
        throw new Error('Platform templates are read-only. Take a copy and edit that.');
      }

      await db.query(
        `update programs
            set name = $2, summary = $3, days_per_week = $4, session_minutes = $5,
                requires_equipment_codes = $6, low_impact = $7, ramadan_friendly = $8,
                contraindications = $9, updated_at = now()
          where id = $1`,
        [
          programId,
          edits.name.trim(),
          edits.summary.trim(),
          edits.daysPerWeek,
          edits.sessionMinutes,
          edits.requiresEquipmentCodes,
          edits.lowImpact,
          edits.ramadanFriendly,
          edits.contraindications,
        ],
      );
      return program;
    });

    await recordAudit({
      organizationId: actor.organizationId,
      actorUserId: actor.userId,
      actorRole: actor.role,
      action: 'update',
      entityType: 'program',
      entityId: programId,
      summary: `${actor.fullName} edited the program "${before.name}"`,
      before: { name: before.name },
      after: { name: edits.name.trim(), daysPerWeek: edits.daysPerWeek },
    });

    return { ok: true, message: 'Saved.' };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'Could not save that program.' };
  }
}

export interface PhaseEdits {
  name: string;
  focus: string;
  weeks: number;
  progressionRule: ProgressionRule;
  deloadAtEnd: boolean;
  memberSummary: string;
}

export async function updatePhase(
  actor: Actor,
  phaseId: string,
  edits: PhaseEdits,
): Promise<{ ok: boolean; message: string }> {
  if (!can(actor, 'content.write')) {
    return { ok: false, message: 'You do not have permission to author programs.' };
  }
  if (!PROGRESSION_RULES.includes(edits.progressionRule)) {
    return { ok: false, message: 'That is not a progression rule the coaching engine knows.' };
  }
  if (edits.weeks < 1 || edits.weeks > 26) {
    return { ok: false, message: 'A phase runs between one and twenty-six weeks.' };
  }

  const session = tenantSessionFor(actor);
  try {
    const context = await withTenant(session, async (db) => {
      const { rows } = await db.query<{ program_id: string; program_name: string; is_platform: boolean }>(
        `select p.id as program_id, p.name as program_name, p.organization_id is null as is_platform
           from program_phases ph
           join program_versions pv on pv.id = ph.program_version_id
           join programs p on p.id = pv.program_id
          where ph.id = $1`,
        [phaseId],
      );
      const found = rows[0];
      if (!found) throw new Error('That phase is not visible to you.');
      if (found.is_platform) throw new Error('Platform templates are read-only. Take a copy and edit that.');

      await db.query(
        `update program_phases
            set name = $2, focus = $3, weeks = $4, progression_rule = $5,
                deload_at_end = $6, member_summary = $7
          where id = $1`,
        [
          phaseId,
          edits.name.trim(),
          edits.focus.trim(),
          edits.weeks,
          edits.progressionRule,
          edits.deloadAtEnd,
          edits.memberSummary.trim() || null,
        ],
      );
      return found;
    });

    await recordAudit({
      organizationId: actor.organizationId,
      actorUserId: actor.userId,
      actorRole: actor.role,
      action: 'update',
      entityType: 'program_phase',
      entityId: phaseId,
      summary: `${actor.fullName} edited a phase of "${context.program_name}" (${edits.progressionRule})`,
    });

    return { ok: true, message: 'Phase saved.' };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'Could not save that phase.' };
  }
}

/**
 * Publish or withdraw a program.
 *
 * Publishing records who approved it, because "only approved templates" is
 * meaningless without a name attached. A program with no phases cannot be
 * published: it would match members and then give them nothing to do.
 * Withdrawing does not disturb anyone already on it — pulling the plan out from
 * under someone mid-block is worse than letting the block finish.
 */
export async function setProgramPublishState(
  actor: Actor,
  programId: string,
  publish: boolean,
): Promise<{ ok: boolean; message: string }> {
  if (!can(actor, 'content.write')) {
    return { ok: false, message: 'You do not have permission to publish programs.' };
  }

  const session = tenantSessionFor(actor);
  try {
    const result = await withTenant(session, async (db) => {
      const { rows } = await db.query<{
        name: string;
        is_platform: boolean;
        version_id: string | null;
        phase_count: string;
        day_count: string;
      }>(
        `select p.name, p.organization_id is null as is_platform, pv.id as version_id,
                (select count(*) from program_phases ph where ph.program_version_id = pv.id) as phase_count,
                (select count(*) from program_days pd
                   join program_phases ph on ph.id = pd.program_phase_id
                  where ph.program_version_id = pv.id and not pd.is_rest_day) as day_count,
                0 as unused
           from programs p
           left join lateral (
             select id from program_versions where program_id = p.id order by version desc limit 1
           ) pv on true
          where p.id = $1 and p.deleted_at is null`,
        [programId],
      );
      const program = rows[0];
      if (!program) throw new Error('That program is not visible to you.');
      if (program.is_platform) throw new Error('Platform templates are managed by GymGuide, not by a gym.');

      if (publish) {
        if (!program.version_id || Number(program.phase_count) === 0) {
          throw new Error('This program has no phases yet. A member would be matched to nothing.');
        }
        if (Number(program.day_count) === 0) {
          throw new Error('No training days are scheduled in any phase, so there is nothing to do.');
        }
        await db.query(
          `update programs set publish_state = 'published', approved_by = $2, approved_at = now(),
                               updated_at = now()
            where id = $1`,
          [programId, actor.userId],
        );
        await db.query(
          `update program_versions set publish_state = 'published', published_at = now(), published_by = $2
            where id = $1`,
          [program.version_id, actor.userId],
        );
      } else {
        await db.query(
          `update programs set publish_state = 'draft', approved_by = null, approved_at = null,
                               updated_at = now()
            where id = $1`,
          [programId],
        );
        if (program.version_id) {
          await db.query(`update program_versions set publish_state = 'draft' where id = $1`, [program.version_id]);
        }
      }

      return { name: program.name };
    });

    const active = (await activeAssignmentCounts([programId])).get(programId) ?? 0;

    await recordAudit({
      organizationId: actor.organizationId,
      actorUserId: actor.userId,
      actorRole: actor.role,
      action: 'update',
      entityType: 'program',
      entityId: programId,
      summary: publish
        ? `${actor.fullName} approved and published "${result.name}"`
        : `${actor.fullName} withdrew "${result.name}" from the library`,
    });

    return {
      ok: true,
      message: publish
        ? `Published. Your name is on it as the approver, and new members can now be matched to it.`
        : active > 0
          ? `Withdrawn. The ${active} member(s) already on it keep their plan — pulling it mid-block would be worse.`
          : 'Withdrawn. Nobody can be matched to it now.',
    };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'Could not change that program.' };
  }
}

/** `copy`, `copy-2`, … — the code is unique per gym, so find a free one. */
async function uniqueCode(db: Queryable, organizationId: string, base: string): Promise<string> {
  for (let suffix = 0; suffix < 50; suffix += 1) {
    const candidate = suffix === 0 ? `${base}_gym` : `${base}_gym_${suffix + 1}`;
    const { rows } = await db.query<{ taken: boolean }>(
      `select exists (select 1 from programs where organization_id = $1 and code = $2) as taken`,
      [organizationId, candidate],
    );
    if (!rows[0]!.taken) return candidate;
  }
  throw new Error('Too many copies of that template already exist.');
}
