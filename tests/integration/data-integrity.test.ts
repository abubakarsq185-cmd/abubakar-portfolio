import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Client } from 'pg';
import {
  AUDIT_ACTIONS,
  CONSENT_KINDS,
  LEDGER_ACCOUNTS,
  PERMISSIONS,
  RISK_KINDS,
  ROLE_CODES,
  ROLE_PERMISSIONS,
  TRAINING_GOALS,
} from '@gymguide/types';
import { ownerClient } from './helpers';

/**
 * These tests guard the contracts that are easy to break silently: the RBAC
 * matrix drifting between code and database, an enum added in one place only,
 * and the financial ledger going out of balance.
 */
describe('data integrity', () => {
  let owner: Client;

  beforeAll(async () => {
    owner = await ownerClient();
  });

  afterAll(async () => {
    await owner?.end();
  });

  describe('RBAC matrix', () => {
    it('every permission in code exists in the database', async () => {
      const { rows } = await owner.query<{ key: string }>('select key::text as key from permissions');
      const inDatabase = new Set(rows.map((row) => row.key));
      const missing = PERMISSIONS.filter((permission) => !inDatabase.has(permission));
      expect(missing).toEqual([]);
    });

    it('every permission in the database exists in code', async () => {
      const { rows } = await owner.query<{ key: string }>('select key::text as key from permissions');
      const inCode = new Set<string>(PERMISSIONS);
      const extra = rows.map((row) => row.key).filter((key) => !inCode.has(key));
      expect(extra).toEqual([]);
    });

    it('the role → permission matrix matches the database exactly', async () => {
      const { rows } = await owner.query<{ role: string; key: string }>(
        `select r.code::text as role, p.key::text as key
           from role_permissions rp
           join roles r on r.id = rp.role_id
           join permissions p on p.id = rp.permission_id`,
      );

      const fromDatabase = new Map<string, Set<string>>();
      for (const row of rows) {
        if (!fromDatabase.has(row.role)) fromDatabase.set(row.role, new Set());
        fromDatabase.get(row.role)!.add(row.key);
      }

      for (const role of ROLE_CODES) {
        const expected = [...(ROLE_PERMISSIONS[role] ?? [])].sort();
        const actual = [...(fromDatabase.get(role) ?? new Set<string>())].sort();
        expect({ role, permissions: actual }).toEqual({ role, permissions: expected });
      }
    });

    it('front desk holds no health, nutrition or restricted-note permission', async () => {
      const frontDesk = new Set(ROLE_PERMISSIONS.front_desk);
      for (const forbidden of ['health.read', 'health.write', 'nutrition.read', 'notes.restricted.read', 'progress_photos.read']) {
        expect(frontDesk.has(forbidden as never)).toBe(false);
      }
    });

    it('coaches hold no financial permission by default', async () => {
      const coach = new Set(ROLE_PERMISSIONS.coach);
      for (const forbidden of ['finance.read', 'finance.write', 'finance.refund', 'ledger.read', 'reports.financial']) {
        expect(coach.has(forbidden as never)).toBe(false);
      }
    });
  });

  describe('enum parity', () => {
    const cases: Array<[string, readonly string[]]> = [
      ['role_code', ROLE_CODES],
      ['training_goal', TRAINING_GOALS],
      ['ledger_account', LEDGER_ACCOUNTS],
      ['risk_kind', RISK_KINDS],
      ['consent_kind', CONSENT_KINDS],
      ['audit_action', AUDIT_ACTIONS],
    ];

    it.each(cases)('%s matches the TypeScript union', async (typeName, values) => {
      const { rows } = await owner.query<{ label: string }>(
        `select e.enumlabel as label
           from pg_enum e join pg_type t on t.oid = e.enumtypid
          where t.typname = $1
          order by e.enumsortorder`,
        [typeName],
      );
      expect(rows.map((row) => row.label).sort()).toEqual([...values].sort());
    });
  });

  describe('financial ledger', () => {
    it('balances: total debits equal total credits', async () => {
      const { rows } = await owner.query<{ debits: string; credits: string }>(
        `select coalesce(sum(amount_minor) filter (where direction = 'debit'), 0) as debits,
                coalesce(sum(amount_minor) filter (where direction = 'credit'), 0) as credits
           from ledger_entries`,
      );
      expect(rows[0]!.debits).toBe(rows[0]!.credits);
    });

    it('balances within every entry group', async () => {
      const { rows } = await owner.query<{ entry_group: string; difference: string }>(
        `select entry_group,
                sum(case when direction = 'debit' then amount_minor else -amount_minor end)::text as difference
           from ledger_entries
          group by entry_group
         having sum(case when direction = 'debit' then amount_minor else -amount_minor end) <> 0`,
      );
      expect(rows).toEqual([]);
    });

    it('never records a zero or negative posting', async () => {
      const { rows } = await owner.query('select id from ledger_entries where amount_minor <= 0');
      expect(rows).toHaveLength(0);
    });

    it('invoice state always agrees with the amounts on the invoice', async () => {
      const { rows } = await owner.query<{ number: string; state: string; total: string; paid: string }>(
        `select number, state::text as state, total_minor::text as total, amount_paid_minor::text as paid
           from invoices
          where voided_at is null
            and (
              (amount_paid_minor >= total_minor and state not in ('paid','refunded'))
              or (amount_paid_minor = 0 and state not in ('open','uncollectible','draft'))
            )`,
      );
      expect(rows).toEqual([]);
    });

    it('every succeeded payment that is applied to an invoice has ledger entries', async () => {
      const { rows } = await owner.query<{ reference: string }>(
        `select p.reference from payments p
          where p.state = 'succeeded'
            and not exists (select 1 from ledger_entries le where le.payment_id = p.id)`,
      );
      expect(rows).toEqual([]);
    });

    it('no refund exceeds the payment it belongs to', async () => {
      const { rows } = await owner.query<{ payment_id: string }>(
        `select p.id as payment_id
           from payments p
           join refunds r on r.payment_id = p.id
          group by p.id, p.amount_minor
         having sum(r.amount_minor) > p.amount_minor`,
      );
      expect(rows).toEqual([]);
    });
  });

  describe('seeded demo tenant', () => {
    /**
     * Asserts the seed produced its cast, not that nobody has since joined.
     * The earlier version demanded exactly sixteen members and failed the moment
     * anyone enrolled someone through the interface — a test that breaks because
     * the product was used is measuring the wrong thing.
     */
    it('has both branches, every staff role and its full member cast', async () => {
      const { rows } = await owner.query<{ branches: string; members: string; roles: string }>(
        `select
           (select count(*) from branches b join organizations o on o.id = b.organization_id
             where o.slug = 'apex-fitness-lahore') as branches,
           (select count(*) from member_profiles mp join organizations o on o.id = mp.organization_id
             where o.slug = 'apex-fitness-lahore') as members,
           (select count(distinct r.code) from user_roles ur
              join roles r on r.id = ur.role_id
              join users u on u.id = ur.user_id
              join organizations o on o.id = u.organization_id
             where o.slug = 'apex-fitness-lahore') as roles`,
      );
      expect(Number(rows[0]!.branches)).toBe(2);
      expect(Number(rows[0]!.members)).toBeGreaterThanOrEqual(16);
      expect(Number(rows[0]!.roles)).toBeGreaterThanOrEqual(7);

      // The named members the documentation points at must all be there.
      const { rows: cast } = await owner.query<{ email: string }>(
        `select u.email from users u
           join member_profiles mp on mp.user_id = u.id
          where u.email = any($1::citext[])`,
        [[
          'ayesha.khan@example.com',
          'bilal.ahmed@example.com',
          'ahmed.nawaz@example.com',
          'hamza.raza@example.com',
          'maryam.javed@example.com',
          'nida.aslam@example.com',
          'fatima.sheikh@example.com',
        ]],
      );
      expect(cast).toHaveLength(7);
    });

    it('has training history with logged sets', async () => {
      const { rows } = await owner.query<{ sessions: string; sets: string }>(
        `select (select count(*) from workout_sessions) as sessions,
                (select count(*) from set_logs) as sets`,
      );
      expect(Number(rows[0]!.sessions)).toBeGreaterThan(200);
      expect(Number(rows[0]!.sets)).toBeGreaterThan(1000);
    });

    it('has an open health escalation with progression paused', async () => {
      const { rows } = await owner.query<{ count: string }>(
        `select count(*) as count
           from risk_flags rf
           join member_profiles mp on mp.user_id = rf.user_id
          where rf.resolved_at is null and rf.blocks_progression
            and mp.progression_hold_reason is not null`,
      );
      expect(Number(rows[0]!.count)).toBeGreaterThan(0);
    });

    it('never stores a plaintext password', async () => {
      const { rows } = await owner.query<{ count: string }>(
        `select count(*) as count from users
          where password_hash is not null and password_hash not like 'scrypt$%'`,
      );
      expect(Number(rows[0]!.count)).toBe(0);
    });
  });

  describe('schema safety net', () => {
    it('every tenant table has row-level security enabled', async () => {
      const { rows } = await owner.query<{ tablename: string }>(
        `select tablename from pg_tables
          where schemaname = 'public' and not rowsecurity and tablename <> 'schema_migrations'`,
      );
      expect(rows.map((row) => row.tablename)).toEqual([]);
    });

    it('every reporting view runs with the caller’s permissions, not the owner’s', async () => {
      const { rows } = await owner.query<{ viewname: string }>(
        `select c.relname as viewname
           from pg_class c
           join pg_namespace n on n.oid = c.relnamespace
          where n.nspname = 'public' and c.relkind = 'v'
            and not coalesce((select option_value::boolean from pg_options_to_table(c.reloptions)
                               where option_name = 'security_invoker'), false)`,
      );
      expect(rows.map((row) => row.viewname)).toEqual([]);
    });
  });
});
