import {
  Card,
  Rating,
  State,
  createEmptyCard,
  fsrs,
  type FSRSParameters,
  type Steps,
} from 'ts-fsrs';
import { DateTime } from 'luxon';

import { RepeatPluginSettings } from '../settings';
import { parseTime } from './parsers';
import { FsrsCardState, Repetition } from './repeatTypes';

const MORNING_REVIEW_TIME = '06:00';

export function parseLearningSteps(steps: string): Steps {
  return steps.split(',').map((step) => step.trim()).filter(Boolean) as Steps;
}

export function buildScheduler(settings: RepeatPluginSettings) {
  const params: Partial<FSRSParameters> = {
    request_retention: settings.fsrsRequestRetention,
    maximum_interval: settings.fsrsMaximumInterval,
    enable_fuzz: settings.fsrsEnableFuzz,
    enable_short_term: settings.fsrsEnableShortTerm,
    learning_steps: parseLearningSteps(settings.fsrsLearningSteps),
    relearning_steps: parseLearningSteps(settings.fsrsRelearningSteps),
  };
  if (settings.fsrsWeights?.length) {
    params.w = settings.fsrsWeights;
  }
  return fsrs(params);
}

function stateToEnum(state: FsrsCardState['state']): State {
  switch (state) {
    case 'learning':
      return State.Learning;
    case 'review':
      return State.Review;
    case 'relearning':
      return State.Relearning;
    default:
      return State.New;
  }
}

export function enumToState(state: State): FsrsCardState['state'] {
  switch (state) {
    case State.Learning:
      return 'learning';
    case State.Review:
      return 'review';
    case State.Relearning:
      return 'relearning';
    default:
      return 'new';
  }
}

export function cardToFsrsState(card: Card): FsrsCardState {
  return {
    state: enumToState(card.state),
    stability: card.stability,
    difficulty: card.difficulty,
    scheduledDays: card.scheduled_days,
    learningSteps: card.learning_steps,
    reps: card.reps,
    lapses: card.lapses,
    lastReview: card.last_review
      ? DateTime.fromJSDate(card.last_review)
      : undefined,
  };
}

export function repetitionToFsrsCard(repetition: Repetition, now: Date): Card {
  if (!repetition.fsrs) {
    return createEmptyCard(now);
  }
  const { fsrs: fsrsState } = repetition;
  return {
    due: repetition.repeatDueAt.toJSDate(),
    stability: fsrsState.stability,
    difficulty: fsrsState.difficulty,
    elapsed_days: 0,
    scheduled_days: fsrsState.scheduledDays,
    learning_steps: fsrsState.learningSteps,
    reps: fsrsState.reps,
    lapses: fsrsState.lapses,
    state: stateToEnum(fsrsState.state),
    last_review: fsrsState.lastReview?.toJSDate(),
  };
}

export function snapDueAtToReviewTime(
  dueAt: DateTime,
  now: DateTime,
): DateTime {
  if (dueAt.minus({ days: 7 }) < now) {
    return dueAt;
  }
  const reviewTime = parseTime(MORNING_REVIEW_TIME);
  return dueAt.set({
    hour: reviewTime.hour,
    minute: reviewTime.minute,
    second: 0,
    millisecond: 0,
  });
}

export function fsrsCardToRepetition(
  card: Card,
  repetition: Repetition,
  settings: RepeatPluginSettings,
  now: DateTime,
): Repetition {
  const repeatDueAt = snapDueAtToReviewTime(
    DateTime.fromJSDate(card.due),
    now,
  );
  return {
    ...repetition,
    repeatDueAt,
    fsrs: cardToFsrsState(card),
  };
}

export function createInitialFsrsRepetition(
  settings: RepeatPluginSettings,
): Repetition {
  const now = DateTime.now();
  const card = createEmptyCard(now.toJSDate());
  return {
    repeatTimeOfDay: 'AM',
    repeatDueAt: now,
    fsrs: cardToFsrsState(card),
  };
}
