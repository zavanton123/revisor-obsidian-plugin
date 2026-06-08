jest.mock('obsidian', () => {}, { virtual: true });
import { DateTime } from 'luxon';
import { parseRepetition } from './parsers';
import { serializeRepetition } from './serializers';
import { Repetition } from './repeatTypes';

const referenceRepeatDueAt = DateTime.fromISO('2022-03-04T06:00:00.000-05:00');

describe('serializeRepetition round trip', () => {
  const fsrsRepetition: Repetition = {
    repeatTimeOfDay: 'AM',
    repeatDueAt: referenceRepeatDueAt,
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
      review_time_of_day: serialized.review_time_of_day,
      fsrs: serialized.fsrs,
    });
    expect(roundTripped).toEqual(fsrsRepetition);
  });

  test('serializes evening review time', () => {
    const evening = { ...fsrsRepetition, repeatTimeOfDay: 'PM' as const };
    const serialized = serializeRepetition(evening);
    expect(serialized.review_time_of_day).toBe('PM');
    expect(serialized.repeat).toBeUndefined();
  });
});
