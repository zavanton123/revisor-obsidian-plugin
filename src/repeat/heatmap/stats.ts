import { DateTime } from 'luxon';

import { ReviewLog, dailyCountsFromLog } from '../activity';

export interface HeatmapStats {
  currentStreak: number;
  longestStreak: number;
  dailyAverage: number;
  daysLearnedPct: number;
  totalReviews: number;
  activeDays: number;
  firstDay: string | null;
  lastDay: string | null;
}

function sortedDayKeys(counts: Map<string, number>): string[] {
  return [...counts.keys()].sort();
}

export function computeStatsFromLog(
  log: ReviewLog,
  today: string,
  dayStartsAt: string,
): HeatmapStats {
  const counts = dailyCountsFromLog(log, dayStartsAt);
  const keys = sortedDayKeys(counts);
  const activeDays = keys.length;

  let totalReviews = 0;
  for (const key of keys) {
    totalReviews += counts.get(key) ?? 0;
  }

  const dailyAverage = activeDays > 0 ? Math.round(totalReviews / activeDays) : 0;

  const firstDay = keys[0] ?? null;
  const lastDay = keys[keys.length - 1] ?? null;

  let daysLearnedPct = 0;
  if (firstDay) {
    const first = DateTime.fromISO(firstDay);
    const todayDate = DateTime.fromISO(today);
    const totalDays = Math.floor(todayDate.diff(first, 'days').days) + 1;
    if (totalDays > 0) {
      daysLearnedPct = Math.round((activeDays / totalDays) * 100);
    }
  }

  let longestStreak = 0;
  let currentStreak = 0;

  const activeSet = new Set(counts.keys());

  if (keys.length > 0) {
    let streak = 0;
    let prevDate: DateTime | null = null;

    for (const key of keys) {
      const current = DateTime.fromISO(key);
      if (prevDate) {
        const diff = Math.floor(current.diff(prevDate, 'days').days);
        if (diff === 1) {
          streak += 1;
        } else {
          longestStreak = Math.max(longestStreak, streak);
          streak = 1;
        }
      } else {
        streak = 1;
      }
      prevDate = current;
    }
    longestStreak = Math.max(longestStreak, streak);

    const todayDate = DateTime.fromISO(today);
    const yesterdayDate = todayDate.minus({ days: 1 });
    const todayKey = todayDate.toISODate()!;
    const yesterdayKey = yesterdayDate.toISODate()!;

    const lastActiveIsTodayOrYesterday =
      activeSet.has(todayKey) || activeSet.has(yesterdayKey);

    if (lastActiveIsTodayOrYesterday) {
      currentStreak = 0;
      let check = activeSet.has(todayKey) ? todayDate : yesterdayDate;
      while (activeSet.has(check.toISODate()!)) {
        currentStreak += 1;
        check = check.minus({ days: 1 });
      }
    }
  }

  return {
    currentStreak,
    longestStreak,
    dailyAverage,
    daysLearnedPct,
    totalReviews,
    activeDays,
    firstDay,
    lastDay,
  };
}

export function computeStatsFromCounts(
  counts: Map<string, number>,
  today: string,
): HeatmapStats {
  const keys = sortedDayKeys(counts);
  const activeDays = keys.length;

  let totalReviews = 0;
  for (const key of keys) {
    totalReviews += counts.get(key) ?? 0;
  }

  const dailyAverage = activeDays > 0 ? Math.round(totalReviews / activeDays) : 0;
  const firstDay = keys[0] ?? null;
  const lastDay = keys[keys.length - 1] ?? null;

  let daysLearnedPct = 0;
  if (firstDay) {
    const first = DateTime.fromISO(firstDay);
    const todayDate = DateTime.fromISO(today);
    const totalDays = Math.floor(todayDate.diff(first, 'days').days) + 1;
    if (totalDays > 0) {
      daysLearnedPct = Math.round((activeDays / totalDays) * 100);
    }
  }

  let longestStreak = 0;
  let currentStreak = 0;
  const activeSet = new Set(counts.keys());

  if (keys.length > 0) {
    let streak = 0;
    let prevDate: DateTime | null = null;
    for (const key of keys) {
      const current = DateTime.fromISO(key);
      if (prevDate) {
        const diff = Math.floor(current.diff(prevDate, 'days').days);
        streak = diff === 1 ? streak + 1 : 1;
      } else {
        streak = 1;
      }
      longestStreak = Math.max(longestStreak, streak);
      prevDate = current;
    }

    const todayDate = DateTime.fromISO(today);
    const yesterdayDate = todayDate.minus({ days: 1 });
    const todayKey = todayDate.toISODate()!;
    const yesterdayKey = yesterdayDate.toISODate()!;
    if (activeSet.has(todayKey) || activeSet.has(yesterdayKey)) {
      currentStreak = 0;
      let check = activeSet.has(todayKey) ? todayDate : yesterdayDate;
      while (activeSet.has(check.toISODate()!)) {
        currentStreak += 1;
        check = check.minus({ days: 1 });
      }
    }
  }

  return { currentStreak, longestStreak, dailyAverage, daysLearnedPct, totalReviews, activeDays, firstDay, lastDay };
}

export function computeDynamicLegendFromCounts(counts: Map<string, number>): number[] {
  const avg = getDailyAverageFromCounts(counts, 20);
  const factors = [0.125, 0.25, 0.5, 1, 2, 4];
  return factors.map((f) => Math.max(1, Math.round(f * avg)));
}

function getDailyAverageFromCounts(counts: Map<string, number>, minAvg: number): number {
  let total = 0;
  for (const c of counts.values()) total += c;
  const avg = counts.size > 0 ? Math.round(total / counts.size) : 0;
  return Math.max(minAvg, avg);
}
