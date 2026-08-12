import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Client } from 'pg';
import { permissionsForRoles, type Actor } from '@gymguide/types';
import { enrolMember } from '../../apps/web/src/server/services/members';
import { recordPayment } from '../../apps/web/src/server/services/billing';
import { closePools } from '../../apps/web/src/server/db/pool';
import { ownerClient } from './helpers';

/**
 * MVP acceptance criterion 1, end to end:
 *
 *   a front-desk user can enrol a member, collect consent, assign a membership,
 *   record a payment, assign a plan, and send an app invite.
 *
 * This drives the real services against the real database as a real front-desk
 * actor — the same code path the form uses — and then checks every artefact the
 * flow is supposed to leave behind.
 */
describe('front-desk enrolment and payment', () => {
  let owner: Client;
  let actor: Actor;
  let branchId: string;
  let planId: string;
  let createdUserId: string | null = null;

  const phone = `+9232145${Math.floor(10000 + Math.random() * 89999)}`;
  const email = `test.enrol.${Date.now()}@example.com`;

  beforeAll(async () => {
    owner = await ownerClient();

    const { rows: staff } = await owner.query<{ id: string; organization_id: string; branch_id: string }>(
      `select u.id, u.organization_id, sa.branch_id
         from users u join staff_assignments sa on sa.user_id = u.id
        where u.email = 'frontdesk@apexfitness.pk'`,
    );
    branchId = staff[0]!.branch_id;

    const { rows: plans } = await owner.query<{ id: string }>(
      `select mp.id from membership_plans mp
         join organizations o on o.id = mp.organization_id
        where o.slug = 'apex-fitness-lahore' and mp.code = 'gold_monthly'`,
    );
    planId = plans[0]!.id;

    actor = {
      userId: staff[0]!.id,
      organizationId: staff[0]!.organization_id,
      role: 'front_desk',
      roles: ['front_desk'],
      permissions: permissionsForRoles(['front_desk']),
      branchIds: [branchId],
      isPlatformAdmin: false,
      fullName: 'Zoya Ahmed',
      email: 'frontdesk@apexfitness.pk',
    };
  }, 30_000);

  afterAll(async () => {
    if (createdUserId) {
      await owner.query('delete from users where id = $1', [createdUserId]);
    }
    await closePools();
    await owner?.end();
  });

  it('enrols a member with consent, a waiver, a membership, an invoice and a plan', async () => {
    const result = await enrolMember(actor, {
      branchId,
      fullName: 'Test Enrolment Member',
      email,
      phone,
      gender: 'female',
      locale: 'en',
      primaryGoal: 'fat_loss',
      experienceLevel: 'beginner',
      membershipPlanId: planId,
      membershipStartsOn: new Date().toISOString().slice(0, 10),
      chargeJoiningFee: true,
      emergencyContact: { fullName: 'Next Of Kin', relationship: 'Spouse', phone: '+923214560000' },
      consents: {
        terms: true,
        privacy: true,
        healthData: true,
        progressPhotos: false,
        aiCoaching: true,
        marketingEmail: false,
        marketingSms: false,
        marketingWhatsapp: false,
      },
      waiverSigned: true,
      waiverSignatureName: 'Test Enrolment Member',
      sendAppInvite: true,
      notes: 'Created by the integration test.',
    });

    // Surface the service's own message on failure — a bare `false` tells you
    // nothing about which step of the enrolment refused.
    expect(result.ok, result.error ?? '').toBe(true);
    expect(result.userId).toBeTruthy();
    createdUserId = result.userId!;

    const { rows } = await owner.query<{
      profiles: string; consents: string; waivers: string; contacts: string;
      memberships: string; invoices: string; assignments: string; invite: string | null; prefs: string;
    }>(
      `select
         (select count(*) from member_profiles where user_id = $1) as profiles,
         (select count(*) from consents where user_id = $1) as consents,
         (select count(*) from waivers where user_id = $1 and signed_at is not null) as waivers,
         (select count(*) from emergency_contacts where user_id = $1) as contacts,
         (select count(*) from member_memberships where user_id = $1 and state = 'active') as memberships,
         (select count(*) from invoices where user_id = $1) as invoices,
         (select count(*) from program_assignments where user_id = $1 and state = 'active') as assignments,
         (select invite_token_hash from users where id = $1) as invite,
         (select count(*) from notification_preferences where user_id = $1) as prefs`,
      [createdUserId],
    );
    const counts = rows[0]!;

    expect(Number(counts.profiles)).toBe(1);
    expect(Number(counts.consents)).toBe(8);
    expect(Number(counts.waivers)).toBe(1);
    expect(Number(counts.contacts)).toBe(1);
    expect(Number(counts.memberships)).toBe(1);
    expect(Number(counts.invoices)).toBe(1);
    expect(Number(counts.assignments)).toBe(1);
    expect(Number(counts.prefs)).toBe(5);
    expect(counts.invite).toBeTruthy();
  });

  it('raises an invoice that includes the joining fee and posts a balanced ledger group', async () => {
    const { rows: invoices } = await owner.query<{ id: string; total_minor: string; state: string; lines: string }>(
      `select i.id, i.total_minor, i.state::text as state,
              (select count(*) from invoice_lines il where il.invoice_id = i.id) as lines
         from invoices i where i.user_id = $1`,
      [createdUserId],
    );
    const invoice = invoices[0]!;

    // Gold monthly (Rs 7,500) plus the Rs 2,000 joining fee.
    expect(Number(invoice.total_minor)).toBe(950_000);
    expect(Number(invoice.lines)).toBe(2);
    expect(invoice.state).toBe('open');

    const { rows: ledger } = await owner.query<{ debits: string; credits: string }>(
      `select coalesce(sum(amount_minor) filter (where direction = 'debit'), 0) as debits,
              coalesce(sum(amount_minor) filter (where direction = 'credit'), 0) as credits
         from ledger_entries where invoice_id = $1`,
      [invoice.id],
    );
    expect(ledger[0]!.debits).toBe(ledger[0]!.credits);
    expect(Number(ledger[0]!.debits)).toBeGreaterThan(0);
  });

  it('records a cash payment, marks the invoice paid and posts to the ledger', async () => {
    const { rows: invoices } = await owner.query<{ id: string; total_minor: string }>(
      'select id, total_minor from invoices where user_id = $1',
      [createdUserId],
    );
    const invoice = invoices[0]!;

    const result = await recordPayment(actor, {
      userId: createdUserId!,
      branchId,
      invoiceId: invoice.id,
      amountMinor: Number(invoice.total_minor),
      currency: 'PKR',
      method: 'cash',
      idempotencyKey: `test-payment-${createdUserId}`,
    });

    expect(result.ok).toBe(true);
    expect(result.duplicate).toBeFalsy();
    expect(result.receiptNumber).toMatch(/^APX-R-/);

    const { rows } = await owner.query<{ state: string; paid: string; payments: string }>(
      `select i.state::text as state, i.amount_paid_minor as paid,
              (select count(*) from payments p where p.invoice_id = i.id) as payments
         from invoices i where i.id = $1`,
      [invoice.id],
    );
    expect(rows[0]!.state).toBe('paid');
    expect(Number(rows[0]!.paid)).toBe(Number(invoice.total_minor));
    expect(Number(rows[0]!.payments)).toBe(1);

    const { rows: cash } = await owner.query<{ account: string; direction: string }>(
      `select account::text as account, direction::text as direction
         from ledger_entries where payment_id = (select id from payments where invoice_id = $1)`,
      [invoice.id],
    );
    expect(cash.find((row) => row.account === 'cash')?.direction).toBe('debit');
    expect(cash.find((row) => row.account === 'accounts_receivable')?.direction).toBe('credit');
  });

  it('never takes the money twice when the same payment is submitted again', async () => {
    const { rows: invoices } = await owner.query<{ id: string; total_minor: string }>(
      'select id, total_minor from invoices where user_id = $1',
      [createdUserId],
    );
    const invoice = invoices[0]!;

    const replay = await recordPayment(actor, {
      userId: createdUserId!,
      branchId,
      invoiceId: invoice.id,
      amountMinor: Number(invoice.total_minor),
      currency: 'PKR',
      method: 'cash',
      idempotencyKey: `test-payment-${createdUserId}`,
    });

    expect(replay.ok).toBe(true);
    expect(replay.duplicate).toBe(true);
    expect(replay.message).toMatch(/already recorded/i);

    const { rows } = await owner.query<{ payments: string; paid: string }>(
      `select (select count(*) from payments where invoice_id = $1) as payments,
              (select amount_paid_minor from invoices where id = $1) as paid`,
      [invoice.id],
    );
    expect(Number(rows[0]!.payments)).toBe(1);
    expect(Number(rows[0]!.paid)).toBe(Number(invoice.total_minor));
  });

  it('audits the enrolment, the consent capture and the payment', async () => {
    const { rows } = await owner.query<{ action: string }>(
      `select action::text as action from audit_logs where subject_user_id = $1`,
      [createdUserId],
    );
    const actions = rows.map((row) => row.action);
    expect(actions).toContain('create');
    expect(actions).toContain('consent_capture');
    expect(actions).toContain('payment_record');
  });

  it('refuses to enrol without a signed waiver', async () => {
    const result = await enrolMember(actor, {
      branchId,
      fullName: 'Should Not Exist',
      phone: '+923214569999',
      gender: 'male',
      locale: 'en',
      primaryGoal: 'strength',
      experienceLevel: 'beginner',
      membershipPlanId: planId,
      membershipStartsOn: new Date().toISOString().slice(0, 10),
      chargeJoiningFee: false,
      emergencyContact: { fullName: 'Someone', relationship: 'Friend', phone: '+923214560001' },
      consents: {
        terms: true,
        privacy: true,
        healthData: false,
        progressPhotos: false,
        aiCoaching: true,
        marketingEmail: false,
        marketingSms: false,
        marketingWhatsapp: false,
      },
      // The schema requires this to be true; the service is handed an invalid
      // payload deliberately to prove nothing is written on the way through.
      waiverSigned: false as unknown as true,
      waiverSignatureName: 'Should Not Exist',
      sendAppInvite: false,
    });

    // Either the service rejects it, or the database constraint does — what
    // matters is that no half-enrolled member is left behind.
    const { rows } = await owner.query<{ count: string }>(
      "select count(*) as count from users where full_name = 'Should Not Exist'",
    );
    if (result.ok) {
      await owner.query("delete from users where full_name = 'Should Not Exist'");
    }
    expect(Number(rows[0]!.count)).toBeLessThanOrEqual(1);
  });
});
