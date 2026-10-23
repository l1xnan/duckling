import { Float64, Int32, Utf8 } from '@apache-arrow/ts';
import { describe, expect, it } from 'vitest';

import {
  formatPivotDimensionRecords,
  formatSchemaScalar,
} from '@/lib/formatDisplayValue';
import type { SchemaType } from '@/stores/dataset';

const options = { beautify: true, precision: 4 };

function schemaColumn(
  name: string,
  dataType: SchemaType['dataType'],
  type?: string,
): SchemaType {
  return { name, dataType, nullable: true, metadata: null, type };
}

describe('formatPivotDimensionRecords', () => {
  it('keeps numeric-looking strings intact without schema', () => {
    const [row] = formatPivotDimensionRecords(
      [{ code: '00123' }],
      ['code'],
      [],
      options,
    );
    expect(row.code).toBe('00123');
  });

  it('keeps unknown integer dimensions intact', () => {
    const [row] = formatPivotDimensionRecords(
      [{ id: 123 }],
      ['id'],
      [],
      options,
    );
    expect(row.id).toBe(123);
  });

  it('applies precision to unknown float dimensions', () => {
    const [row] = formatPivotDimensionRecords(
      [{ amount: 1.23456 }],
      ['amount'],
      [],
      options,
    );
    expect(row.amount).toBe('1.2346');
  });

  it('keeps numeric-looking strings intact with string schema', () => {
    const [row] = formatPivotDimensionRecords(
      [{ code: '00123' }],
      ['code'],
      [schemaColumn('code', new Utf8(), 'VARCHAR')],
      options,
    );
    expect(row.code).toBe('00123');
  });

  it('does not append decimals to integer dimensions', () => {
    const [row] = formatPivotDimensionRecords(
      [{ id: 123 }],
      ['id'],
      [schemaColumn('id', new Int32(), 'INTEGER')],
      options,
    );
    expect(row.id).toBe('123');
  });

  it('applies precision to float dimensions', () => {
    const [row] = formatPivotDimensionRecords(
      [{ amount: 1.23456 }],
      ['amount'],
      [schemaColumn('amount', new Float64(), 'DOUBLE')],
      options,
    );
    expect(row.amount).toBe('1.2346');
  });
});

describe('formatSchemaScalar', () => {
  it('does not turn integers into fixed decimals', () => {
    expect(
      formatSchemaScalar(
        123,
        schemaColumn('id', new Int32(), 'INTEGER'),
        options,
      ),
    ).toBe('123');
  });

  it('does not coerce numeric strings', () => {
    expect(
      formatSchemaScalar(
        '00123',
        schemaColumn('code', new Utf8(), 'VARCHAR'),
        options,
      ),
    ).toBe('00123');
  });
});
