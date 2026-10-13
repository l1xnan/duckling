import { describe, expect, it } from 'vitest';

import {
  CLICKHOUSE_TABLE_PRIORITY_COLUMNS,
  FILE_LIST_PRIORITY_COLUMNS,
  MYSQL_TABLE_PRIORITY_COLUMNS,
  clickhouseTableDefaults,
  fileListDefaults,
  formatReadableSize,
  mysqlTableDefaults,
  schemaTableDefaultsFor,
  sizeColumnFormatters,
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

  it('keeps raw sizes and reports them as display-only size columns', () => {
    const { data, sizeColumns } = clickhouseTableDefaults(rows);
    expect(data[0].total_bytes).toBe(1536);
    expect(data[0].name).toBe('events');
    expect(sizeColumns).toEqual(['total_bytes']);
  });

  it('tolerates missing priority columns and empty input', () => {
    const { data, sizeColumns } = clickhouseTableDefaults([
      { name: 't', engine: 'Log' },
    ]);
    expect(Object.keys(data[0])).toEqual(['name', 'engine']);
    expect(sizeColumns).toEqual([]);

    expect(clickhouseTableDefaults([])).toEqual({
      data: [],
      hiddenColumns: {},
      sizeColumns: [],
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

  it('keeps raw sizes, reports size columns and leaves other values alone', () => {
    const { data, sizeColumns } = mysqlTableDefaults(rows);
    expect(data[0].DATA_LENGTH).toBe(1536);
    expect(data[0].INDEX_LENGTH).toBe(1024);
    expect(sizeColumns).toEqual(['DATA_LENGTH', 'INDEX_LENGTH']);
    expect(data[0].TABLE_NAME).toBe('orders');
    expect(data[0].TABLE_ROWS).toBe(1200);
  });

  it('matches column names case-insensitively', () => {
    const { data, hiddenColumns, sizeColumns } = mysqlTableDefaults([
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
    expect(data[0].data_length).toBe(2048);
    expect(sizeColumns).toEqual(['data_length']);
    expect(hiddenColumns).toEqual({ table_collation: true });
  });

  it('tolerates missing priority columns and empty input', () => {
    const { data, sizeColumns } = mysqlTableDefaults([
      { TABLE_NAME: 'v', TABLE_TYPE: 'VIEW' },
    ]);
    expect(Object.keys(data[0])).toEqual(['TABLE_NAME', 'TABLE_TYPE']);
    expect(sizeColumns).toEqual([]);

    expect(mysqlTableDefaults([])).toEqual({
      data: [],
      hiddenColumns: {},
      sizeColumns: [],
    });
  });
});

describe('sizeColumnFormatters', () => {
  it('formats only the rendered text, keeping records sortable by bytes', () => {
    const rows = [
      { TABLE_NAME: 'small', DATA_LENGTH: 1536, INDEX_LENGTH: 0 },
      { TABLE_NAME: 'large', DATA_LENGTH: 3 * 1024 ** 3, INDEX_LENGTH: 1024 },
    ];
    const { data, sizeColumns } = mysqlTableDefaults(rows);
    const formatters = sizeColumnFormatters(sizeColumns);

    expect(formatters.DATA_LENGTH(data[0].DATA_LENGTH)).toBe('1.50 KiB');
    expect(formatters.INDEX_LENGTH(data[1].INDEX_LENGTH)).toBe('1.00 KiB');
    expect(formatters.TABLE_NAME).toBeUndefined();

    // Sorting compares the raw values the formatter was handed, not its text.
    const sorted = [...data].sort(
      (a, b) => Number(a.DATA_LENGTH) - Number(b.DATA_LENGTH),
    );
    expect(sorted.map((row) => row.TABLE_NAME)).toEqual(['small', 'large']);
  });
});

describe('fileListDefaults', () => {
  const rows = [
    {
      filename: '/data/orders.csv',
      size: 1536,
      rows: 120,
      last_modified: '2024-02-01 00:00:00',
      content: 'ignored',
    },
  ];

  it('keeps the file columns in order and hides the rest', () => {
    const { data, hiddenColumns, sizeColumns } = fileListDefaults(rows);

    expect(Object.keys(data[0])).toEqual([
      ...FILE_LIST_PRIORITY_COLUMNS,
      'content',
    ]);
    expect(hiddenColumns).toEqual({ content: true });
    expect(data[0].rows).toBe(120);
    expect(data[0].last_modified).toBe('2024-02-01 00:00:00');
    expect(sizeColumns).toEqual(['size']);
  });

  it('renders the byte size readably while sorting on the raw value', () => {
    const { data, sizeColumns } = fileListDefaults(rows);

    expect(data[0].size).toBe(1536);
    expect(sizeColumnFormatters(sizeColumns).size(1536)).toBe('1.50 KiB');
  });

  it('tolerates an empty folder', () => {
    expect(fileListDefaults([])).toEqual({
      data: [],
      hiddenColumns: {},
      sizeColumns: [],
    });
  });
});

describe('schemaTableDefaultsFor', () => {
  it('picks the defaults per dialect', () => {
    expect(
      schemaTableDefaultsFor('MySQL', [{ TABLE_NAME: 't', DATA_LENGTH: 1024 }])
        ?.sizeColumns,
    ).toEqual(['DATA_LENGTH']);
    expect(
      schemaTableDefaultsFor('clickhouse', [{ name: 't', total_bytes: 1024 }])
        ?.sizeColumns,
    ).toEqual(['total_bytes']);
  });

  it('leaves dialects without a default view untouched', () => {
    const rows = [{ table_name: 't' }];
    expect(schemaTableDefaultsFor('postgres', rows)).toBeUndefined();
    expect(schemaTableDefaultsFor('sqlite', rows)).toBeUndefined();
    expect(schemaTableDefaultsFor(undefined, rows)).toBeUndefined();
    // File listings are driven by the tab flag, not by the dialect.
    expect(schemaTableDefaultsFor('folder', rows)).toBeUndefined();
    expect(schemaTableDefaultsFor('quack', rows)).toBeUndefined();
  });
});
