import { DateTime } from 'luxon';
import { activityDayKey } from '../activity';

export function periodCutoffMs(
  period: 'today',
  dayStartsAt: string,
  now: DateTime = DateTime.now(),
): number {
  const todayKey = activityDayKey(now, dayStartsAt);
  return DateTime.fromISO(todayKey).toMillis();
}
