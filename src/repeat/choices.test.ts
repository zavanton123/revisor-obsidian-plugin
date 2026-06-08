jest.mock('obsidian', () => {}, { virtual: true });
import { DateTime } from 'luxon';
import { Repetition } from './repeatTypes';
import {
  getRepeatChoices,
  DISMISS_BUTTON_TEXT,
  SKIP_BUTTON_TEXT,
  NEVER_BUTTON_TEXT,
} from './choices';
import { createInitialFsrsRepetition } from './fsrs';

const mockPluginSettings = {
  morningReviewTime: '06:00',
  eveningReviewTime: '18:00',
  enqueueNonRepeatingNotes: false,
  fsrsRequestRetention: 0.9,
  fsrsMaximumInterval: 36500,
  fsrsEnableFuzz: false,
  fsrsEnableShortTerm: true,
  fsrsLearningSteps: '1m, 10m',
  fsrsRelearningSteps: '10m',
  fsrsWeights: null,
  defaultRepeat: { repeatTimeOfDay: 'AM' },
};

const mockNow = DateTime.fromObject({ year: 2024, month: 6, day: 15, hour: 10 });

function isRepetition(nextRepetition: Repetition | 'DISMISS' | 'NEVER'): nextRepetition is Repetition {
  return typeof nextRepetition === 'object' && nextRepetition !== null;
}

test('due fsrs note gets skip and four rating buttons', () => {
  const originalNow = DateTime.now;
  DateTime.now = () => mockNow;

  try {
    const repetition = createInitialFsrsRepetition(mockPluginSettings as any);
    repetition.repeatDueAt = mockNow.minus({ hours: 1 });
    const choices = getRepeatChoices(repetition, mockPluginSettings as any);

    expect(choices[0].text).toBe(SKIP_BUTTON_TEXT);
    expect(choices).toHaveLength(5);
    expect(choices.some((choice) => choice.text.startsWith('Again'))).toBe(true);
    expect(choices.some((choice) => choice.text.startsWith('Good'))).toBe(true);
  } finally {
    DateTime.now = originalNow;
  }
});

test('not-yet-due note gets dismiss only', () => {
  const originalNow = DateTime.now;
  DateTime.now = () => mockNow;

  try {
    const repetition = createInitialFsrsRepetition(mockPluginSettings as any);
    repetition.repeatDueAt = mockNow.plus({ days: 1 });
    const choices = getRepeatChoices(repetition, mockPluginSettings as any);

    expect(choices).toHaveLength(1);
    expect(choices[0].text).toBe(DISMISS_BUTTON_TEXT);
  } finally {
    DateTime.now = originalNow;
  }
});

test('virtual note includes never button when enqueue enabled', () => {
  const settingsWithEnqueue = {
    ...mockPluginSettings,
    enqueueNonRepeatingNotes: true,
  };
  const repetition = {
    ...createInitialFsrsRepetition(mockPluginSettings as any),
    repeatDueAt: mockNow.minus({ hours: 1 }),
    virtual: true,
  };

  const originalNow = DateTime.now;
  DateTime.now = () => mockNow;

  try {
    const choices = getRepeatChoices(repetition, settingsWithEnqueue as any);
    expect(choices.some((choice) => choice.nextRepetition === 'NEVER')).toBe(true);
    expect(choices.find((choice) => choice.text === NEVER_BUTTON_TEXT)).toBeDefined();
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
    const choices = getRepeatChoices(repetition, mockPluginSettings as any);
    const goodChoice = choices.find((choice) => choice.text.startsWith('Good'));

    expect(goodChoice).toBeDefined();
    if (goodChoice && isRepetition(goodChoice.nextRepetition)) {
      expect(goodChoice.nextRepetition.fsrs?.reps).toBeGreaterThan(0);
      expect(goodChoice.nextRepetition.repeatDueAt > mockNow).toBe(true);
    }
  } finally {
    DateTime.now = originalNow;
  }
});
