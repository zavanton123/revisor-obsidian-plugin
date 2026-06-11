import { ReviewLog } from '../activity';
import { computeStatsFromLog } from './stats';

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
