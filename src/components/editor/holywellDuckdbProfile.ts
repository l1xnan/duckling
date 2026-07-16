import {
  POSTGRES_PROFILE,
  type DialectProfile,
  type DialectStatementHandler,
} from 'holywell';

/**
 * DuckDB statements holywell cannot fully format. Register them as
 * statement starters + verbatim passthrough so top-level forms like
 * `PIVOT …` / `FROM …` do not fail tokenization as identifiers.
 */
const DUCKDB_VERBATIM_STATEMENTS = [
  'PIVOT',
  'UNPIVOT',
  'INSTALL',
  'LOAD',
  'ATTACH',
  'DETACH',
  'EXPORT',
  'IMPORT',
  'SUMMARIZE',
  'FROM',
  'CHECKPOINT',
  'FORCE',
  'COPY',
  'CALL',
  'PRAGMA',
] as const;

const DUCKDB_EXTRA_KEYWORDS = [
  'MACRO',
  'SECRET',
  'TEMPORARY',
  'TEMP',
  'STRUCT',
  'MAP',
  'LIST',
  'ALIAS',
  'DATABASE',
  'CATALOG',
] as const;

const verbatimHandler: DialectStatementHandler = {
  kind: 'verbatim_unsupported',
  allowImplicitBoundary: true,
};

let cached: DialectProfile | null = null;

/** Custom holywell profile optimized for DuckDB (based on postgres). */
export function getDuckdbHolywellProfile(): DialectProfile {
  if (cached) {
    return cached;
  }

  const base = POSTGRES_PROFILE;
  const keywords = new Set(base.keywords);
  const clauseKeywords = new Set(base.clauseKeywords);
  const statementStarters = new Set(base.statementStarters);
  const statementHandlers: Record<string, DialectStatementHandler> = {
    ...(base.statementHandlers ?? {}),
  };

  for (const kw of DUCKDB_VERBATIM_STATEMENTS) {
    keywords.add(kw);
    statementStarters.add(kw);
    statementHandlers[kw] = verbatimHandler;
  }

  clauseKeywords.add('PIVOT');
  clauseKeywords.add('UNPIVOT');

  for (const kw of DUCKDB_EXTRA_KEYWORDS) {
    keywords.add(kw);
  }

  cached = {
    // DialectProfile.name must be a built-in DialectName.
    name: 'postgres',
    keywords,
    functionKeywords: base.functionKeywords,
    clauseKeywords,
    statementStarters,
    statementHandlers,
  };

  return cached;
}
