import { quoteIdent, quoteTableExpr } from '@/lib/sql/countByColumn';

export type ColumnProfileSqlOptions = {
  tableExpr: string;
  column: string;
  dialect: string;
  where?: string;
  /** Top-N values (default 10). */
  topN?: number;
};

/**
 * SQL for column profile: total, nulls, distinct, min, max.
 * Min/max use the column as-is (works for numbers/dates/strings on most engines).
 */
export function buildColumnProfileSql(opts: ColumnProfileSqlOptions): string {
  const dialect = opts.dialect || 'generic';
  const col = quoteIdent(opts.column, dialect);
  const from = quoteTableExpr(opts.tableExpr, dialect);
  const where =
    opts.where && opts.where.trim().length > 0
      ? ` WHERE ${opts.where.trim()}`
      : '';
  return (
    `SELECT` +
    ` COUNT(*) AS total,` +
    ` SUM(CASE WHEN ${col} IS NULL THEN 1 ELSE 0 END) AS null_count,` +
    ` COUNT(DISTINCT ${col}) AS distinct_count,` +
    ` MIN(${col}) AS min_value,` +
    ` MAX(${col}) AS max_value` +
    ` FROM ${from}${where}`
  );
}

/** Top-N value distribution (same shape as count-by). */
export function buildColumnTopNSql(opts: ColumnProfileSqlOptions): string {
  const dialect = opts.dialect || 'generic';
  const col = quoteIdent(opts.column, dialect);
  const from = quoteTableExpr(opts.tableExpr, dialect);
  const where =
    opts.where && opts.where.trim().length > 0
      ? ` WHERE ${opts.where.trim()}`
      : '';
  const lim = opts.topN ?? 10;
  return (
    `SELECT ${col} AS value, COUNT(*) AS count` +
    ` FROM ${from}${where}` +
    ` GROUP BY ${col}` +
    ` ORDER BY count DESC` +
    ` LIMIT ${lim}`
  );
}
