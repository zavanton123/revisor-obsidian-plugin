jest.mock('obsidian', () => {}, { virtual: true });
import { DateTime } from 'luxon';
import {
  isRevisorNote,
  isFsrsRepeat,
  parseRepetition,
  parseReviewTimeOfDay,
} from './parsers';

const referenceRepeatDueAt = '2022-03-04T06:00:00.000-05:00';

describe('isFsrsRepeat', () => {
  test('matches legacy fsrs repeat strings', () => {
    expect(isFsrsRepeat('fsrs')).toBe(true);
    expect(isFsrsRepeat('FSRS in the evening')).toBe(true);
    expect(isFsrsRepeat('daily')).toBe(false);
  });
});

describe('isRevisorNote', () => {
  test('detects notes with due_at', () => {
    expect(isRevisorNote({ due_at: referenceRepeatDueAt })).toBe(true);
  });

  test('detects notes with fsrs block', () => {
    expect(isRevisorNote({ fsrs: { state: 'new' } })).toBe(true);
  });

  test('detects legacy repeat: fsrs', () => {
    expect(isRevisorNote({ repeat: 'fsrs', due_at: referenceRepeatDueAt })).toBe(true);
  });

  test('rejects disabled repeat field', () => {
    expect(isRevisorNote({ repeat: 'never', due_at: referenceRepeatDueAt })).toBe(false);
  });

  test('rejects notes without revisor metadata', () => {
    expect(isRevisorNote({ title: 'plain note' })).toBe(false);
  });
});

describe('parseReviewTimeOfDay', () => {
  test('reads review_time_of_day field', () => {
    expect(parseReviewTimeOfDay({ review_time_of_day: 'PM' })).toBe('PM');
    expect(parseReviewTimeOfDay({ review_time_of_day: 'AM' })).toBe('AM');
  });

  test('reads legacy repeat field', () => {
    expect(parseReviewTimeOfDay({ repeat: 'fsrs in the evening' })).toBe('PM');
    expect(parseReviewTimeOfDay({ repeat: 'fsrs' })).toBe('AM');
  });
});

describe('parseRepetition', () => {
  test('parses revisor note from due_at', () => {
    const repetition = parseRepetition({ due_at: referenceRepeatDueAt });
    expect(repetition).toEqual({
      repeatTimeOfDay: 'AM',
      repeatDueAt: DateTime.fromISO(referenceRepeatDueAt),
      fsrs: undefined,
    });
  });

  test('returns undefined for plain notes', () => {
    expect(parseRepetition({ title: 'plain note' })).toBeUndefined();
    expect(parseRepetition({ repeat: 'daily', due_at: referenceRepeatDueAt })).toBeUndefined();
  });

  test('parses fsrs frontmatter block', () => {
    const repetition = parseRepetition({
      due_at: referenceRepeatDueAt,
      review_time_of_day: 'PM',
      fsrs: {
        state: 'review',
        stability: 8.42,
        reps: 5,
      },
    });
    expect(repetition?.repeatTimeOfDay).toBe('PM');
    expect(repetition?.fsrs).toMatchObject({
      state: 'review',
      stability: 8.42,
      reps: 5,
    });
  });

  test('invalid due_at falls back to reference time', () => {
    const repetition = parseRepetition(
      { due_at: 'not-a-date' },
      DateTime.fromISO('2024-01-01T06:00:00.000Z'),
    );
    expect(repetition?.repeatDueAt.toMillis()).toBe(
      DateTime.fromISO('2024-01-01T06:00:00.000Z').toMillis(),
    );
  });
});
