import { describe, expect, it } from 'vitest';

import {
  basenamePath,
  buildStatusBarLeft,
  isFileLikeDialect,
  resolveStatusSchema,
  resolveStatusShortPath,
} from '@/lib/statusBarContext';
import type { DBType } from '@/stores/dbList';
import type { TabContextType } from '@/stores/tabs';

function db(partial: Partial<DBType> & Pick<DBType, 'id' | 'dialect'>): DBType {
  return {
    displayName: partial.displayName ?? partial.dialect,
    data: { name: 'x', path: 'x', type: 'database' },
    ...partial,
  } as DBType;
}

describe('statusBarContext', () => {
  it('basenamePath uses last segment', () => {
    expect(basenamePath('D:/data/warehouse/2024')).toBe('2024');
    expect(basenamePath('C:\\Users\\me\\app.db')).toBe('app.db');
    expect(basenamePath('/home/u/project/')).toBe('project');
  });

  it('isFileLikeDialect', () => {
    expect(isFileLikeDialect('duckdb')).toBe(true);
    expect(isFileLikeDialect('folder')).toBe(true);
    expect(isFileLikeDialect('mysql')).toBe(false);
  });

  it('resolveStatusSchema prefers tab.schema then defaultDatabase', () => {
    const conn = db({
      id: 'c1',
      dialect: 'postgres',
      defaultDatabase: 'appdb',
    });
    expect(
      resolveStatusSchema(
        {
          id: 't1',
          dbId: 'c1',
          type: 'editor',
          displayName: 'e',
          schema: 'public',
        },
        conn,
      ),
    ).toBe('public');
    expect(
      resolveStatusSchema(
        { id: 't1', dbId: 'c1', type: 'editor', displayName: 'e' },
        conn,
      ),
    ).toBe('appdb');
  });

  it('resolveStatusSchema splits postgres-style tableId', () => {
    expect(
      resolveStatusSchema(
        {
          id: 't1',
          dbId: 'c1',
          type: 'table',
          displayName: 'orders',
          tableId: 'public.orders',
        } as TabContextType,
        db({ id: 'c1', dialect: 'postgres' }),
      ),
    ).toBe('public');
  });

  it('resolveStatusShortPath for file-like connections', () => {
    expect(
      resolveStatusShortPath(
        db({
          id: 'c1',
          dialect: 'duckdb',
          config: { path: 'D:/data/sales.duckdb', dialect: 'duckdb' },
        }),
      ),
    ).toEqual({ short: 'sales.duckdb', full: 'D:/data/sales.duckdb' });
    expect(
      resolveStatusShortPath(
        db({
          id: 'c1',
          dialect: 'mysql',
          config: { path: '/nope', dialect: 'mysql' } as never,
        }),
      ),
    ).toBeUndefined();
  });

  it('buildStatusBarLeft joins unique segments', () => {
    const left = buildStatusBarLeft(
      {
        id: 't1',
        dbId: 'c1',
        type: 'table',
        displayName: 'orders',
        tableId: 'public.orders',
        schema: 'public',
      } as TabContextType,
      db({
        id: 'c1',
        dialect: 'postgres',
        displayName: 'prod',
      }),
    );
    expect(left.segments).toEqual(['prod', 'postgres', 'public']);
  });

  it('buildStatusBarLeft dedupes name===dialect', () => {
    const left = buildStatusBarLeft(
      { id: 't1', dbId: 'c1', type: 'editor', displayName: 'e' },
      db({ id: 'c1', dialect: 'mysql', displayName: 'mysql' }),
    );
    expect(left.segments).toEqual(['mysql']);
  });

  it('buildStatusBarLeft empty without connection', () => {
    expect(buildStatusBarLeft(undefined, undefined).segments).toEqual([]);
  });
});
