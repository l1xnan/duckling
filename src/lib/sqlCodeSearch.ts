import type { TreeNode } from '@/types';

export function normalizeSqlPath(path: string): string {
  return path.replace(/\\/g, '/').replace(/\/+$/, '');
}

export function textIncludesQuery(text: string, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) {
    return true;
  }
  return text.toLowerCase().includes(needle);
}

function isDir(node: TreeNode): boolean {
  return node.type === 'path' || (node.children?.length ?? 0) > 0;
}

export function collectSqlFilePaths(node: TreeNode): string[] {
  if (isDir(node)) {
    return (node.children ?? []).flatMap(collectSqlFilePaths);
  }
  return node.path ? [normalizeSqlPath(node.path)] : [];
}

/** Keep nodes whose name or content matches, plus directories that contain a match. */
export function filterSqlTree(
  node: TreeNode,
  query: string,
  contentHits: ReadonlySet<string>,
): TreeNode | null {
  const needle = query.trim().toLowerCase();
  if (!needle) {
    return node;
  }
  const nameMatch = node.name.toLowerCase().includes(needle);
  if (!isDir(node)) {
    const contentMatch = contentHits.has(normalizeSqlPath(node.path));
    return nameMatch || contentMatch ? node : null;
  }
  const children = (node.children ?? [])
    .map((child) => filterSqlTree(child, needle, contentHits))
    .filter((child): child is TreeNode => child != null);
  if (nameMatch || children.length > 0) {
    return { ...node, children };
  }
  return null;
}
