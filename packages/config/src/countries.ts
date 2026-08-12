/**
 * Country configuration. Pakistan is the launch market; the rest exist so the
 * expansion path is code, not a rewrite. Tax, currency, units, week start and
 * the preferred payment adapters are all per-country.
 */
import type { LocaleCode, UnitSystem } from '@gymguide/types';

export interface CountryConfig {
  code: string;
  name: string;
  currency: string;
  timezone: string;
  locales: LocaleCode[];
  units: UnitSystem;
  /** 0 = Sunday, 1 = Monday. */
  weekStartsOn: 0 | 1;
  taxLabel: string;
  defaultTaxRateBps: number;
  taxInclusivePricing: boolean;
  phonePrefix: string;
  paymentAdapters: string[];
  privacyRegime: 'pk_pdpb' | 'gdpr' | 'uae_pdpl' | 'ksa_pdpl' | 'us_state';
  requiresGuardianConsentUnder: number;
}

export const COUNTRIES: Record<string, CountryConfig> = {
  PK: {
    code: 'PK',
    name: 'Pakistan',
    currency: 'PKR',
    timezone: 'Asia/Karachi',
    locales: ['en', 'ur', 'ur_rm'],
    units: 'metric',
    weekStartsOn: 1,
    taxLabel: 'Sales tax',
    defaultTaxRateBps: 0,
    taxInclusivePricing: true,
    phonePrefix: '+92',
    paymentAdapters: ['manual', 'jazzcash', 'easypaisa', 'raast_qr', 'card'],
    privacyRegime: 'pk_pdpb',
    requiresGuardianConsentUnder: 18,
  },
  AE: {
    code: 'AE',
    name: 'United Arab Emirates',
    currency: 'AED',
    timezone: 'Asia/Dubai',
    locales: ['en'],
    units: 'metric',
    weekStartsOn: 1,
    taxLabel: 'VAT',
    defaultTaxRateBps: 500,
    taxInclusivePricing: true,
    phonePrefix: '+971',
    paymentAdapters: ['manual', 'card'],
    privacyRegime: 'uae_pdpl',
    requiresGuardianConsentUnder: 18,
  },
  SA: {
    code: 'SA',
    name: 'Saudi Arabia',
    currency: 'SAR',
    timezone: 'Asia/Riyadh',
    locales: ['en'],
    units: 'metric',
    weekStartsOn: 0,
    taxLabel: 'VAT',
    defaultTaxRateBps: 1500,
    taxInclusivePricing: true,
    phonePrefix: '+966',
    paymentAdapters: ['manual', 'card'],
    privacyRegime: 'ksa_pdpl',
    requiresGuardianConsentUnder: 18,
  },
  GB: {
    code: 'GB',
    name: 'United Kingdom',
    currency: 'GBP',
    timezone: 'Europe/London',
    locales: ['en'],
    units: 'metric',
    weekStartsOn: 1,
    taxLabel: 'VAT',
    defaultTaxRateBps: 2000,
    taxInclusivePricing: true,
    phonePrefix: '+44',
    paymentAdapters: ['manual', 'card'],
    privacyRegime: 'gdpr',
    requiresGuardianConsentUnder: 18,
  },
  US: {
    code: 'US',
    name: 'United States',
    currency: 'USD',
    timezone: 'America/New_York',
    locales: ['en'],
    units: 'imperial',
    weekStartsOn: 0,
    taxLabel: 'Sales tax',
    defaultTaxRateBps: 0,
    taxInclusivePricing: false,
    phonePrefix: '+1',
    paymentAdapters: ['manual', 'card'],
    privacyRegime: 'us_state',
    requiresGuardianConsentUnder: 18,
  },
};

export function countryConfig(code: string): CountryConfig {
  return COUNTRIES[code.toUpperCase()] ?? COUNTRIES.PK!;
}
