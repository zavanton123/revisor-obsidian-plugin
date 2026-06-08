jest.mock('obsidian', () => {}, { virtual: true });
import { DateTime } from 'luxon';
import { parseRepetitionFields, parseRepeat, isFsrsRepeat } from './parsers';

const referenceRepeatDueAt = '2022-03-04T06:00:00.000-05:00';

describe('parseRepeat', () => {
  test('parses fsrs', () => {
    expect(parseRepeat('fsrs')).toEqual({ repeatTimeOfDay: 'AM' });
  });

  test('parses fsrs in the evening', () => {
    expect(parseRepeat('fsrs in the evening')).toEqual({ repeatTimeOfDay: 'PM' });
  });

  test('rejects legacy periodic strings', () => {
    expect(parseRepeat('daily')).toBeUndefined();
    expect(parseRepeat('spaced every day')).toBeUndefined();
    expect(parseRepeat('every week')).toBeUndefined();
  });
});

describe('isFsrsRepeat', () => {
  test('matches fsrs repeat strings', () => {
    expect(isFsrsRepeat('fsrs')).toBe(true);
    expect(isFsrsRepeat('FSRS in the evening')).toBe(true);
    expect(isFsrsRepeat('daily')).toBe(false);
  });
});

describe('parseRepetitionFields', () => {
  test('parses fsrs note', () => {
    const repetition = parseRepetitionFields('fsrs', referenceRepeatDueAt);
    expect(repetition).toEqual({
      repeatTimeOfDay: 'AM',
      repeatDueAt: DateTime.fromISO(referenceRepeatDueAt),
      virtual: false,
      fsrs: undefined,
    });
  });

  test('returns undefined for legacy repeat strings', () => {
    expect(parseRepetitionFields('daily', referenceRepeatDueAt)).toBeUndefined();
    expect(parseRepetitionFields('spaced every day', referenceRepeatDueAt)).toBeUndefined();
  });

  test('parses fsrs frontmatter block', () => {
    const repetition = parseRepetitionFields(
      'fsrs',
      referenceRepeatDueAt,
      undefined,
      {
        fsrs: {
          state: 'review',
          stability: 8.42,
          reps: 5,
        },
      },
    );
    expect(repetition?.fsrs).toMatchObject({
      state: 'review',
      stability: 8.42,
      reps: 5,
    });
  });

  test('invalid due_at falls back to reference time', () => {
    const repetition = parseRepetitionFields(
      'fsrs',
      'not-a-date',
      DateTime.fromISO('2024-01-01T06:00:00.000Z'),
    );
    expect(repetition?.repeatDueAt.toMillis()).toBe(
      DateTime.fromISO('2024-01-01T06:00:00.000Z').toMillis(),
    );
  });
});
