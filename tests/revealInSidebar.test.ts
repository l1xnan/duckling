import { beforeEach, describe, expect, it } from 'vitest';

import type { DBType } from '@/stores/dbList';
import type { QueryContextType, TabContextType } from '@/stores/tabs';
import { useQuerySessionStore } from '@/stores/querySession';
import type { TreeNode } from '@/types';
import { DB_TREE_ROOT } from '@/lib/dbTreeData';
import {
  ancestorFolderIds,
  isLocatableTab,
  normalizeDbPath,
  resolveDbNodeTarget,
} from '@/lib/revealInSidebar';
import { convertId, convertTreeToMap } from '@/utils';
import { getEffectiveTab } from '@/stores/reveal';

function node(
  name: string,
  path: string,
  type: string,
  children: TreeNode[] = [],
): TreeNode {
  return { name, path, type, children };
}

function dbList(): DBType[] {
  return [
    {
      id: 'db1',
      dialect: 'postgres',
      displayName: 'db1',
      data: node('db1', 'db1', 'database', [
        node('public', 'db1.public', 'schema', [
          node('users', 'db1.public.users', 'table', [
            node('id', 'db1.public.users.id', 'column'),
          ]),
        ]),
      ]),
    },
    {
      id: 'folder1',
      dialect: 'folder',
      displayName: 'sql',
      data: node('sql', 'D:/sql', 'path', [
        node('q.sql', 'D:/sql/q.sql', 'file'),
      ]),
    },
  ];
}

function tableTab(overrides = {}): TabContextType {
  return {
    id: 'db1:db1.public.users',
    dbId: 'db1',
    tableId: 'db1.public.users',
    displayName: 'users',
    type: 'table',
    ...overrides,
  } as TabContextType;
}

describe('normalizeDbPath', () => {
  it('converts backslashes and strips trailing slashes', () => {
    expect(normalizeDbPath('D:\\sql\\q.sql')).toBe('D:/sql/q.sql');
    expect(normalizeDbPath('db1.public.users/')).toBe('db1.public.users');
    expect(normalizeDbPath('/')).toBe('/');
  });

  it('strips extended-length path prefixes', () => {
    expect(normalizeDbPath('\\\\?\\D:\\sql\\q.sql')).toBe('D:/sql/q.sql');
  });
});

describe('isLocatableTab', () => {
  it('accepts table tabs with a tableId', () => {
    expect(isLocatableTab(tableTab())).toBe(true);
    expect(isLocatableTab(tableTab({ tableId: '' }))).toBe(false);
  });

  it('accepts file tabs with a path', () => {
    expect(
      isLocatableTab({
        id: 'f',
        dbId: ':memory:',
        tableId: 'D:/sql/q.sql',
        displayName: 'q.sql',
        type: 'file',
      } as TabContextType),
    ).toBe(true);
  });

  it('rejects editor tabs and query/schema/search tabs', () => {
    expect(
      isLocatableTab({
        id: 'D:/sql/q.sql',
        dbId: 'db1',
        displayName: 'q.sql',
        type: 'editor',
        path: 'D:/sql/q.sql',
      } as TabContextType),
    ).toBe(false);
    expect(
      isLocatableTab({
        id: 's',
        dbId: '',
        displayName: 'scratch',
        type: 'editor',
      } as TabContextType),
    ).toBe(false);
    for (const type of ['query', 'schema', 'search', 'pivot']) {
      expect(
        isLocatableTab({ id: 'x', dbId: 'db1', displayName: 'x', type } as TabContextType),
      ).toBe(false);
    }
    expect(isLocatableTab(null)).toBe(false);
    expect(isLocatableTab(undefined)).toBe(false);
  });
});

describe('ancestorFolderIds', () => {
  it('returns folders on the path to a nested table', () => {
    const root = {
      id: DB_TREE_ROOT,
      children: dbList().map((db) => {
        const treeData = convertId(db.data, db.id, db.displayName);
        return { ...treeData, icon: db.dialect };
      }),
    };
    const map = convertTreeToMap(root as Parameters<typeof convertTreeToMap>[0]);
    expect(ancestorFolderIds(map, 'db1:db1.public.users')).toEqual([
      'db1:db1',
      'db1:db1.public',
    ]);
  });
});

describe('resolveDbNodeTarget', () => {
  it('resolves table tabs by exact node id', () => {
    expect(resolveDbNodeTarget(tableTab(), dbList())).toEqual({
      dbId: 'db1',
      nodeId: 'db1:db1.public.users',
    });
  });

  it('falls back to normalized path within the same connection', () => {
    const target = resolveDbNodeTarget(
      tableTab({ tableId: 'db1.public.users/' }),
      dbList(),
    );
    expect(target).toEqual({ dbId: 'db1', nodeId: 'db1:db1.public.users' });
  });

  it('resolves file tabs by path across connections', () => {
    expect(
      resolveDbNodeTarget(
        {
          id: 'f',
          dbId: ':memory:',
          tableId: 'D:\\sql\\q.sql',
          displayName: 'q.sql',
          type: 'file',
        } as TabContextType,
        dbList(),
      ),
    ).toEqual({ dbId: 'folder1', nodeId: 'folder1:D:/sql/q.sql' });
  });

  it('matches paths case-insensitively', () => {
    expect(
      resolveDbNodeTarget(
        {
          id: 'f',
          dbId: ':memory:',
          tableId: 'd:/SQL/Q.SQL',
          displayName: 'q.sql',
          type: 'file',
        } as TabContextType,
        dbList(),
      ),
    ).toEqual({ dbId: 'folder1', nodeId: 'folder1:D:/sql/q.sql' });
  });

  it('falls back to the deepest ancestor folder node', () => {
    expect(
      resolveDbNodeTarget(
        {
          id: 'f',
          dbId: ':memory:',
          tableId: 'D:/sql/notes.txt',
          displayName: 'notes.txt',
          type: 'file',
        } as TabContextType,
        dbList(),
      ),
    ).toEqual({ dbId: 'folder1', nodeId: 'folder1:D:/sql' });
  });

  it('returns null when nothing matches', () => {
    expect(
      resolveDbNodeTarget(tableTab({ tableId: 'db1.nope' }), dbList()),
    ).toBeNull();
    expect(
      resolveDbNodeTarget(
        {
          id: 'f',
          dbId: ':memory:',
          tableId: 'E:/elsewhere/a.parquet',
          displayName: 'a.parquet',
          type: 'file',
        } as TabContextType,
        dbList(),
      ),
    ).toBeNull();
    expect(
      resolveDbNodeTarget(
        {
          id: 's',
          dbId: '',
          displayName: 'scratch',
          type: 'editor',
        } as TabContextType,
        dbList(),
      ),
    ).toBeNull();
  });
});

describe('getEffectiveTab', () => {
  const editor = {
    id: 'D:/sql/q.sql',
    dbId: 'db1',
    displayName: 'q.sql',
    type: 'editor',
    path: 'D:/sql/q.sql',
  } as TabContextType;

  beforeEach(() => {
    useQuerySessionStore.setState({ byEditor: {} });
  });

  it('returns the tab itself when no result is active', () => {
    expect(getEffectiveTab(editor, null)).toBe(editor);
    expect(getEffectiveTab(editor, undefined)).toBe(editor);
    const table = tableTab();
    expect(getEffectiveTab(table, null)).toBe(table);
  });

  it('resolves to the active query child', () => {
    const { appendChild, setActiveKey } = useQuerySessionStore.getState();
    const child = {
      id: 'D:/sql/q.sql@abc',
      dbId: 'db1',
      displayName: 'Result 1',
      type: 'query',
      stmt: 'select 1',
    } as QueryContextType;
    appendChild('D:/sql/q.sql', child);
    setActiveKey('D:/sql/q.sql', child.id);
    const effective = getEffectiveTab(editor, child.id);
    expect(effective).toMatchObject({ id: child.id, type: 'query' });
    expect(isLocatableTab(effective)).toBe(false);
  });

  it('falls back to the editor when the key points nowhere', () => {
    expect(getEffectiveTab(editor, 'missing')).toBe(editor);
    expect(isLocatableTab(editor)).toBe(false);
  });
});
