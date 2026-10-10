import { describe, expect, it } from 'vitest';

import {
  CLICKHOUSE_TABLE_PRIORITY_COLUMNS,
  clickhouseTableDefaults,
  formatReadableSize,
} from '@/lib/schemaColumns';

describe('formatReadableSize', () => {
  it('passes through empty values', () => {
    expect(formatReadableSize(null)).toBeNull();
    expect(formatReadableSize(undefined)).toBeUndefined();
    expect(formatReadableSize('')).toBe('');
  });

  it('formats bytes, MiB and GiB', () => {
    expect(formatReadableSize(0)).toBe('0 B');
    expect(formatReadableSize(512)).toBe('512 B');
    expect(formatReadableSize(1024)).toBe('1.00 KiB');
    expect(formatReadableSize(1.5 * 1024 ** 2)).toBe('1.50 MiB');
    expect(formatReadableSize(3 * 1024 ** 3)).toBe('3.00 GiB');
  });

  it('formats bigint and numeric strings', () => {
    expect(formatReadableSize(2048n)).toBe('2.00 KiB');
    expect(formatReadableSize('1048576')).toBe('1.00 MiB');
  });
});

describe('clickhouseTableDefaults', () => {
  const rows = [
    {
      uuid: 'u1',
      name: 'events',
      database: 'default',
      engine_full: 'MergeTree ORDER BY id',
      engine: 'MergeTree',
      total_bytes: 1536,
      metadata_modification_time: '2024-01-01 00:00:00',
      comment: '',
      total_rows: 10,
      metadata_path: '/var/lib/clickhouse/...',
      create_table_query: 'CREATE TABLE ...',
      is_temporary: 0,
    },
  ];

  it('orders priority columns first and keeps the rest after', () => {
    const { data } = clickhouseTableDefaults(rows);
    expect(Object.keys(data[0])).toEqual([
      ...CLICKHOUSE_TABLE_PRIORITY_COLUMNS,
      'uuid',
      'create_table_query',
      'is_temporary',
    ]);
  });

  it('hides every column outside the priority list', () => {
    const { hiddenColumns } = clickhouseTableDefaults(rows);
    expect(hiddenColumns).toEqual({
      uuid: true,
      create_table_query: true,
      is_temporary: true,
    });
  });

  it('renders sizes readably', () => {
    const { data } = clickhouseTableDefaults(rows);
    expect(data[0].total_bytes).toBe('1.50 KiB');
    expect(data[0].name).toBe('events');
  });

  it('tolerates missing priority columns and empty input', () => {
    const { data } = clickhouseTableDefaults([{ name: 't', engine: 'Log' }]);
    expect(Object.keys(data[0])).toEqual(['name', 'engine']);

    expect(clickhouseTableDefaults([])).toEqual({
      data: [],
      hiddenColumns: {},
    });
  });
});
