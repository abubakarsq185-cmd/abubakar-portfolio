import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Client } from 'pg';
import { actorFor, appClient, asActor, createRivalTenant, ownerClient, userIdFor, type ActorContext } from './helpers';

/**
 * Tenant isolation, proven rather than assumed.
 *
 * Every query here runs as `gymguide_app` — a role without BYPASSRLS — with the
 * same session GUCs the application sets. If row-level security regresses, these
 * tests fail.
 */
describe('row-level security', () => {
  let owner: Client;
  let app: Client;
  let rival: Awaited<ReturnType<typeof createRivalTenant>>;

  let apexOwner: ActorContext;
  let coach: ActorContext;
  let frontDesk: ActorContext;
  let member: ActorContext;
  let otherMember: ActorContext;
  let nutritionist: ActorContext;
  let branchManager: ActorContext;

  beforeAll(async () => {
    owner = await ownerClient();
    app = await appClient();
    rival = await createRivalTenant(owner);

    apexOwner = await actorFor(owner, 'owner@apexfitness.pk');
    coach = await actorFor(owner, 'coach@apexfitness.pk');
    frontDesk = await actorFor(owner, 'frontdesk@apexfitness.pk');
    member = await actorFor(owner, 'ayesha.khan@example.com');
    otherMember = await actorFor(owner, 'bilal.ahmed@example.com');
    nutritionist = await actorFor(owner, 'nutrition@apexfitness.pk');
    branchManager = await actorFor(owner, 'manager.dha@apexfitness.pk');
  }, 30_000);

  afterAll(async () => {
    await rival?.cleanup();
    await app?.end();
    await owner?.end();
  });

  describe('cross-organization', () => {
    it('an owner cannot see another gym’s members', async () => {
      const rows = await asActor(app, apexOwner, async (db) => {
        const result = await db.query('select id from member_profiles where user_id = $1', [rival.memberUserId]);
        return result.rows;
      });
      expect(rows).toHaveLength(0);
    });

    it('an owner cannot see another gym’s branches, invoices or payments', async () => {
      const counts = await asActor(app, apexOwner, async (db) => {
        const branches = await db.query('select id from branches where organization_id = $1', [rival.organizationId]);
        const invoices = await db.query('select id from invoices where organization_id = $1', [rival.organizationId]);
        const payments = await db.query('select id from payments where organization_id = $1', [rival.organizationId]);
        return [branches.rowCount, invoices.rowCount, payments.rowCount];
      });
      expect(counts).toEqual([0, 0, 0]);
    });

    it('an owner cannot read another gym’s health screenings', async () => {
      const rows = await asActor(app, apexOwner, async (db) => {
        const result = await db.query('select id from health_screenings where user_id = $1', [rival.memberUserId]);
        return result.rows;
      });
      expect(rows).toHaveLength(0);
    });

    it('an owner cannot write a row into another organization', async () => {
      await expect(
        asActor(app, apexOwner, async (db) => {
          await db.query(
            `insert into notes (organization_id, entity_type, entity_id, body, visibility)
             values ($1, 'member', $2, 'injected', 'staff')`,
            [rival.organizationId, rival.memberUserId],
          );
        }),
      ).rejects.toThrow(/row-level security|violates/i);
    });

    it('an owner cannot update another organization’s record', async () => {
      const updated = await asActor(app, apexOwner, async (db) => {
        const result = await db.query('update branches set name = $1 where id = $2', ['Hijacked', rival.branchId]);
        return result.rowCount;
      });
      expect(updated).toBe(0);

      const { rows } = await owner.query<{ name: string }>('select name from branches where id = $1', [rival.branchId]);
      expect(rows[0]?.name).toBe('Rival Main');
    });

    it('the rival owner cannot see Apex members either — isolation cuts both ways', async () => {
      const rivalActor: ActorContext = {
        userId: rival.ownerUserId,
        organizationId: rival.organizationId,
        role: 'gym_owner',
        branchIds: [],
        permissions: ['members.read.all', 'finance.read', 'health.read'],
        isPlatformAdmin: false,
      };
      const count = await asActor(app, rivalActor, async (db) => {
        const result = await db.query('select count(*)::int as count from member_profiles');
        return (result.rows[0] as { count: number }).count;
      });
      expect(count).toBe(1); // only their own seeded member
    });
  });

  describe('members', () => {
    it('a member sees only their own workout sessions', async () => {
      const rows = await asActor(app, member, async (db) => {
        const result = await db.query<{ user_id: string }>('select distinct user_id from workout_sessions');
        return result.rows;
      });
      expect(rows.length).toBeGreaterThan(0);
      expect(rows.every((row) => row.user_id === member.userId)).toBe(true);
    });

    it('a member cannot read another member’s invoices', async () => {
      const rows = await asActor(app, member, async (db) => {
        const result = await db.query('select id from invoices where user_id = $1', [otherMember.userId]);
        return result.rows;
      });
      expect(rows).toHaveLength(0);
    });

    it('a member cannot read another member’s health screening', async () => {
      const rows = await asActor(app, member, async (db) => {
        const result = await db.query('select id from health_screenings where user_id = $1', [otherMember.userId]);
        return result.rows;
      });
      expect(rows).toHaveLength(0);
    });

    it('a member can read their own health screening', async () => {
      const rows = await asActor(app, member, async (db) => {
        const result = await db.query('select id from health_screenings where user_id = $1', [member.userId]);
        return result.rows;
      });
      expect(rows.length).toBeGreaterThan(0);
    });

    it('a member cannot see the whole member directory', async () => {
      const count = await asActor(app, member, async (db) => {
        const result = await db.query('select count(*)::int as count from member_profiles');
        return (result.rows[0] as { count: number }).count;
      });
      expect(count).toBe(1);
    });
  });

  describe('staff permissions', () => {
    it('front desk cannot read health screenings', async () => {
      expect(frontDesk.permissions).not.toContain('health.read');
      const rows = await asActor(app, frontDesk, async (db) => {
        const result = await db.query('select id from health_screenings');
        return result.rows;
      });
      expect(rows).toHaveLength(0);
    });

    it('front desk cannot read restricted or coach-only notes', async () => {
      const visibilities = await asActor(app, frontDesk, async (db) => {
        const result = await db.query<{ visibility: string }>('select distinct visibility from notes');
        return result.rows.map((row) => row.visibility);
      });
      expect(visibilities).not.toContain('coach_only');
      expect(visibilities).not.toContain('restricted');
    });

    it('front desk cannot read nutrition targets', async () => {
      const rows = await asActor(app, frontDesk, async (db) => {
        const result = await db.query('select id from nutrition_targets');
        return result.rows;
      });
      expect(rows).toHaveLength(0);
    });

    it('a coach has no financial visibility by default', async () => {
      expect(coach.permissions).not.toContain('finance.read');
      const rows = await asActor(app, { ...coach, permissions: coach.permissions }, async (db) => {
        const result = await db.query('select id from ledger_entries');
        return result.rows;
      });
      expect(rows).toHaveLength(0);
    });

    it('a coach only sees members assigned to them', async () => {
      const rows = await asActor(app, coach, async (db) => {
        const result = await db.query<{ assigned_coach_id: string | null }>(
          'select assigned_coach_id from member_profiles',
        );
        return result.rows;
      });
      expect(rows.length).toBeGreaterThan(0);
      expect(rows.every((row) => row.assigned_coach_id === coach.userId)).toBe(true);
    });

    it('a branch manager sees only their branch', async () => {
      expect(branchManager.branchIds.length).toBe(1);
      const rows = await asActor(app, branchManager, async (db) => {
        const result = await db.query<{ branch_id: string }>('select distinct branch_id from member_profiles');
        return result.rows;
      });
      expect(rows.every((row) => branchManager.branchIds.includes(row.branch_id))).toBe(true);
    });

    it('a nutrition professional sees nutrition data but no money', async () => {
      const nutrition = await asActor(app, nutritionist, async (db) => {
        const result = await db.query('select id from nutrition_targets');
        return result.rowCount;
      });
      const ledger = await asActor(app, nutritionist, async (db) => {
        const result = await db.query('select id from ledger_entries');
        return result.rowCount;
      });
      expect(nutrition).toBeGreaterThan(0);
      expect(ledger).toBe(0);
    });

    it('progress photos stay private unless the member shared them', async () => {
      const memberUserId = await userIdFor(owner, 'ayesha.khan@example.com');
      await owner.query(
        `insert into progress_photos (organization_id, user_id, storage_key, shared_with_coach)
         select organization_id, $1, 'private/test.jpg', false from member_profiles where user_id = $1`,
        [memberUserId],
      );

      const coachSees = await asActor(app, coach, async (db) => {
        const result = await db.query("select id from progress_photos where storage_key = 'private/test.jpg'");
        return result.rowCount;
      });
      const memberSees = await asActor(app, member, async (db) => {
        const result = await db.query("select id from progress_photos where storage_key = 'private/test.jpg'");
        return result.rowCount;
      });

      await owner.query("delete from progress_photos where storage_key = 'private/test.jpg'");

      expect(coachSees).toBe(0);
      expect(memberSees).toBe(1);
    });
  });

  describe('unauthenticated access', () => {
    it('sees nothing at all when no session GUCs are set', async () => {
      await app.query('begin');
      try {
        // Deliberately no set_config calls.
        const members = await app.query('select id from member_profiles');
        const invoices = await app.query('select id from invoices');
        const health = await app.query('select id from health_screenings');
        expect(members.rowCount).toBe(0);
        expect(invoices.rowCount).toBe(0);
        expect(health.rowCount).toBe(0);
      } finally {
        await app.query('rollback');
      }
    });
  });

  describe('append-only guarantees', () => {
    it('the application role cannot update or delete audit records', async () => {
      await expect(
        asActor(app, apexOwner, (db) => db.query('update audit_logs set summary = $1 where id > 0', ['tampered'])),
      ).rejects.toThrow(/permission denied|append-only/i);

      await expect(
        asActor(app, apexOwner, (db) => db.query('delete from audit_logs where id > 0')),
      ).rejects.toThrow(/permission denied|append-only/i);
    });

    it('the ledger cannot be rewritten, even by the owner of the database', async () => {
      // Prove a row exists first: a statement that matches nothing never fires a
      // row-level trigger, so an empty table would make this pass for the wrong
      // reason.
      const { rows } = await owner.query<{ count: number }>('select count(*)::int as count from ledger_entries');
      expect(rows[0]!.count).toBeGreaterThan(0);

      await expect(owner.query('update ledger_entries set amount_minor = 1 where id > 0')).rejects.toThrow(
        /append-only/i,
      );
    });

    it('consent history cannot be rewritten by anyone', async () => {
      // Self-contained: insert the row we are about to attack, so the assertion
      // cannot silently pass on an empty table.
      const { rows } = await owner.query<{ id: string }>(
        `insert into consents (organization_id, user_id, kind, granted, version, collected_channel, granted_at)
         select organization_id, user_id, 'marketing_email', true, 'test', 'front_desk', now()
           from member_profiles where user_id = $1
         returning id`,
        [member.userId],
      );
      const consentId = rows[0]!.id;

      try {
        await expect(
          owner.query('update consents set granted = false where id = $1', [consentId]),
        ).rejects.toThrow(/append-only/i);
      } finally {
        // The database owner may delete; only the application role may not.
        await owner.query('delete from consents where id = $1', [consentId]);
      }
    });

    it('the application can never delete consent, but a privileged erasure job can', async () => {
      // Immutability and deletion rights are separate concerns. The trigger makes
      // content unrewritable for everyone; revoked privileges stop the app from
      // deleting, while leaving an erasure request able to remove a person.
      await expect(
        asActor(app, apexOwner, (db) => db.query('delete from consents where id is not null')),
      ).rejects.toThrow(/permission denied/i);

      const { rows } = await owner.query<{ has_delete: boolean }>(
        `select has_table_privilege('gymguide_app', 'consents', 'DELETE') as has_delete`,
      );
      expect(rows[0]!.has_delete).toBe(false);
    });
  });
});
