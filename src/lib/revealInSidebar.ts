import type { ItemInstance, TreeInstance } from '@headless-tree/core';

import type { DBType } from '@/stores/dbList';
import type { TabContextType, TableContextType } from '@/stores/tabs';
import { DB_TREE_ROOT, buildDatabaseTreeData } from '@/lib/dbTreeData';
import type { Node3Type } from '@/utils';
import { convertTreeToMap } from '@/utils';

export type DbNodeTarget = {
  dbId: string;
  nodeId: string;
};

export function normalizeDbPath(path: string): string {
  const withoutUnc = path.replace(/^([/\\]{2}\?[\\/])/, '');
  const normalized = withoutUnc.replace(/\\/g, '/');
  return normalized.length > 1 ? normalized.replace(/\/+$/, '') : normalized;
}

type IndexedNode = {
  id: string;
  dbId: string;
  path: string;
};

function collectNodes(dbList: DBType[]): IndexedNode[] {
  const map = convertTreeToMap(buildDatabaseTreeData(dbList));
  return Object.values(map).map((n) => ({
    id: n.data.id,
    dbId: n.data.dbId,
    path: normalizeDbPath(n.data.path ?? ''),
  }));
}

function findExact(nodes: IndexedNode[], want: string): IndexedNode | null {
  return nodes.find((n) => n.path === want) ?? null;
}

function findExactCi(nodes: IndexedNode[], want: string): IndexedNode | null {
  const lower = want.toLowerCase();
  return nodes.find((n) => n.path.toLowerCase() === lower) ?? null;
}

/** Deepest node whose path is the file itself or an ancestor directory. */
function findDeepestAncestor(
  nodes: IndexedNode[],
  want: string,
): IndexedNode | null {
  const lower = want.toLowerCase();
  let best: IndexedNode | null = null;
  for (const n of nodes) {
    if (!n.path) {
      continue;
    }
    const p = n.path.toLowerCase();
    if (lower !== p && !lower.startsWith(`${p}/`)) {
      continue;
    }
    if (!best || n.path.length > best.path.length) {
      best = n;
    }
  }
  return best;
}

/**
 * Whether a tab can be revealed in the database explorer: opened tables and
 * file tabs. Editors, scratch SQL, and query/schema/search tabs have no
 * tree counterpart (or are intentionally excluded).
 */
export function isLocatableTab(
  tab: TabContextType | undefined | null,
): boolean {
  if (!tab) {
    return false;
  }
  if (tab.type === 'table') {
    return !!(tab as TableContextType).tableId;
  }
  if (tab.type === 'file') {
    return !!(tab as TableContextType).tableId;
  }
  return false;
}

/**
 * Map a tab to its database-tree node. Table tabs resolve by exact node id
 * first (inverse of the double-click handler), then by normalized path
 * within the same connection. File tabs are matched by normalized path across
 * all connections.
 */
export function resolveDbNodeTarget(
  tab: TabContextType,
  dbList: DBType[],
): DbNodeTarget | null {
  if (!isLocatableTab(tab)) {
    return null;
  }
  const nodes = collectNodes(dbList);

  if (tab.type === 'table') {
    const t = tab as TableContextType;
    const exact = `${t.dbId}:${t.tableId}`;
    if (nodes.some((n) => n.id === exact)) {
      return { dbId: t.dbId, nodeId: exact };
    }
    const sameDb = nodes.filter((n) => n.dbId === t.dbId);
    const want = normalizeDbPath(t.tableId);
    const hit = findExact(sameDb, want) ?? findExactCi(sameDb, want);
    return hit ? { dbId: t.dbId, nodeId: hit.id } : null;
  }

  if (tab.type !== 'file') {
    return null;
  }
  const rawPath = (tab as TableContextType).tableId;
  if (!rawPath) {
    return null;
  }
  const want = normalizeDbPath(rawPath);
  const hit =
    findExact(nodes, want) ??
    findExactCi(nodes, want) ??
    findDeepestAncestor(nodes, want);
  return hit ? { dbId: hit.dbId, nodeId: hit.id } : null;
}

export function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

/** Folder ancestors on the path from root to `nodeId` (from the flat tree map). */
export function ancestorFolderIds(
  data: Record<string, Node3Type>,
  nodeId: string,
  rootId: string = DB_TREE_ROOT,
): string[] {
  const ancestors: string[] = [];
  const walk = (currentId: string, path: string[]): boolean => {
    if (currentId === nodeId) {
      for (const id of path) {
        if (id !== rootId && (data[id]?.children?.length ?? 0) > 0) {
          ancestors.push(id);
        }
      }
      return true;
    }
    for (const childId of data[currentId]?.children ?? []) {
      if (walk(childId, [...path, currentId])) {
        return true;
      }
    }
    return false;
  };
  walk(rootId, []);
  return ancestors;
}

/**
 * Expand ancestors, wait for the virtual list to catch up, then select and scroll.
 */
export async function revealNodeInTree(
  tree: TreeInstance<Node3Type>,
  nodeId: string,
  data: Record<string, Node3Type>,
  scrollToIndex: (index: number) => void,
): Promise<ItemInstance<Node3Type>> {
  if (!data[nodeId]) {
    throw new Error('item not found');
  }

  const ancestors = ancestorFolderIds(data, nodeId);
  tree.applySubStateUpdate('expandedItems', (expanded) => {
    const set = new Set(expanded);
    for (const id of ancestors) {
      set.add(id);
    }
    return [...set];
  });
  tree.rebuildTree();
  await nextFrame();
  await nextFrame();

  const item = tree.getItemInstance(nodeId);
  tree.setSelectedItems([nodeId]);
  scrollToIndex(item.getItemMeta().index);
  await nextFrame();
  return item;
}
