import { DateTime } from 'luxon';

import { Repetition, QueueEligibility, FsrsStateName } from './repeatTypes';

export function getQueueEligibility(
  repetition: Repetition | undefined,
  now: DateTime,
): QueueEligibility {
  if (!repetition) {
    return 'not-revisor';
  }
  if (repetition.suspended) {
    return 'suspended';
  }
  if (repetition.buriedUntil && repetition.buriedUntil > now) {
    return 'buried';
  }
  if (repetition.repeatDueAt <= now) {
    return 'due';
  }
  return 'not-due';
}

export function isDueForReview(
  repetition: Repetition | undefined,
  now: DateTime,
): boolean {
  return getQueueEligibility(repetition, now) === 'due';
}

function getFsrsState(repetition: Repetition): FsrsStateName | undefined {
  return repetition.fsrs?.state;
}

export function isNewCard(repetition: Repetition): boolean {
  const state = getFsrsState(repetition);
  return state === 'new' || !state;
}

export function isGraduatedReview(repetition: Repetition): boolean {
  const state = getFsrsState(repetition);
  return state === 'review';
}

export function isIntradayLearning(repetition: Repetition): boolean {
  const state = getFsrsState(repetition);
  return state === 'learning' || state === 'relearning';
}
