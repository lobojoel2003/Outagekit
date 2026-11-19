import { chemistryProfile, clamp } from './chemistry.js';
import type { Chemistry } from './types.js';

const DAY_MS = 86_400_000;
const DAYS_PER_MONTH = 30.44;

export type DateInput = Date | string | number;

function toDate(value: DateInput): Date {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (Number.isNaN(date.getTime())) throw new RangeError(`Invalid date: ${String(value)}`);
  return date;
}

/** Whole and fractional days between two moments (never negative). */
export function daysBetween(from: DateInput, to: DateInput): number {
  return Math.max(0, (toDate(to).getTime() - toDate(from).getTime()) / DAY_MS);
}

export interface StoredChargeInput {
  chemistry: Chemistry;
  /** Charge level when it was last topped up, from 0 to 1. Default 1. */
  chargedTo?: number;
  /** Days since it was last topped up. */
  daysSinceCharge: number;
}

/**
 * Estimated charge of a battery that has been sitting unused, from 0 to 1.
 * Uses the chemistry's self-discharge rate, including standby electronics.
 */
export function estimateStoredCharge(input: StoredChargeInput): number {
  const profile = chemistryProfile(input.chemistry);
  const start = clamp(input.chargedTo ?? 1, 0, 1);
  const months = Math.max(0, input.daysSinceCharge) / DAYS_PER_MONTH;
  return clamp(start - profile.selfDischargePerMonth * months, 0, 1);
}

/** Suggested days between charge checks for a chemistry. */
export function recommendedCheckIntervalDays(chemistry: Chemistry): number {
  return chemistryProfile(chemistry).checkIntervalDays;
}

export interface ChargeReminderInput {
  lastChargedAt: DateInput;
  /** Days between top-ups. */
  intervalDays: number;
  now?: DateInput;
}

export interface ChargeReminder {
  dueAt: Date;
  /** Days until due; negative when overdue. */
  daysUntilDue: number;
  overdue: boolean;
}

/** When the next top-up charge is due. */
export function chargeReminder(input: ChargeReminderInput): ChargeReminder {
  const last = toDate(input.lastChargedAt);
  const now = toDate(input.now ?? Date.now());
  const interval = Math.max(1, input.intervalDays);
  const dueAt = new Date(last.getTime() + interval * DAY_MS);
  const daysUntilDue = (dueAt.getTime() - now.getTime()) / DAY_MS;
  return { dueAt, daysUntilDue, overdue: daysUntilDue < 0 };
}

/**
 * Hours it takes to recharge from `fromCharge` to `toCharge` with a charger
 * of `chargerWatts`, assuming 85% charging efficiency.
 */
export function rechargeHours(
  capacityWh: number,
  chargerWatts: number,
  fromCharge = 0,
  toCharge = 1,
): number {
  if (chargerWatts <= 0) return Number.POSITIVE_INFINITY;
  const needed =
    Math.max(0, clamp(toCharge, 0, 1) - clamp(fromCharge, 0, 1)) * Math.max(0, capacityWh);
  return needed / (chargerWatts * 0.85);
}
