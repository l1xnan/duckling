import { describe, expect, it } from 'vitest';

import {
  isBrowsablePathNode,
  isSyntheticSchemaPath,
} from '@/lib/treeNode';

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
