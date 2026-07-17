import { getAPI } from 'obsidian-dataview';
import { App } from 'obsidian';
import { DateTime } from 'luxon';

import { parseRepetition } from '../parsers';

export interface CardSnapshot {
  state: string;
  scheduledDays: number;
  dueAt: DateTime;
  suspended: boolean;
  buried: boolean;
}

export function buildCardSnapshot(app: App): CardSnapshot[] {
  const dv = getAPI(app);
  if (!dv?.index.initialized) return [];

  const results: CardSnapshot[] = [];
  const files = app.vault.getMarkdownFiles();

  for (const file of files) {
    const cache = app.metadataCache.getFileCache(file);
    const rep = parseRepetition(cache?.frontmatter || {});
    if (!rep) continue;

    results.push({
      state: rep.fsrs?.state ?? 'new',
      scheduledDays: rep.fsrs?.scheduledDays ?? 0,
      dueAt: rep.repeatDueAt || DateTime.now(),
      suspended: rep.suspended ?? false,
      buried: rep.buriedUntil != null && rep.buriedUntil > DateTime.now(),
    });
  }
  return results;
}
