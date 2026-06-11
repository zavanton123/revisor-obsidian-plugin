import { DateTime } from 'luxon';

import { ReviewLog, ReviewRating, isCorrect, activityDayKeyMs, activityDayKey } from '../activity';
import { withinPeriod, periodCutoffMs } from './periods';
import { CardSnapshot } from './snapshot';

// ── Today ──

export interface TodayData {
  total: number;
  totalTimeMs: number;
  againPercent: number;
  maturePercent: number;
  learn: number;
  relearn: number;
  young: number;
  mature: number;
  correct: number;
}

export function aggregateToday(log: ReviewLog, dayStartsAt: string): TodayData {
  const start = periodCutoffMs('today', dayStartsAt);
  const todayEvents = log.filter(e => e.at >= start);

  const total = todayEvents.length;
  const totalTimeMs = todayEvents.reduce((s, e) => s + (e.elapsedMs ?? 0), 0);
  const correct = todayEvents.filter(e => isCorrect(e.rating)).length;
  const againPercent = total > 0 ? Math.round((total - correct) / total * 100) : 0;

  const matureEvents = todayEvents.filter(e => e.kind === 'mature');
  const matureCorrect = matureEvents.filter(e => isCorrect(e.rating)).length;
  const maturePercent = matureEvents.length > 0
    ? Math.round(matureCorrect / matureEvents.length * 100)
    : 0;

  return {
    total, totalTimeMs, againPercent, maturePercent,
    learn: todayEvents.filter(e => e.kind === 'learn').length,
    relearn: todayEvents.filter(e => e.kind === 'relearn').length,
    young: todayEvents.filter(e => e.kind === 'young').length,
    mature: matureEvents.length,
    correct,
  };
}

// ── Reviews ──

export interface ReviewsData {
  dailyBars: { day: number; learn: number; relearn: number; young: number; mature: number }[];
  cumulative: number[];
  daysStudied: number;
  totalReviews: number;
  dayRange: number;
}

export function aggregateReviews(
  log: ReviewLog,
  dayStartsAt: string,
  daysBack: number = 90,
): ReviewsData {
  const today = DateTime.fromISO(activityDayKey(DateTime.now(), dayStartsAt));
  const cutoff = today.minus({ days: daysBack });
  const events = log.filter(e => {
    const d = DateTime.fromMillis(e.at);
    return d >= cutoff && d < today.plus({ days: 1 });
  });

  const numBins = 70;
  const binMs = (daysBack * 86400000) / numBins;
  const dailyBars: ReviewsData['dailyBars'] = [];
  const cumulative: number[] = [];
  let cum = 0;

  for (let i = 0; i < numBins; i++) {
    const binStart = cutoff.toMillis() + i * binMs;
    const binEnd = binStart + binMs;
    const binEvents = events.filter(e => e.at >= binStart && e.at < binEnd);
    const bar = { day: i, learn: 0, relearn: 0, young: 0, mature: 0 };
    for (const e of binEvents) bar[e.kind]++;
    cum += binEvents.length;
    dailyBars.push(bar);
    cumulative.push(cum);
  }

  const activeDays = new Set<string>();
  for (const e of events) {
    activeDays.add(activityDayKeyMs(e.at, dayStartsAt));
  }

  return {
    dailyBars, cumulative, daysStudied: activeDays.size,
    totalReviews: events.length, dayRange: daysBack,
  };
}

// ── Card Counts ──

export interface CardCountsData {
  newCount: number;
  learning: number;
  relearning: number;
  young: number;
  mature: number;
  suspended: number;
  buried: number;
  total: number;
}

export function aggregateCardCounts(cards: CardSnapshot[]): CardCountsData {
  const r: CardCountsData = {
    newCount: 0, learning: 0, relearning: 0, young: 0, mature: 0,
    suspended: 0, buried: 0, total: cards.length,
  };
  for (const c of cards) {
    if (c.suspended) r.suspended++;
    else if (c.buried) r.buried++;
    else if (c.state === 'new') r.newCount++;
    else if (c.state === 'learning') r.learning++;
    else if (c.state === 'relearning') r.relearning++;
    else if (c.state === 'review') {
      if (c.scheduledDays < 21) r.young++;
      else r.mature++;
    }
  }
  return r;
}

// ── Future Due ──

export interface FutureDueData {
  dueByDay: Map<number, number>;
  totalDue: number;
  dueTomorrow: number;
  dailyLoad: number;
}

export function aggregateFutureDue(cards: CardSnapshot[]): FutureDueData {
  const now = DateTime.now();
  const dueByDay = new Map<number, number>();
  let dailyLoad = 0;

  for (const c of cards) {
    if (c.state === 'new' || c.suspended) continue;
    const dayIdx = Math.floor(c.dueAt.diff(now.startOf('day'), 'days').days);
    if (dayIdx > 365 || dayIdx < -365) continue;
    dueByDay.set(dayIdx, (dueByDay.get(dayIdx) ?? 0) + 1);
    dailyLoad += 1 / Math.max(1, c.scheduledDays);
  }

  let totalDue = 0;
  for (const v of dueByDay.values()) totalDue += v;

  return { dueByDay, totalDue, dueTomorrow: dueByDay.get(1) ?? 0, dailyLoad: Math.round(dailyLoad * 10) / 10 };
}

// ── Buttons ──

export interface ButtonsData {
  learning: [number, number, number, number];
  young: [number, number, number, number];
  mature: [number, number, number, number];
  totalEvents: number;
}

export function aggregateButtons(log: ReviewLog, dayStartsAt: string): ButtonsData {
  const events = log.filter(e => withinPeriod(e.at, 'year', dayStartsAt));
  const learning: [number, number, number, number] = [0, 0, 0, 0];
  const young: [number, number, number, number] = [0, 0, 0, 0];
  const mature: [number, number, number, number] = [0, 0, 0, 0];

  for (const e of events) {
    const arr = e.kind === 'mature' ? mature : e.kind === 'young' ? young : learning;
    arr[e.rating - 1]++;
  }
  return { learning, young, mature, totalEvents: events.length };
}

// ── Hourly ──

export interface HourlyData {
  perHour: { total: number; correct: number }[];
}

export function aggregateHourly(log: ReviewLog, dayStartsAt: string): HourlyData {
  const events = log.filter(e => withinPeriod(e.at, 'year', dayStartsAt));
  const perHour = Array.from({ length: 24 }, (): { total: number; correct: number } => ({ total: 0, correct: 0 }));
  for (const e of events) {
    const h = new Date(e.at).getHours();
    perHour[h].total++;
    if (isCorrect(e.rating)) perHour[h].correct++;
  }
  return { perHour };
}

// ── True Retention ──

export interface RetentionData {
  today: { youngPass: number; youngFail: number; maturePass: number; matureFail: number };
  yesterday: { youngPass: number; youngFail: number; maturePass: number; matureFail: number };
  week: { youngPass: number; youngFail: number; maturePass: number; matureFail: number };
  month: { youngPass: number; youngFail: number; maturePass: number; matureFail: number };
  year: { youngPass: number; youngFail: number; maturePass: number; matureFail: number };
}

export function aggregateTrueRetention(log: ReviewLog, dayStartsAt: string): RetentionData {
  const init = (): RetentionData['today'] => ({ youngPass: 0, youngFail: 0, maturePass: 0, matureFail: 0 });
  const r: RetentionData = { today: init(), yesterday: init(), week: init(), month: init(), year: init() };
  const scheduled = log.filter(e => e.kind === 'young' || e.kind === 'mature');
  const periods: Array<keyof RetentionData> = ['today', 'yesterday', 'week', 'month', 'year'];

  for (const e of scheduled) {
    for (const p of periods) {
      if (withinPeriod(e.at, p, dayStartsAt)) {
        const bucket = e.kind === 'mature' ? 'mature' : 'young';
        if (isCorrect(e.rating)) {
          if (bucket === 'mature') r[p].maturePass++;
          else r[p].youngPass++;
        } else {
          if (bucket === 'mature') r[p].matureFail++;
          else r[p].youngFail++;
        }
      }
    }
  }
  return r;
}

// ── Histograms (Intervals, Stability, Difficulty, Retrievability, Added) ──

export interface HistogramData {
  values: number[];
  median: number;
  average: number;
}

function fromSorted(sorted: number[]): HistogramData {
  if (sorted.length === 0) return { values: [], median: 0, average: 0 };
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 === 1 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
  const average = Math.round(sorted.reduce((a, b) => a + b, 0) / sorted.length);
  return { values: sorted, median, average };
}

export function aggregateIntervals(cards: CardSnapshot[]): HistogramData {
  const vals = cards
    .filter(c => (c.state === 'review' || c.state === 'relearning') && c.scheduledDays > 0)
    .map(c => c.scheduledDays).sort((a, b) => a - b);
  return fromSorted(vals);
}

export function aggregateStability(cards: CardSnapshot[]): HistogramData {
  const vals = cards
    .filter(c => (c.state === 'review' || c.state === 'relearning') && c.stability > 0)
    .map(c => Math.round(c.stability)).sort((a, b) => a - b);
  return fromSorted(vals);
}

export function aggregateDifficulty(cards: CardSnapshot[]): HistogramData {
  const vals = cards
    .filter(c => (c.state === 'review' || c.state === 'relearning') && c.difficulty > 0)
    .map(c => Math.round(c.difficulty * 100)).sort((a, b) => a - b);
  return fromSorted(vals);
}

export function aggregateRetrievability(cards: CardSnapshot[]): HistogramData {
  const vals: number[] = [];
  for (const c of cards) {
    if ((c.state === 'review' || c.state === 'relearning') && c.lastReview && c.stability > 0) {
      const elapsedDays = Math.max(0, DateTime.now().diff(c.lastReview, 'days').days);
      const factor = 19 / (Math.log(0.9) * -1);
      const r = Math.pow(1 + factor * elapsedDays / (9 * c.stability), -1) * 100;
      vals.push(Math.round(Math.min(100, r)));
    }
  }
  vals.sort((a, b) => a - b);
  return fromSorted(vals);
}

export function aggregateAdded(cards: CardSnapshot[]): HistogramData {
  const vals = cards
    .filter(c => c.createdAt.isValid)
    .map(c => {
      const now = DateTime.now();
      return Math.floor(now.diff(c.createdAt, 'days').days);
    })
    .sort((a, b) => a - b);
  return fromSorted(vals);
}
