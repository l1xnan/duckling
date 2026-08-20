import type { NodeElementType } from '@/types';

export function isSyntheticSchemaPath(path: string | undefined): boolean {
  if (!path) return false;
  return (
    path.endsWith('-tables') ||
    path.endsWith('-views') ||
    path.endsWith('-files')
  );
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
