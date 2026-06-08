import { PeriodUnit, Repeat, Repetition, FsrsCardState } from './repeatTypes';

const SERIALIZED_TRUE = 'true';
export const SERIALIZED_FALSE = 'false';

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
];

function serializeRepeatPeriodUnit(
  repeatPeriodUnit: PeriodUnit,
  repeatPeriod: number,
): string {
  const suffix = (repeatPeriod === 1) ? '' : 's';
  return `${repeatPeriodUnit.toLowerCase()}${suffix}`;
}

export function serializeRepeat({
  repeatStrategy,
  repeatPeriod,
  repeatPeriodUnit,
  repeatTimeOfDay,
  repeatWeekdays
}: Repeat | Repetition): string {
  if (repeatStrategy === 'FSRS') {
    return [
      'fsrs',
      ...(repeatTimeOfDay === 'AM' ? [] : ['in the evening']),
    ].join(' ');
  }

  // Handle weekday-based repetitions
  if (repeatPeriodUnit === 'WEEKDAYS' && repeatWeekdays && repeatWeekdays.length > 0) {
    const weekdayString = repeatWeekdays.join(', ');
    return [
      ...(repeatStrategy === 'PERIODIC' ? [] : ['spaced']),
      'every',
      weekdayString,
      ...(repeatTimeOfDay === 'AM' ? [] : ['in the evening']),
    ].join(' ');
  }

  // Handle traditional short forms
  if (repeatStrategy === 'PERIODIC'
      && repeatPeriod === 1
      && repeatPeriodUnit !== 'HOUR'
      && repeatTimeOfDay === 'AM'
  ) {
    switch (repeatPeriodUnit) {
      case 'DAY':
        return 'daily';
      case 'WEEK':
        return 'weekly';
      case 'MONTH':
        return 'monthly';
      case 'YEAR':
        return 'yearly';
      default:
        break;
    }
  }

  // Handle traditional time-based repetitions
  return [
    ...(repeatStrategy === 'PERIODIC' ? [] : ['spaced']),
    'every',
    ...(repeatPeriod === 1 ? [] : [`${repeatPeriod}`]),
    serializeRepeatPeriodUnit(repeatPeriodUnit, repeatPeriod),
    ...(repeatTimeOfDay === 'AM' ? [] : ['in the evening']),
  ].join(' ');
}

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

export function serializeRepetition(repetition: Repetition | 'DISMISS' | 'NEVER') {
  if (repetition === 'NEVER') {
    return {
      repeat: 'never',
      due_at: undefined,
      hidden: undefined,
      fsrs: undefined,
      ...Object.fromEntries(FSRS_FRONTMATTER_FIELDS.map((field) => [field, undefined])),
    };
  } else if (repetition === 'DISMISS') {
    return {
      repeat: undefined,
      due_at: undefined,
      hidden: undefined,
      fsrs: undefined,
      ...Object.fromEntries(FSRS_FRONTMATTER_FIELDS.map((field) => [field, undefined])),
    };
  } else {
    const serialized: Record<string, string | undefined> = {
      repeat: serializeRepeat(repetition),
      due_at: repetition.repeatDueAt.toISO() || undefined,
      hidden: repetition.hidden ? SERIALIZED_TRUE : SERIALIZED_FALSE,
    };
    if (repetition.repeatStrategy === 'FSRS' && repetition.fsrs) {
      serialized.fsrs = serializeFsrsState(repetition.fsrs);
    } else {
      serialized.fsrs = undefined;
    }
    FSRS_FRONTMATTER_FIELDS.forEach((field) => {
      if (field !== 'fsrs') {
        serialized[field] = undefined;
      }
    });
    return serialized;
  }
}
