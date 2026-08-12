/**
 * The permission catalogue and role matrix, mirrored from
 * db/migrations/0010_rbac_reference.sql.
 *
 * The database is the enforcement point (RLS reads the actor's permission list
 * from a session GUC). This module is what the API and UI use to decide what to
 * offer, and it is verified against the database by
 * tests/integration/rbac-matrix.test.ts.
 */
import type { RoleCode } from './enums';

export const PERMISSIONS = [
  'organization.settings.write',
  'branches.write',
  'staff.read',
  'staff.write',
  'staff.roles.write',
  'audit.read',
  'integrations.read',
  'integrations.write',
  'platform_billing.read',
  'leads.read',
  'leads.write',
  'members.read.all',
  'members.read.assigned',
  'members.write',
  'members.export',
  'consent.collect',
  'notes.write',
  'notes.coach.read',
  'notes.restricted.read',
  'tasks.write',
  'health.read',
  'health.write',
  'progress_photos.read',
  'escalations.manage',
  'finance.read',
  'finance.write',
  'finance.refund',
  'plans.write',
  'memberships.write',
  'ledger.read',
  'content.write',
  'programs.assign',
  'programs.override',
  'checkins.review',
  'nutrition.read',
  'nutrition.write',
  'classes.write',
  'bookings.write',
  'attendance.write',
  'equipment.write',
  'automations.write',
  'messaging.read',
  'messaging.write',
  'support.read',
  'support.write',
  'ai.logs.read',
  'reports.read',
  'reports.financial',
  'reports.export',
  'member.self',
  'family.billing.manage',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

/** Permissions that gate health, money or private notes. Never default-granted. */
export const SENSITIVE_PERMISSIONS: readonly Permission[] = [
  'staff.roles.write',
  'audit.read',
  'integrations.write',
  'members.export',
  'notes.coach.read',
  'notes.restricted.read',
  'health.read',
  'health.write',
  'progress_photos.read',
  'escalations.manage',
  'finance.read',
  'finance.write',
  'finance.refund',
  'ledger.read',
  'programs.override',
  'nutrition.read',
  'nutrition.write',
  'ai.logs.read',
  'reports.financial',
];

const OWNER_PERMISSIONS: readonly Permission[] = [
  'organization.settings.write',
  'branches.write',
  'staff.read',
  'staff.write',
  'staff.roles.write',
  'audit.read',
  'integrations.read',
  'integrations.write',
  'platform_billing.read',
  'leads.read',
  'leads.write',
  'members.read.all',
  'members.write',
  'members.export',
  'consent.collect',
  'notes.write',
  'notes.coach.read',
  'notes.restricted.read',
  'tasks.write',
  'health.read',
  'health.write',
  'progress_photos.read',
  'escalations.manage',
  'finance.read',
  'finance.write',
  'finance.refund',
  'plans.write',
  'memberships.write',
  'ledger.read',
  'content.write',
  'programs.assign',
  'programs.override',
  'checkins.review',
  'nutrition.read',
  'nutrition.write',
  'classes.write',
  'bookings.write',
  'attendance.write',
  'equipment.write',
  'automations.write',
  'messaging.read',
  'messaging.write',
  'support.read',
  'support.write',
  'ai.logs.read',
  'reports.read',
  'reports.financial',
  'reports.export',
];

const BRANCH_MANAGER_PERMISSIONS: readonly Permission[] = [
  'staff.read',
  'staff.write',
  'audit.read',
  'integrations.read',
  'leads.read',
  'leads.write',
  'members.read.all',
  'members.write',
  'members.export',
  'consent.collect',
  'notes.write',
  'notes.coach.read',
  'notes.restricted.read',
  'tasks.write',
  'health.read',
  'health.write',
  'escalations.manage',
  'finance.read',
  'finance.write',
  'memberships.write',
  'ledger.read',
  'content.write',
  'programs.assign',
  'checkins.review',
  'classes.write',
  'bookings.write',
  'attendance.write',
  'equipment.write',
  'automations.write',
  'messaging.read',
  'messaging.write',
  'support.read',
  'support.write',
  'reports.read',
  'reports.financial',
  'reports.export',
];

/** Coaches deliberately hold no finance permission. Grant per user if needed. */
const COACH_PERMISSIONS: readonly Permission[] = [
  'members.read.assigned',
  'notes.write',
  'notes.coach.read',
  'tasks.write',
  'health.read',
  'health.write',
  'progress_photos.read',
  'escalations.manage',
  'content.write',
  'programs.assign',
  'programs.override',
  'checkins.review',
  'nutrition.read',
  'bookings.write',
  'attendance.write',
  'messaging.read',
  'messaging.write',
  'support.read',
  'support.write',
  'reports.read',
];

/** Front desk: no health, no restricted notes, no nutrition, no photos. */
const FRONT_DESK_PERMISSIONS: readonly Permission[] = [
  'leads.read',
  'leads.write',
  'members.read.all',
  'members.write',
  'consent.collect',
  'notes.write',
  'tasks.write',
  'finance.read',
  'finance.write',
  'memberships.write',
  'bookings.write',
  'attendance.write',
  'messaging.read',
  'messaging.write',
  'support.read',
  'reports.read',
];

const NUTRITION_PERMISSIONS: readonly Permission[] = [
  'members.read.assigned',
  'notes.write',
  'tasks.write',
  'health.read',
  'nutrition.read',
  'nutrition.write',
  'checkins.review',
  'messaging.read',
  'messaging.write',
  'support.read',
  'support.write',
];

export const ROLE_PERMISSIONS: Record<RoleCode, readonly Permission[]> = {
  platform_super_admin: PERMISSIONS,
  gym_owner: OWNER_PERMISSIONS,
  branch_manager: BRANCH_MANAGER_PERMISSIONS,
  coach: COACH_PERMISSIONS,
  front_desk: FRONT_DESK_PERMISSIONS,
  nutrition_professional: NUTRITION_PERMISSIONS,
  member: ['member.self'],
  guardian: ['member.self', 'family.billing.manage'],
};

export interface PermissionDescriptor {
  key: Permission;
  module: string;
  label: string;
  sensitive: boolean;
}

export const PERMISSION_MODULES: Record<Permission, string> = {
  'organization.settings.write': 'organization',
  'branches.write': 'organization',
  'staff.read': 'staff',
  'staff.write': 'staff',
  'staff.roles.write': 'staff',
  'audit.read': 'security',
  'integrations.read': 'integrations',
  'integrations.write': 'integrations',
  'platform_billing.read': 'billing',
  'leads.read': 'crm',
  'leads.write': 'crm',
  'members.read.all': 'members',
  'members.read.assigned': 'members',
  'members.write': 'members',
  'members.export': 'members',
  'consent.collect': 'members',
  'notes.write': 'members',
  'notes.coach.read': 'members',
  'notes.restricted.read': 'members',
  'tasks.write': 'members',
  'health.read': 'health',
  'health.write': 'health',
  'progress_photos.read': 'health',
  'escalations.manage': 'health',
  'finance.read': 'billing',
  'finance.write': 'billing',
  'finance.refund': 'billing',
  'plans.write': 'billing',
  'memberships.write': 'billing',
  'ledger.read': 'billing',
  'content.write': 'coaching',
  'programs.assign': 'coaching',
  'programs.override': 'coaching',
  'checkins.review': 'coaching',
  'nutrition.read': 'nutrition',
  'nutrition.write': 'nutrition',
  'classes.write': 'scheduling',
  'bookings.write': 'scheduling',
  'attendance.write': 'scheduling',
  'equipment.write': 'operations',
  'automations.write': 'operations',
  'messaging.read': 'communication',
  'messaging.write': 'communication',
  'support.read': 'support',
  'support.write': 'support',
  'ai.logs.read': 'support',
  'reports.read': 'reports',
  'reports.financial': 'reports',
  'reports.export': 'reports',
  'member.self': 'member',
  'family.billing.manage': 'member',
};

/**
 * The authenticated actor. Everything the API and RLS need to make a decision
 * travels in this one object.
 */
export interface Actor {
  userId: string;
  organizationId: string | null;
  role: RoleCode;
  roles: readonly RoleCode[];
  permissions: readonly Permission[];
  /** Empty array means organization-wide scope. */
  branchIds: readonly string[];
  isPlatformAdmin: boolean;
  fullName: string;
  email: string | null;
  impersonatedBy?: string | null;
  supportSessionId?: string | null;
  mfaSatisfied?: boolean;
}

export function permissionsForRoles(
  roles: readonly RoleCode[],
  extraGrants: readonly Permission[] = [],
): Permission[] {
  const set = new Set<Permission>(extraGrants);
  for (const role of roles) {
    for (const permission of ROLE_PERMISSIONS[role] ?? []) set.add(permission);
  }
  return [...set].sort();
}

export function can(actor: Pick<Actor, 'permissions' | 'isPlatformAdmin'>, permission: Permission): boolean {
  if (actor.isPlatformAdmin) return true;
  return actor.permissions.includes(permission);
}

export function canAny(
  actor: Pick<Actor, 'permissions' | 'isPlatformAdmin'>,
  permissions: readonly Permission[],
): boolean {
  return permissions.some((permission) => can(actor, permission));
}

export function canAll(
  actor: Pick<Actor, 'permissions' | 'isPlatformAdmin'>,
  permissions: readonly Permission[],
): boolean {
  return permissions.every((permission) => can(actor, permission));
}

export function isStaffRole(role: RoleCode): boolean {
  return (
    role === 'gym_owner' ||
    role === 'branch_manager' ||
    role === 'coach' ||
    role === 'front_desk' ||
    role === 'nutrition_professional' ||
    role === 'platform_super_admin'
  );
}

/** Branch scope check used by the API before it ever reaches the database. */
export function canTouchBranch(actor: Actor, branchId: string | null | undefined): boolean {
  if (actor.isPlatformAdmin) return true;
  if (!branchId) return true;
  if (actor.branchIds.length === 0) return true;
  return actor.branchIds.includes(branchId);
}
