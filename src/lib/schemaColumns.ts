/**
 * ClickHouse `system.tables` columns shown first (in this order) when a
 * database is opened.
 */
export const CLICKHOUSE_TABLE_PRIORITY_COLUMNS = [
  'name',
  'database',
  'engine_full',
  'engine',
  'total_bytes',
  'metadata_modification_time',
  'comment',
  'total_rows',
  'metadata_path',
] as const;

/**
 * MySQL `information_schema.tables` counterpart of the ClickHouse list: the
 * same kind of information (table, schema, kind, engine, size, last modified,
 * comment, rows) shown first when a database is opened.
 */
export const MYSQL_TABLE_PRIORITY_COLUMNS = [
  'TABLE_NAME',
  'TABLE_SCHEMA',
  'TABLE_TYPE',
  'ENGINE',
  'DATA_LENGTH',
  'INDEX_LENGTH',
  'UPDATE_TIME',
  'TABLE_COMMENT',
  'TABLE_ROWS',
] as const;

const SIZE_UNITS = ['B', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB'] as const;

/** Byte count as a readable string, e.g. `1.50 MiB` / `3.20 GiB`. */
export function formatReadableSize(value: unknown): unknown {
  if (value === null || value === undefined || value === '') {
    return value;
  }

  const bytes = Number(value);
  if (!Number.isFinite(bytes)) {
    return value;
  }

  const abs = Math.abs(bytes);
  if (abs < 1024) {
    return `${bytes} ${SIZE_UNITS[0]}`;
  }

  const exp = Math.min(
    Math.floor(Math.log(abs) / Math.log(1024)),
    SIZE_UNITS.length - 1,
  );
  return `${(bytes / 1024 ** exp).toFixed(2)} ${SIZE_UNITS[exp]}`;
}

export type SchemaTableDefaults = {
  data: Record<string, unknown>[];
  /** Columns outside the priority list — hidden until the user shows them. */
  hiddenColumns: Record<string, boolean>;
  /**
   * Byte-size columns, left raw in `data` so the grid keeps sorting them by
   * real bytes; render them with `formatReadableSize`.
   */
  sizeColumns: string[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Reorder rows so `priorityColumns` come first and report the remaining
 * columns as hidden by default. Matching ignores case because server metadata
 * casing differs between dialects. Values are never rewritten: size columns
 * are reported in `sizeColumns` so the caller can format them for display
 * while sorting keeps comparing the raw byte counts.
 */
function priorityTableDefaults(
  rows: unknown[],
  priorityColumns: readonly string[],
  sizeColumns: readonly string[],
): SchemaTableDefaults {
  const records = (rows ?? []).filter(isRecord);
  const first = records[0];
  if (!first) {
    return { data: records, hiddenColumns: {}, sizeColumns: [] };
  }

  const rank = new Map<string, number>();
  for (const [index, column] of priorityColumns.entries()) {
    rank.set(column.toLowerCase(), index);
  }
  const sizes = new Set(sizeColumns.map((column) => column.toLowerCase()));

  const keys = Object.keys(first);
  const isPriority = (key: string) => rank.has(key.toLowerCase());
  const ordered = [
    ...keys
      .filter(isPriority)
      .sort((a, b) => rank.get(a.toLowerCase())! - rank.get(b.toLowerCase())!),
    ...keys.filter((key) => !isPriority(key)),
  ];

  const hiddenColumns: Record<string, boolean> = {};
  for (const key of ordered) {
    if (!isPriority(key)) {
      hiddenColumns[key] = true;
    }
  }

  const data = records.map((record) => {
    const next: Record<string, unknown> = {};
    for (const key of ordered) {
      next[key] = record[key];
    }
    return next;
  });

  return {
    data,
    hiddenColumns,
    sizeColumns: ordered.filter((key) => sizes.has(key.toLowerCase())),
  };
}

/**
 * Reorder `system.tables` rows so the priority columns come first, report
 * `total_bytes` as a display-formatted size column, and hide the rest.
 */
export function clickhouseTableDefaults(rows: unknown[]): SchemaTableDefaults {
  return priorityTableDefaults(rows, CLICKHOUSE_TABLE_PRIORITY_COLUMNS, [
    'total_bytes',
  ]);
}

/**
 * Same default view as ClickHouse for `information_schema.tables` rows: key
 * columns first, data and index sizes formatted, everything else hidden.
 */
export function mysqlTableDefaults(rows: unknown[]): SchemaTableDefaults {
  return priorityTableDefaults(rows, MYSQL_TABLE_PRIORITY_COLUMNS, [
    'DATA_LENGTH',
    'INDEX_LENGTH',
  ]);
}

/**
 * File listings (folder / quack directories) have no schema: the table list is
 * the readable files below a directory, with the byte size rendered readably.
 */
export const FILE_LIST_PRIORITY_COLUMNS = [
  'filename',
  'size',
  'rows',
  'last_modified',
] as const;

export function fileListDefaults(rows: unknown[]): SchemaTableDefaults {
  return priorityTableDefaults(rows, FILE_LIST_PRIORITY_COLUMNS, ['size']);
}

/** Default table-list view for a dialect, when it has one. */
export function schemaTableDefaultsFor(
  dialect: string | undefined | null,
  rows: unknown[],
): SchemaTableDefaults | undefined {
  switch ((dialect ?? '').toLowerCase()) {
    case 'clickhouse':
      return clickhouseTableDefaults(rows);
    case 'mysql':
      return mysqlTableDefaults(rows);
    default:
      return undefined;
  }
}

/**
 * Display formatters for the size columns of a schema table view. The records
 * keep raw byte counts, so the grid sorts them numerically and only the
 * rendered text becomes readable.
 */
export function sizeColumnFormatters(
  sizeColumns: readonly string[],
): Record<string, (value: unknown) => unknown> {
  const formatters: Record<string, (value: unknown) => unknown> = {};
  for (const key of sizeColumns) {
    formatters[key] = formatReadableSize;
  }
  return formatters;
}
