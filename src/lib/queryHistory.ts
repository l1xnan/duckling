/**
 * Query history helpers: normalize runs, summarize SQL, group by connection.
 */

import { msg } from '@lingui/core/macro';

import { i18n } from '@/i18n';

export type QueryHistoryItem = {
  id: string;
  type: 'query';
  dbId: string;
  schema?: string;
  tableId?: string;
  stmt: string;
  /** Wall-clock when the run was started / recorded. */
  createdAt: number;
  hasLimit?: boolean;
  /** Filled when the query finishes. */
  elapsed?: number;
  total?: number;
  code?: number;
  message?: string;
  /** Executed SQL if different from stmt (e.g. with limit). */
  sql?: string;
  displayName?: string;
};

/** Collapse whitespace and take a short one-line summary. */
export function summarizeSql(stmt: string, maxLen = 72): string {
  const oneLine = (stmt ?? '')
    .replace(/--[^\n]*/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!oneLine) {
    // Tests / early boot may not have activated a locale yet.
    return i18n.locale ? i18n._(msg`(empty)`) : '(empty)';
  }
  if (oneLine.length <= maxLen) return oneLine;
  return oneLine.slice(0, maxLen - 1) + '…';
}

/** Detect leading SQL verb for a badge (SELECT / INSERT / …). */
export function sqlVerb(stmt: string): string {
  let s = stmt ?? '';
  // Strip leading whitespace and line/block comments repeatedly.
  for (let i = 0; i < 8; i++) {
    const next = s
      .replace(/^\s+/, '')
      .replace(/^--[^\n]*\n?/, '')
      .replace(/^\/\*[\s\S]*?\*\//, '');
    if (next === s) break;
    s = next;
  }
  const m = s.trim().match(/^(\w+)/i);
  return (m?.[1] ?? 'SQL').toUpperCase();
}

export function formatElapsedMs(ms?: number): string {
  if (ms == null || Number.isNaN(ms)) return '—';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(2)}s`;
  const m = Math.floor(ms / 60_000);
  const s = ((ms % 60_000) / 1000).toFixed(1);
  return `${m}m ${s}s`;
}

export function formatRelativeTime(
  ts: number | undefined,
  now = Date.now(),
): string {
  if (!ts) return '';
  const diff = Math.max(0, now - ts);
  const sec = Math.floor(diff / 1000);
  if (!i18n.locale) {
    if (sec < 60) return `${sec}s ago`;
    const min0 = Math.floor(sec / 60);
    if (min0 < 60) return `${min0}m ago`;
    const hr0 = Math.floor(min0 / 60);
    if (hr0 < 24) return `${hr0}h ago`;
    const day0 = Math.floor(hr0 / 24);
    if (day0 < 7) return `${day0}d ago`;
    return new Date(ts).toLocaleDateString();
  }
  if (sec < 60) return i18n._(msg`${sec}s ago`);
  const min = Math.floor(sec / 60);
  if (min < 60) return i18n._(msg`${min}m ago`);
  const hr = Math.floor(min / 60);
  if (hr < 24) return i18n._(msg`${hr}h ago`);
  const day = Math.floor(hr / 24);
  if (day < 7) return i18n._(msg`${day}d ago`);
  return new Date(ts).toLocaleDateString();
}

export function formatAbsoluteTime(ts?: number): string {
  if (!ts) return '';
  return new Date(ts).toLocaleString();
}

/** Normalize legacy TabContext-shaped runs into QueryHistoryItem. */
export function normalizeHistoryItem(raw: unknown): QueryHistoryItem | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const stmt = String(r.stmt ?? r.sql ?? '').trim();
  if (!stmt && !r.id) return null;
  const id = String(r.id ?? `${r.dbId ?? 'unknown'}@${stmt.slice(0, 16)}`);
  return {
    id,
    type: 'query',
    dbId: String(r.dbId ?? ''),
    schema: r.schema != null ? String(r.schema) : undefined,
    tableId: r.tableId != null ? String(r.tableId) : undefined,
    stmt: String(r.stmt ?? r.sql ?? ''),
    createdAt:
      typeof r.createdAt === 'number'
        ? r.createdAt
        : typeof r.elapsed === 'number'
          ? Date.now()
          : Date.now(),
    hasLimit: r.hasLimit as boolean | undefined,
    elapsed: typeof r.elapsed === 'number' ? r.elapsed : undefined,
    total: typeof r.total === 'number' ? r.total : undefined,
    code: typeof r.code === 'number' ? r.code : undefined,
    message: r.message != null ? String(r.message) : undefined,
    sql: r.sql != null ? String(r.sql) : undefined,
    displayName: r.displayName != null ? String(r.displayName) : undefined,
  };
}

export function filterHistory(
  items: QueryHistoryItem[],
  query: string,
): QueryHistoryItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  return items.filter((item) => {
    const hay = [
      item.stmt,
      item.sql,
      item.displayName,
      item.message,
      item.dbId,
      item.schema,
      item.tableId,
      sqlVerb(item.stmt),
    ]
      .filter(Boolean)
      .join('\n')
      .toLowerCase();
    return hay.includes(q);
  });
}

export type HistoryGroup = {
  dbId: string;
  items: QueryHistoryItem[];
};

/** Group newest-first items by dbId; groups ordered by latest item time. */
export function groupHistoryByConnection(
  items: QueryHistoryItem[],
): HistoryGroup[] {
  const map = new Map<string, QueryHistoryItem[]>();
  for (const item of items) {
    const key = item.dbId || '__unknown__';
    const list = map.get(key);
    if (list) list.push(item);
    else map.set(key, [item]);
  }
  const groups: HistoryGroup[] = [...map.entries()].map(([dbId, list]) => ({
    dbId,
    items: [...list].sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0)),
  }));
  groups.sort(
    (a, b) => (b.items[0]?.createdAt ?? 0) - (a.items[0]?.createdAt ?? 0),
  );
  return groups;
}

export function isHistoryError(item: QueryHistoryItem): boolean {
  if (item.code != null && item.code !== 0) return true;
  if (item.message && /error|fail|cancel/i.test(item.message)) {
    // only treat as error if no successful total when code missing
    if (item.code == null && item.total != null && item.total >= 0) return false;
    return item.code == null ? true : item.code !== 0;
  }
  return false;
}
