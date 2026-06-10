import { DateTime } from 'luxon';

import { isNewCard } from './queueEligibility';
import { Repetition } from './repeatTypes';

function parseTime(twentyFourHourTime: string) {
  const [hourString, minuteString] = twentyFourHourTime.split(':');
  return {
    hour: parseInt(hourString),
    minute: parseInt(minuteString),
  };
}

export interface DayActivity {
  reviews: number;
  newCards: number;
}

export type ReviewActivityLog = Record<string, DayActivity>;

export function activityDayKey(now: DateTime, dayStartsAt: string): string {
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
  return start.toISODate()!;
}

export function classifyReviewRepetition(
  repetition: Repetition,
): 'new' | 'review' | 'other' {
  if (isNewCard(repetition)) {
    return 'new';
  }
  if (repetition.fsrs?.state === 'review') {
    return 'review';
  }
  return 'other';
}

export function recordActivity(
  log: ReviewActivityLog,
  dayKey: string,
  classification: 'new' | 'review' | 'other',
): ReviewActivityLog {
  if (classification === 'other') {
    return log;
  }
  const day = log[dayKey] ?? { reviews: 0, newCards: 0 };
  if (classification === 'new') {
    day.newCards += 1;
  } else {
    day.reviews += 1;
  }
  log[dayKey] = day;
  return log;
}

export function unrecordActivity(
  log: ReviewActivityLog,
  dayKey: string,
  classification: 'new' | 'review' | 'other',
): ReviewActivityLog {
  if (classification === 'other') {
    return log;
  }
  const day = log[dayKey];
  if (!day) {
    return log;
  }
  if (classification === 'new') {
    day.newCards = Math.max(0, day.newCards - 1);
  } else {
    day.reviews = Math.max(0, day.reviews - 1);
  }
  if (day.reviews === 0 && day.newCards === 0) {
    delete log[dayKey];
  }
  return log;
}
