/**
 * Money is always an integer count of minor units plus a currency. No floats,
 * no implicit currency. Mixing currencies throws rather than silently adding.
 */

export interface Money {
  amountMinor: number;
  currency: string;
}

export function money(amountMinor: number, currency = 'PKR'): Money {
  if (!Number.isInteger(amountMinor)) {
    throw new Error(`Money must be an integer number of minor units, received ${amountMinor}`);
  }
  return { amountMinor, currency: currency.toUpperCase() };
}

export function zero(currency = 'PKR'): Money {
  return money(0, currency);
}

function assertSameCurrency(a: Money, b: Money): void {
  if (a.currency !== b.currency) {
    throw new Error(`Cannot combine ${a.currency} with ${b.currency}`);
  }
}

export function add(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return money(a.amountMinor + b.amountMinor, a.currency);
}

export function subtract(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return money(a.amountMinor - b.amountMinor, a.currency);
}

export function sum(values: Money[], currency = 'PKR'): Money {
  return values.reduce((acc, value) => add(acc, value), zero(currency));
}

/** Banker-safe multiply: rounds half away from zero to a whole minor unit. */
export function multiply(value: Money, factor: number): Money {
  const raw = value.amountMinor * factor;
  return money(Math.sign(raw) * Math.round(Math.abs(raw)), value.currency);
}

/** Basis points, so a 17.5% tax rate is 1750 and never a float. */
export function applyBps(value: Money, bps: number): Money {
  if (!Number.isInteger(bps) || bps < 0) throw new Error(`Invalid basis points: ${bps}`);
  return money(Math.round((value.amountMinor * bps) / 10_000), value.currency);
}

export function isZero(value: Money): boolean {
  return value.amountMinor === 0;
}

export function isPositive(value: Money): boolean {
  return value.amountMinor > 0;
}

export function max(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return a.amountMinor >= b.amountMinor ? a : b;
}

export function min(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return a.amountMinor <= b.amountMinor ? a : b;
}

export function clampNonNegative(value: Money): Money {
  return value.amountMinor < 0 ? zero(value.currency) : value;
}

/**
 * Split an amount into n parts with no lost minor units — the first parts
 * absorb the remainder. Used for family memberships and instalments.
 */
export function allocate(value: Money, parts: number): Money[] {
  if (parts <= 0) throw new Error('Cannot allocate into zero parts');
  const base = Math.floor(value.amountMinor / parts);
  let remainder = value.amountMinor - base * parts;
  const out: Money[] = [];
  for (let i = 0; i < parts; i += 1) {
    const extra = remainder > 0 ? 1 : 0;
    remainder -= extra;
    out.push(money(base + extra, value.currency));
  }
  return out;
}

/** Allocate proportionally to weights, preserving the total exactly. */
export function allocateByWeights(value: Money, weights: number[]): Money[] {
  const total = weights.reduce((a, b) => a + b, 0);
  if (total <= 0) return allocate(value, Math.max(weights.length, 1));
  const raw = weights.map((w) => (value.amountMinor * w) / total);
  const floored = raw.map((v) => Math.floor(v));
  let remainder = value.amountMinor - floored.reduce((a, b) => a + b, 0);
  const order = raw
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac);
  const out = [...floored];
  for (const { i } of order) {
    if (remainder <= 0) break;
    out[i] = (out[i] ?? 0) + 1;
    remainder -= 1;
  }
  return out.map((amount) => money(amount, value.currency));
}
