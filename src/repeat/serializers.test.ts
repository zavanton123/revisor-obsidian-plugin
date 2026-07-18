jest.mock('obsidian', () => {}, { virtual: true });
import { DateTime } from 'luxon';
import { parseRepetition } from './parsers';
import {
  serializeFsrsState,
  serializeQueueMetadata,
  serializeRepetition,
} from './serializers';
import { Repetition } from './repeatTypes';

const referenceRepeatDueAt = DateTime.fromISO('2022-03-04T06:00:00.000-05:00');

describe('serializeRepetition round trip', () => {
  const fsrsRepetition: Repetition = {
    repeatTimeOfDay: 'AM',
    repeatDueAt: referenceRepeatDueAt,
    suspended: false,
    fsrs: {
      state: 'review',
      stability: 8.42,
      difficulty: 4.7,
      scheduledDays: 7,
      learningSteps: 0,
      reps: 5,
      lapses: 0,
      lastReview: DateTime.fromISO('2022-03-01T06:00:00.000-05:00'),
    },
  };

  test('retains fsrs repetition fields', () => {
    const serialized = serializeRepetition(fsrsRepetition);
    const roundTripped = parseRepetition({
      due_at: serialized.due_at,
      fsrs: serialized.fsrs,
    });
    expect(roundTripped).toEqual(fsrsRepetition);
  });

  test('does not serialize review_time_of_day or repeat', () => {
    const serialized = serializeRepetition(fsrsRepetition);
    expect(serialized.review_time_of_day).toBeUndefined();
    expect(serialized.repeat).toBeUndefined();
  });

  test('serializes suspended and buried, clears fsrs when missing', () => {
    const buried = DateTime.fromISO('2026-06-09T06:00:00.000-03:00');
    const serialized = serializeRepetition({
      ...fsrsRepetition,
      fsrs: undefined,
      suspended: true,
      buriedUntil: buried,
    });
    expect(serialized.fsrs).toBeUndefined();
    expect(serialized.revisor_suspended).toBe('true');
    expect(serialized.revisor_buried_until).toBe(buried.toISO());
  });
});

describe('serializeFsrsState / serializeQueueMetadata', () => {
  test('includes learning steps, lapses, and last review', () => {
    const lastReview = DateTime.fromISO('2024-01-02T03:04:05.000-03:00');
    const json = serializeFsrsState({
      state: 'relearning',
      stability: 1.23456,
      difficulty: 4.5678,
      scheduledDays: 0,
      learningSteps: 2,
      reps: 3,
      lapses: 1,
      lastReview,
    });
    expect(JSON.parse(json)).toMatchObject({
      state: 'relearning',
      stability: 1.2346,
      difficulty: 4.568,
      learning_steps: 2,
      reps: 3,
      lapses: 1,
      last_review: lastReview.toISO(),
    });
  });

  test('queue metadata clears legacy fields not provided', () => {
    const serialized = serializeQueueMetadata({
      due_at: 'x',
      revisor_suspended: 'true',
    });
    expect(serialized.due_at).toBe('x');
    expect(serialized.revisor_suspended).toBe('true');
    expect(serialized.fsrs).toBeUndefined();
    expect(serialized.repeat).toBeUndefined();
  });
});
