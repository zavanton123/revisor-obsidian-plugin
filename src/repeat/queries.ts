import { DateTime } from 'luxon';
import { Literal, DataviewApi, DataArray } from 'obsidian-dataview';

import { isRepeatDisabled, parseRepetitionFields } from './parsers';

export interface TagStats {
  tag: string;
  count: number;
}

export function getNotesDue(
  dv: DataviewApi | undefined,
  ignoreFolderPath: string,
  ignoreFilePath?: string | undefined,
  filterQuery?: string,
): DataArray<Record<string, Literal>> | undefined {
  const now = DateTime.now();
  return dv?.pages(filterQuery || undefined)
    .mutate((page: any) => {
      const frontmatter = page.file.frontmatter || {};
      const { repeat, due_at } = frontmatter;
      if (isRepeatDisabled(repeat) || !repeat) {
        page.repetition = undefined;
        return page;
      }
      page.repetition = parseRepetitionFields(
        repeat,
        due_at,
        page.file.ctime,
        frontmatter,
      );
      return page;
    })
    .where((page: any) => {
      const { repetition } = page;
      if (!repetition) {
        return false;
      }
      if (ignoreFolderPath && page.file.folder.startsWith(ignoreFolderPath)) {
        return false;
      }
      if (ignoreFilePath && (page.file.path === ignoreFilePath)) {
        return false;
      }
      return repetition.repeatDueAt <= now;
    })
    .sort((page: any) => page.repetition.repeatDueAt, 'asc')
}

export function getNextDueNote(
  dv: DataviewApi | undefined,
  ignoreFolderPath: string,
  ignoreFilePath?: string | undefined,
  filterQuery?: string,
): Record<string, Literal> | undefined {
  const page = getNotesDue(
    dv,
    ignoreFolderPath,
    ignoreFilePath,
    filterQuery,
  )?.first();
  if (!page) { return; }
  return page;
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
