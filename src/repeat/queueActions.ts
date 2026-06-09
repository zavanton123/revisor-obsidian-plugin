import { DateTime } from 'luxon';

import { parseTime } from './parsers';
import { Repetition } from './repeatTypes';
import { RepeatPluginSettings } from '../settings';
import { createInitialFsrsRepetition } from './fsrs';
import { serializeFsrsState, serializeQueueMetadata } from './serializers';

export type QueueAction = 'suspend' | 'unsuspend' | 'bury' | 'unbury' | 'forget';

export function getNextDayRollover(
  now: DateTime,
  dayStartsAt: string,
): DateTime {
  const { hour, minute } = parseTime(dayStartsAt);
  let rollover = now.startOf('day').set({
    hour,
    minute,
    second: 0,
    millisecond: 0,
  });
  if (now >= rollover) {
    rollover = rollover.plus({ days: 1 });
  }
  return rollover;
}

function baseMetadataFromRepetition(repetition: Repetition) {
  return {
    due_at: repetition.repeatDueAt.toISO() || undefined,
    fsrs: repetition.fsrs ? serializeFsrsState(repetition.fsrs) : undefined,
  };
}

export function buildQueueMetadata(
  action: QueueAction,
  repetition: Repetition,
  settings: RepeatPluginSettings,
  now: DateTime = DateTime.now(),
): Record<string, string | undefined> {
  switch (action) {
    case 'suspend':
      return serializeQueueMetadata({
        ...baseMetadataFromRepetition(repetition),
        revisor_suspended: 'true',
        revisor_buried_until: undefined,
      });
    case 'unsuspend':
      return serializeQueueMetadata({
        ...baseMetadataFromRepetition(repetition),
        revisor_suspended: undefined,
      });
    case 'bury':
      return serializeQueueMetadata({
        ...baseMetadataFromRepetition(repetition),
        revisor_buried_until: getNextDayRollover(now, settings.dayStartsAt).toISO() || undefined,
      });
    case 'unbury':
      return serializeQueueMetadata({
        ...baseMetadataFromRepetition(repetition),
        revisor_buried_until: undefined,
      });
    case 'forget': {
      const fresh = createInitialFsrsRepetition(settings, now);
      return serializeQueueMetadata({
        due_at: fresh.repeatDueAt.toISO() || undefined,
        fsrs: fresh.fsrs ? serializeFsrsState(fresh.fsrs) : undefined,
        revisor_suspended: undefined,
        revisor_buried_until: undefined,
      });
    }
  }
}
