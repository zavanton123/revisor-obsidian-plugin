import { DateTime } from 'luxon';
import { Literal, DataviewApi, DataArray } from 'obsidian-dataview';

import { parseRepetition } from './parsers';
import { getQueueEligibility } from './queueEligibility';
import { QueueEligibility, Repetition } from './repeatTypes';
import {
  buildQueueFromPages,
  BuiltQueue,
  formatQueueBreakdown,
  getQueueBreakdown,
  QueueBreakdown,
  QueueBuildOptions,
  RevisorQueuePage,
} from './queueBuilder';
import { createSessionConfig, DEFAULT_SESSION_CONFIG, SessionStudyConfig } from './sessionStudy';
import { DailyStudyState, normalizeDailyStudy } from './dailyStudy';
import { RepeatPluginSettings } from '../settings';

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

export interface QueueQueryContext {
  settings: RepeatPluginSettings;
  dailyStudy: DailyStudyState;
  session?: SessionStudyConfig;
  now?: DateTime;
}

export function mutateRevisorPages(
  dv: DataviewApi | undefined,
  ignoreFolderPath: string,
  ignoreFilePath?: string | undefined,
  filterQuery?: string,
  now: DateTime = DateTime.now(),
): DataArray<Record<string, Literal>> | undefined {
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

export function collectRevisorPages(
  dv: DataviewApi | undefined,
  ignoreFolderPath: string,
  ignoreFilePath?: string,
  filterQuery?: string,
  now?: DateTime,
): RevisorQueuePage[] {
  const pages: RevisorQueuePage[] = [];
  mutateRevisorPages(dv, ignoreFolderPath, ignoreFilePath, filterQuery, now)
    ?.forEach((page: any) => {
      pages.push({
        repetition: page.repetition as Repetition,
        filePath: page.file.path,
      });
    });
  return pages;
}

export function buildQueue(
  dv: DataviewApi | undefined,
  ignoreFolderPath: string,
  filterQuery: string | undefined,
  context: QueueQueryContext,
  ignoreFilePath?: string,
): BuiltQueue {
  const now = context.now || DateTime.now();
  const dailyStudy = normalizeDailyStudy(
    context.dailyStudy,
    now,
    context.settings.dayStartsAt,
  );
  const pages = collectRevisorPages(
    dv,
    ignoreFolderPath,
    ignoreFilePath,
    filterQuery,
    now,
  );
  const options: QueueBuildOptions = {
    settings: context.settings,
    dailyStudy,
    session: context.session || DEFAULT_SESSION_CONFIG,
    now,
  };
  return buildQueueFromPages(pages, options);
}

export function getNotesDue(
  dv: DataviewApi | undefined,
  ignoreFolderPath: string,
  ignoreFilePath?: string | undefined,
  filterQuery?: string,
  context?: QueueQueryContext,
): RevisorQueuePage[] | undefined {
  if (context) {
    return buildQueue(
      dv,
      ignoreFolderPath,
      filterQuery,
      context,
      ignoreFilePath,
    ).notes;
  }
  const now = DateTime.now();
  return mutateRevisorPages(dv, ignoreFolderPath, ignoreFilePath, filterQuery, now)
    ?.where((page: any) => getQueueEligibility(page.repetition, now) === 'due')
    .sort((page: any) => page.repetition.repeatDueAt, 'asc')
    .array()
    .map((page: any) => ({
      repetition: page.repetition as Repetition,
      filePath: page.file.path,
    }));
}

export function getNextDueNote(
  dv: DataviewApi | undefined,
  ignoreFolderPath: string,
  ignoreFilePath?: string | undefined,
  filterQuery?: string,
  context?: QueueQueryContext,
): Record<string, Literal> | undefined {
  if (context) {
    const built = buildQueue(
      dv,
      ignoreFolderPath,
      filterQuery,
      context,
      ignoreFilePath,
    );
    const next = built.notes[0];
    if (!next) {
      return undefined;
    }
    const pages = mutateRevisorPages(
      dv,
      ignoreFolderPath,
      ignoreFilePath,
      filterQuery,
      context.now,
    );
    return pages?.find((page: any) => page.file.path === next.filePath);
  }

  const page = mutateRevisorPages(dv, ignoreFolderPath, ignoreFilePath, filterQuery)
    ?.where((page: any) => getQueueEligibility(page.repetition, DateTime.now()) === 'due')
    .sort((page: any) => page.repetition.repeatDueAt, 'asc')
    .first();
  if (!page) { return; }
  return page;
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
  mutateRevisorPages(dv, ignoreFolderPath, ignoreFilePath, filterQuery, now)
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

export function getQueueBreakdownStats(
  dv: DataviewApi | undefined,
  ignoreFolderPath: string,
  filterQuery?: string,
): QueueBreakdown {
  const pages = collectRevisorPages(dv, ignoreFolderPath, undefined, filterQuery);
  return getQueueBreakdown(pages);
}

export function countByEligibility(
  dv: DataviewApi | undefined,
  ignoreFolderPath: string,
  eligibility: QueueEligibility,
  filterQuery?: string,
): number {
  const now = DateTime.now();
  let count = 0;
  mutateRevisorPages(dv, ignoreFolderPath, undefined, filterQuery, now)
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
  context?: QueueQueryContext,
): TagStats[] | undefined {
  const dueNotes = context
    ? buildQueue(dv, ignoreFolderPath, undefined, context, ignoreFilePath).notes
    : getNotesDue(dv, ignoreFolderPath, ignoreFilePath);

  if (!dueNotes?.length) return undefined;

  const tagCounts = new Map<string, number>();

  const pages = mutateRevisorPages(dv, ignoreFolderPath, ignoreFilePath);
  dueNotes.forEach((note) => {
    const page = pages?.find((p: any) => p.file.path === note.filePath);
    const tags = page?.file.etags?.values || [];
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

export function makeQueueContext(
  settings: RepeatPluginSettings,
  dailyStudy: DailyStudyState,
  session: SessionStudyConfig = createSessionConfig(),
): QueueQueryContext {
  const now = DateTime.now();
  return {
    settings,
    dailyStudy: normalizeDailyStudy(dailyStudy, now, settings.dayStartsAt),
    session,
    now,
  };
}

export { formatQueueBreakdown };
