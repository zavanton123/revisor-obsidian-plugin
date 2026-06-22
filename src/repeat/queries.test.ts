jest.mock('obsidian', () => ({ parseYaml: jest.fn() }), { virtual: true });
jest.mock('obsidian-dataview', () => ({}), { virtual: true });

import { pickRandomDuePage } from './queries';

describe('pickRandomDuePage', () => {
  test('returns undefined for an empty list', () => {
    expect(pickRandomDuePage([])).toBeUndefined();
  });

  test('returns the only page', () => {
    const page = { file: { path: 'a.md' } };
    expect(pickRandomDuePage([page as any])).toBe(page);
  });

  test('returns a page from the list', () => {
    const pages = [
      { file: { path: 'a.md' } },
      { file: { path: 'b.md' } },
      { file: { path: 'c.md' } },
    ];
    const picks = new Set<string>();
    for (let i = 0; i < 40; i++) {
      const page = pickRandomDuePage(pages as any);
      picks.add((page?.file as any).path);
    }
    expect(picks.size).toBeGreaterThan(1);
  });
});
