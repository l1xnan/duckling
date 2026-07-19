/**
 * Build GROUP BY aggregation SQL for pivot (flat records for VisActor PivotTable).
 */

import { quoteIdent, quoteTableExpr } from '@/lib/sql/countByColumn';

export type PivotAgg = 'count' | 'sum' | 'avg' | 'min' | 'max';

export type PivotMeasure = {
  field: string;
  agg: PivotAgg;
  /** Defaults to `${agg}_${field}` or `count_star` for COUNT(*). */
  alias?: string;
};

export type PivotConfig = {
  rows: string[];
  columns: string[];
  measures: PivotMeasure[];
  where?: string;
  /** Max result rows (default 5000). */
  limit?: number;
};

export type PivotSource =
  | { kind: 'table'; tableExpr: string; dialect: string }
  | { kind: 'subquery'; sourceSql: string; dialect: string };

export const DEFAULT_PIVOT_LIMIT = 5000;

export function measureAlias(m: PivotMeasure): string {
  if (m.alias && m.alias.trim()) return m.alias.trim();
  if (m.agg === 'count' && (!m.field || m.field === '*')) {
    return 'count_star';
  }
  const field = m.field && m.field !== '*' ? m.field : 'star';
  return `${m.agg}_${field}`;
}

export function measureTitle(m: PivotMeasure): string {
  if (m.alias && m.alias.trim()) return m.alias.trim();
  if (m.agg === 'count' && (!m.field || m.field === '*')) {
    return 'COUNT(*)';
  }
  const field = m.field && m.field !== '*' ? m.field : '*';
  return `${m.agg.toUpperCase()}(${field})`;
}

function buildAggExpr(m: PivotMeasure, dialect: string): string {
  const alias = quoteIdent(measureAlias(m), dialect);
  if (m.agg === 'count' && (!m.field || m.field === '*')) {
    return `COUNT(*) AS ${alias}`;
  }
  const col = quoteIdent(m.field, dialect);
  switch (m.agg) {
    case 'count':
      return `COUNT(${col}) AS ${alias}`;
    case 'sum':
      return `SUM(${col}) AS ${alias}`;
    case 'avg':
      return `AVG(${col}) AS ${alias}`;
    case 'min':
      return `MIN(${col}) AS ${alias}`;
    case 'max':
      return `MAX(${col}) AS ${alias}`;
    default: {
      const _exhaustive: never = m.agg;
      return _exhaustive;
    }
  }
}

export type PivotValidationError = {
  code:
    | 'no_measures'
    | 'no_dimensions'
    | 'empty_field'
    | 'duplicate_field'
    | 'overlap';
  message: string;
};

export function validatePivotConfig(
  config: PivotConfig,
): PivotValidationError | null {
  if (!config.measures?.length) {
    return { code: 'no_measures', message: 'At least one measure is required' };
  }
  if (!config.rows?.length && !config.columns?.length) {
    return {
      code: 'no_dimensions',
      message: 'At least one row or column dimension is required',
    };
  }

  const dimFields: string[] = [];
  for (const f of [...(config.rows ?? []), ...(config.columns ?? [])]) {
    if (!f || !f.trim()) {
      return { code: 'empty_field', message: 'Dimension field cannot be empty' };
    }
    dimFields.push(f);
  }

  const dimSet = new Set(dimFields);
  if (dimSet.size !== dimFields.length) {
    return {
      code: 'duplicate_field',
      message: 'Duplicate dimension fields are not allowed',
    };
  }

  const aliases = new Set<string>();
  for (const m of config.measures) {
    if (m.agg !== 'count' && (!m.field || !m.field.trim() || m.field === '*')) {
      return {
        code: 'empty_field',
        message: `${m.agg.toUpperCase()} requires a field`,
      };
    }
    if (m.field && m.field !== '*' && dimSet.has(m.field)) {
      return {
        code: 'overlap',
        message: `Measure field "${m.field}" cannot also be a dimension`,
      };
    }
    const a = measureAlias(m);
    if (aliases.has(a)) {
      return {
        code: 'duplicate_field',
        message: `Duplicate measure alias "${a}"`,
      };
    }
    aliases.add(a);
    if (dimSet.has(a)) {
      return {
        code: 'overlap',
        message: `Measure alias "${a}" conflicts with a dimension name`,
      };
    }
  }

  return null;
}

function fromClause(source: PivotSource): string {
  if (source.kind === 'table') {
    return quoteTableExpr(source.tableExpr, source.dialect);
  }
  const inner = source.sourceSql.trim().replace(/;+\s*$/, '');
  return `(${inner}) AS __pivot_src`;
}

export function buildPivotSql(
  config: PivotConfig,
  source: PivotSource,
): string {
  const err = validatePivotConfig(config);
  if (err) {
    throw new Error(err.message);
  }

  const dialect = source.dialect || 'generic';
  const dims = [...config.rows, ...config.columns];
  const selectDims = dims.map((f) => quoteIdent(f, dialect));
  const selectMeasures = config.measures.map((m) => buildAggExpr(m, dialect));
  const selectList = [...selectDims, ...selectMeasures].join(', ');
  const groupBy = dims.map((f) => quoteIdent(f, dialect)).join(', ');
  const from = fromClause(source);
  const where =
    config.where && config.where.trim().length > 0
      ? ` WHERE ${config.where.trim()}`
      : '';
  const lim = config.limit ?? DEFAULT_PIVOT_LIMIT;

  return (
    `SELECT ${selectList}` +
    ` FROM ${from}${where}` +
    ` GROUP BY ${groupBy}` +
    ` LIMIT ${lim}`
  );
}
