jest.mock('obsidian', () => {}, { virtual: true });
import { DateTime } from 'luxon';

import { DEFAULT_SETTINGS } from '../settings';
import {
  decrementDailyStats,
  getRemainingDailyLimits,
  getReviewDayStart,
  incrementDailyStats,
  isWithinDailyLimits,
  normalizeDailyStats,
  shouldCountTowardDailyStats,
} from './dailyStats';
import { Repetition } from './repeatTypes';

const baseRepetition = (overrides: Partial<Repetition> = {}): Repetition => ({
  repeatTimeOfDay: 'AM',
  repeatDueAt: DateTime.fromISO('2026-06-08T10:00:00.000-03:00'),
  fsrs: {
    state: 'review',
    stability: 12,
    difficulty: 5,
    scheduledDays: 7,
    learningSteps: 0,
    reps: 3,
    lapses: 0,
  },
  ...overrides,
});

const learningRepetition = (): Repetition => baseRepetition({
  fsrs: {
    state: 'learning',
    stability: 2,
    difficulty: 5,
    scheduledDays: 0,
    learningSteps: 1,
    reps: 1,
    lapses: 0,
  },
});

describe('getReviewDayStart', () => {
  test('uses previous day before rollover time', () => {
    const now = DateTime.fromISO('2026-06-08T03:00:00.000-03:00');
    const start = getReviewDayStart(now, '06:00');
    expect(start.toISO()).toBe('2026-06-07T06:00:00.000-03:00');
  });

  test('uses same day after rollover time', () => {
    const now = DateTime.fromISO('2026-06-08T10:00:00.000-03:00');
    const start = getReviewDayStart(now, '06:00');
    expect(start.toISO()).toBe('2026-06-08T06:00:00.000-03:00');
  });
});

describe('normalizeDailyStats', () => {
  test('resets counts when review day changes', () => {
    const now = DateTime.fromISO('2026-06-08T10:00:00.000-03:00');
    const stats = normalizeDailyStats({
      reviewDayStartMs: getReviewDayStart(
        DateTime.fromISO('2026-06-07T10:00:00.000-03:00'),
        '06:00',
      ).toMillis(),
      newReviewed: 5,
      reviewsReviewed: 10,
    }, '06:00', now);

    expect(stats.newReviewed).toBe(0);
    expect(stats.reviewsReviewed).toBe(0);
    expect(stats.reviewDayStartMs).toBe(getReviewDayStart(now, '06:00').toMillis());
  });

  test('migrates legacy reviewDayStart strings', () => {
    const now = DateTime.fromISO('2026-06-08T10:00:00.000-03:00');
    const stats = normalizeDailyStats({
      reviewDayStart: '2026-06-08T06:00:00.000-03:00',
      newReviewed: 3,
      reviewsReviewed: 4,
    }, '06:00', now);

    expect(stats.newReviewed).toBe(3);
    expect(stats.reviewsReviewed).toBe(4);
    expect(stats.reviewDayStartMs).toBe(getReviewDayStart(now, '06:00').toMillis());
  });
});

describe('getRemainingDailyLimits', () => {
  test('new cards consume review budget', () => {
    const settings = { ...DEFAULT_SETTINGS, maxNewPerDay: 20, maxReviewsPerDay: 200 };
    const limits = getRemainingDailyLimits(settings, {
      reviewDayStartMs: 0,
      newReviewed: 5,
      reviewsReviewed: 10,
    });

    expect(limits.reviewRemaining).toBe(185);
    expect(limits.newRemaining).toBe(15);
  });

  test('returns null remaining when limit is disabled', () => {
    const settings = { ...DEFAULT_SETTINGS, maxNewPerDay: 0, maxReviewsPerDay: 0 };
    const limits = getRemainingDailyLimits(settings, {
      reviewDayStartMs: 0,
      newReviewed: 5,
      reviewsReviewed: 10,
    });

    expect(limits.newRemaining).toBeNull();
    expect(limits.reviewRemaining).toBeNull();
  });
});

describe('incrementDailyStats', () => {
  test('tracks new and review cards separately', () => {
    const stats = {
      reviewDayStartMs: 0,
      newReviewed: 1,
      reviewsReviewed: 2,
    };

    const afterNew = incrementDailyStats(stats, baseRepetition({
      fsrs: { state: 'new', stability: 0, difficulty: 0, scheduledDays: 0,
        learningSteps: 0, reps: 0, lapses: 0 },
    }));
    expect(afterNew.newReviewed).toBe(2);

    const afterReview = incrementDailyStats(stats, baseRepetition());
    expect(afterReview.reviewsReviewed).toBe(3);
  });

  test('does not count learning steps', () => {
    const stats = {
      reviewDayStartMs: 0,
      newReviewed: 1,
      reviewsReviewed: 2,
    };
    const afterLearning = incrementDailyStats(stats, learningRepetition());
    expect(afterLearning).toEqual(stats);
  });
});

describe('decrementDailyStats', () => {
  test('does not go below zero', () => {
    const stats = {
      reviewDayStartMs: 0,
      newReviewed: 0,
      reviewsReviewed: 0,
    };
    const after = decrementDailyStats(stats, baseRepetition());
    expect(after.reviewsReviewed).toBe(0);
  });
});

describe('shouldCountTowardDailyStats', () => {
  test('ignores learning and relearning cards', () => {
    expect(shouldCountTowardDailyStats(learningRepetition())).toBe(false);
    expect(shouldCountTowardDailyStats(baseRepetition({
      fsrs: { state: 'relearning', stability: 1, difficulty: 5, scheduledDays: 0,
        learningSteps: 1, reps: 2, lapses: 1 },
    }))).toBe(false);
  });
});

describe('isWithinDailyLimits', () => {
  test('blocks new cards when new limit is exhausted', () => {
    const limits = { newRemaining: 0, reviewRemaining: 10 };
    expect(isWithinDailyLimits(baseRepetition({
      fsrs: { state: 'new', stability: 0, difficulty: 0, scheduledDays: 0,
        learningSteps: 0, reps: 0, lapses: 0 },
    }), limits)).toBe(false);
  });

  test('blocks review cards when review limit is exhausted', () => {
    const limits = { newRemaining: 10, reviewRemaining: 0 };
    expect(isWithinDailyLimits(baseRepetition(), limits)).toBe(false);
  });

  test('always allows learning cards even when limits are exhausted', () => {
    const limits = { newRemaining: 0, reviewRemaining: 0 };
    expect(isWithinDailyLimits(learningRepetition(), limits)).toBe(true);
  });
});
