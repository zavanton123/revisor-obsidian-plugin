import { DateTime } from 'luxon';
import { Literal, DataviewApi, DataArray } from 'obsidian-dataview';

import { parseRepetition } from './parsers';
import { getQueueEligibility, isDueForReview } from './queueEligibility';
import { QueueEligibility } from './repeatTypes';

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

export function pickRandomDuePage(
  pages: Record<string, Literal>[],
): Record<string, Literal> | undefined {
  if (pages.length === 0) {
    return;
  }
  const index = Math.floor(Math.random() * pages.length);
  return pages[index];
}

export function getNextDueNote(
  dv: DataviewApi | undefined,
  ignoreFolderPath: string,
  ignoreFilePath?: string | undefined,
  filterQuery?: string,
): Record<string, Literal> | undefined {
  const dueNotes = getNotesDue(
    dv,
    ignoreFolderPath,
    ignoreFilePath,
    filterQuery,
  );
  if (!dueNotes?.length) {
    return;
  }
  return pickRandomDuePage(dueNotes.array());
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
