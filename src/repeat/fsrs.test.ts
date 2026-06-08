jest.mock('obsidian', () => {}, { virtual: true });
import { DateTime } from 'luxon';
import { Rating, State } from 'ts-fsrs';

import { getRepeatChoices, SKIP_BUTTON_TEXT } from './choices';
import {
  buildScheduler,
  cardToFsrsState,
  createInitialFsrsRepetition,
  enumToState,
  repetitionToFsrsCard,
} from './fsrs';
import { parseRepetitionFields } from './parsers';
import { serializeFsrsState, serializeRepetition } from './serializers';
import { Repetition } from './repeatTypes';

const mockSettings = {
  morningReviewTime: '06:00',
  eveningReviewTime: '18:00',
  enqueueNonRepeatingNotes: false,
  fsrsEnabled: true,
  fsrsRequestRetention: 0.9,
  fsrsMaximumInterval: 36500,
  fsrsEnableFuzz: false,
  fsrsEnableShortTerm: true,
  fsrsLearningSteps: '1m, 10m',
  fsrsRelearningSteps: '10m',
  fsrsWeights: null,
  defaultRepeat: {
    repeatStrategy: 'SPACED',
    repeatPeriod: 1,
    repeatPeriodUnit: 'DAY',
    repeatTimeOfDay: 'AM',
  },
};

const referenceDueAt = '2024-06-01T06:00:00.000-05:00';
const mockNow = DateTime.fromObject({ year: 2024, month: 6, day: 15, hour: 10 });

describe('parseRepetitionFields FSRS', () => {
  test('parses repeat: fsrs', () => {
    const repetition = parseRepetitionFields('fsrs', referenceDueAt);
    expect(repetition.repeatStrategy).toBe('FSRS');
    expect(repetition.repeatPeriodUnit).toBe('DAY');
  });

  test('parses fsrs in the evening', () => {
    const repetition = parseRepetitionFields('fsrs in the evening', referenceDueAt);
    expect(repetition.repeatStrategy).toBe('FSRS');
    expect(repetition.repeatTimeOfDay).toBe('PM');
  });

  test('parses nested fsrs frontmatter block', () => {
    const fsrsBlock = {
      state: 'review',
      stability: 8.42,
      difficulty: 4.7,
      scheduled_days: 7,
      learning_steps: 0,
      reps: 5,
      lapses: 0,
      last_review: '2024-06-01T06:00:00.000-05:00',
    };
    const repetition = parseRepetitionFields(
      'fsrs',
      referenceDueAt,
      undefined,
      undefined,
      { fsrs: fsrsBlock },
    );
    expect(repetition.fsrs).toEqual({
      state: 'review',
      stability: 8.42,
      difficulty: 4.7,
      scheduledDays: 7,
      learningSteps: 0,
      reps: 5,
      lapses: 0,
      lastReview: DateTime.fromISO('2024-06-01T06:00:00.000-05:00'),
    });
  });
});

describe('serializeRepetition FSRS', () => {
  test('serializes fsrs state as JSON', () => {
    const repetition: Repetition = {
      repeatStrategy: 'FSRS',
      repeatPeriod: 1,
      repeatPeriodUnit: 'DAY',
      repeatTimeOfDay: 'AM',
      repeatDueAt: DateTime.fromISO(referenceDueAt),
      hidden: false,
      virtual: false,
      fsrs: {
        state: 'review',
        stability: 8.42,
        difficulty: 4.7,
        scheduledDays: 7,
        learningSteps: 0,
        reps: 5,
        lapses: 0,
        lastReview: DateTime.fromISO('2024-06-01T06:00:00.000-05:00'),
      },
    };
    const serialized = serializeRepetition(repetition);
    expect(serialized.repeat).toBe('fsrs');
    expect(JSON.parse(String(serialized.fsrs))).toMatchObject({
      state: 'review',
      stability: 8.42,
      reps: 5,
    });
  });

  test('round-trips fsrs frontmatter', () => {
    const repetition: Repetition = {
      repeatStrategy: 'FSRS',
      repeatPeriod: 1,
      repeatPeriodUnit: 'DAY',
      repeatTimeOfDay: 'AM',
      repeatDueAt: DateTime.fromISO(referenceDueAt),
      hidden: true,
      virtual: false,
      fsrs: {
        state: 'learning',
        stability: 2.5,
        difficulty: 5,
        scheduledDays: 0,
        learningSteps: 1,
        reps: 2,
        lapses: 0,
      },
    };
    const serialized = serializeRepetition(repetition);
    const parsed = parseRepetitionFields(
      String(serialized.repeat),
      String(serialized.due_at),
      String(serialized.hidden),
      undefined,
      { fsrs: serialized.fsrs },
    );
    expect(parsed.repeatStrategy).toBe('FSRS');
    expect(parsed.hidden).toBe(true);
    expect(parsed.fsrs?.state).toBe('learning');
    expect(parsed.fsrs?.learningSteps).toBe(1);
  });
});

describe('getRepeatChoices FSRS', () => {
  test('returns skip and four rating buttons for due fsrs notes', () => {
    const originalNow = DateTime.now;
    DateTime.now = () => mockNow;

    try {
      const repetition = createInitialFsrsRepetition(mockSettings as any, false);
      repetition.repeatDueAt = mockNow.minus({ hours: 1 });
      const choices = getRepeatChoices(repetition, mockSettings as any);

      expect(choices[0].text).toBe(SKIP_BUTTON_TEXT);
      expect(choices).toHaveLength(5);
      expect(choices.some((choice) => choice.text.startsWith('Again'))).toBe(true);
      expect(choices.some((choice) => choice.text.startsWith('Good'))).toBe(true);
    } finally {
      DateTime.now = originalNow;
    }
  });
});

describe('fsrs scheduler helpers', () => {
  test('buildScheduler produces valid preview states', () => {
    const scheduler = buildScheduler(mockSettings as any);
    const card = repetitionToFsrsCard(
      createInitialFsrsRepetition(mockSettings as any, false),
      mockNow.toJSDate(),
    );
    const preview = scheduler.repeat(card, mockNow.toJSDate());
    expect(enumToState(preview[Rating.Good].card.state)).toBe('learning');
    expect(preview[Rating.Good].card.reps).toBeGreaterThan(0);
  });

  test('cardToFsrsState maps ts-fsrs card fields', () => {
    const card = {
      due: mockNow.toJSDate(),
      stability: 3,
      difficulty: 5,
      elapsed_days: 0,
      scheduled_days: 1,
      learning_steps: 0,
      reps: 2,
      lapses: 0,
      state: State.Review,
      last_review: mockNow.minus({ days: 1 }).toJSDate(),
    };
    expect(cardToFsrsState(card)).toMatchObject({
      state: 'review',
      stability: 3,
      reps: 2,
    });
  });

  test('serializeFsrsState omits zero defaults', () => {
    const payload = JSON.parse(serializeFsrsState({
      state: 'new',
      stability: 0,
      difficulty: 0,
      scheduledDays: 0,
      learningSteps: 0,
      reps: 0,
      lapses: 0,
    }));
    expect(payload).toEqual({ state: 'new' });
  });
});
