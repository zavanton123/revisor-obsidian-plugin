jest.mock('obsidian', () => {}, { virtual: true });
import { DateTime } from 'luxon';

import { DEFAULT_SETTINGS } from '../settings';
import {
  createEmptyDailyStudy,
  extendDailyLimits,
  getCurrentStudyDayKey,
  getEffectiveLimits,
  normalizeDailyStudy,
  recordStudy,
} from './dailyStudy';
import {
  buildQueueFromPages,
  matchesCustomStudy,
  matchesQueueMode,
  RevisorQueuePage,
} from './queueBuilder';
import { createSessionConfig } from './sessionStudy';
import {
  countsAsNew,
  countsAsReview,
  getStudyCardKind,
} from './studyCardKind';
import { Repetition } from './repeatTypes';

const now = DateTime.fromISO('2026-06-08T12:00:00.000-03:00');

const page = (
  overrides: Partial<Repetition> = {},
  filePath = 'note.md',
): RevisorQueuePage => ({
  filePath,
  repetition: {
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
  },
});

describe('getStudyCardKind', () => {
  test('classifies new notes', () => {
    expect(getStudyCardKind(page({ fsrs: { state: 'new', stability: 0, difficulty: 0, scheduledDays: 0, learningSteps: 0, reps: 0, lapses: 0 } }).repetition)).toBe('new');
    expect(getStudyCardKind(page({ fsrs: undefined }).repetition)).toBe('new');
  });

  test('classifies learning and review', () => {
    expect(getStudyCardKind(page({ fsrs: { state: 'learning', stability: 1, difficulty: 5, scheduledDays: 0, learningSteps: 1, reps: 1, lapses: 0 } }).repetition)).toBe('learning');
    expect(getStudyCardKind(page().repetition)).toBe('review');
  });

  test('countsAs helpers', () => {
    expect(countsAsNew('new')).toBe(true);
    expect(countsAsReview('learning')).toBe(true);
    expect(countsAsReview('review')).toBe(true);
  });
});

describe('dailyStudy', () => {
  test('getCurrentStudyDayKey respects dayStartsAt', () => {
    const early = DateTime.fromISO('2026-06-08T05:00:00.000-03:00');
    expect(getCurrentStudyDayKey(early, '06:00')).toBe('2026-06-07');
    expect(getCurrentStudyDayKey(now, '06:00')).toBe('2026-06-08');
  });

  test('normalizeDailyStudy resets on day change', () => {
    const stale = createEmptyDailyStudy('2026-06-07');
    stale.newStudied = 5;
    const normalized = normalizeDailyStudy(stale, now, '06:00');
    expect(normalized.studyDayKey).toBe('2026-06-08');
    expect(normalized.newStudied).toBe(0);
  });

  test('getEffectiveLimits and extend', () => {
    const settings = { ...DEFAULT_SETTINGS, maxNewPerDay: 5, maxReviewsPerDay: 10 };
    let daily = createEmptyDailyStudy('2026-06-08');
    daily.newStudied = 3;
    daily.reviewStudied = 8;
    expect(getEffectiveLimits(settings, daily)).toEqual({
      newRemaining: 2,
      reviewRemaining: 2,
    });
    daily = extendDailyLimits(daily, 0, 5);
    expect(getEffectiveLimits(settings, daily).reviewRemaining).toBe(7);
    daily = recordStudy(daily, 'new');
    expect(daily.newStudied).toBe(4);
    daily = recordStudy(daily, 'review');
    expect(daily.reviewStudied).toBe(9);
  });

  test('new limit capped by review limit', () => {
    const settings = {
      ...DEFAULT_SETTINGS,
      maxNewPerDay: 20,
      maxReviewsPerDay: 5,
      newCardsIgnoreReviewLimit: false,
    };
    const daily = createEmptyDailyStudy('2026-06-08');
    expect(getEffectiveLimits(settings, daily).newRemaining).toBe(5);
  });
});

describe('queueBuilder', () => {
  const baseOptions = () => ({
    settings: DEFAULT_SETTINGS,
    dailyStudy: createEmptyDailyStudy('2026-06-08'),
    session: createSessionConfig(),
    now,
  });

  test('returns due notes sorted by due_at', () => {
    const pages = [
      page({ repeatDueAt: DateTime.fromISO('2026-06-08T11:00:00.000-03:00') }, 'b.md'),
      page({ repeatDueAt: DateTime.fromISO('2026-06-08T09:00:00.000-03:00') }, 'a.md'),
    ];
    const built = buildQueueFromPages(pages, baseOptions());
    expect(built.notes.map((n) => n.filePath)).toEqual(['a.md', 'b.md']);
  });

  test('excludes suspended and buried', () => {
    const pages = [
      page({ suspended: true }),
      page({ buriedUntil: now.plus({ hours: 1 }) }),
      page({}, 'ok.md'),
    ];
    const built = buildQueueFromPages(pages, baseOptions());
    expect(built.notes).toHaveLength(1);
    expect(built.notes[0].filePath).toBe('ok.md');
  });

  test('applies daily review limit', () => {
    const pages = Array.from({ length: 5 }, (_, i) =>
      page({}, `r${i}.md`));
    const built = buildQueueFromPages(pages, {
      ...baseOptions(),
      settings: { ...DEFAULT_SETTINGS, maxReviewsPerDay: 2 },
    });
    expect(built.notes).toHaveLength(2);
    expect(built.stats.limitedOutReview).toBe(3);
    expect(built.stats.blockedByDailyLimit).toBe(true);
  });

  test('new-only mode', () => {
    const pages = [
      page({}, 'review.md'),
      page({
        fsrs: { state: 'new', stability: 0, difficulty: 0, scheduledDays: 0, learningSteps: 0, reps: 0, lapses: 0 },
      }, 'new.md'),
    ];
    const built = buildQueueFromPages(pages, {
      ...baseOptions(),
      session: createSessionConfig({ queueMode: 'new-only' }),
    });
    expect(built.notes).toHaveLength(1);
    expect(built.notes[0].filePath).toBe('new.md');
  });

  test('review-ahead includes not-yet-due notes', () => {
    const pages = [
      page({ repeatDueAt: now.plus({ days: 3 }) }, 'ahead.md'),
      page({ repeatDueAt: now.plus({ days: 20 }) }, 'far.md'),
    ];
    const built = buildQueueFromPages(pages, {
      ...baseOptions(),
      session: createSessionConfig({
        customStudy: { kind: 'review-ahead', daysAhead: 7 },
      }),
    });
    expect(built.notes.map((n) => n.filePath)).toEqual(['ahead.md']);
  });

  test('lapses-only filter', () => {
    expect(matchesCustomStudy(page({ fsrs: { state: 'review', stability: 1, difficulty: 5, scheduledDays: 1, learningSteps: 0, reps: 2, lapses: 2 } }).repetition, { kind: 'lapses-only' })).toBe(true);
    expect(matchesCustomStudy(page().repetition, { kind: 'lapses-only' })).toBe(false);
  });

  test('matchesQueueMode reviews-only', () => {
    expect(matchesQueueMode(page().repetition, 'reviews-only')).toBe(true);
    expect(matchesQueueMode(page({
      fsrs: { state: 'new', stability: 0, difficulty: 0, scheduledDays: 0, learningSteps: 0, reps: 0, lapses: 0 },
    }).repetition, 'reviews-only')).toBe(false);
  });
});
