import { DateTime } from 'luxon';
import { parseYaml } from 'obsidian';

import { determineFrontmatterBounds } from '../frontmatter';

import {
  Repetition,
  FsrsCardState,
  FsrsStateName,
} from './repeatTypes';
import { DEFAULT_REPEAT } from '../settings';

const FSRS_STATE_NAMES: FsrsStateName[] = [
  'new', 'learning', 'review', 'relearning',
];

export function isFsrsRepeat(repeat: string): boolean {
  return /^fsrs(\b|\s|$)/i.test(repeat.trim());
}

export function isRepeatDisabled(repeatFieldValue: string): boolean {
  const booleanRegex = new RegExp('^(n|no|false|off|never)$', 'i');
  return booleanRegex.test(repeatFieldValue);
}

export function isRevisorNote(frontmatter: Record<string, unknown>): boolean {
  const repeat = frontmatter.repeat;
  if (typeof repeat === 'string') {
    if (isRepeatDisabled(repeat)) {
      return false;
    }
    if (repeat.trim() && !isFsrsRepeat(repeat)) {
      return false;
    }
  }
  if (frontmatter.fsrs !== undefined) {
    return true;
  }
  if (frontmatter.due_at) {
    return true;
  }
  if (typeof repeat === 'string' && isFsrsRepeat(repeat)) {
    return true;
  }
  return false;
}

export function parseRepeatDueAt(
  repeatDueAt: string | undefined,
  referenceDateTime: DateTime,
) {
  if (repeatDueAt) {
    const parsedDueAtMaybe = DateTime.fromISO(String(repeatDueAt));
    // @ts-ignore: luxon adds .invalid if the timestamp is not parsable.
    if (!parsedDueAtMaybe.invalid) {
      return parsedDueAtMaybe;
    }
  }
  return referenceDateTime;
}

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

export function parseRepetition(
  frontmatter: Record<string, unknown>,
  referenceDateTime?: DateTime | undefined,
): Repetition | undefined {
  if (!isRevisorNote(frontmatter)) {
    return undefined;
  }
  const reference = referenceDateTime || DateTime.now();
  return {
    repeatTimeOfDay: DEFAULT_REPEAT.repeatTimeOfDay,
    repeatDueAt: parseRepeatDueAt(
      frontmatter.due_at ? String(frontmatter.due_at) : undefined,
      reference,
    ),
    fsrs: parseFsrsFromFrontmatter(frontmatter),
  };
}

export function parseRepetitionFromMarkdown(
  markdown: string,
): Repetition | undefined {
  const bounds = determineFrontmatterBounds(markdown);
  if (!bounds) {
    return undefined;
  }
  const frontmatter = parseYaml(markdown.slice(...bounds)) || {};
  return parseRepetition(frontmatter);
}

export function parseTime(twentyFourHourTime: string) {
  const [hourString, minuteString] = twentyFourHourTime.split(':');
  return {
    hour: parseInt(hourString),
    minute: parseInt(minuteString),
  };
}
