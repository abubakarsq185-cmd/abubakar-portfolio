import { z } from 'zod';
import { emailAddress, localeCode, personName, phoneNumber, uuid } from './common';
import { ROLE_CODES } from '../enums';

export const passwordSchema = z
  .string()
  .min(10, 'Use at least 10 characters')
  .max(200, 'That password is too long')
  .refine((v) => /[a-z]/.test(v), 'Include a lowercase letter')
  .refine((v) => /[A-Z]/.test(v), 'Include an uppercase letter')
  .refine((v) => /\d/.test(v), 'Include a number');

export const loginInput = z.object({
  email: emailAddress,
  password: z.string().min(1, 'Enter your password'),
  totp: z
    .string()
    .trim()
    .regex(/^\d{6}$/, 'Enter the 6-digit code')
    .optional(),
  rememberDevice: z.boolean().default(false),
});
export type LoginInput = z.infer<typeof loginInput>;

export const acceptInviteInput = z
  .object({
    token: z.string().min(20, 'This invite link is not valid'),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });
export type AcceptInviteInput = z.infer<typeof acceptInviteInput>;

export const changePasswordInput = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password'),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export const staffInviteInput = z.object({
  fullName: personName,
  email: emailAddress,
  phone: phoneNumber.optional(),
  role: z.enum(ROLE_CODES).refine(
    (role) => role !== 'platform_super_admin' && role !== 'member' && role !== 'guardian',
    'Choose a staff role',
  ),
  branchIds: z.array(uuid).default([]),
  jobTitle: z.string().trim().max(80).optional(),
  locale: localeCode.default('en'),
});
export type StaffInviteInput = z.infer<typeof staffInviteInput>;

export const supportAccessInput = z.object({
  organizationId: uuid,
  reason: z
    .string()
    .trim()
    .min(12, 'Describe why you need access (min 12 characters)')
    .max(500),
  ticketReference: z.string().trim().max(60).optional(),
  scope: z.enum(['read_only', 'read_write']).default('read_only'),
  durationMinutes: z.coerce.number().int().min(15).max(480).default(60),
  actAsUserId: uuid.optional(),
});
export type SupportAccessInput = z.infer<typeof supportAccessInput>;
