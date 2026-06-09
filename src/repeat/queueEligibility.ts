import { DateTime } from 'luxon';

import { Repetition, QueueEligibility } from './repeatTypes';

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
