import { DateTime } from 'luxon';
import { activityDayKey, dayIndex as dayIndexFromMs } from '../activity';

export function periodCutoffMs(
  period: 'today' | 'yesterday' | 'week' | 'month' | 'year' | 'all',
  dayStartsAt: string,
  now: DateTime = DateTime.now(),
): number {
  const todayKey = activityDayKey(now, dayStartsAt);
  const today = DateTime.fromISO(todayKey);

  switch (period) {
    case 'today':
      return today.toMillis();
    case 'yesterday':
      return today.minus({ days: 1 }).toMillis();
    case 'week':
      return today.minus({ days: 7 }).toMillis();
    case 'month':
      return today.minus({ days: 30 }).toMillis();
    case 'year':
      return today.minus({ days: 365 }).toMillis();
    case 'all':
      return 0;
  }
}

export function withinPeriod(
  eventMs: number,
  period: 'today' | 'yesterday' | 'week' | 'month' | 'year' | 'all',
  dayStartsAt: string,
  now: DateTime = DateTime.now(),
): boolean {
  const cutoff = periodCutoffMs(period, dayStartsAt, now);
  if (period === 'today') {
    const todayKey = activityDayKey(now, dayStartsAt);
    const eventKey = DateTime.fromMillis(eventMs).toISODate()!;
    const today = DateTime.fromISO(todayKey);
    return eventKey >= today.toISODate()!;
  }
  if (period === 'yesterday') {
    const todayKey = activityDayKey(now, dayStartsAt);
    const yesterdayKey = DateTime.fromISO(todayKey).minus({ days: 1 }).toISODate()!;
    return DateTime.fromMillis(eventMs).toISODate()! === yesterdayKey;
  }
  return eventMs >= cutoff;
}

export function todayRangeMs(dayStartsAt: string): { start: number; end: number } {
  const now = DateTime.now();
  const start = DateTime.fromISO(activityDayKey(now, dayStartsAt)).toMillis();
  const end = start + 86400000;
  return { start, end };
}
