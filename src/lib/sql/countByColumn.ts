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
