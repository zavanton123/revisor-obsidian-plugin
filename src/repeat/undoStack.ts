import { Rating } from 'ts-fsrs';

import { QueueAction } from './queueActions';
import { Repetition } from './repeatTypes';
import { classifyKind, ReviewKind } from './activity';
import { serializeRepetition } from './serializers';

export type UndoEntry = {
  filePath: string;
  metadata: Record<string, string | undefined>;
  action: 'rating' | QueueAction;
  rating?: Rating;
  timestamp: number;
  activityDayKey?: string;
  activityClassification?: ReviewKind;
  logIndex?: number;
};

export function buildUndoEntry(
  filePath: string,
  repetition: Repetition,
  action: UndoEntry['action'],
  rating?: Rating,
  activityDayKey?: string,
  logIndex?: number,
): UndoEntry {
  return {
    filePath,
    metadata: serializeRepetition(repetition),
    action,
    rating,
    timestamp: Date.now(),
    activityDayKey,
    activityClassification: classifyKind(repetition),
    logIndex,
  };
}

export class ReviewUndoStack {
  private entries: UndoEntry[] = [];

  constructor(private readonly limit = 30) {}

  push(entry: UndoEntry): void {
    this.entries.push(entry);
    if (this.entries.length > this.limit) {
      this.entries.shift();
    }
  }

  pop(): UndoEntry | undefined {
    return this.entries.pop();
  }

  peek(): UndoEntry | undefined {
    return this.entries[this.entries.length - 1];
  }

  canUndo(): boolean {
    return this.entries.length > 0;
  }

  clear(): void {
    this.entries = [];
  }

  get size(): number {
    return this.entries.length;
  }
}
