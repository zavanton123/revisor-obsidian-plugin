import { DateTime } from 'luxon';
import { parseYaml } from 'obsidian';

import { determineFrontmatterBounds } from '../frontmatter';

import {
  PeriodUnit,
  Repeat,
  Repetition,
  Strategy,
  TimeOfDay,
  Weekday,
  FsrsCardState,
  FsrsStateName,
} from './repeatTypes';
import { DEFAULT_SETTINGS } from '../settings';

const joinedUnits = 'hour|day|week|month|year';

const weekdayNames: Record<string, Weekday> = {
  'monday': 'monday',
  'mon': 'monday',
  'tuesday': 'tuesday',
  'tue': 'tuesday',
  'tues': 'tuesday',
  'wednesday': 'wednesday',
  'wed': 'wednesday',
  'thursday': 'thursday',
  'thu': 'thursday',
  'thur': 'thursday',
  'thurs': 'thursday',
  'friday': 'friday',
  'fri': 'friday',
  'saturday': 'saturday',
  'sat': 'saturday',
  'sunday': 'sunday',
  'sun': 'sunday',
};

function parseWeekdays(weekdayString: string): Weekday[] {
  const weekdays: Weekday[] = [];
  const parts = weekdayString.toLowerCase().split(/,\s*|\s+and\s+|\s*&\s*/);

  for (const part of parts) {
    const trimmed = part.trim();
    if (weekdayNames[trimmed]) {
      weekdays.push(weekdayNames[trimmed]);
    }
  }

  return weekdays.length > 0 ? weekdays : [];
}

function parseRepeatPeriodUnit(unitDescription: string): PeriodUnit {
  const processedUnitDescription = unitDescription.trim();
  switch (processedUnitDescription) {
    case 'daily':
      return 'DAY';
    case 'weekly':
      return 'WEEK';
    case 'monthly':
      return 'MONTH';
    case 'yearly':
    case 'annually':
      return 'YEAR';
    default:
      break;
  }
  const unitRegex = new RegExp(
    `every (\\d+ )?(?<unit>${joinedUnits})s?`
  );
  let result;
  if (( result = unitRegex.exec(processedUnitDescription) )) {
    switch ((result?.groups?.unit || '').trim()) {
      case 'hour':
        return 'HOUR';
      case 'day':
        return 'DAY';
      case 'week':
        return 'WEEK';
      case 'month':
        return 'MONTH';
      case 'year':
        return 'YEAR';
      default:
        break;
    }
  }
  return 'DAY';
}

function parseRepeatTimeOfDay(timeOfDaySuffix: string): TimeOfDay {
  const processedTimeOfDaySuffix = timeOfDaySuffix.trim();
  if (processedTimeOfDaySuffix === 'in the evening' || processedTimeOfDaySuffix === 'pm') {
    return 'PM';
  }
  return 'AM';
}

export function parseRepeat(repeat: string): Repeat {
  let processedRepeat = repeat.toLowerCase();
  let repeatStrategy = 'PERIODIC';
  const fsrsRegex = /^fsrs ?/;
  if (processedRepeat.match(fsrsRegex)) {
    repeatStrategy = 'FSRS';
    processedRepeat = processedRepeat.split(fsrsRegex)[1] || '';
  } else {
    const spacedRegex = /^spaced ?/;
    if (processedRepeat.match(spacedRegex)) {
      repeatStrategy = 'SPACED';
      processedRepeat = processedRepeat.split(spacedRegex)[1];
    }
  }

  if (repeatStrategy === 'FSRS') {
    const timeOfDaySuffix = processedRepeat.trim();
    return {
      repeatStrategy: 'FSRS' as Strategy,
      repeatPeriod: 1,
      repeatPeriodUnit: 'DAY',
      repeatTimeOfDay: timeOfDaySuffix
        ? parseRepeatTimeOfDay(timeOfDaySuffix)
        : DEFAULT_SETTINGS.defaultRepeat.repeatTimeOfDay,
    };
  }

  // Check for weekday patterns first
  // @ts-ignore: we're in obsidian, so this capture group being named is always fine.
  const weekdayRegex = /^every\s+(.+?)(?<timeOfDaySuffix>\s+in\s+the\s+(morning|evening)|\s+(am|pm))?$/;
  let result = weekdayRegex.exec(processedRepeat);
  if (result) {
    const weekdayString = result[1];
    const weekdays = parseWeekdays(weekdayString);
    if (weekdays.length > 0) {
      return {
        repeatStrategy: repeatStrategy as Strategy,
        repeatPeriod: 1,
        repeatPeriodUnit: 'WEEKDAYS',
        repeatTimeOfDay: parseRepeatTimeOfDay(
          result?.groups?.timeOfDaySuffix || DEFAULT_SETTINGS.defaultRepeat.repeatTimeOfDay
        ),
        repeatWeekdays: weekdays,
      };
    }
  }

  // Then parse traditional time-based patterns
  const repetitionRegex = new RegExp(
    '(?<description>' +
      'daily|weekly|monthly|yearly|annually' +
      '|(' +
        `(every (${joinedUnits})|every (?<period>\\d+) (${joinedUnits})s?)` +
      ')' +
    ')' +
    '(?<timeOfDaySuffix>.*)'
  );
  result = repetitionRegex.exec(processedRepeat);
  if (result) {
    return {
      repeatStrategy: repeatStrategy as Strategy,
      repeatPeriod: parseInt(
        result?.groups?.period
        || String(DEFAULT_SETTINGS.defaultRepeat.repeatPeriod)
      ),
      repeatPeriodUnit: parseRepeatPeriodUnit(
        result?.groups?.description
        || DEFAULT_SETTINGS.defaultRepeat.repeatPeriodUnit
      ),
      repeatTimeOfDay: parseRepeatTimeOfDay(
        result?.groups?.timeOfDaySuffix
        || DEFAULT_SETTINGS.defaultRepeat.repeatTimeOfDay
      ),
    }
  }
  return DEFAULT_SETTINGS.defaultRepeat;
}

export function isRepeatDisabled(repeatFieldValue: string): boolean {
  // https://yaml.org/type/bool.html + "never"
  const booleanRegex = new RegExp('^(n|no|false|off|never)$', 'i');
  return booleanRegex.test(repeatFieldValue);
}

export function parseRepeatDueAt(
  repeatDueAt: string | undefined,
  repeat: Repeat | undefined,
  referenceDateTime: DateTime,
) {
  if (repeatDueAt) {
    const parsedDueAtMaybe = DateTime.fromISO(repeatDueAt);
    // @ts-ignore: luxon adds .invalid if the timestamp is not parsable.
    if (!parsedDueAtMaybe.invalid) {
      return parsedDueAtMaybe;
    }
  }
  // We can't parse the timestamp, or it isn't set.
  if (repeat) {
    // Handle weekday-based repetitions specially
    if (repeat.repeatPeriodUnit === 'WEEKDAYS' && repeat.repeatWeekdays) {
      const weekdayNumbers: Record<string, number> = {
        'monday': 1,
        'tuesday': 2,
        'wednesday': 3,
        'thursday': 4,
        'friday': 5,
        'saturday': 6,
        'sunday': 7,
      };

      const targetWeekdays = repeat.repeatWeekdays.map(day => weekdayNumbers[day]).sort();

      // Find next occurrence of any of the target weekdays
      for (let daysAhead = 1; daysAhead <= 7; daysAhead++) {
        const candidateDate = referenceDateTime.plus({ days: daysAhead });
        if (targetWeekdays.includes(candidateDate.weekday)) {
          return candidateDate;
        }
      }

      // Fallback - should never happen
      return referenceDateTime.plus({ days: 1 });
    }

    return referenceDateTime.plus({
      [repeat.repeatPeriodUnit.toLowerCase()]: repeat.repeatPeriod,
    });
  }
  return referenceDateTime;
}

export function parseYamlBoolean(
  value: string | undefined,
): boolean {
  if (!value) {
    return false;
  }
  // Reference https://yaml.org/type/bool.html
  const booleanRegex = new RegExp('^(y|yes|true|on)$');
  return booleanRegex.test(String(value));
}

const FSRS_STATE_NAMES: FsrsStateName[] = [
  'new', 'learning', 'review', 'relearning',
];

function parseFsrsStateName(value: unknown): FsrsStateName {
  const normalized = String(value).toLowerCase();
  if (FSRS_STATE_NAMES.includes(normalized as FsrsStateName)) {
    return normalized as FsrsStateName;
  }
  return 'new';
}

function parseFsrsNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseFsrsBlock(raw: unknown): FsrsCardState | undefined {
  if (!raw) {
    return undefined;
  }
  let block: Record<string, unknown>;
  if (typeof raw === 'string') {
    try {
      block = JSON.parse(raw);
    } catch {
      return undefined;
    }
  } else if (typeof raw === 'object') {
    block = raw as Record<string, unknown>;
  } else {
    return undefined;
  }
  const lastReviewRaw = block.last_review;
  let lastReview: DateTime | undefined;
  if (lastReviewRaw) {
    const parsed = DateTime.fromISO(String(lastReviewRaw));
    // @ts-ignore: luxon adds .invalid if the timestamp is not parsable.
    if (!parsed.invalid) {
      lastReview = parsed;
    }
  }
  return {
    state: parseFsrsStateName(block.state),
    stability: parseFsrsNumber(block.stability),
    difficulty: parseFsrsNumber(block.difficulty),
    scheduledDays: parseFsrsNumber(block.scheduled_days),
    learningSteps: parseFsrsNumber(block.learning_steps),
    reps: parseFsrsNumber(block.reps),
    lapses: parseFsrsNumber(block.lapses),
    lastReview,
  };
}

export function parseFsrsFromFrontmatter(
  frontmatter?: Record<string, unknown> | null,
): FsrsCardState | undefined {
  if (!frontmatter) {
    return undefined;
  }
  if (frontmatter.fsrs !== undefined) {
    return parseFsrsBlock(frontmatter.fsrs);
  }
  if (frontmatter.fsrs_state !== undefined) {
    const lastReviewRaw = frontmatter.fsrs_last_review;
    let lastReview: DateTime | undefined;
    if (lastReviewRaw) {
      const parsed = DateTime.fromISO(String(lastReviewRaw));
      // @ts-ignore: luxon adds .invalid if the timestamp is not parsable.
      if (!parsed.invalid) {
        lastReview = parsed;
      }
    }
    return {
      state: parseFsrsStateName(frontmatter.fsrs_state),
      stability: parseFsrsNumber(frontmatter.fsrs_stability),
      difficulty: parseFsrsNumber(frontmatter.fsrs_difficulty),
      scheduledDays: parseFsrsNumber(frontmatter.fsrs_scheduled_days),
      learningSteps: parseFsrsNumber(frontmatter.fsrs_learning_steps),
      reps: parseFsrsNumber(frontmatter.fsrs_reps),
      lapses: parseFsrsNumber(frontmatter.fsrs_lapses),
      lastReview,
    };
  }
  return undefined;
}

export function formRepetition(
  parsedRepeat: Repeat,
  repeatDueAt: string | undefined,
  hidden?: string | undefined,
  referenceDateTime?: DateTime | undefined,
  virtual?: boolean | undefined,
  fsrsFrontmatter?: Record<string, unknown> | null,
): Repetition {
  const repetition: Repetition = {
    ...parsedRepeat,
    hidden: parseYamlBoolean(hidden),
    virtual: virtual || false,
    repeatDueAt: parseRepeatDueAt(
      repeatDueAt,
      parsedRepeat,
      referenceDateTime || DateTime.now(),
    ),
  };
  if (parsedRepeat.repeatStrategy === 'FSRS') {
    repetition.fsrs = parseFsrsFromFrontmatter(fsrsFrontmatter);
  }
  return repetition;
}

export function parseRepetitionFields(
  repeat: string,
  repeatDueAt: string | undefined,
  hidden?: string | undefined,
  referenceDateTime?: DateTime | undefined,
  fsrsFrontmatter?: Record<string, unknown> | null,
): Repetition {
  const parsedRepeat = parseRepeat(repeat);
  return formRepetition(
    parsedRepeat,
    repeatDueAt,
    hidden,
    referenceDateTime,
    false,
    fsrsFrontmatter,
  );
}

export function parseRepetitionFromMarkdown(
  markdown: string,
): Repetition | undefined {
  const bounds = determineFrontmatterBounds(markdown);
  if (bounds) {
    const frontmatter = parseYaml(markdown.slice(...bounds)) || {};
    const { repeat, due_at, hidden } = frontmatter;
    if (repeat && !isRepeatDisabled(repeat)) {
      return parseRepetitionFields(
        repeat,
        due_at || undefined,
        hidden,
        undefined,
        frontmatter,
      );
    }
  }
  return undefined;
}

export function parseHiddenFieldFromMarkdown(
  markdown: string
): boolean | undefined {
  const frontmatterBounds = determineFrontmatterBounds(markdown);
  const frontmatter = frontmatterBounds?.length ?
    markdown.slice(...frontmatterBounds) : '';
  if (frontmatter) {
    const { hidden: extractedHidden } = parseYaml(frontmatter) || {};
    if (extractedHidden === undefined || extractedHidden === null) {
      return undefined;
    }
    return parseYamlBoolean(extractedHidden);
  }
  return undefined;
}

export function parseTime(twentyFourHourTime: string) {
  const [hourString, minuteString] = twentyFourHourTime.split(':');
  return {
    hour: parseInt(hourString),
    minute: parseInt(minuteString),
  };
}
