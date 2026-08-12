/**
 * Build GROUP BY COUNT SQL for "count by this column" feature.
 */

export function quoteIdent(name: string, dialect: string): string {
  const d = dialect.toLowerCase();
  const q = d === 'mysql' || d === 'clickhouse' ? '`' : '"';
  return `${q}${name.replaceAll(q, q + q)}${q}`;
}

/** Quote a bare table ref (`schema.table`); leave function expressions alone. */
export function quoteTableExpr(tableExpr: string, dialect: string): string {
  const t = tableExpr.trim();
  // DuckDB table functions / subqueries
  if (t.includes('(') || t.includes(' ') || t.startsWith('(')) {
    return t;
  }
  return t
    .split('.')
    .map((part) => quoteIdent(part, dialect))
    .join('.');
}

export type CountByColumnSqlOptions = {
  tableExpr: string;
  column: string;
  dialect: string;
  where?: string;
  /** Max distinct groups (default 1000). */
  limit?: number;
};

export function buildCountByColumnSql(opts: CountByColumnSqlOptions): string {
  const dialect = opts.dialect || 'generic';
  const col = quoteIdent(opts.column, dialect);
  const from = quoteTableExpr(opts.tableExpr, dialect);
  const where =
    opts.where && opts.where.trim().length > 0
      ? ` WHERE ${opts.where.trim()}`
      : '';
  const lim = opts.limit ?? 1000;
  return (
    `SELECT ${col} AS value, COUNT(*) AS count` +
    ` FROM ${from}${where}` +
    ` GROUP BY ${col}` +
    ` ORDER BY count DESC` +
    ` LIMIT ${lim}`
  );
}

export type TableRowCountSqlOptions = {
  tableExpr: string;
  dialect: string;
  where?: string;
};

/** Row count for the same FROM/WHERE as count-by (denominator for percent). */
export function buildTableRowCountSql(opts: TableRowCountSqlOptions): string {
  const dialect = opts.dialect || 'generic';
  const from = quoteTableExpr(opts.tableExpr, dialect);
  const where =
    opts.where && opts.where.trim().length > 0
      ? ` WHERE ${opts.where.trim()}`
      : '';
  return `SELECT COUNT(*) AS count FROM ${from}${where}`;
}

export type CountRowLike = { count: number };

export function sumCountRows(rows: CountRowLike[]): number {
  return rows.reduce((sum, row) => sum + row.count, 0);
}

export function formatCountPercent(count: number, total: number): string {
  if (!total || total <= 0) return '0%';
  return `${((count / total) * 100).toFixed(2)}%`;
}

export function withCountPercent<T extends CountRowLike>(
  rows: T[],
  total: number,
): Array<T & { percent: string }> {
  return rows.map((row) => ({
    ...row,
    percent: formatCountPercent(row.count, total),
  }));
}

export function mapCountByRows(
  data: unknown[],
): Array<{ value: unknown; count: number }> {
  return (data ?? []).map((row) => {
    const r = row as Record<string, unknown>;
    const value = r.value ?? r.VALUE ?? r.Value ?? Object.values(r)[0];
    const countRaw =
      r.count ?? r.COUNT ?? r.Count ?? Object.values(r)[1] ?? 0;
    const count =
      typeof countRaw === 'bigint' ? Number(countRaw) : Number(countRaw) || 0;
    return { value, count };
  });
}

export function parseScalarCountResult(data: unknown[]): number {
  if (!data?.length) return 0;
  const r = data[0] as Record<string, unknown>;
  const raw =
    r.count ??
    r.COUNT ??
    r.Count ??
    r.num ??
    r.NUM ??
    Object.values(r)[0] ??
    0;
  return typeof raw === 'bigint' ? Number(raw) : Number(raw) || 0;
}

/** Prefer parent view total; fetch COUNT(*) when missing but groups exist. */
export async function resolveAllRowsTotal(
  rows: CountRowLike[],
  parentTotal: number | undefined,
  fetchTotal: () => Promise<number>,
): Promise<number> {
  if (parentTotal != null && parentTotal > 0) {
    return parentTotal;
  }
  if (sumCountRows(rows) > 0) {
    return fetchTotal();
  }
  return parentTotal ?? 0;
}

export function toCountByDisplayRows(
  rows: Array<{ value: unknown; count: number }>,
  total: number,
): Array<{ value: string; count: number; percent: string }> {
  const mapped = rows.map((row) => ({
    value: row.value == null || row.value === '' ? '<null>' : String(row.value),
    count: row.count,
  }));
  return withCountPercent(mapped, total);
}
