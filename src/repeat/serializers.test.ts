jest.mock('obsidian', () => {}, { virtual: true });
import { DateTime } from 'luxon';
import { parseRepetitionFields } from './parsers';
import { serializeRepetition } from './serializers';
import { Repetition } from './repeatTypes';

const referenceRepeatDueAt = DateTime.fromISO('2022-03-04T06:00:00.000-05:00');

describe('serializeRepetition round trip', () => {
  const fsrsRepetition: Repetition = {
    repeatTimeOfDay: 'AM',
    repeatDueAt: referenceRepeatDueAt,
    virtual: false,
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
    const { repeat, due_at, fsrs } = serializeRepetition(fsrsRepetition);
    const roundTripped = parseRepetitionFields(
      String(repeat),
      String(due_at ?? ''),
      undefined,
      { fsrs },
    );
    expect(roundTripped).toEqual(fsrsRepetition);
  });

  test('serializes evening repeat string', () => {
    const evening = { ...fsrsRepetition, repeatTimeOfDay: 'PM' as const };
    const { repeat } = serializeRepetition(evening);
    expect(repeat).toBe('fsrs in the evening');
  });
});
