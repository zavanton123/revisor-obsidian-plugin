import { DateTime } from 'luxon';

import { Repetition } from './repeatTypes';

function parseTime(twentyFourHourTime: string) {
  const [hourString, minuteString] = twentyFourHourTime.split(':');
  return {
    hour: parseInt(hourString),
    minute: parseInt(minuteString),
  };
}

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

export function activityDayKeyMs(epochMs: number, dayStartsAt: string): string {
  return activityDayKey(DateTime.fromMillis(epochMs), dayStartsAt);
}

export function dayIndex(epochMs: number, dayStartsAt: string): number {
  const now = DateTime.now();
  const todayStart = activityDayKey(now, dayStartsAt);
  const eventStart = activityDayKeyMs(epochMs, dayStartsAt);
  const today = DateTime.fromISO(todayStart);
  const event = DateTime.fromISO(eventStart);
  return Math.floor(event.diff(today, 'days').days);
}

// ── Review event log ──

export type ReviewRating = 1 | 2 | 3 | 4;
export type ReviewKind = 'learn' | 'relearn' | 'young' | 'mature';

export interface ReviewEvent {
  at: number;
  rating: ReviewRating;
  kind: ReviewKind;
  lastIntervalDays: number;
  elapsedMs?: number;
}

export type ReviewLog = ReviewEvent[];

export function ratingToNumber(rating: number): ReviewRating {
  const r = Math.round(rating);
  if (r < 1 || r > 4) return 3;
  return r as ReviewRating;
}

export function classifyKind(rep: Repetition): ReviewKind {
  const s = rep.fsrs?.state;
  if (!s) return 'learn';
  if (s === 'new') return 'learn';
  if (s === 'learning') return 'learn';
  if (s === 'relearning') return 'relearn';
  const ivl = rep.fsrs?.scheduledDays ?? 0;
  return ivl >= 21 ? 'mature' : 'young';
}

export function isCorrect(rating: ReviewRating): boolean {
  return rating > 1;
}

// ── Derived daily counts (for the heatmap) ──

export function dailyCountsFromLog(
  log: ReviewLog,
  dayStartsAt: string,
): Map<string, number> {
  const m = new Map<string, number>();
  for (const e of log) {
    const key = activityDayKeyMs(e.at, dayStartsAt);
    m.set(key, (m.get(key) ?? 0) + 1);
  }
  return m;
}

export function dailyCountsByKindFromLog(
  log: ReviewLog,
  dayStartsAt: string,
): Map<string, { learn: number; relearn: number; young: number; mature: number }> {
  const m = new Map<string, { learn: number; relearn: number; young: number; mature: number }>();
  const empty = () => ({ learn: 0, relearn: 0, young: 0, mature: 0 });
  for (const e of log) {
    const key = activityDayKeyMs(e.at, dayStartsAt);
    const day = m.get(key) ?? empty();
    day[e.kind] += 1;
    m.set(key, day);
  }
  return m;
}

// ── Migration from legacy per-day counters ──

export function migrateLegacyActivity(
  legacyActivity: Record<string, { reviews: number; newCards: number }>,
  dayStartsAt: string,
): ReviewLog {
  const log: ReviewLog = [];
  for (const [dayKey, day] of Object.entries(legacyActivity)) {
    const at = DateTime.fromISO(dayKey)
      .set({ hour: 6, minute: 0 }) // approximate timestamp
      .toMillis();
    for (let i = 0; i < (day.newCards ?? 0); i++) {
      log.push({ at, rating: 3, kind: 'learn', lastIntervalDays: 0 });
    }
    for (let i = 0; i < (day.reviews ?? 0); i++) {
      log.push({ at: at + i * 1000, rating: 3, kind: 'young', lastIntervalDays: 7 });
    }
  }
  return log;
}
