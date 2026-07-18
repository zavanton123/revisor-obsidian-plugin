const parseYaml = jest.fn();
jest.mock('obsidian', () => ({ parseYaml: (...args: unknown[]) => parseYaml(...args) }), { virtual: true });
import { DateTime } from 'luxon';
import {
  isRevisorNote,
  isFsrsRepeat,
  isRepeatDisabled,
  parseBooleanField,
  parseFsrsFromFrontmatter,
  parseRepetition,
  parseRepetitionFromMarkdown,
  parseTime,
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

describe('parseRepetition', () => {
  test('parses revisor note from due_at', () => {
    const repetition = parseRepetition({ due_at: referenceRepeatDueAt });
    expect(repetition).toEqual({
      repeatTimeOfDay: 'AM',
      repeatDueAt: DateTime.fromISO(referenceRepeatDueAt),
      fsrs: undefined,
      suspended: false,
      buriedUntil: undefined,
    });
  });

  test('returns undefined for plain notes', () => {
    expect(parseRepetition({ title: 'plain note' })).toBeUndefined();
    expect(parseRepetition({ repeat: 'daily', due_at: referenceRepeatDueAt })).toBeUndefined();
  });

  test('parses fsrs frontmatter block', () => {
    const repetition = parseRepetition({
      due_at: referenceRepeatDueAt,
      fsrs: {
        state: 'review',
        stability: 8.42,
        reps: 5,
      },
    });
    expect(repetition?.repeatTimeOfDay).toBe('AM');
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

  test('parses suspended and buried fields', () => {
    const now = DateTime.fromISO('2026-06-08T12:00:00.000-03:00');
    const buriedUntil = '2026-06-09T06:00:00.000-03:00';
    const repetition = parseRepetition({
      due_at: referenceRepeatDueAt,
      revisor_suspended: true,
      revisor_buried_until: buriedUntil,
    }, now);
    expect(repetition?.suspended).toBe(true);
    expect(repetition?.buriedUntil?.toISO()).toBe(buriedUntil);
  });

  test('ignores expired buried_until', () => {
    const now = DateTime.fromISO('2026-06-08T12:00:00.000-03:00');
    const repetition = parseRepetition({
      due_at: referenceRepeatDueAt,
      revisor_buried_until: '2026-06-08T06:00:00.000-03:00',
    }, now);
    expect(repetition?.buriedUntil).toBeUndefined();
  });

  test('parses fsrs JSON string and invalid JSON', () => {
    const ok = parseRepetition({
      due_at: referenceRepeatDueAt,
      fsrs: JSON.stringify({ state: 'learning', reps: 2 }),
    });
    expect(ok?.fsrs?.state).toBe('learning');
    expect(ok?.fsrs?.reps).toBe(2);

    const bad = parseRepetition({
      due_at: referenceRepeatDueAt,
      fsrs: '{not-json',
    });
    expect(bad?.fsrs).toBeUndefined();
  });

  test('parses legacy flat fsrs_* fields', () => {
    const repetition = parseRepetition({
      due_at: referenceRepeatDueAt,
      fsrs_state: 'Review',
      fsrs_stability: '3.5',
      fsrs_difficulty: '4',
      fsrs_scheduled_days: '12',
      fsrs_learning_steps: '1',
      fsrs_reps: '4',
      fsrs_lapses: '1',
      fsrs_last_review: '2024-06-01T06:00:00.000-05:00',
    });
    expect(repetition?.fsrs).toMatchObject({
      state: 'review',
      stability: 3.5,
      difficulty: 4,
      scheduledDays: 12,
      learningSteps: 1,
      reps: 4,
      lapses: 1,
    });
    expect(repetition?.fsrs?.lastReview?.toMillis()).toBe(
      DateTime.fromISO('2024-06-01T06:00:00.000-05:00').toMillis(),
    );
  });
});

describe('isRepeatDisabled / parseBooleanField / parseTime', () => {
  test('isRepeatDisabled', () => {
    expect(isRepeatDisabled('never')).toBe(true);
    expect(isRepeatDisabled('OFF')).toBe(true);
    expect(isRepeatDisabled('fsrs')).toBe(false);
  });

  test('parseBooleanField', () => {
    expect(parseBooleanField(true)).toBe(true);
    expect(parseBooleanField('yes')).toBe(true);
    expect(parseBooleanField('1')).toBe(true);
    expect(parseBooleanField('no')).toBe(false);
    expect(parseBooleanField(0)).toBe(false);
  });

  test('parseTime', () => {
    expect(parseTime('06:30')).toEqual({ hour: 6, minute: 30 });
  });
});

describe('parseFsrsFromFrontmatter / parseRepetitionFromMarkdown', () => {
  test('returns undefined without fsrs metadata', () => {
    expect(parseFsrsFromFrontmatter(null)).toBeUndefined();
    expect(parseFsrsFromFrontmatter({ due_at: referenceRepeatDueAt })).toBeUndefined();
  });

  test('parses repetition from markdown frontmatter', () => {
    parseYaml.mockReturnValue({ due_at: referenceRepeatDueAt, revisor_suspended: 'yes' });
    const markdown = [
      '---',
      'due_at: ignored-by-mock',
      '---',
      'Body',
      '',
    ].join('\n');
    const repetition = parseRepetitionFromMarkdown(markdown);
    expect(repetition?.suspended).toBe(true);
    expect(repetition?.repeatDueAt.toMillis()).toBe(
      DateTime.fromISO(referenceRepeatDueAt).toMillis(),
    );
  });

  test('returns undefined when markdown has no frontmatter', () => {
    expect(parseRepetitionFromMarkdown('no yaml here')).toBeUndefined();
  });
});
