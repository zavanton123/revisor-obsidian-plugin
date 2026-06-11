import { getAPI } from 'obsidian-dataview';
import { App } from 'obsidian';
import { DateTime } from 'luxon';

import { parseRepetition } from '../parsers';

export interface CardSnapshot {
  state: string;
  scheduledDays: number;
  stability: number;
  difficulty: number;
  dueAt: DateTime;
  lastReview?: DateTime;
  suspended: boolean;
  buried: boolean;
  createdAt: DateTime;
  reps: number;
  lapses: number;
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
      stability: rep.fsrs?.stability ?? 0,
      difficulty: rep.fsrs?.difficulty ?? 0,
      dueAt: rep.repeatDueAt || DateTime.now(),
      lastReview: rep.fsrs?.lastReview,
      suspended: rep.suspended ?? false,
      buried: rep.buriedUntil != null && rep.buriedUntil > DateTime.now(),
      createdAt: DateTime.fromMillis(file.stat.ctime),
      reps: rep.fsrs?.reps ?? 0,
      lapses: rep.fsrs?.lapses ?? 0,
    });
  }
  return results;
}
