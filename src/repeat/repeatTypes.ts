import { DateTime } from 'luxon';

export type Strategy = 'SPACED' | 'PERIODIC' | 'FSRS';

export type FsrsStateName = 'new' | 'learning' | 'review' | 'relearning';

export interface FsrsCardState {
  state: FsrsStateName;
  stability: number;
  difficulty: number;
  scheduledDays: number;
  learningSteps: number;
  reps: number;
  lapses: number;
  lastReview?: DateTime;
}

export type PeriodUnit = 'HOUR' | 'DAY' | 'WEEK' | 'MONTH' | 'YEAR' | 'WEEKDAYS';

export type TimeOfDay = 'AM' | 'PM';

export type Weekday = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

// A parsed `repeat` property value.
export type Repeat = {
  repeatStrategy: Strategy,
  repeatPeriod: number,
  repeatPeriodUnit: PeriodUnit,
  repeatTimeOfDay: TimeOfDay,
  repeatWeekdays?: Weekday[],
}

// A complete set of parsed repetition properties.
export interface Repetition extends Repeat {
  repeatDueAt: DateTime,
  hidden: boolean,
  virtual: boolean,
  fsrs?: FsrsCardState,
}

// A next-repeat choice shown in the review interface.
export type RepeatChoice = {
  text: string,
  nextRepetition: Repetition | 'DISMISS' | 'NEVER',
}
