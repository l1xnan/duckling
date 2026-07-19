import { quoteIdent } from '@/lib/sql/countByColumn';

/**
 * Build an ORDER BY clause fragment: `"col" ASC` / `` `col` DESC ``
 * (without the ORDER BY keyword).
 */
export function orderByClause(
  column: string,
  desc: boolean,
  dialect: string,
): string {
  const col = quoteIdent(column, dialect);
  return `${col} ${desc ? 'DESC' : 'ASC'}`;
}

/**
 * Toggle sort state for a column header click.
 * Cycle: none → ASC → DESC → none
 */
export function nextOrderBy(
  current: { name: string; desc: boolean } | undefined,
  column: string,
): { name: string; desc: boolean } | undefined {
  if (!current || current.name !== column) {
    return { name: column, desc: false };
  }
  if (!current.desc) {
    return { name: column, desc: true };
  }
  return undefined;
}
