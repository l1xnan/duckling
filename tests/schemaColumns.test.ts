import { describe, expect, it } from 'vitest';

import {
  CLICKHOUSE_TABLE_PRIORITY_COLUMNS,
  MYSQL_TABLE_PRIORITY_COLUMNS,
  clickhouseTableDefaults,
  formatReadableSize,
  mysqlTableDefaults,
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

describe('mysqlTableDefaults', () => {
  const rows = [
    {
      TABLE_CATALOG: 'def',
      TABLE_SCHEMA: 'shop',
      TABLE_NAME: 'orders',
      TABLE_TYPE: 'BASE TABLE',
      ENGINE: 'InnoDB',
      VERSION: 10,
      ROW_FORMAT: 'Dynamic',
      TABLE_ROWS: 1200,
      AVG_ROW_LENGTH: 64,
      DATA_LENGTH: 1536,
      MAX_DATA_LENGTH: 0,
      INDEX_LENGTH: 1024,
      DATA_FREE: 0,
      AUTO_INCREMENT: 1201,
      CREATE_TIME: '2024-01-01 00:00:00',
      UPDATE_TIME: '2024-02-01 00:00:00',
      CHECK_TIME: null,
      TABLE_COLLATION: 'utf8mb4_general_ci',
      CHECKSUM: null,
      CREATE_OPTIONS: '',
      TABLE_COMMENT: '',
    },
  ];

  it('orders the ClickHouse-like columns first and keeps the rest after', () => {
    const { data } = mysqlTableDefaults(rows);
    expect(Object.keys(data[0])).toEqual([
      ...MYSQL_TABLE_PRIORITY_COLUMNS,
      'TABLE_CATALOG',
      'VERSION',
      'ROW_FORMAT',
      'AVG_ROW_LENGTH',
      'MAX_DATA_LENGTH',
      'DATA_FREE',
      'AUTO_INCREMENT',
      'CREATE_TIME',
      'CHECK_TIME',
      'TABLE_COLLATION',
      'CHECKSUM',
      'CREATE_OPTIONS',
    ]);
  });

  it('hides every column outside the priority list', () => {
    const { hiddenColumns } = mysqlTableDefaults(rows);
    expect(Object.keys(hiddenColumns)).toEqual([
      'TABLE_CATALOG',
      'VERSION',
      'ROW_FORMAT',
      'AVG_ROW_LENGTH',
      'MAX_DATA_LENGTH',
      'DATA_FREE',
      'AUTO_INCREMENT',
      'CREATE_TIME',
      'CHECK_TIME',
      'TABLE_COLLATION',
      'CHECKSUM',
      'CREATE_OPTIONS',
    ]);
    expect(hiddenColumns.TABLE_NAME).toBeUndefined();
    expect(hiddenColumns.DATA_LENGTH).toBeUndefined();
  });

  it('renders data and index sizes readably and keeps other values', () => {
    const { data } = mysqlTableDefaults(rows);
    expect(data[0].DATA_LENGTH).toBe('1.50 KiB');
    expect(data[0].INDEX_LENGTH).toBe('1.00 KiB');
    expect(data[0].TABLE_NAME).toBe('orders');
    expect(data[0].TABLE_ROWS).toBe(1200);
  });

  it('matches column names case-insensitively', () => {
    const { data, hiddenColumns } = mysqlTableDefaults([
      {
        table_name: 'orders',
        data_length: 2048,
        engine: 'InnoDB',
        table_collation: 'utf8mb4_general_ci',
      },
    ]);
    expect(Object.keys(data[0])).toEqual([
      'table_name',
      'engine',
      'data_length',
      'table_collation',
    ]);
    expect(data[0].data_length).toBe('2.00 KiB');
    expect(hiddenColumns).toEqual({ table_collation: true });
  });

  it('tolerates missing priority columns and empty input', () => {
    const { data } = mysqlTableDefaults([{ TABLE_NAME: 'v', TABLE_TYPE: 'VIEW' }]);
    expect(Object.keys(data[0])).toEqual(['TABLE_NAME', 'TABLE_TYPE']);

    expect(mysqlTableDefaults([])).toEqual({ data: [], hiddenColumns: {} });
  });
});
