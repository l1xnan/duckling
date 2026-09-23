import { quoteIdent } from '@/lib/sql/countByColumn';
import { wrapSqlAsAliasedSubquery } from '@/lib/sql/wrapSubquery';

/**
 * Build a single equality (or IS NULL) predicate for drill-down from a cell.
 */
export function buildCellPredicate(
  column: string,
  value: unknown,
  dialect: string,
): string {
  const col = quoteIdent(column, dialect);
  if (value === null || value === undefined) {
    return `${col} IS NULL`;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return `${col} = ${value}`;
  }
  if (typeof value === 'bigint') {
    return `${col} = ${value.toString()}`;
  }
  if (typeof value === 'boolean') {
    const d = dialect.toLowerCase();
    if (d === 'mysql' || d === 'sqlite') {
      return `${col} = ${value ? 1 : 0}`;
    }
    return `${col} = ${value ? 'TRUE' : 'FALSE'}`;
  }
  const s = String(value).replaceAll("'", "''");
  return `${col} = '${s}'`;
}

/** Merge a new predicate into an existing WHERE string with AND. */
export function mergeWhere(existing: string | undefined, predicate: string): string {
  const prev = (existing ?? '').trim();
  if (!prev) return predicate;
  if (!predicate.trim()) return prev;
  return `(${prev}) AND (${predicate})`;
}

/** Wrap a statement so an extra predicate filters its result rows. */
export function buildFilteredSubquerySql(sourceSql: string, where: string): string {
  const predicate = where.trim();
  const source = sourceSql.trim();
  if (!predicate) return source;
  return `SELECT * FROM ${wrapSqlAsAliasedSubquery(source, '__filter_src')} WHERE ${predicate}`;
}
