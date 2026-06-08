import { DateTime } from 'luxon';

export type FsrsStateName = 'new' | 'learning' | 'review' | 'relearning';

export type TimeOfDay = 'AM' | 'PM';

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

export type Repeat = {
  repeatTimeOfDay: TimeOfDay,
}

export interface Repetition extends Repeat {
  repeatDueAt: DateTime,
  virtual: boolean,
  fsrs?: FsrsCardState,
}

export type RepeatChoice = {
  text: string,
  nextRepetition: Repetition | 'DISMISS' | 'NEVER',
}
