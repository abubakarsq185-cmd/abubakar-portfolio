import { z } from 'zod';
import { LOCALE_CODES, UNIT_SYSTEMS } from '../enums';

export const uuid = z.string().uuid('Must be a valid id');
export const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');
export const localeCode = z.enum(LOCALE_CODES);
export const unitSystem = z.enum(UNIT_SYSTEMS);

/**
 * Pakistan-first phone handling: accepts 03xx-xxxxxxx, +923xxxxxxxxx and
 * international E.164, then normalises to E.164.
 */
export const phoneNumber = z
  .string()
  .trim()
  .min(7, 'Phone number looks too short')
  .max(20, 'Phone number looks too long')
  .transform((value) => value.replace(/[\s()-]/g, ''))
  .refine((value) => /^\+?\d{7,15}$/.test(value), 'Enter a valid phone number')
  .transform((value) => {
    if (value.startsWith('+')) return value;
    if (value.startsWith('00')) return `+${value.slice(2)}`;
    if (value.startsWith('0')) return `+92${value.slice(1)}`;
    return `+${value}`;
  });

export const emailAddress = z
  .string()
  .trim()
  .toLowerCase()
  .email('Enter a valid email address');

export const personName = z
  .string()
  .trim()
  .min(2, 'Please enter a full name')
  .max(120, 'That name is too long');

export const moneyMinor = z
  .number()
  .int('Amounts are stored in whole paisa')
  .min(0, 'Amount cannot be negative')
  .max(1_000_000_000_00, 'Amount is unrealistically large');

export const currencyCode = z
  .string()
  .length(3)
  .toUpperCase()
  .default('PKR');

export const paginationInput = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  search: z.string().trim().max(120).optional(),
  sort: z.string().trim().max(60).optional(),
});
export type PaginationInput = z.infer<typeof paginationInput>;

export interface Paginated<T> {
  rows: T[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

/** Uniform API envelope shared by web route handlers and the mobile client. */
export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string; fieldErrors?: Record<string, string[]> } };

export const weightKg = z
  .number()
  .min(25, 'Weight must be at least 25 kg')
  .max(400, 'Weight must be under 400 kg');

export const heightCm = z
  .number()
  .min(80, 'Height must be at least 80 cm')
  .max(260, 'Height must be under 260 cm');
