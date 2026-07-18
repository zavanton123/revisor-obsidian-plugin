import { uniqByField } from './utils';

describe('uniqByField', () => {
  test('keeps first occurrence for each field value', () => {
    const input = [
      { id: 'a', name: 'one' },
      { id: 'b', name: 'two' },
      { id: 'a', name: 'three' },
    ];
    expect(uniqByField(input, 'id')).toEqual([
      { id: 'a', name: 'one' },
      { id: 'b', name: 'two' },
    ]);
  });

  test('handles nullish items', () => {
    expect(uniqByField([null, { id: 1 }, null, { id: 1 }], 'id')).toEqual([
      null,
      { id: 1 },
    ]);
  });
});
