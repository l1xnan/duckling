import { quoteIdent, quoteTableExpr } from '@/lib/sql/countByColumn';
import { wrapSqlAsAliasedSubquery } from '@/lib/sql/wrapSubquery';

export type ColumnProfileSqlOptions = {
  tableExpr: string;
  column: string;
  dialect: string;
  where?: string;
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
  return `${profileSelect(col)} FROM ${from}${where}`;
}

/** Same aggregates over an arbitrary SELECT result (query view). */
export function buildColumnProfileSubquerySql(opts: {
  sourceSql: string;
  column: string;
  dialect: string;
}): string {
  const dialect = opts.dialect || 'generic';
  const col = quoteIdent(opts.column, dialect);
  const from = wrapSqlAsAliasedSubquery(opts.sourceSql, '__count_src');
  return `${profileSelect(col)} FROM ${from}`;
}

function profileSelect(col: string): string {
  return (
    `SELECT` +
    ` COUNT(*) AS total,` +
    ` SUM(CASE WHEN ${col} IS NULL THEN 1 ELSE 0 END) AS null_count,` +
    ` COUNT(DISTINCT ${col}) AS distinct_count,` +
    ` MIN(${col}) AS min_value,` +
    ` MAX(${col}) AS max_value`
  );
}
