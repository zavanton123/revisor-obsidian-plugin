import { ReviewLog } from '../activity';
import { computeStatsFromLog } from '../heatmap/stats';
import { DateTime } from 'luxon';
import {
  aggregateToday, aggregateCardCounts, aggregateFutureDue,
} from './aggregate';
import { CardSnapshot } from './snapshot';

const DAY = '06:00';

function makeCard(overrides: Partial<CardSnapshot> = {}): CardSnapshot {
  return {
    state: 'review',
    scheduledDays: 10,
    dueAt: DateTime.now().plus({ days: 3 }),
    suspended: false,
    buried: false,
    ...overrides,
  };
}

describe('Today', () => {
  it('empty log', () => { expect(aggregateToday([], DAY).total).toBe(0); });
  it('counts today events', () => {
    const log: ReviewLog = [{ at: Date.now(), rating: 3, kind: 'young', lastIntervalDays: 7 }];
    const r = aggregateToday(log, DAY);
    expect(r.total).toBe(1);
    expect(r.correct).toBe(1);
  });
});

describe('CardCounts', () => {
  it('counts new', () => {
    const r = aggregateCardCounts([makeCard({ state: 'new' })]);
    expect(r.newCount).toBe(1);
  });
  it('young vs mature', () => {
    const r = aggregateCardCounts([
      makeCard({ state: 'review', scheduledDays: 5 }),
      makeCard({ state: 'review', scheduledDays: 50 }),
    ]);
    expect(r.young).toBe(1);
    expect(r.mature).toBe(1);
  });
});

describe('FutureDue', () => {
  it('computes due', () => {
    const cards = [
      makeCard({ state: 'review', dueAt: DateTime.now().plus({ days: 1 }) }),
      makeCard({ state: 'review', dueAt: DateTime.now().plus({ days: 1 }) }),
    ];
    const r = aggregateFutureDue(cards);
    expect(r.dueTomorrow).toBe(2);
  });
  it('excludes new', () => {
    expect(aggregateFutureDue([makeCard({ state: 'new' })]).totalDue).toBe(0);
  });
});

describe('computeStatsFromLog', () => {
  it('empty', () => {
    expect(computeStatsFromLog([], '2026-06-10', DAY).activeDays).toBe(0);
  });
  it('streak', () => {
    const today = DateTime.now();
    const log: ReviewLog = [{ at: today.toMillis(), rating: 3, kind: 'young', lastIntervalDays: 7 }];
    expect(computeStatsFromLog(log, today.toISODate()!, DAY).currentStreak).toBe(1);
  });
});
