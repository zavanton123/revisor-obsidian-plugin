import { DateTime } from 'luxon';
import { Literal, DataviewApi, DataArray } from 'obsidian-dataview';

import { parseRepetition } from './parsers';
import { getQueueEligibility, isDueForReview } from './queueEligibility';
import { QueueEligibility, Repetition } from './repeatTypes';

export interface TagStats {
  tag: string;
  count: number;
}

export interface QueueStats {
  due: number;
  buried: number;
  suspended: number;
  notDue: number;
}

export interface TodayReviewCounts {
  newCount: number;
  reviewCount: number;
}

function isSameDay(a: DateTime, b: DateTime): boolean {
  return a.hasSame(b, 'day');
}

function mutateRevisorPages(
  dv: DataviewApi | undefined,
  ignoreFolderPath: string,
  ignoreFilePath?: string | undefined,
  filterQuery?: string,
): DataArray<Record<string, Literal>> | undefined {
  const now = DateTime.now();
  return dv?.pages(filterQuery || undefined)
    .mutate((page: any) => {
      const frontmatter = page.file.frontmatter || {};
      page.repetition = parseRepetition(frontmatter, now);
      return page;
    })
    .where((page: any) => {
      if (!page.repetition) {
        return false;
      }
      if (ignoreFolderPath && page.file.folder.startsWith(ignoreFolderPath)) {
        return false;
      }
      if (ignoreFilePath && (page.file.path === ignoreFilePath)) {
        return false;
      }
      return true;
    });
}

export function getNotesDue(
  dv: DataviewApi | undefined,
  ignoreFolderPath: string,
  ignoreFilePath?: string | undefined,
  filterQuery?: string,
): DataArray<Record<string, Literal>> | undefined {
  const now = DateTime.now();
  return mutateRevisorPages(dv, ignoreFolderPath, ignoreFilePath, filterQuery)
    ?.where((page: any) => isDueForReview(page.repetition, now))
    .sort((page: any) => page.repetition.repeatDueAt, 'asc');
}

export function getNextDueNote(
  dv: DataviewApi | undefined,
  ignoreFolderPath: string,
  ignoreFilePath?: string | undefined,
  filterQuery?: string,
  maxNewPerDay = 0,
  maxReviewsPerDay = 0,
): Record<string, Literal> | undefined {
  const dueNotes = getNotesDue(
    dv,
    ignoreFolderPath,
    ignoreFilePath,
    filterQuery,
  );
  if (!dueNotes) { return; }

  const todayCounts = getTodayReviewCounts(dv, ignoreFolderPath, filterQuery);

  let remainingNew = maxNewPerDay > 0
    ? Math.max(0, maxNewPerDay - todayCounts.newCount)
    : Infinity;

  let remainingReviews = maxReviewsPerDay > 0
    ? Math.max(0, maxReviewsPerDay - todayCounts.reviewCount)
    : Infinity;

  for (const page of dueNotes.values()) {
    const r = page.repetition as Repetition;

    if (!r.fsrs) {
      if (remainingNew <= 0) { continue; }
      remainingNew--;
      return page;
    }

    if (r.fsrs.state === 'new') {
      if (remainingNew <= 0) { continue; }
      remainingNew--;
      return page;
    }

    if (r.fsrs.state === 'learning') {
      return page;
    }

    if (remainingReviews <= 0) { continue; }
    remainingReviews--;
    return page;
  }

  return;
}

export function getQueueStats(
  dv: DataviewApi | undefined,
  ignoreFolderPath: string,
  ignoreFilePath?: string | undefined,
  filterQuery?: string,
): QueueStats {
  const now = DateTime.now();
  const stats: QueueStats = {
    due: 0,
    buried: 0,
    suspended: 0,
    notDue: 0,
  };
  mutateRevisorPages(dv, ignoreFolderPath, ignoreFilePath, filterQuery)
    ?.forEach((page: any) => {
      switch (getQueueEligibility(page.repetition, now)) {
        case 'due':
          stats.due += 1;
          break;
        case 'buried':
          stats.buried += 1;
          break;
        case 'suspended':
          stats.suspended += 1;
          break;
        case 'not-due':
          stats.notDue += 1;
          break;
      }
    });
  return stats;
}

export function getTodayReviewCounts(
  dv: DataviewApi | undefined,
  ignoreFolderPath: string,
  filterQuery?: string,
): TodayReviewCounts {
  const now = DateTime.now();
  let newCount = 0;
  let reviewCount = 0;

  mutateRevisorPages(dv, ignoreFolderPath, undefined, filterQuery)
    ?.forEach((page: any) => {
      const r = page.repetition as Repetition;
      if (!r.fsrs?.lastReview) { return; }
      if (!isSameDay(r.fsrs.lastReview, now)) { return; }

      if (r.fsrs.reps === 1) {
        newCount++;
      } else if (r.fsrs.state === 'review' || r.fsrs.state === 'relearning') {
        reviewCount++;
      }
    });

  return { newCount, reviewCount };
}

export function countByEligibility(
  dv: DataviewApi | undefined,
  ignoreFolderPath: string,
  eligibility: QueueEligibility,
  filterQuery?: string,
): number {
  const now = DateTime.now();
  let count = 0;
  mutateRevisorPages(dv, ignoreFolderPath, undefined, filterQuery)
    ?.forEach((page: any) => {
      if (getQueueEligibility(page.repetition, now) === eligibility) {
        count += 1;
      }
    });
  return count;
}

export function getTagsFromDueNotes(
  dv: DataviewApi | undefined,
  ignoreFolderPath: string,
  ignoreFilePath?: string | undefined,
): TagStats[] | undefined {
  const dueNotes = getNotesDue(
    dv, ignoreFolderPath, ignoreFilePath,
  );

  if (!dueNotes) return undefined;

  const tagCounts = new Map<string, number>();

  dueNotes.forEach((page: any) => {
    const tags = page.file.etags?.values || [];
    tags.forEach((tag: string) => {
      tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
    });
  });

  return Array.from(tagCounts.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.tag.localeCompare(b.tag);
    });
}
