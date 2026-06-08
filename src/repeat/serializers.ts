import { Repetition, FsrsCardState } from './repeatTypes';

export const FSRS_FRONTMATTER_FIELDS = [
  'fsrs',
  'fsrs_state',
  'fsrs_stability',
  'fsrs_difficulty',
  'fsrs_scheduled_days',
  'fsrs_learning_steps',
  'fsrs_reps',
  'fsrs_lapses',
  'fsrs_last_review',
  'hidden',
  'repeat',
];

function roundNumber(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export function serializeFsrsState(fsrs: FsrsCardState): string {
  const payload: Record<string, string | number> = {
    state: fsrs.state,
  };
  if (fsrs.stability) {
    payload.stability = roundNumber(fsrs.stability, 4);
  }
  if (fsrs.difficulty) {
    payload.difficulty = roundNumber(fsrs.difficulty, 3);
  }
  if (fsrs.scheduledDays) {
    payload.scheduled_days = fsrs.scheduledDays;
  }
  if (fsrs.learningSteps) {
    payload.learning_steps = fsrs.learningSteps;
  }
  if (fsrs.reps) {
    payload.reps = fsrs.reps;
  }
  if (fsrs.lapses) {
    payload.lapses = fsrs.lapses;
  }
  if (fsrs.lastReview) {
    payload.last_review = fsrs.lastReview.toISO() || '';
  }
  return JSON.stringify(payload);
}

export function serializeRepetition(repetition: Repetition) {
  const serialized: Record<string, string | undefined> = {
    repeat: undefined,
    due_at: repetition.repeatDueAt.toISO() || undefined,
    review_time_of_day: repetition.repeatTimeOfDay,
    hidden: undefined,
  };
  if (repetition.fsrs) {
    serialized.fsrs = serializeFsrsState(repetition.fsrs);
  } else {
    serialized.fsrs = undefined;
  }
  FSRS_FRONTMATTER_FIELDS.forEach((field) => {
    if (field !== 'fsrs' && field !== 'hidden' && field !== 'repeat') {
      serialized[field] = undefined;
    }
  });
  return serialized;
}
