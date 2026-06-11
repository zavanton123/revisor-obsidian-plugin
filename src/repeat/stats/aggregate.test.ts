import { ReviewLog } from '../activity';
import { computeStatsFromLog } from '../heatmap/stats';
import { DateTime } from 'luxon';
import {
  aggregateToday, aggregateReviews, aggregateCardCounts,
  aggregateFutureDue, aggregateButtons, aggregateHourly,
  aggregateTrueRetention, aggregateIntervals, aggregateStability,
  aggregateDifficulty, aggregateAdded,
} from './aggregate';
import { CardSnapshot } from './snapshot';

const DAY = '06:00';

function makeLog(daysBack: number[]): ReviewLog {
  const now = DateTime.now();
  const log: ReviewLog = [];
  for (const d of daysBack) {
    const at = now.minus({ days: d }).set({ hour: 10 }).toMillis();
    log.push({ at, rating: 3, kind: 'young', lastIntervalDays: 7 });
  }
  return log;
}

function makeCard(overrides: Partial<CardSnapshot> = {}): CardSnapshot {
  return {
    state: 'review', scheduledDays: 10, stability: 10, difficulty: 0.3,
    dueAt: DateTime.now().plus({ days: 3 }),
    lastReview: DateTime.now().minus({ days: 1 }),
    suspended: false, buried: false,
    createdAt: DateTime.now().minus({ days: 365 }),
    reps: 5, lapses: 1,
    ...overrides as any,
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

describe('Reviews', () => {
  it('empty', () => { expect(aggregateReviews([], DAY).totalReviews).toBe(0); });
  it('counts events', () => {
    const r = aggregateReviews(makeLog([5, 10, 30]), DAY, 90);
    expect(r.totalReviews).toBe(3);
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

describe('Buttons', () => {
  it('counts per rating', () => {
    const now = Date.now();
    const log: ReviewLog = [
      { at: now, rating: 1, kind: 'young', lastIntervalDays: 5 },
      { at: now, rating: 4, kind: 'mature', lastIntervalDays: 30 },
    ];
    const r = aggregateButtons(log, DAY);
    expect(r.young[0]).toBe(1);
    expect(r.mature[3]).toBe(1);
  });
});

describe('Hourly', () => {
  it('buckets by hour', () => {
    const now = Date.now();
    const h = new Date(now).getHours();
    const r = aggregateHourly([{ at: now, rating: 3, kind: 'young', lastIntervalDays: 7 }], DAY);
    expect(r.perHour[h].total).toBe(1);
  });
});

describe('TrueRetention', () => {
  it('computes', () => {
    const now = Date.now();
    const log: ReviewLog = [
      { at: now, rating: 1, kind: 'young', lastIntervalDays: 5 },
      { at: now, rating: 3, kind: 'young', lastIntervalDays: 5 },
      { at: now, rating: 3, kind: 'mature', lastIntervalDays: 30 },
    ];
    const r = aggregateTrueRetention(log, DAY);
    expect(r.today.youngPass).toBe(1);
    expect(r.today.youngFail).toBe(1);
    expect(r.today.maturePass).toBe(1);
  });
});

describe('Intervals/Stability/Difficulty/Added', () => {
  it('intervals', () => {
    expect(aggregateIntervals([makeCard({ scheduledDays: 15 })]).median).toBe(15);
  });
  it('stability rounds', () => {
    expect(aggregateStability([makeCard({ stability: 12.7 })]).median).toBe(13);
  });
  it('difficulty to %', () => {
    expect(aggregateDifficulty([makeCard({ difficulty: 0.45 })]).median).toBe(45);
  });
  it('added days ago', () => {
    const c = makeCard({ createdAt: DateTime.now().minus({ days: 100 }) });
    expect(aggregateAdded([c]).median).toBe(100);
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
