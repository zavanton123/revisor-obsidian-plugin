import { DateTime, Settings } from 'luxon';

import {
  activityDayKey,
  activityDayKeyMs,
  classifyKind,
  dailyCountsByKindFromLog,
  dailyCountsFromLog,
  dayIndex,
  isCorrect,
  migrateLegacyActivity,
  ratingToNumber,
} from './activity';
import { Repetition } from './repeatTypes';

const DAY = '06:00';

function makeRep(overrides: Partial<Repetition> = {}): Repetition {
  return {
    repeatTimeOfDay: 'AM',
    repeatDueAt: DateTime.fromISO('2026-06-08T10:00:00.000-03:00'),
    fsrs: {
      state: 'review',
      stability: 10,
      difficulty: 5,
      scheduledDays: 7,
      learningSteps: 0,
      reps: 2,
      lapses: 0,
    },
    ...overrides,
  };
}

describe('activityDayKey', () => {
  test('uses previous calendar day before rollover', () => {
    const now = DateTime.fromISO('2026-06-08T05:59:00.000-03:00', { setZone: true });
    expect(activityDayKey(now, DAY)).toBe('2026-06-07');
  });

  test('uses same calendar day at and after rollover', () => {
    const atRollover = DateTime.fromISO('2026-06-08T06:00:00.000-03:00', { setZone: true });
    const after = DateTime.fromISO('2026-06-08T10:00:00.000-03:00', { setZone: true });
    expect(activityDayKey(atRollover, DAY)).toBe('2026-06-08');
    expect(activityDayKey(after, DAY)).toBe('2026-06-08');
  });

  test('activityDayKeyMs matches activityDayKey for same instant', () => {
    const now = DateTime.fromISO('2026-06-08T03:00:00.000-03:00', { setZone: true });
    expect(activityDayKeyMs(now.toMillis(), DAY)).toBe(activityDayKey(now, DAY));
  });
});

describe('dayIndex', () => {
  const originalNow = Settings.now;
  const frozenNowMs = Date.parse('2026-06-08T15:00:00.000Z'); // 12:00 -03:00

  afterEach(() => {
    Settings.now = originalNow;
  });

  test('maps today/yesterday/tomorrow relative to frozen now', () => {
    Settings.now = () => frozenNowMs;

    const today = Date.parse('2026-06-08T13:00:00.000Z');
    const yesterday = Date.parse('2026-06-07T13:00:00.000Z');
    const tomorrow = Date.parse('2026-06-09T13:00:00.000Z');

    expect(dayIndex(today, DAY)).toBe(0);
    expect(dayIndex(yesterday, DAY)).toBe(-1);
    expect(dayIndex(tomorrow, DAY)).toBe(1);
  });
});

describe('ratingToNumber / isCorrect / classifyKind', () => {
  test('ratingToNumber clamps invalid ratings to Good', () => {
    expect(ratingToNumber(0)).toBe(3);
    expect(ratingToNumber(5)).toBe(3);
    expect(ratingToNumber(1.4)).toBe(1);
    expect(ratingToNumber(2.6)).toBe(3);
  });

  test('isCorrect treats Again as incorrect', () => {
    expect(isCorrect(1)).toBe(false);
    expect(isCorrect(2)).toBe(true);
    expect(isCorrect(3)).toBe(true);
    expect(isCorrect(4)).toBe(true);
  });

  test('classifyKind maps FSRS states and mature threshold', () => {
    expect(classifyKind(makeRep({ fsrs: undefined }))).toBe('learn');
    expect(classifyKind(makeRep({
      fsrs: { state: 'new', stability: 0, difficulty: 0, scheduledDays: 0,
        learningSteps: 0, reps: 0, lapses: 0 },
    }))).toBe('learn');
    expect(classifyKind(makeRep({
      fsrs: { state: 'learning', stability: 1, difficulty: 5, scheduledDays: 0,
        learningSteps: 1, reps: 1, lapses: 0 },
    }))).toBe('learn');
    expect(classifyKind(makeRep({
      fsrs: { state: 'relearning', stability: 1, difficulty: 5, scheduledDays: 0,
        learningSteps: 1, reps: 2, lapses: 1 },
    }))).toBe('relearn');
    expect(classifyKind(makeRep({
      fsrs: { state: 'review', stability: 10, difficulty: 5, scheduledDays: 20,
        learningSteps: 0, reps: 3, lapses: 0 },
    }))).toBe('young');
    expect(classifyKind(makeRep({
      fsrs: { state: 'review', stability: 10, difficulty: 5, scheduledDays: 21,
        learningSteps: 0, reps: 3, lapses: 0 },
    }))).toBe('mature');
  });
});

describe('dailyCountsFromLog / dailyCountsByKindFromLog', () => {
  test('buckets events by activity day and kind', () => {
    const dayA = DateTime.fromISO('2026-06-08T10:00:00.000-03:00', { setZone: true }).toMillis();
    const dayB = DateTime.fromISO('2026-06-07T10:00:00.000-03:00', { setZone: true }).toMillis();
    const log = [
      { at: dayA, rating: 3 as const, kind: 'young' as const, lastIntervalDays: 7 },
      { at: dayA + 1000, rating: 1 as const, kind: 'learn' as const, lastIntervalDays: 0 },
      { at: dayB, rating: 4 as const, kind: 'mature' as const, lastIntervalDays: 30 },
    ];

    const totals = dailyCountsFromLog(log, DAY);
    expect(totals.get('2026-06-08')).toBe(2);
    expect(totals.get('2026-06-07')).toBe(1);

    const byKind = dailyCountsByKindFromLog(log, DAY);
    expect(byKind.get('2026-06-08')).toEqual({
      learn: 1, relearn: 0, young: 1, mature: 0,
    });
    expect(byKind.get('2026-06-07')).toEqual({
      learn: 0, relearn: 0, young: 0, mature: 1,
    });
  });
});

describe('migrateLegacyActivity', () => {
  test('expands per-day counters into learn and young events', () => {
    const log = migrateLegacyActivity({
      '2026-06-08': { reviews: 2, newCards: 1 },
    }, DAY);

    expect(log).toHaveLength(3);
    expect(log.filter((e) => e.kind === 'learn')).toHaveLength(1);
    expect(log.filter((e) => e.kind === 'young')).toHaveLength(2);
    expect(log.every((e) => e.rating === 3)).toBe(true);
    expect(dailyCountsFromLog(log, DAY).get('2026-06-08')).toBe(3);
  });
});
