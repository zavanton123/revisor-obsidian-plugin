jest.mock('obsidian', () => ({ parseYaml: jest.fn() }), { virtual: true });
jest.mock('obsidian-dataview', () => ({}), { virtual: true });

import { Settings } from 'luxon';

import {
  countByEligibility,
  getNextDrillNote,
  getNextDueNote,
  getNotesDue,
  getQueueStats,
  getTagsFromDueNotes,
  getTrackedNotes,
  pickRandomDuePage,
} from './queries';

function wrap(arr: any[]): any {
  return {
    mutate: (fn: (page: any) => any) => wrap(arr.map(fn)),
    where: (fn: (page: any) => boolean) => wrap(arr.filter(fn)),
    sort: (fn: (page: any) => any, dir: 'asc' | 'desc' = 'asc') => {
      const sorted = [...arr].sort((a, b) => {
        const av = fn(a);
        const bv = fn(b);
        if (av < bv) return dir === 'asc' ? -1 : 1;
        if (av > bv) return dir === 'asc' ? 1 : -1;
        return 0;
      });
      return wrap(sorted);
    },
    forEach: (fn: (page: any) => void) => arr.forEach(fn),
    array: () => arr,
    get length() {
      return arr.length;
    },
  };
}

function fakeDv(pages: any[]) {
  return {
    pages: (_query?: string) => wrap(pages),
  } as any;
}

function page(
  path: string,
  frontmatter: Record<string, unknown>,
  tags: string[] = [],
) {
  const folder = path.includes('/') ? path.split('/').slice(0, -1).join('/') : '';
  return {
    file: {
      path,
      folder,
      frontmatter,
      etags: { values: tags },
    },
  };
}

const dueAt = '2026-06-08T10:00:00.000-03:00';
const futureDue = '2026-06-10T10:00:00.000-03:00';
const buriedUntil = '2026-06-09T06:00:00.000-03:00';

describe('pickRandomDuePage', () => {
  test('returns undefined for an empty list', () => {
    expect(pickRandomDuePage([])).toBeUndefined();
  });

  test('returns the only page', () => {
    const only = { file: { path: 'a.md' } };
    expect(pickRandomDuePage([only as any])).toBe(only);
  });

  test('returns a page from the list', () => {
    const pages = [
      { file: { path: 'a.md' } },
      { file: { path: 'b.md' } },
      { file: { path: 'c.md' } },
    ];
    const picks = new Set<string>();
    for (let i = 0; i < 40; i++) {
      const chosen = pickRandomDuePage(pages as any);
      picks.add((chosen?.file as any).path);
    }
    expect(picks.size).toBeGreaterThan(1);
  });
});

describe('queue queries', () => {
  const originalNow = Settings.now;
  const frozenNowMs = Date.parse('2026-06-08T15:00:00.000Z'); // 12:00 -03:00

  beforeEach(() => {
    Settings.now = () => frozenNowMs;
  });

  afterEach(() => {
    Settings.now = originalNow;
  });

  const pages = [
    page('Notes/due.md', {
      due_at: dueAt,
      fsrs: { state: 'review', scheduled_days: 7 },
    }, ['#tag/a', '#tag/b']),
    page('Notes/future.md', {
      due_at: futureDue,
      fsrs: { state: 'review', scheduled_days: 7 },
    }, ['#tag/a']),
    page('Notes/suspended.md', {
      due_at: dueAt,
      fsrs: { state: 'review', scheduled_days: 7 },
      revisor_suspended: true,
    }),
    page('Notes/buried.md', {
      due_at: dueAt,
      fsrs: { state: 'review', scheduled_days: 7 },
      revisor_buried_until: buriedUntil,
    }),
    page('Archive/old.md', {
      due_at: dueAt,
      fsrs: { state: 'review', scheduled_days: 7 },
    }),
    page('Notes/plain.md', {
      title: 'not a revisor note',
    }),
    page('Notes/due-only.md', {
      due_at: dueAt,
    }, ['#tag/c']),
  ];

  test('getNotesDue returns only due notes and ignores folder/file', () => {
    const dv = fakeDv(pages);
    const due = getNotesDue(dv, 'Archive', 'Notes/due.md');
    const paths = due?.array().map((p: any) => p.file.path) ?? [];
    expect(paths).toContain('Notes/due-only.md');
    expect(paths).not.toContain('Notes/due.md');
    expect(paths).not.toContain('Archive/old.md');
    expect(paths).not.toContain('Notes/future.md');
    expect(paths).not.toContain('Notes/suspended.md');
    expect(paths).not.toContain('Notes/buried.md');
    expect(paths).not.toContain('Notes/plain.md');
  });

  test('getTrackedNotes keeps only notes with fsrs', () => {
    const dv = fakeDv(pages);
    const tracked = getTrackedNotes(dv, '');
    const paths = tracked?.array().map((p: any) => p.file.path) ?? [];
    expect(paths).toContain('Notes/due.md');
    expect(paths).toContain('Notes/future.md');
    expect(paths).not.toContain('Notes/due-only.md');
    expect(paths).not.toContain('Notes/plain.md');
  });

  test('getQueueStats counts eligibility buckets', () => {
    const dv = fakeDv(pages);
    expect(getQueueStats(dv, 'Archive')).toEqual({
      due: 2,
      buried: 1,
      suspended: 1,
      notDue: 1,
    });
  });

  test('countByEligibility matches buried count', () => {
    const dv = fakeDv(pages);
    expect(countByEligibility(dv, 'Archive', 'buried')).toBe(1);
  });

  test('getNextDueNote and getNextDrillNote return a page when present', () => {
    const dv = fakeDv(pages);
    expect(getNextDueNote(dv, 'Archive')?.file.path).toBeTruthy();
    expect(getNextDrillNote(dv, 'Archive')?.file.path).toBeTruthy();
    expect(getNextDueNote(undefined as any, '')).toBeUndefined();
  });

  test('getTagsFromDueNotes aggregates and sorts tags', () => {
    const dv = fakeDv(pages);
    const tags = getTagsFromDueNotes(dv, 'Archive');
    expect(tags?.[0]).toEqual({ tag: '#tag/a', count: 1 });
    expect(tags?.map((t) => t.tag)).toContain('#tag/c');
  });
});
