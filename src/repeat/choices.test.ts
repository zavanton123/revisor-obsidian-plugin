jest.mock('obsidian', () => {}, { virtual: true });
import { DateTime } from 'luxon';
import { Rating } from 'ts-fsrs';
import { getRepeatChoices, getRepeatChoiceForRating } from './choices';
import { createInitialFsrsRepetition } from './fsrs';

const mockPluginSettings = {
  fsrsRequestRetention: 0.9,
  fsrsMaximumInterval: 36500,
  fsrsEnableFuzz: false,
  fsrsEnableShortTerm: true,
  fsrsLearningSteps: '1m, 10m',
  fsrsRelearningSteps: '10m',
  fsrsWeights: null,
};

const mockNow = DateTime.fromObject({ year: 2024, month: 6, day: 15, hour: 10 });

test('due fsrs note gets four rating buttons', () => {
  const originalNow = DateTime.now;
  DateTime.now = () => mockNow;

  try {
    const repetition = createInitialFsrsRepetition(mockPluginSettings as any);
    repetition.repeatDueAt = mockNow.minus({ hours: 1 });
    const choices = getRepeatChoices(repetition, mockPluginSettings as any);

    expect(choices).toHaveLength(4);
    expect(choices.map((c) => c.rating)).toEqual([
      Rating.Again,
      Rating.Hard,
      Rating.Good,
      Rating.Easy,
    ]);
    expect(choices.some((choice) => choice.text.startsWith('Again'))).toBe(true);
    expect(choices.some((choice) => choice.text.startsWith('Good'))).toBe(true);
  } finally {
    DateTime.now = originalNow;
  }
});

test('not-yet-due note gets no choices', () => {
  const originalNow = DateTime.now;
  DateTime.now = () => mockNow;

  try {
    const repetition = createInitialFsrsRepetition(mockPluginSettings as any);
    repetition.repeatDueAt = mockNow.plus({ days: 1 });
    const choices = getRepeatChoices(repetition, mockPluginSettings as any);

    expect(choices).toHaveLength(0);
  } finally {
    DateTime.now = originalNow;
  }
});

test('rating choices update fsrs state', () => {
  const originalNow = DateTime.now;
  DateTime.now = () => mockNow;

  try {
    const repetition = createInitialFsrsRepetition(mockPluginSettings as any);
    repetition.repeatDueAt = mockNow.minus({ hours: 1 });
    const goodChoice = getRepeatChoiceForRating(
      repetition,
      mockPluginSettings as any,
      Rating.Good,
    );

    expect(goodChoice).toBeDefined();
    if (goodChoice) {
      expect(goodChoice.nextRepetition.fsrs?.reps).toBeGreaterThan(0);
      expect(goodChoice.nextRepetition.repeatDueAt > mockNow).toBe(true);
    }
  } finally {
    DateTime.now = originalNow;
  }
});
