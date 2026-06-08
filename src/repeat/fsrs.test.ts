jest.mock('obsidian', () => {}, { virtual: true });
import { DateTime } from 'luxon';
import { Rating, State } from 'ts-fsrs';

import { getRepeatChoices } from './choices';
import {
  buildScheduler,
  cardToFsrsState,
  createInitialFsrsRepetition,
  enumToState,
  repetitionToFsrsCard,
} from './fsrs';
import { parseRepetition } from './parsers';
import { serializeFsrsState, serializeRepetition } from './serializers';
import { Repetition } from './repeatTypes';

const mockSettings = {
  fsrsRequestRetention: 0.9,
  fsrsMaximumInterval: 36500,
  fsrsEnableFuzz: false,
  fsrsEnableShortTerm: true,
  fsrsLearningSteps: '1m, 10m',
  fsrsRelearningSteps: '10m',
  fsrsWeights: null,
};

const referenceDueAt = '2024-06-01T06:00:00.000-05:00';
const mockNow = DateTime.fromObject({ year: 2024, month: 6, day: 15, hour: 10 });

describe('parseRepetition FSRS', () => {
  test('parses note with due_at', () => {
    const repetition = parseRepetition({ due_at: referenceDueAt });
    expect(repetition?.repeatTimeOfDay).toBe('AM');
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
    const repetition = parseRepetition({
      due_at: referenceDueAt,
      fsrs: fsrsBlock,
    });
    expect(repetition?.fsrs).toEqual({
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
  test('serializes fsrs state without repeat field', () => {
    const repetition: Repetition = {
      repeatTimeOfDay: 'AM',
      repeatDueAt: DateTime.fromISO(referenceDueAt),
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
    expect(serialized.repeat).toBeUndefined();
    expect(serialized.review_time_of_day).toBeUndefined();
    expect(JSON.parse(String(serialized.fsrs))).toMatchObject({
      state: 'review',
      stability: 8.42,
      reps: 5,
    });
  });

  test('round-trips fsrs frontmatter', () => {
    const repetition: Repetition = {
      repeatTimeOfDay: 'AM',
      repeatDueAt: DateTime.fromISO(referenceDueAt),
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
    const parsed = parseRepetition({
      due_at: serialized.due_at,
      fsrs: serialized.fsrs,
    });
    expect(parsed?.repeatTimeOfDay).toBe('AM');
    expect(parsed?.fsrs?.state).toBe('learning');
    expect(parsed?.fsrs?.learningSteps).toBe(1);
  });
});

describe('getRepeatChoices FSRS', () => {
  test('returns four rating buttons for due fsrs notes', () => {
    const originalNow = DateTime.now;
    DateTime.now = () => mockNow;

    try {
      const repetition = createInitialFsrsRepetition(mockSettings as any);
      repetition.repeatDueAt = mockNow.minus({ hours: 1 });
      const choices = getRepeatChoices(repetition, mockSettings as any);

      expect(choices).toHaveLength(4);
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
      createInitialFsrsRepetition(mockSettings as any),
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
