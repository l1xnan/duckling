import { Field, Int32, List, Struct, Utf8 } from '@apache-arrow/ts';
import { describe, expect, it } from 'vitest';

import { formatCellForGrid, handleFieldFormat } from '@/components/tables/format';

const listType = new List(new Field('item', new Int32()));
const structType = new Struct([
  new Field('a', new Int32()),
  new Field('b', new Utf8()),
]);

describe('formatCellForGrid', () => {
  it('stringifies full list contents', () => {
    const value = [1, 2, 3];
    const text = formatCellForGrid(value, listType, { dataType: listType });
    expect(text).toBe('[1,2,3]');
  });

  it('stringifies struct with all keys', () => {
    const wideStruct = new Struct(
      Array.from({ length: 10 }, (_, i) => new Field(`k${i}`, new Int32())),
    );
    const value = Object.fromEntries(
      Array.from({ length: 10 }, (_, i) => [`k${i}`, i]),
    );
    const text = formatCellForGrid(value, wideStruct, {
      dataType: wideStruct,
    });
    expect(text).toContain('k9');
    expect(text).not.toContain('more');
  });
});

describe('handleFieldFormat', () => {
  it('reads from record key', () => {
    const record = { col: { a: 1, b: 'x' } };
    const out = handleFieldFormat(record, {
      key: 'col',
      dataType: structType,
    });
    expect(out).toContain('"a":1');
  });
});
