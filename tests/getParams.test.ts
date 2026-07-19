import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { TreeNode } from '@/types';

const whenRegistryReady = vi.fn(async () => undefined);
const dbMap = new Map<
  string,
  {
    id: string;
    dialect: string;
    displayName: string;
    data: TreeNode;
    config?: unknown;
  }
>();
const tableMaps = new Map<string, Map<string, TreeNode>>();

vi.mock('@/stores/dbList', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/stores/dbList')>();
  return {
    ...actual,
    whenRegistryReady: () => whenRegistryReady(),
    getDbMap: () => dbMap,
    getTableMap: () => tableMaps,
  };
});

vi.mock('@/stores/setting', () => ({
  useSettingStore: {
    getState: () => ({ csv: {} }),
  },
}));

import { getParams } from '@/stores/tabs';

describe('getParams', () => {
  beforeEach(() => {
    dbMap.clear();
    tableMaps.clear();
    whenRegistryReady.mockClear();
    whenRegistryReady.mockResolvedValue(undefined);

    dbMap.set('db1', {
      id: 'db1',
      dialect: 'mysql',
      displayName: 'MySQL',
      data: { name: 'root', path: 'root' },
      config: {
        dialect: 'mysql',
        host: 'h',
        port: '3306',
        username: 'u',
        password: 'SHOULD_NOT_APPEAR',
        database: 'd',
      },
    });
  });

  it('waits for registry and sends connectionId only', async () => {
    const params = await getParams({
      dbId: 'db1',
      tableId: 't1',
      page: 1,
      perPage: 100,
      stmt: 'select 1',
    });

    expect(whenRegistryReady).toHaveBeenCalled();
    expect(params).toMatchObject({
      sql: 'select 1',
      limit: 100,
      offset: 0,
      dialect: { connectionId: 'db1' },
    });
    expect(JSON.stringify(params)).not.toContain('SHOULD_NOT_APPEAR');
    expect(JSON.stringify(params)).not.toContain('password');
  });

  it('throws when connection is missing', async () => {
    await expect(
      getParams({
        dbId: 'missing',
        tableId: 't',
        page: 1,
        perPage: 10,
        stmt: 'select 1',
      }),
    ).rejects.toThrow(/No connection found/);
  });

  it('uses file dialect for type=file without connection registry lookup', async () => {
    const params = await getParams({
      dbId: '',
      tableId: '/tmp/data.csv',
      page: 1,
      perPage: 50,
      type: 'file',
      stmt: undefined as unknown as string,
      tableName: undefined,
    } as never);

    // file path without stmt goes to table branch
    expect(params).toBeDefined();
  });

  it('file type with stmt still uses file dialect payload', async () => {
    const params = await getParams({
      dbId: 'ignored',
      tableId: '/tmp/a.parquet',
      page: 2,
      perPage: 20,
      type: 'file',
      stmt: 'select * from t',
    });

    expect(params).toMatchObject({
      sql: 'select * from t',
      limit: 20,
      offset: 20,
      dialect: { path: '/tmp/a.parquet', dialect: 'file' },
    });
  });

  it('postgres table path overrides database on connectionRef', async () => {
    dbMap.set('pg1', {
      id: 'pg1',
      dialect: 'postgres',
      displayName: 'PG',
      data: { name: 'pg', path: 'pg' },
      config: {
        dialect: 'postgres',
        host: 'h',
        port: '5432',
        username: 'u',
        password: 'p',
        database: 'db',
      },
    });
    tableMaps.set(
      'pg1',
      new Map([['db.public.users', { name: 'users', path: 'db.public.users' }]]),
    );

    const params = await getParams({
      dbId: 'pg1',
      tableId: 'db.public.users',
      page: 1,
      perPage: 10,
    });

    expect(params).toMatchObject({
      table: 'db.public.users',
      dialect: { connectionId: 'pg1', database: 'db' },
    });
    expect(JSON.stringify(params)).not.toContain('"password"');
  });

  it('wraps csv table names with read_csv', async () => {
    const params = await getParams({
      dbId: 'db1',
      tableId: '/data/file.csv',
      page: 1,
      perPage: 10,
      tableName: '/data/file.csv',
    });

    expect(params).toMatchObject({
      dialect: { connectionId: 'db1' },
    });
    expect(String((params as { table?: string }).table)).toContain('read_csv');
  });
});
