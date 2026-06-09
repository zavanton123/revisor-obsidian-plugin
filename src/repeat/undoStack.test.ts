import { Rating } from 'ts-fsrs';
import { DateTime } from 'luxon';

import { buildUndoEntry, ReviewUndoStack } from './undoStack';
import { Repetition } from './repeatTypes';

const baseRepetition = (): Repetition => ({
  repeatTimeOfDay: 'AM',
  repeatDueAt: DateTime.fromISO('2026-06-08T10:00:00.000-03:00'),
  fsrs: {
    state: 'review',
    stability: 12,
    difficulty: 5,
    scheduledDays: 7,
    learningSteps: 0,
    reps: 3,
    lapses: 0,
  },
});

describe('buildUndoEntry', () => {
  test('serializes due_at and fsrs from repetition', () => {
    const entry = buildUndoEntry(
      'notes/test.md',
      baseRepetition(),
      'rating',
      Rating.Good,
    );

    expect(entry.filePath).toBe('notes/test.md');
    expect(entry.action).toBe('rating');
    expect(entry.rating).toBe(Rating.Good);
    expect(entry.metadata.due_at).toBe('2026-06-08T10:00:00.000-03:00');
    expect(entry.metadata.fsrs).toContain('"state":"review"');
    expect(entry.timestamp).toBeGreaterThan(0);
  });
});

describe('ReviewUndoStack', () => {
  test('pop returns entries in reverse push order', () => {
    const stack = new ReviewUndoStack();
    const first = buildUndoEntry('a.md', baseRepetition(), 'rating', Rating.Good);
    const second = buildUndoEntry('b.md', baseRepetition(), 'bury');

    stack.push(first);
    stack.push(second);

    expect(stack.pop()).toBe(second);
    expect(stack.pop()).toBe(first);
    expect(stack.pop()).toBeUndefined();
  });

  test('canUndo reflects stack state', () => {
    const stack = new ReviewUndoStack();
    expect(stack.canUndo()).toBe(false);

    stack.push(buildUndoEntry('a.md', baseRepetition(), 'rating', Rating.Again));
    expect(stack.canUndo()).toBe(true);

    stack.pop();
    expect(stack.canUndo()).toBe(false);
  });

  test('evicts oldest entry when limit exceeded', () => {
    const stack = new ReviewUndoStack(2);
    const first = buildUndoEntry('a.md', baseRepetition(), 'rating', Rating.Good);
    const second = buildUndoEntry('b.md', baseRepetition(), 'rating', Rating.Hard);
    const third = buildUndoEntry('c.md', baseRepetition(), 'rating', Rating.Easy);

    stack.push(first);
    stack.push(second);
    stack.push(third);

    expect(stack.size).toBe(2);
    expect(stack.pop()).toBe(third);
    expect(stack.pop()).toBe(second);
    expect(stack.pop()).toBeUndefined();
  });

  test('clear removes all entries', () => {
    const stack = new ReviewUndoStack();
    stack.push(buildUndoEntry('a.md', baseRepetition(), 'forget'));
    stack.clear();

    expect(stack.canUndo()).toBe(false);
    expect(stack.size).toBe(0);
  });

  test('peek returns last pushed entry without removing it', () => {
    const stack = new ReviewUndoStack();
    const entry = buildUndoEntry('a.md', baseRepetition(), 'suspend');

    stack.push(entry);

    expect(stack.peek()).toBe(entry);
    expect(stack.size).toBe(1);
  });
});
