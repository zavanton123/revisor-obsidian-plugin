import { Repetition } from './repeatTypes';

export type StudyCardKind = 'new' | 'learning' | 'review';

export function getStudyCardKind(repetition: Repetition): StudyCardKind {
  const fsrs = repetition.fsrs;
  if (!fsrs || fsrs.state === 'new' || fsrs.reps === 0) {
    return 'new';
  }
  if (fsrs.state === 'learning' || fsrs.state === 'relearning') {
    return 'learning';
  }
  return 'review';
}

export function countsAsNew(kind: StudyCardKind): boolean {
  return kind === 'new';
}

export function countsAsReview(kind: StudyCardKind): boolean {
  return kind === 'learning' || kind === 'review';
}
