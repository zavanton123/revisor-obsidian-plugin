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

export const FSRS_RATING_LABELS: Record<Rating, string> = {
  [Rating.Manual]: 'Manual',
  [Rating.Again]: 'Again',
  [Rating.Hard]: 'Hard',
  [Rating.Good]: 'Good',
  [Rating.Easy]: 'Easy',
};

export const FSRS_RATINGS = [Rating.Again, Rating.Hard, Rating.Good, Rating.Easy];

function getFsrsRepeatChoices(
  repetition: Repetition,
  now: DateTime,
  settings: RepeatPluginSettings,
  treatAsDue = false,
): RepeatChoice[] {
  const { repeatDueAt } = repetition;
  if (!treatAsDue && (repeatDueAt > now || !repeatDueAt)) {
    return [];
  }

  const scheduler = buildScheduler(settings);
  const reviewDate = now.toJSDate();
  const card = repetitionToFsrsCard(repetition, reviewDate);
  const preview = scheduler.repeat(card, reviewDate);

  return FSRS_RATINGS.map((rating) => {
    const { card: nextCard } = preview[rating];
    const nextRepetition = fsrsCardToRepetition(
      nextCard,
      repetition,
      settings,
      now,
    );
    return {
      rating,
      text: `${FSRS_RATING_LABELS[rating]} — ${summarizeDueAt(nextRepetition.repeatDueAt, now)}`,
      nextRepetition,
    };
  });
}

export function getRepeatChoices(
  repetition: Repetition | undefined | null,
  settings: RepeatPluginSettings,
  options?: { treatAsDue?: boolean },
): RepeatChoice[] {
  if (!repetition) {
    return [];
  }
  const now = DateTime.now();
  return getFsrsRepeatChoices(
    repetition,
    now,
    settings,
    options?.treatAsDue ?? false,
  );
}

export function getRepeatChoiceForRating(
  repetition: Repetition | undefined | null,
  settings: RepeatPluginSettings,
  rating: Rating,
): RepeatChoice | undefined {
  return getRepeatChoices(repetition, settings)
    .find((choice) => choice.rating === rating);
}
