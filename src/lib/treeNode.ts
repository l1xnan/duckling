import type { NodeElementType, TreeNode } from '@/types';

export function isSyntheticSchemaPath(path: string | undefined): boolean {
  if (!path) return false;
  return (
    path.endsWith('-tables') ||
    path.endsWith('-views') ||
    path.endsWith('-files')
  );
}

/**
 * Copy of `tree` without the node at `path` (and its subtree), so a delete can
 * be reflected before the backend list is fetched again. A `path` matching the
 * root keeps the root itself and only drops its children.
 */
export function removeTreeNode(tree: TreeNode, path: string): TreeNode {
  if (tree.path === path) {
    return { ...tree, children: [] };
  }
  if (!tree.children?.length) {
    return tree;
  }

  return {
    ...tree,
    children: tree.children
      .filter((child) => child.path !== path)
      .map((child) => removeTreeNode(child, path)),
  };
}

export function isBrowsablePathNode(
  node: Pick<NodeElementType, 'type' | 'path'>,
  dialect: string,
): boolean {
  if (node.type !== 'path') return false;
  if (dialect === 'folder') return true;
  if (dialect === 'quack') return !isSyntheticSchemaPath(node.path);
  return false;
}
