import { DateTime } from 'luxon';
import { Rating } from 'ts-fsrs';

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
  fsrs?: FsrsCardState,
  suspended?: boolean,
  buriedUntil?: DateTime,
}

export type QueueEligibility =
  | 'due'
  | 'not-due'
  | 'suspended'
  | 'buried'
  | 'not-revisor';

export type RepeatChoice = {
  text: string,
  rating: Rating,
  nextRepetition: Repetition,
  hint?: string,
}
