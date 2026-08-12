import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Client } from 'pg';
import { permissionsForRoles, type Actor } from '@gymguide/types';
import {
  copyProgramToGym,
  listPrograms,
  loadProgram,
  setProgramPublishState,
  updatePhase,
  updateProgram,
} from '../../apps/web/src/server/services/programs';
import { closePools } from '../../apps/web/src/server/db/pool';
import { ownerClient } from './helpers';

/**
 * Program authoring.
 *
 * The two rules worth protecting are that a gym cannot edit a shared platform
 * template, and that nothing reaches a member without a named person having
 * approved it.
 */
describe('program authoring', () => {
  let owner: Client;
  let coach: Actor;
  let frontDesk: Actor;
  let organizationId: string;
  let platformProgramId: string;

  const createdProgramIds: string[] = [];

  async function copyForTest(): Promise<string> {
    const result = await copyProgramToGym(coach, platformProgramId);
    if (!result.ok || !result.programId) throw new Error(result.message);
    createdProgramIds.push(result.programId);
    return result.programId;
  }

  beforeAll(async () => {
    owner = await ownerClient();

    const { rows: staff } = await owner.query<{ id: string; organization_id: string; branch_id: string }>(
      `select u.id, u.organization_id, sa.branch_id
         from users u join staff_assignments sa on sa.user_id = u.id
        where u.email = 'coach@apexfitness.pk'`,
    );
    organizationId = staff[0]!.organization_id;

    coach = {
      userId: staff[0]!.id,
      organizationId,
      role: 'coach',
      roles: ['coach'],
      permissions: permissionsForRoles(['coach']),
      branchIds: [staff[0]!.branch_id],
      isPlatformAdmin: false,
      fullName: 'Hassan Raza',
      email: 'coach@apexfitness.pk',
    };

    const { rows: desk } = await owner.query<{ id: string; branch_id: string }>(
      `select u.id, sa.branch_id from users u join staff_assignments sa on sa.user_id = u.id
        where u.email = 'frontdesk@apexfitness.pk'`,
    );
    frontDesk = {
      userId: desk[0]!.id,
      organizationId,
      role: 'front_desk',
      roles: ['front_desk'],
      permissions: permissionsForRoles(['front_desk']),
      branchIds: [desk[0]!.branch_id],
      isPlatformAdmin: false,
      fullName: 'Zoya Ahmed',
      email: 'frontdesk@apexfitness.pk',
    };

    const { rows: program } = await owner.query<{ id: string }>(
      `select id from programs where organization_id is null and code = 'fat_loss_3d'`,
    );
    platformProgramId = program[0]!.id;
  }, 30_000);

  afterAll(async () => {
    if (createdProgramIds.length) {
      // Assignments reference programs with ON DELETE RESTRICT, deliberately —
      // a program someone is running must not vanish. Clear them first.
      await owner.query('delete from program_assignments where program_id = any($1::uuid[])', [createdProgramIds]);
      await owner.query('delete from programs where id = any($1::uuid[])', [createdProgramIds]);
    }
    await closePools();
    await owner?.end();
  });

  it('shows platform templates and the gym’s own programs separately', async () => {
    const programs = await listPrograms(coach);
    expect(programs.some((program) => program.isPlatform)).toBe(true);
    expect(programs.every((program) => program.publishState !== undefined)).toBe(true);
  });

  it('will not let a gym edit a shared platform template', async () => {
    const result = await updateProgram(coach, platformProgramId, {
      name: 'Hijacked Template',
      summary: 'This should never be written to a template every other gym is running.',
      daysPerWeek: 3,
      sessionMinutes: 45,
      requiresEquipmentCodes: [],
      lowImpact: false,
      ramadanFriendly: false,
      contraindications: [],
    });
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/read-only/i);

    const { rows } = await owner.query<{ name: string }>('select name from programs where id = $1', [
      platformProgramId,
    ]);
    expect(rows[0]!.name).not.toBe('Hijacked Template');
  });

  it('will not let a gym publish or withdraw a platform template', async () => {
    const result = await setProgramPublishState(coach, platformProgramId, false);
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/managed by GymGuide/i);

    const { rows } = await owner.query<{ publish_state: string }>(
      'select publish_state from programs where id = $1',
      [platformProgramId],
    );
    expect(rows[0]!.publish_state).toBe('published');
  });

  it('copies a template into the gym as a draft, carrying its phases and days', async () => {
    const copyId = await copyForTest();
    const copy = await loadProgram(coach, copyId);

    expect(copy).not.toBeNull();
    expect(copy!.isPlatform).toBe(false);
    expect(copy!.editable).toBe(true);
    // Taking a copy is not approving it.
    expect(copy!.publishState).toBe('draft');
    expect(copy!.derivedFromName).toBeTruthy();
    expect(copy!.phases.length).toBeGreaterThan(0);
    expect(copy!.phases.some((phase) => phase.days.some((day) => day.workoutName !== null))).toBe(true);

    const original = await loadProgram(coach, platformProgramId);
    expect(copy!.phases).toHaveLength(original!.phases.length);
  });

  it('gives each copy its own code so a second copy does not collide', async () => {
    const first = await copyForTest();
    const second = await copyForTest();
    const { rows } = await owner.query<{ code: string }>(
      'select code from programs where id = any($1::uuid[])',
      [[first, second]],
    );
    expect(new Set(rows.map((row) => row.code)).size).toBe(2);
  });

  it('refuses to copy something that is already a gym program', async () => {
    const copyId = await copyForTest();
    const result = await copyProgramToGym(coach, copyId);
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/already belongs to a gym/i);
  });

  it('saves edits to a gym program and records who made them', async () => {
    const copyId = await copyForTest();
    const result = await updateProgram(coach, copyId, {
      name: 'Fat Loss — Gulberg Evenings',
      summary: 'Three evening sessions a week, adapted for the machines we actually have at Gulberg.',
      daysPerWeek: 3,
      sessionMinutes: 40,
      requiresEquipmentCodes: ['dumbbell', 'cable'],
      lowImpact: true,
      ramadanFriendly: true,
      contraindications: ['back_problem'],
    });
    expect(result.ok, result.message).toBe(true);

    const reloaded = await loadProgram(coach, copyId);
    expect(reloaded!.name).toBe('Fat Loss — Gulberg Evenings');
    expect(reloaded!.sessionMinutes).toBe(40);
    expect(reloaded!.lowImpact).toBe(true);
    expect(reloaded!.requiresEquipmentCodes).toEqual(['dumbbell', 'cable']);
    expect(reloaded!.contraindications).toEqual(['back_problem']);

    const { rows } = await owner.query<{ count: string }>(
      `select count(*) as count from audit_logs where entity_id = $1 and action = 'update'`,
      [copyId],
    );
    expect(Number(rows[0]!.count)).toBeGreaterThan(0);
  });

  it('rejects a summary too thin to be useful to a member', async () => {
    const copyId = await copyForTest();
    const result = await updateProgram(coach, copyId, {
      name: 'Something',
      summary: 'Good program',
      daysPerWeek: 3,
      sessionMinutes: 45,
      requiresEquipmentCodes: [],
      lowImpact: false,
      ramadanFriendly: false,
      contraindications: [],
    });
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/summary/i);
  });

  it('only accepts progression rules the coaching engine knows', async () => {
    const copyId = await copyForTest();
    const program = await loadProgram(coach, copyId);
    const phase = program!.phases[0]!;

    const result = await updatePhase(coach, phase.phaseId, {
      name: phase.name,
      focus: phase.focus,
      weeks: phase.weeks,
      // Not a rule the engine implements — accepting it would produce a program
      // whose weights never move and nobody would know why.
      progressionRule: 'make_it_up' as never,
      deloadAtEnd: false,
      memberSummary: '',
    });
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/progression rule/i);
  });

  it('saves a phase edit', async () => {
    const copyId = await copyForTest();
    const program = await loadProgram(coach, copyId);
    const phase = program!.phases[0]!;

    const result = await updatePhase(coach, phase.phaseId, {
      name: 'Settle in',
      focus: 'technique',
      weeks: 3,
      progressionRule: 'rep_progression',
      deloadAtEnd: true,
      memberSummary: 'Three weeks learning the lifts. Reps go up before weight does.',
    });
    expect(result.ok, result.message).toBe(true);

    const reloaded = await loadProgram(coach, copyId);
    const updated = reloaded!.phases.find((entry) => entry.phaseId === phase.phaseId)!;
    expect(updated.name).toBe('Settle in');
    expect(updated.weeks).toBe(3);
    expect(updated.progressionRule).toBe('rep_progression');
    expect(updated.deloadAtEnd).toBe(true);
  });

  it('publishes with a named approver, so “approved template” means something', async () => {
    const copyId = await copyForTest();
    const result = await setProgramPublishState(coach, copyId, true);
    expect(result.ok, result.message).toBe(true);

    const { rows } = await owner.query<{ publish_state: string; approved_by: string; version_state: string }>(
      `select p.publish_state, p.approved_by,
              (select publish_state from program_versions where program_id = p.id order by version desc limit 1) as version_state
         from programs p where p.id = $1`,
      [copyId],
    );
    expect(rows[0]!.publish_state).toBe('published');
    expect(rows[0]!.approved_by).toBe(coach.userId);
    expect(rows[0]!.version_state).toBe('published');
  });

  it('will not publish a program with nothing in it', async () => {
    const copyId = await copyForTest();
    // Strip the phases: a member matched to this would be given nothing to do.
    await owner.query(
      `delete from program_phases where program_version_id in
         (select id from program_versions where program_id = $1)`,
      [copyId],
    );

    const result = await setProgramPublishState(coach, copyId, true);
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/no phases/i);

    const { rows } = await owner.query<{ publish_state: string }>(
      'select publish_state from programs where id = $1',
      [copyId],
    );
    expect(rows[0]!.publish_state).toBe('draft');
  });

  it('withdrawing does not take the plan away from anyone already on it', async () => {
    const copyId = await copyForTest();
    expect((await setProgramPublishState(coach, copyId, true)).ok).toBe(true);

    const { rows: version } = await owner.query<{ id: string }>(
      'select id from program_versions where program_id = $1 order by version desc limit 1',
      [copyId],
    );
    // A member with no active assignment: one active program per member is a
    // constraint the schema enforces, and rightly so.
    const { rows: member } = await owner.query<{ user_id: string; branch_id: string }>(
      `select mp.user_id, mp.branch_id from member_profiles mp
        where mp.organization_id = $1
          and not exists (select 1 from program_assignments pa
                           where pa.user_id = mp.user_id and pa.state = 'active')
        limit 1`,
      [organizationId],
    );
    expect(member[0], 'no member without an active program to test with').toBeDefined();
    const { rows: assignment } = await owner.query<{ id: string }>(
      `insert into program_assignments
         (organization_id, branch_id, user_id, program_id, program_version_id, assignment_source, state, starts_on)
       values ($1, $2, $3, $4, $5, 'coach', 'active', current_date)
       returning id`,
      [organizationId, member[0]!.branch_id, member[0]!.user_id, copyId, version[0]!.id],
    );

    const result = await setProgramPublishState(coach, copyId, false);
    expect(result.ok, result.message).toBe(true);
    expect(result.message).toMatch(/keep their plan/i);

    const { rows: still } = await owner.query<{ state: string }>(
      'select state from program_assignments where id = $1',
      [assignment[0]!.id],
    );
    expect(still[0]!.state).toBe('active');

    await owner.query('delete from program_assignments where id = $1', [assignment[0]!.id]);
  });

  it('does not let front desk author programs', async () => {
    expect(frontDesk.permissions).not.toContain('content.write');

    const copy = await copyProgramToGym(frontDesk, platformProgramId);
    expect(copy.ok).toBe(false);
    expect(copy.message).toMatch(/permission/i);

    const existing = await copyForTest();
    const edit = await updateProgram(frontDesk, existing, {
      name: 'Front desk edit',
      summary: 'A summary long enough to pass the length check but written by the wrong person entirely.',
      daysPerWeek: 3,
      sessionMinutes: 45,
      requiresEquipmentCodes: [],
      lowImpact: false,
      ramadanFriendly: false,
      contraindications: [],
    });
    expect(edit.ok).toBe(false);
    expect(edit.message).toMatch(/permission/i);

    const publish = await setProgramPublishState(frontDesk, existing, true);
    expect(publish.ok).toBe(false);
    expect(publish.message).toMatch(/permission/i);
  });

  it('warns when the gym cannot equip a program it is about to publish', async () => {
    const copyId = await copyForTest();
    await updateProgram(coach, copyId, {
      name: 'Needs a machine nobody has',
      summary: 'A program that asks for a piece of equipment this gym does not own, to check the warning appears.',
      daysPerWeek: 3,
      sessionMinutes: 45,
      requiresEquipmentCodes: ['dumbbell', 'anti_gravity_treadmill'],
      lowImpact: false,
      ramadanFriendly: false,
      contraindications: [],
    });

    const program = await loadProgram(coach, copyId);
    expect(program!.missingEquipment).toEqual(['anti_gravity_treadmill']);
  });
});
