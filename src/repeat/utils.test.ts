import { DateTime } from 'luxon';

import { summarizeDueAt, summarizeDueAtWithPrefix } from './utils';

const now = DateTime.fromISO('2026-06-08T12:00:00.000-03:00', { setZone: true });

describe('summarizeDueAt', () => {
  test('returns empty string for falsy dueAt', () => {
    expect(summarizeDueAt(undefined as any, now)).toBe('');
  });

  test('returns a moment for sub-minute diffs', () => {
    expect(summarizeDueAt(now.plus({ seconds: 30 }), now)).toBe('a moment');
  });

  test('formats minutes', () => {
    expect(summarizeDueAt(now.plus({ minutes: 5 }), now)).toBe('5 minutes');
  });

  test('formats short day spans with hours', () => {
    expect(summarizeDueAt(now.plus({ days: 2, hours: 3 }), now)).toBe('2 days and 3 hours');
  });

  test('formats longer day spans without hours', () => {
    expect(summarizeDueAt(now.plus({ days: 10 }), now)).toBe('10 days');
  });

  test('formats short hour spans with minutes', () => {
    expect(summarizeDueAt(now.plus({ hours: 3, minutes: 15 }), now)).toBe('3 hours and 15 minutes');
  });

  test('formats long hour spans without minutes', () => {
    expect(summarizeDueAt(now.plus({ hours: 15 }), now)).toBe('15 hours');
  });

  test('formats years and months', () => {
    expect(summarizeDueAt(now.plus({ years: 2, months: 1 }), now)).toBe('2 years and 1 month');
  });
});

describe('summarizeDueAtWithPrefix', () => {
  test('prefixes future due dates with in', () => {
    expect(summarizeDueAtWithPrefix(now.plus({ days: 1 }), now)).toBe('in 1 day');
  });

  test('prefixes past due dates with overdue by', () => {
    expect(summarizeDueAtWithPrefix(now.minus({ hours: 2 }), now)).toBe('overdue by 2 hours');
  });
});
