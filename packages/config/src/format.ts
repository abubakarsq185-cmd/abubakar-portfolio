/**
 * Locale-aware formatting. Everything money-shaped goes through here so the
 * product can add currencies without hunting for hard-coded "Rs".
 */
import type { LocaleCode, UnitSystem } from '@gymguide/types';

export interface CurrencyMeta {
  code: string;
  symbol: string;
  minorPerMajor: number;
  /** Where the symbol sits, for locales Intl does not cover the way we want. */
  decimals: number;
}

export const CURRENCIES: Record<string, CurrencyMeta> = {
  PKR: { code: 'PKR', symbol: 'Rs', minorPerMajor: 100, decimals: 0 },
  AED: { code: 'AED', symbol: 'AED', minorPerMajor: 100, decimals: 2 },
  SAR: { code: 'SAR', symbol: 'SAR', minorPerMajor: 100, decimals: 2 },
  USD: { code: 'USD', symbol: '$', minorPerMajor: 100, decimals: 2 },
  GBP: { code: 'GBP', symbol: '£', minorPerMajor: 100, decimals: 2 },
  EUR: { code: 'EUR', symbol: '€', minorPerMajor: 100, decimals: 2 },
};

export function currencyMeta(code: string): CurrencyMeta {
  return CURRENCIES[code.toUpperCase()] ?? { code, symbol: code, minorPerMajor: 100, decimals: 2 };
}

const INTL_LOCALE: Record<LocaleCode, string> = {
  en: 'en-PK',
  ur: 'ur-PK',
  ur_rm: 'en-PK',
};

export function intlLocale(locale: LocaleCode = 'en'): string {
  return INTL_LOCALE[locale] ?? 'en-PK';
}

/** Minor units → display string. PKR shows no decimals; paisa are not spent. */
export function formatMoney(
  amountMinor: number,
  currency = 'PKR',
  locale: LocaleCode = 'en',
  options: { compact?: boolean; showCode?: boolean } = {},
): string {
  const meta = currencyMeta(currency);
  const major = amountMinor / meta.minorPerMajor;
  if (options.compact && Math.abs(major) >= 100_000) {
    const formatter = new Intl.NumberFormat(intlLocale(locale), {
      notation: 'compact',
      maximumFractionDigits: 1,
    });
    return `${meta.symbol} ${formatter.format(major)}`;
  }
  const formatted = new Intl.NumberFormat(intlLocale(locale), {
    minimumFractionDigits: meta.decimals,
    maximumFractionDigits: meta.decimals,
  }).format(major);
  return options.showCode ? `${formatted} ${meta.code}` : `${meta.symbol} ${formatted}`;
}

export function parseMoneyToMinor(input: string, currency = 'PKR'): number | null {
  const meta = currencyMeta(currency);
  const cleaned = input.replace(/[^\d.-]/g, '');
  if (!cleaned || !/^-?\d*(\.\d+)?$/.test(cleaned)) return null;
  const value = Number(cleaned);
  if (!Number.isFinite(value)) return null;
  return Math.round(value * meta.minorPerMajor);
}

export function formatNumber(value: number, locale: LocaleCode = 'en', maximumFractionDigits = 0): string {
  return new Intl.NumberFormat(intlLocale(locale), { maximumFractionDigits }).format(value);
}

export function formatPercent(value: number, locale: LocaleCode = 'en'): string {
  return `${new Intl.NumberFormat(intlLocale(locale), { maximumFractionDigits: 0 }).format(value)}%`;
}

export function formatDate(
  value: string | Date,
  locale: LocaleCode = 'en',
  timeZone = 'Asia/Karachi',
  style: 'short' | 'medium' | 'long' | 'weekday' = 'medium',
): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '—';
  const options: Intl.DateTimeFormatOptions =
    style === 'short'
      ? { day: '2-digit', month: 'short', timeZone }
      : style === 'long'
        ? { day: 'numeric', month: 'long', year: 'numeric', timeZone }
        : style === 'weekday'
          ? { weekday: 'long', day: 'numeric', month: 'long', timeZone }
          : { day: '2-digit', month: 'short', year: 'numeric', timeZone };
  return new Intl.DateTimeFormat(intlLocale(locale), options).format(date);
}

export function formatTime(value: string | Date, locale: LocaleCode = 'en', timeZone = 'Asia/Karachi'): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat(intlLocale(locale), {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone,
  }).format(date);
}

export function formatRelativeDays(value: string | Date | null, locale: LocaleCode = 'en'): string {
  if (!value) return 'Never';
  const date = typeof value === 'string' ? new Date(value) : value;
  const days = Math.floor((Date.now() - date.getTime()) / 86_400_000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} week${days < 14 ? '' : 's'} ago`;
  return formatDate(date, locale);
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}

export function formatWeight(kg: number | null | undefined, units: UnitSystem = 'metric'): string {
  if (kg === null || kg === undefined) return '—';
  if (units === 'imperial') return `${(kg * 2.20462).toFixed(1)} lb`;
  return `${Number.isInteger(kg) ? kg : kg.toFixed(1)} kg`;
}

export function formatLength(cm: number | null | undefined, units: UnitSystem = 'metric'): string {
  if (cm === null || cm === undefined) return '—';
  if (units === 'imperial') {
    const inches = cm / 2.54;
    const feet = Math.floor(inches / 12);
    return `${feet}′ ${Math.round(inches % 12)}″`;
  }
  return `${cm.toFixed(0)} cm`;
}

export function initials(fullName: string): string {
  return fullName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

/** Simple ordinal, used in "3rd session this week" style copy. */
export function ordinal(n: number): string {
  const suffixes = ['th', 'st', 'nd', 'rd'] as const;
  const v = n % 100;
  return `${n}${suffixes[(v - 20) % 10] ?? suffixes[v] ?? 'th'}`;
}
