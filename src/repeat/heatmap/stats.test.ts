import { ReviewLog } from '../activity';
import {
  computeDynamicLegendFromCounts,
  computeStatsFromCounts,
  computeStatsFromLog,
} from './stats';

describe('computeStatsFromLog', () => {
  const DAY = '06:00';

  it('returns zeros for empty log', () => {
    const r = computeStatsFromLog([], '2026-06-10', DAY);
    expect(r.activeDays).toBe(0);
    expect(r.totalReviews).toBe(0);
  });

  it('computes from single event', () => {
    const log: ReviewLog = [
      { at: new Date('2026-06-10T10:00:00').getTime(), rating: 3, kind: 'young', lastIntervalDays: 7 },
      { at: new Date('2026-06-10T10:00:01').getTime(), rating: 3, kind: 'young', lastIntervalDays: 7 },
    ];
    const r = computeStatsFromLog(log, '2026-06-10', DAY);
    expect(r.totalReviews).toBe(2);
    expect(r.dailyAverage).toBe(2);
    expect(r.currentStreak).toBe(1);
    expect(r.longestStreak).toBe(1);
  });
});

describe('computeStatsFromCounts', () => {
  it('tracks longest streak across gaps and current streak from today', () => {
    const counts = new Map<string, number>([
      ['2026-06-01', 1],
      ['2026-06-02', 2],
      ['2026-06-03', 1],
      ['2026-06-05', 1],
      ['2026-06-08', 3],
      ['2026-06-09', 1],
      ['2026-06-10', 2],
    ]);
    const r = computeStatsFromCounts(counts, '2026-06-10');
    expect(r.longestStreak).toBe(3);
    expect(r.currentStreak).toBe(3);
    expect(r.activeDays).toBe(7);
    expect(r.totalReviews).toBe(11);
    expect(r.firstDay).toBe('2026-06-01');
    expect(r.lastDay).toBe('2026-06-10');
    expect(r.daysLearnedPct).toBe(70);
  });

  it('keeps current streak when only yesterday is active', () => {
    const counts = new Map<string, number>([
      ['2026-06-08', 1],
      ['2026-06-09', 2],
    ]);
    const r = computeStatsFromCounts(counts, '2026-06-10');
    expect(r.currentStreak).toBe(2);
    expect(r.longestStreak).toBe(2);
  });

  it('sets current streak to zero when inactive today and yesterday', () => {
    const counts = new Map<string, number>([
      ['2026-06-01', 5],
      ['2026-06-02', 5],
    ]);
    const r = computeStatsFromCounts(counts, '2026-06-10');
    expect(r.currentStreak).toBe(0);
    expect(r.longestStreak).toBe(2);
  });
});

describe('computeDynamicLegendFromCounts', () => {
  it('floors average at 20 for sparse activity', () => {
    const counts = new Map<string, number>([['2026-06-10', 2]]);
    expect(computeDynamicLegendFromCounts(counts)).toEqual([3, 5, 10, 20, 40, 80]);
  });

  it('scales legend from higher daily average', () => {
    const counts = new Map<string, number>([
      ['2026-06-09', 40],
      ['2026-06-10', 60],
    ]);
    expect(computeDynamicLegendFromCounts(counts)).toEqual([6, 13, 25, 50, 100, 200]);
  });
});
