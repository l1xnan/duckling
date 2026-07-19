/**
 * Frontend mirror of connector Caps (connector/src/dialect/capabilities.rs).
 * Used for sync UI gating without an extra IPC round-trip.
 */

export type Capability =
  | 'query'
  | 'metadata'
  | 'paging'
  | 'export'
  | 'find'
  | 'drop_table'
  | 'execute'
  | 'table_browse';

const SQL_CORE: Capability[] = [
  'query',
  'metadata',
  'paging',
  'export',
  'table_browse',
];

/** Match Rust `caps_for_dialect`. */
export function capsForDialect(dialect: string | undefined | null): Set<Capability> {
  const d = (dialect ?? '').toLowerCase();
  let list: Capability[];
  switch (d) {
    case 'mysql':
    case 'postgres':
    case 'clickhouse':
    case 'quack':
      list = [...SQL_CORE];
      break;
    case 'duckdb':
      list = [...SQL_CORE, 'drop_table'];
      break;
    case 'sqlite':
      list = ['query', 'metadata', 'paging', 'export', 'table_browse'];
      break;
    case 'folder':
      list = [
        'query',
        'metadata',
        'paging',
        'export',
        'find',
        'drop_table',
        'table_browse',
      ];
      break;
    case 'file':
      list = ['query', 'paging', 'table_browse'];
      break;
    default:
      list = ['query'];
  }
  return new Set(list);
}

export function hasCapability(
  dialect: string | undefined | null,
  cap: Capability,
): boolean {
  return capsForDialect(dialect).has(cap);
}

export function canExport(dialect: string | undefined | null): boolean {
  return hasCapability(dialect, 'export');
}

export function canDropTable(dialect: string | undefined | null): boolean {
  return hasCapability(dialect, 'drop_table');
}

export function canFind(dialect: string | undefined | null): boolean {
  return hasCapability(dialect, 'find');
}

export function canMetadata(dialect: string | undefined | null): boolean {
  return hasCapability(dialect, 'metadata');
}

export function canTableBrowse(dialect: string | undefined | null): boolean {
  return hasCapability(dialect, 'table_browse');
}

/** Whether a non-zero ArrowResponse code should be treated as an error. */
export function isQueryErrorCode(code: number | undefined | null): boolean {
  return code != null && code !== 0;
}
