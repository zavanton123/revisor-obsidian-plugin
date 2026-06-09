import { DateTime } from 'luxon';

import { parseTime } from './parsers';
import { RepeatPluginSettings } from '../settings';
import { StudyCardKind, countsAsNew, countsAsReview } from './studyCardKind';

export interface DailyStudyState {
  studyDayKey: string;
  newStudied: number;
  reviewStudied: number;
  extendNew: number;
  extendReview: number;
}

export interface EffectiveLimits {
  newRemaining: number;
  reviewRemaining: number;
}

export function createEmptyDailyStudy(studyDayKey: string): DailyStudyState {
  return {
    studyDayKey,
    newStudied: 0,
    reviewStudied: 0,
    extendNew: 0,
    extendReview: 0,
  };
}

export function getCurrentStudyDayKey(
  now: DateTime,
  dayStartsAt: string,
): string {
  const { hour, minute } = parseTime(dayStartsAt);
  let dayStart = now.startOf('day').set({
    hour,
    minute,
    second: 0,
    millisecond: 0,
  });
  if (now < dayStart) {
    dayStart = dayStart.minus({ days: 1 });
  }
  return dayStart.toISODate() || now.toISODate() || '';
}

export function normalizeDailyStudy(
  daily: DailyStudyState | undefined,
  now: DateTime,
  dayStartsAt: string,
): DailyStudyState {
  const studyDayKey = getCurrentStudyDayKey(now, dayStartsAt);
  if (!daily || daily.studyDayKey !== studyDayKey) {
    return createEmptyDailyStudy(studyDayKey);
  }
  return daily;
}

function limitRemaining(
  configured: number,
  studied: number,
  extended: number,
): number {
  if (configured === 0) {
    return Infinity;
  }
  return Math.max(0, configured + extended - studied);
}

export function getEffectiveLimits(
  settings: RepeatPluginSettings,
  daily: DailyStudyState,
): EffectiveLimits {
  let newRemaining = limitRemaining(
    settings.maxNewPerDay,
    daily.newStudied,
    daily.extendNew,
  );
  let reviewRemaining = limitRemaining(
    settings.maxReviewsPerDay,
    daily.reviewStudied,
    daily.extendReview,
  );
  if (!settings.newCardsIgnoreReviewLimit) {
    newRemaining = Math.min(newRemaining, reviewRemaining);
  }
  return { newRemaining, reviewRemaining };
}

export function getSessionLimits(
  sessionNewLimit: number,
  sessionReviewLimit: number,
  sessionNewStudied: number,
  sessionReviewStudied: number,
  newCardsIgnoreReviewLimit: boolean,
): EffectiveLimits {
  let newRemaining = limitRemaining(
    sessionNewLimit,
    sessionNewStudied,
    0,
  );
  let reviewRemaining = limitRemaining(
    sessionReviewLimit,
    sessionReviewStudied,
    0,
  );
  if (!newCardsIgnoreReviewLimit) {
    newRemaining = Math.min(newRemaining, reviewRemaining);
  }
  return { newRemaining, reviewRemaining };
}

export function combineLimits(
  daily: EffectiveLimits,
  session: EffectiveLimits,
  newCardsIgnoreReviewLimit: boolean,
): EffectiveLimits {
  let newRemaining = Math.min(daily.newRemaining, session.newRemaining);
  let reviewRemaining = Math.min(daily.reviewRemaining, session.reviewRemaining);
  if (!newCardsIgnoreReviewLimit) {
    newRemaining = Math.min(newRemaining, reviewRemaining);
  }
  return { newRemaining, reviewRemaining };
}

export function recordStudy(
  daily: DailyStudyState,
  kind: StudyCardKind,
): DailyStudyState {
  if (countsAsNew(kind)) {
    return { ...daily, newStudied: daily.newStudied + 1 };
  }
  if (countsAsReview(kind)) {
    return { ...daily, reviewStudied: daily.reviewStudied + 1 };
  }
  return daily;
}

export function extendDailyLimits(
  daily: DailyStudyState,
  newDelta: number,
  reviewDelta: number,
): DailyStudyState {
  return {
    ...daily,
    extendNew: daily.extendNew + newDelta,
    extendReview: daily.extendReview + reviewDelta,
  };
}
