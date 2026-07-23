import type { DBType, DialectConfig, DialectType } from '@/stores/dbList';
import type { TabContextType } from '@/stores/tabs';

const FILE_LIKE_DIALECTS = new Set<DialectType>([
  'folder',
  'file',
  'duckdb',
  'sqlite',
]);

export function isFileLikeDialect(dialect?: string | null): boolean {
  return !!dialect && FILE_LIKE_DIALECTS.has(dialect as DialectType);
}

export function basenamePath(path: string): string {
  const normalized = path.replace(/\\/g, '/').replace(/\/+$/, '');
  if (!normalized) {
    return '';
  }
  const parts = normalized.split('/').filter(Boolean);
  if (parts.length === 0) {
    return '';
  }
  let base = parts[parts.length - 1] ?? '';
  // Avoid meaningless basenames
  if ((base === '.' || base === '') && parts.length >= 2) {
    base = parts[parts.length - 2] ?? base;
  }
  return base;
}

function configPath(config?: DialectConfig): string | undefined {
  if (!config || typeof config !== 'object') {
    return undefined;
  }
  const c = config as { cwd?: string; path?: string };
  const cwd = typeof c.cwd === 'string' ? c.cwd.trim() : '';
  const path = typeof c.path === 'string' ? c.path.trim() : '';
  return cwd || path || undefined;
}

/** Schema / database context for the focused tab + connection. */
export function resolveStatusSchema(
  tab: TabContextType | undefined,
  connection: DBType | undefined,
): string | undefined {
  if (tab && 'schema' in tab && typeof tab.schema === 'string') {
    const s = tab.schema.trim();
    if (s) {
      return s;
    }
  }
  // Schema browser tab: schema is required on SchemaContextType
  if (tab?.type === 'schema' && 'schema' in tab) {
    const s = String((tab as { schema?: string }).schema ?? '').trim();
    if (s) {
      return s;
    }
  }
  // Postgres-style tableId "schema.table" when schema field missing
  if (tab && 'tableId' in tab && typeof tab.tableId === 'string') {
    const tid = tab.tableId.trim();
    if (tid.includes('.') && !tid.includes('/') && !tid.includes('\\')) {
      const first = tid.split('.')[0]?.trim();
      if (first) {
        return first;
      }
    }
  }
  const defDb = connection?.defaultDatabase?.trim();
  if (defDb) {
    return defDb;
  }
  const defSchema = connection?.defaultSchema?.trim();
  if (defSchema) {
    return defSchema;
  }
  return undefined;
}

export function resolveStatusShortPath(
  connection: DBType | undefined,
): { short: string; full: string } | undefined {
  if (!connection || !isFileLikeDialect(connection.dialect)) {
    return undefined;
  }
  const full = configPath(connection.config);
  if (!full) {
    return undefined;
  }
  const short = basenamePath(full);
  if (!short) {
    return undefined;
  }
  return { short, full };
}

export type StatusBarLeftContext = {
  /** Segments joined with " · " for display */
  segments: string[];
  /** Full tooltip text */
  title: string;
};

/**
 * Build left status-bar context for the focused tab.
 * Empty segments → caller shows Ready.
 */
export function buildStatusBarLeft(
  tab: TabContextType | undefined,
  connection: DBType | undefined,
): StatusBarLeftContext {
  if (!connection && !tab?.dbId) {
    return { segments: [], title: '' };
  }

  const name =
    connection?.displayName?.trim() ||
    connection?.dialect ||
    (tab?.dbId ? tab.dbId.slice(0, 8) : '');
  const dialect = connection?.dialect?.trim() || '';

  const segments: string[] = [];
  if (name) {
    segments.push(name);
  }
  if (
    dialect &&
    name.toLowerCase() !== dialect.toLowerCase()
  ) {
    segments.push(dialect);
  } else if (dialect && segments.length === 0) {
    segments.push(dialect);
  }

  const schema = resolveStatusSchema(tab, connection);
  if (
    schema &&
    !segments.some((s) => s.toLowerCase() === schema.toLowerCase())
  ) {
    segments.push(schema);
  }

  const pathInfo = resolveStatusShortPath(connection);
  if (
    pathInfo &&
    !segments.some((s) => s.toLowerCase() === pathInfo.short.toLowerCase())
  ) {
    segments.push(pathInfo.short);
  }

  const titleParts = [
    connection?.displayName,
    dialect ? `dialect: ${dialect}` : undefined,
    schema ? `schema: ${schema}` : undefined,
    pathInfo ? pathInfo.full : undefined,
  ].filter(Boolean);

  return {
    segments,
    title: titleParts.join(' · '),
  };
}
