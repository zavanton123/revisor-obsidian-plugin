jest.mock('obsidian', () => {}, { virtual: true });
import { DateTime } from 'luxon';

import { DEFAULT_SETTINGS } from '../settings';
import { getNextDayRollover, buildQueueMetadata } from './queueActions';
import { getQueueEligibility, isDueForReview } from './queueEligibility';
import { Repetition } from './repeatTypes';

const baseRepetition = (overrides: Partial<Repetition> = {}): Repetition => ({
  repeatTimeOfDay: 'AM',
  repeatDueAt: DateTime.fromISO('2026-06-08T10:00:00.000-03:00'),
  fsrs: { state: 'review', stability: 12, difficulty: 5, scheduledDays: 7,
    learningSteps: 0, reps: 3, lapses: 0 },
  suspended: false,
  ...overrides,
});

describe('getQueueEligibility', () => {
  const now = DateTime.fromISO('2026-06-08T12:00:00.000-03:00');

  test('returns not-revisor when repetition is undefined', () => {
    expect(getQueueEligibility(undefined, now)).toBe('not-revisor');
  });

  test('returns due when due_at is in the past and not suspended/buried', () => {
    expect(getQueueEligibility(baseRepetition(), now)).toBe('due');
  });

  test('returns suspended when revisor_suspended is true', () => {
    expect(getQueueEligibility(baseRepetition({ suspended: true }), now)).toBe('suspended');
  });

  test('returns buried when buriedUntil is in the future', () => {
    expect(getQueueEligibility(baseRepetition({
      buriedUntil: now.plus({ hours: 1 }),
    }), now)).toBe('buried');
  });

  test('returns due when buriedUntil is in the past', () => {
    expect(getQueueEligibility(baseRepetition({
      buriedUntil: now.minus({ hours: 1 }),
    }), now)).toBe('due');
  });

  test('returns not-due when due_at is in the future', () => {
    expect(getQueueEligibility(baseRepetition({
      repeatDueAt: now.plus({ days: 1 }),
    }), now)).toBe('not-due');
  });

  test('suspend wins over buried', () => {
    expect(getQueueEligibility(baseRepetition({
      suspended: true,
      buriedUntil: now.plus({ hours: 1 }),
    }), now)).toBe('suspended');
  });
});

describe('isDueForReview', () => {
  const now = DateTime.fromISO('2026-06-08T12:00:00.000-03:00');

  test('is true only for due eligibility', () => {
    expect(isDueForReview(baseRepetition(), now)).toBe(true);
    expect(isDueForReview(baseRepetition({ suspended: true }), now)).toBe(false);
  });
});

describe('getNextDayRollover', () => {
  test('returns next day 06:00 when after rollover', () => {
    const now = DateTime.fromISO('2026-06-08T10:00:00.000-03:00');
    const rollover = getNextDayRollover(now, '06:00');
    expect(rollover.toISO()).toBe('2026-06-09T06:00:00.000-03:00');
  });

  test('returns same day 06:00 when before rollover', () => {
    const now = DateTime.fromISO('2026-06-08T03:00:00.000-03:00');
    const rollover = getNextDayRollover(now, '06:00');
    expect(rollover.toISO()).toBe('2026-06-08T06:00:00.000-03:00');
  });
});

describe('buildQueueMetadata', () => {
  const now = DateTime.fromISO('2026-06-08T10:00:00.000-03:00');
  const repetition = baseRepetition();

  test('suspend preserves due_at and fsrs', () => {
    const metadata = buildQueueMetadata('suspend', repetition, DEFAULT_SETTINGS, now);
    expect(metadata.revisor_suspended).toBe('true');
    expect(metadata.due_at).toBe(repetition.repeatDueAt.toISO());
    expect(metadata.fsrs).toContain('"state":"review"');
  });

  test('bury sets buried_until without changing due_at', () => {
    const metadata = buildQueueMetadata('bury', repetition, DEFAULT_SETTINGS, now);
    expect(metadata.due_at).toBe(repetition.repeatDueAt.toISO());
    expect(metadata.revisor_buried_until).toBe('2026-06-09T06:00:00.000-03:00');
  });

  test('forget resets to new state', () => {
    const metadata = buildQueueMetadata('forget', repetition, DEFAULT_SETTINGS, now);
    expect(metadata.revisor_suspended).toBeUndefined();
    expect(metadata.revisor_buried_until).toBeUndefined();
    expect(metadata.fsrs).toContain('"state":"new"');
    expect(metadata.due_at).toBeTruthy();
  });

  test('unsuspend removes suspended flag', () => {
    const suspended = baseRepetition({ suspended: true });
    const metadata = buildQueueMetadata('unsuspend', suspended, DEFAULT_SETTINGS, now);
    expect(metadata.revisor_suspended).toBeUndefined();
    expect(metadata.due_at).toBe(suspended.repeatDueAt.toISO());
  });

  test('unbury removes buried_until', () => {
    const buried = baseRepetition({
      buriedUntil: now.plus({ hours: 5 }),
    });
    const metadata = buildQueueMetadata('unbury', buried, DEFAULT_SETTINGS, now);
    expect(metadata.revisor_buried_until).toBeUndefined();
  });
});
