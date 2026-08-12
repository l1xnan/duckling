import { quoteIdent } from '@/lib/sql/countByColumn';

/**
 * Count-by for an arbitrary SELECT result (QueryView).
 * Wraps the original SQL as a subquery and groups by column.
 */
export function buildCountBySubquerySql(opts: {
  sourceSql: string;
  column: string;
  dialect: string;
  limit?: number;
}): string {
  const dialect = opts.dialect || 'generic';
  const col = quoteIdent(opts.column, dialect);
  const inner = opts.sourceSql.trim().replace(/;+\s*$/, '');
  const lim = opts.limit ?? 1000;
  return (
    `SELECT ${col} AS value, COUNT(*) AS count` +
    ` FROM (${inner}) AS __count_src` +
    ` GROUP BY ${col}` +
    ` ORDER BY count DESC` +
    ` LIMIT ${lim}`
  );
}

/** Row count for the same subquery as count-by (denominator for percent). */
export function buildSubqueryRowCountSql(sourceSql: string): string {
  const inner = sourceSql.trim().replace(/;+\s*$/, '');
  return `SELECT COUNT(*) AS count FROM (${inner}) AS __count_src`;
}
