import { describe, expect, it } from 'vitest';

import {
  isBrowsablePathNode,
  isSyntheticSchemaPath,
  removeTreeNode,
} from '@/lib/treeNode';
import type { TreeNode } from '@/types';

describe('treeNode', () => {
  it('detects synthetic schema grouping paths', () => {
    expect(isSyntheticSchemaPath('conn-1-tables')).toBe(true);
    expect(isSyntheticSchemaPath('conn-1-views')).toBe(true);
    expect(isSyntheticSchemaPath('quack:host-files')).toBe(true);
    expect(isSyntheticSchemaPath('data/project_a')).toBe(false);
  });

  it('allows quack file tree directories for context menu', () => {
    const node = { type: 'path', path: 'data/project_a' } as const;
    expect(isBrowsablePathNode(node, 'quack')).toBe(true);
    expect(isBrowsablePathNode(node, 'folder')).toBe(true);
    expect(isBrowsablePathNode(node, 'postgres')).toBe(false);
    expect(
      isBrowsablePathNode(
        { type: 'path', path: 'quack:host-files' },
        'quack',
      ),
    ).toBe(false);
  });
});

describe('removeTreeNode', () => {
  const tree: TreeNode = {
    name: 'data',
    path: 'D:/data',
    children: [
      { name: 'a.csv', path: 'D:/data/a.csv' },
      {
        name: 'nested',
        path: 'D:/data/nested',
        children: [{ name: 'b.parquet', path: 'D:/data/nested/b.parquet' }],
      },
    ],
  };

  it('drops the matching node and keeps its siblings', () => {
    const next = removeTreeNode(tree, 'D:/data/a.csv');

    expect(next.children?.map((child) => child.path)).toEqual([
      'D:/data/nested',
    ]);
    expect(tree.children).toHaveLength(2);
  });

  it('drops nested nodes together with their subtree', () => {
    const next = removeTreeNode(tree, 'D:/data/nested');

    expect(next.children?.map((child) => child.path)).toEqual([
      'D:/data/a.csv',
    ]);
  });

  it('keeps every node when the path is absent', () => {
    const next = removeTreeNode(tree, 'D:/data/missing.csv');

    expect(next.children?.map((child) => child.path)).toEqual([
      'D:/data/a.csv',
      'D:/data/nested',
    ]);
  });

  it('keeps the root node when its own path is removed', () => {
    const next = removeTreeNode(tree, 'D:/data');

    expect(next.path).toBe('D:/data');
    expect(next.children).toEqual([]);
  });
});
