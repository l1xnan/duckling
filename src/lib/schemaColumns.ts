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

const PRIORITY_COLUMN_SET: ReadonlySet<string> = new Set(
  CLICKHOUSE_TABLE_PRIORITY_COLUMNS,
);

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
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Reorder `system.tables` rows so the priority columns come first, render
 * byte sizes readably, and report the remaining columns as hidden by default.
 */
export function clickhouseTableDefaults(rows: unknown[]): SchemaTableDefaults {
  const records = (rows ?? []).filter(isRecord);
  const first = records[0];
  if (!first) {
    return { data: records, hiddenColumns: {} };
  }

  const keys = Object.keys(first);
  const ordered = [
    ...CLICKHOUSE_TABLE_PRIORITY_COLUMNS.filter((key) => keys.includes(key)),
    ...keys.filter((key) => !PRIORITY_COLUMN_SET.has(key)),
  ];

  const hiddenColumns: Record<string, boolean> = {};
  for (const key of ordered) {
    if (!PRIORITY_COLUMN_SET.has(key)) {
      hiddenColumns[key] = true;
    }
  }

  const data = records.map((record) => {
    const next: Record<string, unknown> = {};
    for (const key of ordered) {
      next[key] =
        key === 'total_bytes' ? formatReadableSize(record[key]) : record[key];
    }
    return next;
  });

  return { data, hiddenColumns };
}
