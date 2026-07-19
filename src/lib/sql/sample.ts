import { quoteTableExpr } from '@/lib/sql/countByColumn';

/**
 * Build a sample-browse SQL for the dialect.
 * Prefers TABLESAMPLE when available; falls back to ORDER BY random LIMIT.
 */
export function buildSampleSql(opts: {
  tableExpr: string;
  dialect: string;
  limit?: number;
}): string {
  const dialect = (opts.dialect || 'generic').toLowerCase();
  const from = quoteTableExpr(opts.tableExpr, dialect);
  const lim = opts.limit ?? 100;

  if (dialect === 'postgres') {
    // SYSTEM sampling is fast; still apply LIMIT for display.
    return `SELECT * FROM ${from} TABLESAMPLE SYSTEM (1) LIMIT ${lim}`;
  }
  if (dialect === 'duckdb') {
    return `SELECT * FROM ${from} USING SAMPLE ${lim} ROWS`;
  }
  if (dialect === 'clickhouse') {
    return `SELECT * FROM ${from} SAMPLE 0.01 LIMIT ${lim}`;
  }
  // MySQL / SQLite / generic
  if (dialect === 'mysql') {
    return `SELECT * FROM ${from} ORDER BY RAND() LIMIT ${lim}`;
  }
  if (dialect === 'sqlite') {
    return `SELECT * FROM ${from} ORDER BY RANDOM() LIMIT ${lim}`;
  }
  return `SELECT * FROM ${from} ORDER BY RANDOM() LIMIT ${lim}`;
}

export function buildExplainSql(
  sourceSql: string,
  dialect: string,
  analyze = false,
): string {
  const inner = sourceSql.trim().replace(/;+\s*$/, '');
  const d = dialect.toLowerCase();
  if (d === 'mysql') {
    return analyze ? `EXPLAIN ANALYZE ${inner}` : `EXPLAIN ${inner}`;
  }
  if (d === 'postgres' || d === 'duckdb') {
    return analyze
      ? `EXPLAIN (ANALYZE, BUFFERS) ${inner}`
      : `EXPLAIN ${inner}`;
  }
  if (d === 'clickhouse') {
    return `EXPLAIN ${inner}`;
  }
  return `EXPLAIN ${inner}`;
}
