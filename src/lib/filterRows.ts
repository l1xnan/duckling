/**
 * Client-side filter of result rows by a free-text query.
 * Matches if any cell's string form contains the query (case-insensitive).
 */

export function cellToSearchText(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (typeof value === 'bigint') return value.toString();
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

/**
 * Filter rows by query. Empty/whitespace query returns the original array.
 * When `columns` is provided, only those fields are searched.
 */
export function filterRows<T extends Record<string, unknown>>(
  rows: T[],
  query: string,
  columns?: string[],
): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return rows;
  if (!rows?.length) return rows;

  return rows.filter((row) => {
    const keys = columns?.length ? columns : Object.keys(row);
    return keys.some((key) => {
      const text = cellToSearchText(row[key]).toLowerCase();
      return text.includes(q);
    });
  });
}

/**
 * Build a simple OR of ILIKE/LIKE predicates for applying client filter as WHERE.
 * Best-effort; dialects that lack ILIKE fall back to LIKE.
 */
export function buildQuickFilterWhere(
  columns: string[],
  query: string,
  dialect: string,
  quoteIdent: (name: string, dialect: string) => string,
): string {
  const q = query.trim();
  if (!q || !columns.length) return '';
  const d = dialect.toLowerCase();
  const useIlike = !['mysql', 'sqlite', 'clickhouse'].includes(d);
  const op = useIlike ? 'ILIKE' : 'LIKE';
  const escaped = q.replaceAll("'", "''");
  const pattern = `'%${escaped}%'`;
  return columns
    .map((c) => {
      const col = quoteIdent(c, dialect);
      const cast =
        d === 'postgres' || d === 'duckdb'
          ? `${col}::text`
          : `CAST(${col} AS CHAR)`;
      return `${cast} ${op} ${pattern}`;
    })
    .join(' OR ');
}
