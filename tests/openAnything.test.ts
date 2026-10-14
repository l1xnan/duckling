import { describe, expect, it } from 'vitest';

import {
  buildOpenAnythingIndex,
  isAsciiSubsequence,
  rankOpenAnything,
  scoreOpenAnythingItem,
  type OpenAnythingItem,
} from '@/lib/openAnything';
import type { DBType } from '@/stores/dbList';
function makeDb(overrides: Partial<DBType> & Pick<DBType, 'id'>): DBType {
  return {
    id: overrides.id,
    dialect: overrides.dialect ?? 'duckdb',
    displayName: overrides.displayName ?? 'Local',
    data: overrides.data ?? {
      name: 'main',
      path: 'main',
      type: 'database',
      children: [
        {
          name: 'tables',
          path: 'main-tables',
          type: 'path',
          children: [
            {
              name: 'users',
              path: 'main.public.users',
              type: 'table',
            },
          ],
        },
        {
          name: 'views',
          path: 'main-views',
          type: 'path',
          children: [
            {
              name: 'active_users',
              path: 'main.public.active_users',
              type: 'view',
            },
          ],
        },
      ],
    },
    visibleDatabases: overrides.visibleDatabases,
  };
}

describe('openAnything', () => {
  it('indexes tables and views but skips synthetic folders', () => {
    const db = makeDb({ id: 'db1', displayName: 'Dev' });
    const items = buildOpenAnythingIndex({
      dbList: [db],
      favorites: [],
      bookmarks: [],
      scratchEditors: [],
      sqlFileTrees: [],
      defaultDbId: 'db1',
    });
    const kinds = items.map((i) => i.kind);
    expect(kinds).toContain('table');
    expect(kinds).toContain('view');
    expect(kinds).toContain('connection');
    expect(items.some((i) => i.name === 'users' && i.kind === 'table')).toBe(
      true,
    );
    expect(items.some((i) => i.searchPath.includes('main-tables'))).toBe(false);
  });

  it('respects visibleDatabases whitelist', () => {
    const db = makeDb({
      id: 'db1',
      data: {
        name: 'root',
        path: 'root',
        type: 'root',
        children: [
          { name: 'keep', path: 'keep', type: 'database', children: [] },
          { name: 'hide', path: 'hide', type: 'database', children: [] },
        ],
      },
      visibleDatabases: ['keep'],
    });
    const indexed = buildOpenAnythingIndex({
      dbList: [db],
      favorites: [],
      bookmarks: [],
      scratchEditors: [],
      sqlFileTrees: [],
      defaultDbId: 'db1',
    });
    expect(indexed.some((i) => i.name === 'hide')).toBe(false);
    expect(indexed.some((i) => i.name === 'keep')).toBe(true);
  });

  it('scores exact before prefix and substring', () => {
    const item: OpenAnythingItem = {
      id: 't1',
      kind: 'table',
      name: 'users',
      subtitle: '',
      searchPath: 'main.users',
      connectionName: 'Dev',
      payload: {
        kind: 'table',
        dbId: 'db1',
        nodeId: 'db1:main.users',
        path: 'main.users',
        displayName: 'users',
      },
    };
    expect(scoreOpenAnythingItem('users', item)).toBeGreaterThan(
      scoreOpenAnythingItem('use', item)!,
    );
    expect(scoreOpenAnythingItem('usr', item)).toBeGreaterThan(
      scoreOpenAnythingItem('zzz', item) ?? -1,
    );
    expect(scoreOpenAnythingItem('zzz', item)).toBeNull();
  });

  it('limits empty-query results per group', () => {
    const manyTables: OpenAnythingItem[] = Array.from({ length: 20 }, (_, i) => ({
      id: `t${i}`,
      kind: 'table' as const,
      name: `t${i}`,
      subtitle: '',
      searchPath: '',
      connectionName: '',
      payload: {
        kind: 'table',
        dbId: 'db1',
        nodeId: `id${i}`,
        path: `p${i}`,
        displayName: `t${i}`,
      },
    }));
    const ranked = rankOpenAnything(manyTables, '');
    expect(ranked.length).toBeLessThanOrEqual(5);
  });

  it('caps ranked search results', () => {
    const items: OpenAnythingItem[] = Array.from({ length: 200 }, (_, i) => ({
      id: `t${i}`,
      kind: 'table' as const,
      name: `table_${i}`,
      subtitle: '',
      searchPath: `path_${i}`,
      connectionName: '',
      payload: {
        kind: 'table',
        dbId: 'db1',
        nodeId: `id${i}`,
        path: `p${i}`,
        displayName: `table_${i}`,
      },
    }));
    const ranked = rankOpenAnything(items, 'table', 80);
    expect(ranked.length).toBe(80);
  });

  it('isAsciiSubsequence matches usr in users', () => {
    expect(isAsciiSubsequence('usr', 'users')).toBe(true);
    expect(isAsciiSubsequence('usr', 'orders')).toBe(false);
  });
});
