import { DateTime } from 'luxon';

import { DayActivity, ReviewActivityLog } from '../activity';

export interface HeatmapStats {
  currentStreak: number;
  longestStreak: number;
  dailyAverage: number;
  daysLearnedPct: number;
  totalReviews: number;
  totalCards: number;
  activeDays: number;
  firstDay: string | null;
  lastDay: string | null;
}

function sortedDayKeys(log: ReviewActivityLog): string[] {
  return Object.keys(log).sort();
}

export function computeStats(
  log: ReviewActivityLog,
  today: string,
): HeatmapStats {
  const keys = sortedDayKeys(log);
  const activeDays = keys.length;

  let totalReviews = 0;
  let totalCards = 0;
  for (const key of keys) {
    const day = log[key];
    totalReviews += day.reviews;
    totalCards += day.newCards;
  }

  const totalItems = totalReviews + totalCards;
  const dailyAverage = activeDays > 0 ? Math.round(totalItems / activeDays) : 0;

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

  const activeSet = new Set(keys);

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
    totalCards,
    activeDays,
    firstDay,
    lastDay,
  };
}

export function computeDynamicLegend(
  log: ReviewActivityLog,
  option?: { avgMin?: number; factors?: number[] },
): number[] {
  const stats = computeStats(log, DateTime.now().toISODate()!);
  const avg = Math.max(option?.avgMin ?? 20, stats.dailyAverage);
  const factors = option?.factors ?? [0.125, 0.25, 0.5, 1, 2, 4];
  return factors.map((f) => Math.max(1, Math.round(f * avg)));
}
