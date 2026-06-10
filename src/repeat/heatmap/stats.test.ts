import { computeStats, computeDynamicLegend } from './stats';
import { ReviewActivityLog } from '../activity';

describe('computeStats', () => {
  it('returns zeros for empty log', () => {
    const result = computeStats({}, '2026-06-10');
    expect(result.currentStreak).toBe(0);
    expect(result.longestStreak).toBe(0);
    expect(result.dailyAverage).toBe(0);
    expect(result.daysLearnedPct).toBe(0);
    expect(result.totalReviews).toBe(0);
    expect(result.activeDays).toBe(0);
    expect(result.firstDay).toBeNull();
  });

  it('counts a single day correctly', () => {
    const log: ReviewActivityLog = {
      '2026-06-10': { reviews: 5, newCards: 2 },
    };
    const result = computeStats(log, '2026-06-10');
    expect(result.totalReviews).toBe(5);
    expect(result.totalCards).toBe(2);
    expect(result.dailyAverage).toBe(7);
    expect(result.activeDays).toBe(1);
    expect(result.daysLearnedPct).toBe(100);
    expect(result.currentStreak).toBe(1);
    expect(result.longestStreak).toBe(1);
  });

  it('detects current streak ending today', () => {
    const log: ReviewActivityLog = {
      '2026-06-09': { reviews: 3, newCards: 0 },
      '2026-06-10': { reviews: 5, newCards: 1 },
    };
    const result = computeStats(log, '2026-06-10');
    expect(result.currentStreak).toBe(2);
    expect(result.longestStreak).toBe(2);
  });

  it('detects current streak ending yesterday', () => {
    const log: ReviewActivityLog = {
      '2026-06-09': { reviews: 3, newCards: 0 },
    };
    const result = computeStats(log, '2026-06-10');
    expect(result.currentStreak).toBe(1);
  });

  it('current streak is 0 if last review older than yesterday', () => {
    const log: ReviewActivityLog = {
      '2026-06-08': { reviews: 3, newCards: 0 },
    };
    const result = computeStats(log, '2026-06-10');
    expect(result.currentStreak).toBe(0);
  });

  it('finds longest streak', () => {
    const log: ReviewActivityLog = {
      '2026-06-01': { reviews: 1, newCards: 0 },
      '2026-06-02': { reviews: 1, newCards: 0 },
      '2026-06-04': { reviews: 1, newCards: 0 },
      '2026-06-05': { reviews: 1, newCards: 0 },
      '2026-06-06': { reviews: 1, newCards: 0 },
    };
    const result = computeStats(log, '2026-06-10');
    expect(result.longestStreak).toBe(3);
    expect(result.currentStreak).toBe(0);
  });

  it('computes days learned %', () => {
    const log: ReviewActivityLog = {
      '2026-06-01': { reviews: 1, newCards: 0 },
      '2026-06-05': { reviews: 1, newCards: 0 },
    };
    const result = computeStats(log, '2026-06-10');
    expect(result.activeDays).toBe(2);
    expect(result.daysLearnedPct).toBe(20); // 2/10 = 20%
  });
});

describe('computeDynamicLegend', () => {
  it('uses default min of 20', () => {
    const result = computeDynamicLegend({}, { avgMin: 20, factors: [1, 2] });
    expect(result).toEqual([20, 40]);
  });

  it('uses daily average when higher than min', () => {
    const log: ReviewActivityLog = {
      '2026-06-10': { reviews: 100, newCards: 0 },
    };
    const result = computeDynamicLegend(log, { avgMin: 20, factors: [0.5, 1] });
    expect(result).toEqual([50, 100]);
  });
});
