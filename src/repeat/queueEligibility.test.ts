import { DateTime } from 'luxon';

import {
  getQueueEligibility,
  isDueForReview,
  isGraduatedReview,
  isIntradayLearning,
  isNewCard,
} from './queueEligibility';
import { Repetition } from './repeatTypes';

const now = DateTime.fromISO('2026-06-08T12:00:00.000-03:00', { setZone: true });

function makeRep(overrides: Partial<Repetition> = {}): Repetition {
  return {
    repeatTimeOfDay: 'AM',
    repeatDueAt: now.minus({ hours: 1 }),
    ...overrides,
  };
}

describe('getQueueEligibility / isDueForReview', () => {
  test('classifies missing, suspended, buried, due, and not-due', () => {
    expect(getQueueEligibility(undefined, now)).toBe('not-revisor');
    expect(getQueueEligibility(makeRep({ suspended: true }), now)).toBe('suspended');
    expect(getQueueEligibility(makeRep({
      buriedUntil: now.plus({ hours: 2 }),
    }), now)).toBe('buried');
    expect(getQueueEligibility(makeRep({
      repeatDueAt: now.minus({ minutes: 1 }),
    }), now)).toBe('due');
    expect(isDueForReview(makeRep({
      repeatDueAt: now.minus({ minutes: 1 }),
    }), now)).toBe(true);
    expect(getQueueEligibility(makeRep({
      repeatDueAt: now.plus({ days: 1 }),
    }), now)).toBe('not-due');
  });
});

describe('card state helpers', () => {
  test('isNewCard', () => {
    expect(isNewCard(makeRep())).toBe(true);
    expect(isNewCard(makeRep({
      fsrs: { state: 'new', stability: 0, difficulty: 0, scheduledDays: 0,
        learningSteps: 0, reps: 0, lapses: 0 },
    }))).toBe(true);
    expect(isNewCard(makeRep({
      fsrs: { state: 'review', stability: 5, difficulty: 5, scheduledDays: 3,
        learningSteps: 0, reps: 2, lapses: 0 },
    }))).toBe(false);
  });

  test('isGraduatedReview and isIntradayLearning', () => {
    expect(isGraduatedReview(makeRep({
      fsrs: { state: 'review', stability: 5, difficulty: 5, scheduledDays: 3,
        learningSteps: 0, reps: 2, lapses: 0 },
    }))).toBe(true);
    expect(isIntradayLearning(makeRep({
      fsrs: { state: 'learning', stability: 1, difficulty: 5, scheduledDays: 0,
        learningSteps: 1, reps: 1, lapses: 0 },
    }))).toBe(true);
    expect(isIntradayLearning(makeRep({
      fsrs: { state: 'relearning', stability: 1, difficulty: 5, scheduledDays: 0,
        learningSteps: 1, reps: 2, lapses: 1 },
    }))).toBe(true);
  });
});
