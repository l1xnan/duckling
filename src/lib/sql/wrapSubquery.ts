/** Trim trailing statement semicolons before embedding SQL in a subquery. */
export function stripTrailingStatementSemicolons(sql: string): string {
  return sql.trim().replace(/;+\s*$/, '');
}

/**
 * Parenthesized subquery body. Newlines ensure a final `--` line comment cannot
 * swallow the closing `)` when the wrapper appends `) AS alias`.
 */
export function wrapSqlAsSubquery(sql: string): string {
  const inner = stripTrailingStatementSemicolons(sql);
  if (!inner) {
    return '(SELECT 1 WHERE FALSE)';
  }
  return `(\n${inner}\n)`;
}

/** `(\n…\n) AS alias` for FROM clauses. */
export function wrapSqlAsAliasedSubquery(sql: string, alias: string): string {
  return `${wrapSqlAsSubquery(sql)} AS ${alias}`;
}
