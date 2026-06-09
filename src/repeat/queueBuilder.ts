import { DateTime } from 'luxon';

import { RepeatPluginSettings } from '../settings';
import {
  combineLimits,
  DailyStudyState,
  getEffectiveLimits,
  getSessionLimits,
} from './dailyStudy';
import { getQueueEligibility } from './queueEligibility';
import { Repetition } from './repeatTypes';
import {
  CustomStudyConfig,
  QueueMode,
  SessionStudyConfig,
} from './sessionStudy';
import {
  countsAsNew,
  countsAsReview,
  getStudyCardKind,
  StudyCardKind,
} from './studyCardKind';

export interface RevisorQueuePage {
  repetition: Repetition;
  filePath: string;
}

export interface QueueBuildOptions {
  settings: RepeatPluginSettings;
  dailyStudy: DailyStudyState;
  session: SessionStudyConfig;
  now?: DateTime;
}

export interface QueueBuildStats {
  totalDue: number;
  availableNew: number;
  availableReview: number;
  limitedOutNew: number;
  limitedOutReview: number;
  queueLength: number;
  blockedByDailyLimit: boolean;
  blockedBySessionLimit: boolean;
  blockedByCustomStudy: boolean;
  blockedByQueueMode: boolean;
}

export interface BuiltQueue {
  notes: RevisorQueuePage[];
  stats: QueueBuildStats;
}

export function matchesCustomStudy(
  repetition: Repetition,
  custom: CustomStudyConfig,
): boolean {
  switch (custom.kind) {
    case 'review-ahead':
      return true;
    case 'lapses-only':
      return (repetition.fsrs?.lapses ?? 0) >= 1;
    case 'never-reviewed':
      return getStudyCardKind(repetition) === 'new';
  }
}

export function matchesQueueMode(
  repetition: Repetition,
  queueMode: QueueMode,
): boolean {
  const kind = getStudyCardKind(repetition);
  switch (queueMode) {
    case 'new-only':
      return kind === 'new';
    case 'reviews-only':
      return kind !== 'new';
    default:
      return true;
  }
}

function isEligibleForStudy(
  repetition: Repetition,
  now: DateTime,
  customStudy?: CustomStudyConfig,
): boolean {
  const eligibility = getQueueEligibility(repetition, now);
  if (eligibility === 'suspended' || eligibility === 'buried') {
    return false;
  }
  if (customStudy?.kind === 'review-ahead') {
    const horizon = now.plus({ days: customStudy.daysAhead ?? 7 });
    return repetition.repeatDueAt <= horizon;
  }
  return eligibility === 'due';
}

function compareByDueAt(a: RevisorQueuePage, b: RevisorQueuePage): number {
  return a.repetition.repeatDueAt.toMillis() - b.repetition.repeatDueAt.toMillis();
}

function applyLimits(
  pages: RevisorQueuePage[],
  limits: { newRemaining: number; reviewRemaining: number },
): { selected: RevisorQueuePage[]; limitedOutNew: number; limitedOutReview: number } {
  const newNotes: RevisorQueuePage[] = [];
  const reviewNotes: RevisorQueuePage[] = [];

  for (const page of pages) {
    const kind = getStudyCardKind(page.repetition);
    if (countsAsNew(kind)) {
      newNotes.push(page);
    } else if (countsAsReview(kind)) {
      reviewNotes.push(page);
    }
  }

  const newCap = limits.newRemaining === Infinity
    ? newNotes.length
    : Math.min(newNotes.length, limits.newRemaining);
  const reviewCap = limits.reviewRemaining === Infinity
    ? reviewNotes.length
    : Math.min(reviewNotes.length, limits.reviewRemaining);

  const selected = [
    ...newNotes.slice(0, newCap),
    ...reviewNotes.slice(0, reviewCap),
  ].sort(compareByDueAt);

  return {
    selected,
    limitedOutNew: Math.max(0, newNotes.length - newCap),
    limitedOutReview: Math.max(0, reviewNotes.length - reviewCap),
  };
}

export function buildQueueFromPages(
  pages: RevisorQueuePage[],
  options: QueueBuildOptions,
): BuiltQueue {
  const now = options.now || DateTime.now();
  const { settings, dailyStudy, session } = options;
  const customStudy = session.customStudy;

  const duePages = pages.filter((page) =>
    isEligibleForStudy(page.repetition, now, customStudy));

  const totalDue = duePages.length;

  let modeFiltered = duePages.filter((page) =>
    matchesQueueMode(page.repetition, session.queueMode));

  if (customStudy && customStudy.kind !== 'review-ahead') {
    modeFiltered = modeFiltered.filter((page) =>
      matchesCustomStudy(page.repetition, customStudy));
  }

  modeFiltered.sort(compareByDueAt);

  const availableNew = modeFiltered.filter((page) =>
    countsAsNew(getStudyCardKind(page.repetition))).length;
  const availableReview = modeFiltered.filter((page) =>
    countsAsReview(getStudyCardKind(page.repetition))).length;

  const dailyLimits = getEffectiveLimits(settings, dailyStudy);
  const sessionLimits = getSessionLimits(
    session.sessionNewLimit,
    session.sessionReviewLimit,
    session.sessionNewStudied,
    session.sessionReviewStudied,
    settings.newCardsIgnoreReviewLimit,
  );
  const limits = combineLimits(
    dailyLimits,
    sessionLimits,
    settings.newCardsIgnoreReviewLimit,
  );

  const { selected, limitedOutNew, limitedOutReview } = applyLimits(
    modeFiltered,
    limits,
  );

  const blockedByDailyLimit = limitedOutNew > 0 || limitedOutReview > 0;
  const blockedBySessionLimit =
    (session.sessionNewLimit > 0 && session.sessionNewStudied >= session.sessionNewLimit)
    || (session.sessionReviewLimit > 0 && session.sessionReviewStudied >= session.sessionReviewLimit);
  const blockedByCustomStudy = customStudy != null
    && totalDue > 0
    && modeFiltered.length === 0;
  const blockedByQueueMode = session.queueMode !== 'normal'
    && totalDue > 0
    && modeFiltered.length === 0;

  return {
    notes: selected,
    stats: {
      totalDue,
      availableNew,
      availableReview,
      limitedOutNew,
      limitedOutReview,
      queueLength: selected.length,
      blockedByDailyLimit,
      blockedBySessionLimit,
      blockedByCustomStudy,
      blockedByQueueMode,
    },
  };
}

export interface QueueBreakdown {
  new: number;
  learning: number;
  review: number;
  due: number;
  buried: number;
  suspended: number;
  notDue: number;
}

export function getQueueBreakdown(
  pages: RevisorQueuePage[],
  now: DateTime = DateTime.now(),
): QueueBreakdown {
  const breakdown: QueueBreakdown = {
    new: 0,
    learning: 0,
    review: 0,
    due: 0,
    buried: 0,
    suspended: 0,
    notDue: 0,
  };

  for (const page of pages) {
    const eligibility = getQueueEligibility(page.repetition, now);
    switch (eligibility) {
      case 'due':
        breakdown.due += 1;
        break;
      case 'buried':
        breakdown.buried += 1;
        break;
      case 'suspended':
        breakdown.suspended += 1;
        break;
      case 'not-due':
        breakdown.notDue += 1;
        break;
      default:
        break;
    }

    if (eligibility !== 'due') {
      continue;
    }
    const kind = getStudyCardKind(page.repetition);
    if (kind === 'new') {
      breakdown.new += 1;
    } else if (kind === 'learning') {
      breakdown.learning += 1;
    } else {
      breakdown.review += 1;
    }
  }

  return breakdown;
}

export function formatQueueBreakdown(breakdown: QueueBreakdown): string {
  if (breakdown.due === 0) {
    return '0 due';
  }
  return `${breakdown.due} due (${breakdown.new} new · ${breakdown.learning} learning · ${breakdown.review} review)`;
}
