import { DateTime } from 'luxon';

import { ReviewLog, isCorrect } from '../activity';
import { periodCutoffMs } from './periods';
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
