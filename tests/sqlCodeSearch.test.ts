import { describe, expect, it } from 'vitest';

import {
  collectSqlFilePaths,
  filterSqlTree,
  textIncludesQuery,
} from '@/lib/sqlCodeSearch';
import type { TreeNode } from '@/types';

function file(name: string, path: string): TreeNode {
  return { name, path, type: 'sql' };
}

function dir(name: string, path: string, children: TreeNode[]): TreeNode {
  return { name, path, type: 'path', children };
}

const tree = dir('src', '/src', [
  file('orders.sql', '/src/orders.sql'),
  dir('nested', '/src/nested', [file('users.sql', '/src/nested/users.sql')]),
]);

describe('sql code search', () => {
  it('matches a file by name', () => {
    const filtered = filterSqlTree(tree, 'orders', new Set());
    expect(filtered?.children?.map((child) => child.name)).toEqual(['orders.sql']);
  });

  it('matches a file by content and keeps its parent', () => {
    const hits = new Set(['/src/nested/users.sql']);
    const filtered = filterSqlTree(tree, 'select id', hits);
    expect(filtered?.children?.map((child) => child.name)).toEqual(['nested']);
    expect(filtered?.children?.[0]?.children?.map((child) => child.path)).toEqual([
      '/src/nested/users.sql',
    ]);
  });

  it('matches names without regard to case', () => {
    expect(textIncludesQuery('Orders.SQL', 'orders')).toBe(true);
    const filtered = filterSqlTree(tree, 'ORDERS', new Set());
    expect(filtered?.children?.map((child) => child.name)).toEqual(['orders.sql']);
  });

  it('returns null when nothing matches', () => {
    expect(filterSqlTree(tree, 'missing', new Set())).toBeNull();
  });

  it('collects only file paths', () => {
    expect(collectSqlFilePaths(tree)).toEqual(['/src/orders.sql', '/src/nested/users.sql']);
  });
});
