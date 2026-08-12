import { quoteTableExpr } from '@/lib/sql/countByColumn';

export type ComputedColumn = {
  id: string;
  sql: string;
};

export type ParsedComputedColumn = {
  expr: string;
  alias: string;
};

const TRAILING_AS_RE = /\bAS\s+([a-zA-Z_][\w$]*)\s*$/i;

/** Parse `expr AS alias` from a computed column SQL fragment. */
export function parseComputedColumnSql(sql: string): ParsedComputedColumn | null {
  const trimmed = sql.trim();
  if (!trimmed) return null;

  const match = trimmed.match(TRAILING_AS_RE);
  if (!match || match.index === undefined) return null;

  const expr = trimmed.slice(0, match.index).trim();
  const alias = match[1]?.trim();
  if (!expr || !alias) return null;

  return { expr, alias };
}

/** Validate all computed columns; returns first error message or null. */
export function validateComputedColumns(columns: ComputedColumn[]): string | null {
  for (const col of columns) {
    const trimmed = col.sql.trim();
    if (!trimmed) {
      return 'Computed column SQL cannot be empty';
    }
    if (!parseComputedColumnSql(trimmed)) {
      return `Invalid computed column (use "expr AS alias"): ${trimmed}`;
    }
  }
  return null;
}

/** `a+1 AS a1, b*2 AS b2` */
export function computedSelectFragments(columns: ComputedColumn[]): string {
  return columns
    .map((c) => c.sql.trim())
    .filter(Boolean)
    .join(', ');
}

/** `, a+1 AS a1, b*2 AS b2` for `SELECT *… FROM table`. */
export function joinComputedSelectList(columns: ComputedColumn[]): string {
  const fragments = computedSelectFragments(columns);
  return fragments ? `, ${fragments}` : '';
}

/**
 * Wrap a table expression for analysis dialogs when computed columns exist.
 * Main browse uses flat `SELECT *, extras FROM table` via `selectExtras`.
 */
export function wrapTableExprWithComputed(
  tableExpr: string,
  columns: ComputedColumn[],
  dialect: string,
): string {
  const fragments = computedSelectFragments(columns);
  if (!fragments) return tableExpr;
  const from = quoteTableExpr(tableExpr, dialect);
  return `(SELECT *, ${fragments} FROM ${from}) AS __computed`;
}

export function resolveAnalysisTableExpr(
  tableExpr: string,
  columns: ComputedColumn[] | undefined,
  dialect: string,
): string {
  if (!columns?.length) return tableExpr;
  return wrapTableExprWithComputed(tableExpr, columns, dialect);
}
