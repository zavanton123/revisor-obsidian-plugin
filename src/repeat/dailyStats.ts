import { DateTime } from 'luxon';

import { parseTime } from './parsers';
import {
  isGraduatedReview,
  isIntradayLearning,
  isNewCard,
} from './queueEligibility';
import { Repetition } from './repeatTypes';
import { RepeatPluginSettings } from '../settings';

export interface DailyReviewStats {
  reviewDayStartMs: number;
  newReviewed: number;
  reviewsReviewed: number;
}

interface LegacyDailyReviewStats {
  reviewDayStart: string;
  newReviewed: number;
  reviewsReviewed: number;
}

function isLegacyDailyReviewStats(
  stats: LegacyDailyReviewStats | DailyReviewStats,
): stats is LegacyDailyReviewStats {
  return 'reviewDayStart' in stats && typeof stats.reviewDayStart === 'string';
}

export interface RemainingDailyLimits {
  newRemaining: number | null;
  reviewRemaining: number | null;
}

export function getReviewDayStart(
  now: DateTime,
  dayStartsAt: string,
): DateTime {
  const { hour, minute } = parseTime(dayStartsAt);
  let start = now.startOf('day').set({
    hour,
    minute,
    second: 0,
    millisecond: 0,
  });
  if (now < start) {
    start = start.minus({ days: 1 });
  }
  return start;
}

export function getReviewDayStartMs(
  now: DateTime,
  dayStartsAt: string,
): number {
  return getReviewDayStart(now, dayStartsAt).toMillis();
}

export function normalizeDailyStats(
  stats: LegacyDailyReviewStats | DailyReviewStats | undefined,
  dayStartsAt: string,
  now: DateTime = DateTime.now(),
): DailyReviewStats {
  const reviewDayStartMs = getReviewDayStartMs(now, dayStartsAt);
  const resolved = resolveDailyStats(stats);

  if (!resolved || resolved.reviewDayStartMs !== reviewDayStartMs) {
    return {
      reviewDayStartMs,
      newReviewed: 0,
      reviewsReviewed: 0,
    };
  }
  return resolved;
}

function resolveDailyStats(
  stats: LegacyDailyReviewStats | DailyReviewStats | undefined,
): DailyReviewStats | undefined {
  if (!stats) {
    return undefined;
  }
  if ('reviewDayStartMs' in stats && typeof stats.reviewDayStartMs === 'number') {
    return stats;
  }
  if (isLegacyDailyReviewStats(stats)) {
    return {
      reviewDayStartMs: DateTime.fromISO(stats.reviewDayStart).toMillis(),
      newReviewed: stats.newReviewed,
      reviewsReviewed: stats.reviewsReviewed,
    };
  }
  return undefined;
}

export function getRemainingDailyLimits(
  settings: RepeatPluginSettings,
  stats: DailyReviewStats,
): RemainingDailyLimits {
  let reviewRemaining: number | null = settings.maxReviewsPerDay === 0
    ? null
    : Math.max(0, settings.maxReviewsPerDay - stats.reviewsReviewed);
  let newRemaining: number | null = settings.maxNewPerDay === 0
    ? null
    : Math.max(0, settings.maxNewPerDay - stats.newReviewed);

  if (reviewRemaining !== null) {
    reviewRemaining = Math.max(0, reviewRemaining - stats.newReviewed);
  }
  if (newRemaining !== null && reviewRemaining !== null) {
    newRemaining = Math.min(newRemaining, reviewRemaining);
  }

  return { newRemaining, reviewRemaining };
}

export function canReviewNewCard(limits: RemainingDailyLimits): boolean {
  return limits.newRemaining === null || limits.newRemaining > 0;
}

export function canReviewReviewCard(limits: RemainingDailyLimits): boolean {
  return limits.reviewRemaining === null || limits.reviewRemaining > 0;
}

export function isWithinDailyLimits(
  repetition: Repetition,
  limits: RemainingDailyLimits,
): boolean {
  if (isIntradayLearning(repetition)) {
    return true;
  }
  if (isNewCard(repetition)) {
    return canReviewNewCard(limits);
  }
  if (isGraduatedReview(repetition)) {
    return canReviewReviewCard(limits);
  }
  return true;
}

export function shouldCountTowardDailyStats(repetition: Repetition): boolean {
  return isNewCard(repetition) || isGraduatedReview(repetition);
}

export function incrementDailyStats(
  stats: DailyReviewStats,
  repetition: Repetition,
): DailyReviewStats {
  if (!shouldCountTowardDailyStats(repetition)) {
    return stats;
  }
  if (isNewCard(repetition)) {
    return { ...stats, newReviewed: stats.newReviewed + 1 };
  }
  return { ...stats, reviewsReviewed: stats.reviewsReviewed + 1 };
}

export function decrementDailyStats(
  stats: DailyReviewStats,
  repetition: Repetition,
): DailyReviewStats {
  if (!shouldCountTowardDailyStats(repetition)) {
    return stats;
  }
  if (isNewCard(repetition)) {
    return {
      ...stats,
      newReviewed: Math.max(0, stats.newReviewed - 1),
    };
  }
  return {
    ...stats,
    reviewsReviewed: Math.max(0, stats.reviewsReviewed - 1),
  };
}

export function hasActiveDailyLimits(settings: RepeatPluginSettings): boolean {
  return settings.maxNewPerDay > 0 || settings.maxReviewsPerDay > 0;
}

export function formatDailyLimitMessage(
  settings: RepeatPluginSettings,
  stats: DailyReviewStats,
): string {
  const limits = getRemainingDailyLimits(settings, stats);
  const parts: string[] = [];

  if (settings.maxReviewsPerDay > 0) {
    const remaining = limits.reviewRemaining ?? 0;
    parts.push(`${remaining} reviews remaining today`);
  }
  if (settings.maxNewPerDay > 0) {
    const remaining = limits.newRemaining ?? 0;
    parts.push(`${remaining} new cards remaining today`);
  }

  return parts.join(' · ');
}
