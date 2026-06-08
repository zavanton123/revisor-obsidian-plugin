import { DateTime } from 'luxon';
import { Rating } from 'ts-fsrs';

import { summarizeDueAt } from './utils';
import { Repetition, RepeatChoice } from './repeatTypes';
import { RepeatPluginSettings } from '../settings';
import {
  buildScheduler,
  fsrsCardToRepetition,
  repetitionToFsrsCard,
} from './fsrs';

export const DISMISS_BUTTON_TEXT = 'Dismiss';
export const NEVER_BUTTON_TEXT = 'Never';

export const SKIP_PERIOD_MINUTES = 5;
export const SKIP_BUTTON_TEXT = `${SKIP_PERIOD_MINUTES} minutes (skip)`;

const FSRS_RATING_LABELS: Record<Rating, string> = {
  [Rating.Manual]: 'Manual',
  [Rating.Again]: 'Again',
  [Rating.Hard]: 'Hard',
  [Rating.Good]: 'Good',
  [Rating.Easy]: 'Easy',
};

const FSRS_RATINGS = [Rating.Again, Rating.Hard, Rating.Good, Rating.Easy];

const getSkipDateTime = (now: DateTime) => (
  now.plus({
    minutes: SKIP_PERIOD_MINUTES,
  })
);

function getFsrsRepeatChoices(
  repetition: Repetition,
  now: DateTime,
  settings: RepeatPluginSettings,
): RepeatChoice[] {
  const { repeatDueAt } = repetition;
  if ((repeatDueAt > now) || !repeatDueAt) {
    return [{
      text: DISMISS_BUTTON_TEXT,
      nextRepetition: 'DISMISS',
    }];
  }

  const scheduler = buildScheduler(settings);
  const reviewDate = now.toJSDate();
  const card = repetitionToFsrsCard(repetition, reviewDate);
  const preview = scheduler.repeat(card, reviewDate);

  const ratingChoices: RepeatChoice[] = FSRS_RATINGS.map((rating) => {
    const { card: nextCard } = preview[rating];
    const nextRepetition = fsrsCardToRepetition(
      nextCard,
      repetition,
      settings,
      now,
    );
    return {
      text: `${FSRS_RATING_LABELS[rating]} — ${summarizeDueAt(nextRepetition.repeatDueAt, now)}`,
      nextRepetition,
    };
  });

  const choices: RepeatChoice[] = [
    {
      text: SKIP_BUTTON_TEXT,
      nextRepetition: {
        ...repetition,
        repeatDueAt: getSkipDateTime(now),
      },
    },
    ...ratingChoices,
  ];

  if (settings.enqueueNonRepeatingNotes && repetition.virtual) {
    choices.push({
      text: NEVER_BUTTON_TEXT,
      nextRepetition: 'NEVER',
    });
  }

  return choices;
}

export function getRepeatChoices(
  repetition: Repetition | undefined | null,
  settings: RepeatPluginSettings
): RepeatChoice[] {
  if (!repetition) {
    return [];
  }
  const now = DateTime.now();
  return getFsrsRepeatChoices(repetition, now, settings);
}
